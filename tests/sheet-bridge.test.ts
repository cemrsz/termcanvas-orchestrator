import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

/** Minimal in-memory stand-ins for the Apps Script services the bridge uses. */
function fakeSpreadsheet(tabs: Record<string, string[][]>) {
  const makeSheet = (name: string) => {
    const grid = tabs[name];
    const width = () => Math.max(0, ...grid.map((row) => row.length));
    const cell = (r: number, c: number) => grid[r]?.[c] ?? "";
    const range = (row: number, col: number, rows: number, cols: number) => ({
      getDisplayValues: () =>
        Array.from({ length: rows }, (_, r) =>
          Array.from({ length: cols }, (_, c) => String(cell(row - 1 + r, col - 1 + c))),
        ),
      setValues: (values: unknown[][]) => {
        values.forEach((line, r) =>
          line.forEach((value, c) => {
            const rr = row - 1 + r;
            while (grid.length <= rr) grid.push([]);
            grid[rr][col - 1 + c] = String(value);
          }),
        );
      },
      setValue: (value: unknown) => {
        while (grid.length <= row - 1) grid.push([]);
        grid[row - 1][col - 1] = String(value);
      },
    });
    return {
      getName: () => name,
      getLastColumn: () => width(),
      getLastRow: () => grid.length,
      getRange: range,
      getDataRange: () => range(1, 1, grid.length, width()),
    };
  };
  const sheets = Object.fromEntries(Object.keys(tabs).map((name) => [name, makeSheet(name)]));
  return {
    getSheetByName: (name: string) => sheets[name] ?? null,
    getSheets: () => Object.values(sheets),
  };
}

function loadBridge(tabs: Record<string, string[][]>) {
  const source = fs
    .readFileSync(path.join(import.meta.dirname, "..", "integrations", "google-sheets", "termcanvas-sheet-bridge.gs"), "utf-8")
    .replace('var TOKEN = "CHANGE-ME-TO-A-LONG-RANDOM-STRING";', 'var TOKEN = "secret-token";');
  const spreadsheet = fakeSpreadsheet(tabs);
  const context = vm.createContext({
    SpreadsheetApp: { getActiveSpreadsheet: () => spreadsheet },
    LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
    ContentService: {
      MimeType: { JSON: "json" },
      createTextOutput: (text: string) => ({ setMimeType: () => text }),
    },
    JSON,
  });
  vm.runInContext(source, context);
  const post = (body: unknown, token = "secret-token") =>
    JSON.parse(
      (context as any).doPost({ parameter: { token }, postData: { contents: JSON.stringify(body) } }),
    );
  return { post, tabs };
}

test("sheet bridge reads, appends and updates rows by header", () => {
  const { post, tabs } = loadBridge({
    Leads: [
      ["email", "name", "status"],
      ["a@x.io", "Ada", "Pending"],
      ["b@x.io", "Bo", "Sent"],
    ],
  });

  assert.deepEqual(post({ action: "read", where: { status: "pending" } }), {
    ok: true,
    tab: "Leads",
    count: 1,
    rows: [{ email: "a@x.io", name: "Ada", status: "Pending" }],
  });

  const appended = post({ action: "append", tab: "Leads", rows: [{ email: "c@x.io", status: "New", score: 7 }] });
  assert.equal(appended.count, 1);
  assert.deepEqual(appended.addedColumns, ["score"]);
  assert.deepEqual(tabs.Leads[0], ["email", "name", "status", "score"]);
  assert.deepEqual(tabs.Leads[3], ["c@x.io", "", "New", "7"]);

  const updated = post({
    action: "update",
    key: "email",
    rows: [{ email: "a@x.io", status: "Contacted" }, { email: "zz@x.io", status: "?" }],
  });
  assert.equal(updated.updated, 1);
  assert.deepEqual(updated.missing, ["zz@x.io"]);
  assert.deepEqual(tabs.Leads[1], ["a@x.io", "Ada", "Contacted"]);

  const upserted = post({ action: "upsert", key: "email", rows: [{ email: "d@x.io", name: "Di" }] });
  assert.equal(upserted.appended, 1);
  assert.equal(tabs.Leads[4][0], "d@x.io");
});

test("sheet bridge refuses a wrong token and unknown tabs", () => {
  const { post } = loadBridge({ Leads: [["email"]] });
  assert.deepEqual(post({ action: "read" }, "nope"), { ok: false, error: "Invalid token" });
  assert.equal(post({ action: "read", tab: "Missing" }).error, "No tab named Missing");
  assert.equal(post({ action: "update", rows: [] }).error, "update needs a key column");
});
