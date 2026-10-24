import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { TeamApi, matchTeamRoute } from "../electron/team-api.ts";
import { TeamHub } from "../electron/team-hub.ts";
import { writeAgentWorkspace } from "../electron/team-bridge.ts";
import type { TeamDirectory, TeamMemberInfo } from "../shared/team.ts";

const run = promisify(execFile);

interface Harness {
  repo: string;
  writes: { ptyId: number; data: string }[];
  bridgeCalls: unknown[];
  delivered: { to: string; text: string }[];
  turnStates: Record<string, string>;
  hub: TeamHub;
  tc: (agent: string, ...args: string[]) => Promise<{ stdout: string; stderr: string; code: number }>;
  /** Run one agent's tool from another agent's terminal. */
  tcAs: (caller: string, agent: string, ...args: string[]) => Promise<{ stdout: string; stderr: string; code: number }>;
  close: () => void;
}

async function harness(): Promise<Harness> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tc-team-api-"));
  const repo = path.join(root, "repo");
  fs.mkdirSync(repo);
  const portFile = path.join(root, "port");
  const writes: { ptyId: number; data: string }[] = [];
  const bridgeCalls: unknown[] = [];
  const delivered: { to: string; text: string }[] = [];
  const turnStates: Record<string, string> = {};

  // Stand-in for the Apps Script / n8n sheet bridge.
  const bridge = http.createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      const payload = JSON.parse(body);
      bridgeCalls.push(payload);
      res.setHeader("Content-Type", "application/json");
      if (payload.action === "read") {
        res.end(JSON.stringify({ ok: true, tab: "Leads", rows: [{ email: "a@b.c", status: "Pending" }] }));
      } else {
        res.end(JSON.stringify({ ok: true, count: payload.rows.length }));
      }
    });
  });
  await new Promise<void>((resolve) => bridge.listen(0, "127.0.0.1", resolve));
  const bridgePort = (bridge.address() as { port: number }).port;

  const hub = new TeamHub({
    dataDir: path.join(root, "team"),
    getTurnState: (id) => turnStates[id] ?? "turn_complete",
    isPtyAlive: () => true,
    deliver: async (m, text) => {
      delivered.push({ to: m.id, text });
    },
    writeWorkspace: (m, role) =>
      writeAgentWorkspace({ terminalId: m.id, worktreePath: m.worktreePath, portFile, role }),
  });
  const member = (id: string, name: string, ptyId: number): TeamMemberInfo => ({
    id, name, type: "claude", worktreePath: repo, project: "repo", ptyId, status: "running",
  });
  const directory: TeamDirectory = {
    managerIds: ["lead"],
    members: [member("lead", "Lead", 1), member("w1", "Writer", 2), member("w2", "Data", 3)],
    sources: [
      {
        id: "sheet-1",
        kind: "sheet",
        name: "Leads",
        url: "https://docs.google.com/spreadsheets/d/abc/edit",
        writeUrl: `http://127.0.0.1:${bridgePort}/exec`,
        description: "email, status",
      },
    ],
    links: [
      { orchestratorId: "lead", targetKind: "terminal", targetId: "w1" },
      { orchestratorId: "lead", targetKind: "terminal", targetId: "w2" },
      { orchestratorId: "lead", targetKind: "source", targetId: "sheet-1" },
    ],
    lang: "en",
  };
  hub.setDirectory(directory);

  const teamApi = new TeamApi({
    hub,
    ptyManager: {
      getPid: () => 4242,
      write: (ptyId: number, data: string) => writes.push({ ptyId, data }),
      getOutput: () => ["(screen)"],
    } as never,
    telemetryService: {
      getTerminalSnapshot: () => ({ turn_state: "turn_complete" }),
    } as never,
  });
  // The same request handling ApiServer does for /team routes.
  const api = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", async () => {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      const route = matchTeamRoute(url.pathname);
      res.setHeader("Content-Type", "application/json");
      try {
        if (!route) throw Object.assign(new Error("Not found"), { status: 404 });
        const result = await teamApi.handle(
          req.method ?? "GET", route.agentId, route.action, url, raw ? JSON.parse(raw) : undefined,
        );
        res.end(JSON.stringify(result));
      } catch (err) {
        res.statusCode = (err as { status?: number }).status ?? 500;
        res.end(JSON.stringify({ error: (err as Error).message }));
      }
    });
  });
  await new Promise<void>((resolve) => api.listen(0, "127.0.0.1", resolve));
  const port = (api.address() as { port: number }).port;
  fs.writeFileSync(portFile, String(port));

  const tcEnv = async (caller: string | null, agent: string, ...args: string[]) => {
    const env = { ...process.env };
    delete env.TERMCANVAS_TERMINAL_ID;
    if (caller) env.TERMCANVAS_TERMINAL_ID = caller;
    try {
      const { stdout, stderr } = await run(
        process.execPath,
        [path.join(repo, ".termcanvas", "agent", agent, "tc.mjs"), ...args],
        { cwd: repo, env },
      );
      return { stdout, stderr, code: 0 };
    } catch (err) {
      const e = err as { stdout: string; stderr: string; code: number };
      return { stdout: e.stdout, stderr: e.stderr, code: e.code };
    }
  };
  const tc = (agent: string, ...args: string[]) => tcEnv(null, agent, ...args);
  const tcAs = (caller: string, agent: string, ...args: string[]) => tcEnv(caller, agent, ...args);
  return {
    repo,
    writes,
    bridgeCalls,
    delivered,
    turnStates,
    hub,
    tc,
    tcAs,
    close: () => {
      api.close();
      bridge.close();
    },
  };
}

test("tc.mjs drives a team end to end over the API", async (t) => {
  const h = await harness();
  t.after(() => h.close());

  assert.ok(fs.existsSync(path.join(h.repo, ".termcanvas", "agent", "w1", "AGENT.md")));
  assert.match(
    fs.readFileSync(path.join(h.repo, ".termcanvas", "agent", "lead", "AGENT.md"), "utf-8"),
    /Final report/,
  );
  assert.doesNotMatch(
    fs.readFileSync(path.join(h.repo, ".termcanvas", "agent", "w1", "AGENT.md"), "utf-8"),
    /As a manager/,
  );

  const status = await h.tc("w2", "status");
  assert.equal(status.code, 0, status.stderr);
  assert.match(status.stdout, /You: Data/);
  assert.match(status.stdout, /Manager: Lead/);
  assert.match(status.stdout, /- Writer/);
  assert.match(status.stdout, /S1\. Leads +\[sheet\].*writable/);

  assert.equal((await h.tc("w2", "say", "Reading the lead list")).code, 0);
  const leadStatus = await h.tc("lead", "status");
  assert.match(leadStatus.stdout, /Data .*doing: Reading the lead list/);

  const send = await h.tc("lead", "send", "Writer", "Draft three subject lines");
  assert.equal(send.code, 0, send.stderr);
  const typed = h.writes.filter((w) => w.ptyId === 2).map((w) => w.data).join("");
  assert.match(typed, /\[TermCanvas · task from Lead to you \(Writer\)\]/);
  assert.match(typed, /Draft three subject lines/);

  const refused = await h.tc("w1", "send", "Data", "do my job");
  assert.notEqual(refused.code, 0);
  assert.match(refused.stderr, /Only managers send tasks/);

  assert.equal((await h.tc("w1", "msg", "Data", "Which leads are Pending?")).code, 0);
  // Data is idle, so the message goes straight in.
  assert.equal(h.delivered.length, 1);
  assert.equal(h.delivered[0].to, "w2");
  assert.match(h.delivered[0].text, /message from Writer\]/);

  assert.equal((await h.tc("w1", "post", "Tone: friendly, short")).code, 0);
  assert.match((await h.tc("w2", "board")).stdout, /Writer: Tone: friendly, short/);

  const read = await h.tc("w2", "sheet", "Leads", "read", "--where", "status=Pending");
  assert.equal(read.code, 0, read.stderr);
  assert.match(read.stdout, /"email":"a@b.c"/);
  const update = await h.tc(
    "w2", "sheet", "S1", "update", "--key", "email",
    "--rows", JSON.stringify([{ email: "a@b.c", status: "Contacted" }]),
  );
  assert.equal(update.code, 0, update.stderr);
  assert.deepEqual(h.bridgeCalls.at(-1), {
    action: "update",
    key: "email",
    rows: [{ email: "a@b.c", status: "Contacted" }],
  });
  const noKey = await h.tc("w2", "sheet", "S1", "update", "--rows", "[]");
  assert.match(noKey.stderr, /needs --key/);

  const log = await h.tc("lead", "log", "--since", "1h");
  assert.match(log.stdout, /Data: Reading the lead list/);
  assert.match(log.stdout, /Lead: → Writer: Draft three subject lines/);
  assert.match(log.stdout, /Data: Updated 1 rows in Leads/);

  const reportFile = path.join(h.repo, "r.md");
  fs.writeFileSync(reportFile, "# Weekly\n- ok\n");
  const report = await h.tc("lead", "report", "--title", "Weekly", "--file", reportFile);
  assert.equal(report.code, 0, report.stderr);
  const saved = h.hub.listReports()[0];
  assert.equal(fs.readFileSync(saved.path, "utf-8"), "# Weekly\n- ok\n");

  const stranger = await h.tc("w1", "reply", "Nobody");
  assert.match(stranger.stderr, /No single agent matches/);
});

test("final message excludes the narration written along the way", async () => {
  const { extractFinalAssistantMessage, extractLastAssistantReply } = await import("../electron/orchestrator-bridge.ts");
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "tc-final-")), "s.jsonl");
  const line = (role: string, text: string, extra: Record<string, unknown> = {}) =>
    JSON.stringify({ type: role, ...extra, message: { role, content: [{ type: "text", text }] } });
  fs.writeFileSync(
    file,
    [
      line("user", "do it", { origin: { kind: "human" } }),
      line("assistant", "Step 1 is done, now step 2."),
      line("assistant", "Bitti: 3 lead skorlandı."),
    ].join("\n") + "\n",
  );
  assert.equal(extractFinalAssistantMessage(file), "Bitti: 3 lead skorlandı.");
  assert.equal(extractLastAssistantReply(file), "Step 1 is done, now step 2.\n\nBitti: 3 lead skorlandı.");
});

test("a worker running its manager's copy of tc.mjs still acts as itself", async (t) => {
  const h = await harness();
  t.after(() => h.close());
  const send = await h.tcAs("w1", "lead", "send", "Data", "do my work");
  assert.notEqual(send.code, 0);
  assert.match(send.stderr, /another agent's tool; running it as you/);
  assert.match(send.stderr, /Only managers send tasks/);
  assert.equal((await h.tcAs("w1", "lead", "say", "Using the wrong path")).code, 0);
  const last = h.hub.listActivity().at(-1);
  assert.equal(last?.agentName, "Writer");
  // Outside a team terminal (no id in the environment) the copy's owner is used.
  assert.match((await h.tc("lead", "status")).stdout, /You: Lead/);
});

test("msg --wait returns the teammate's answer in the same turn, once", async (t) => {
  const h = await harness();
  t.after(() => h.close());
  // The asker is busy running the command, so nothing is typed into it.
  h.turnStates.w1 = "tool_running";
  const asking = h.tc("w1", "msg", "Data", "Which leads are Pending?", "--wait", "--timeout", "20");
  await new Promise((resolve) => setTimeout(resolve, 1500));
  assert.equal((await h.tc("w2", "msg", "Writer", "Ayse and Jonas")).code, 0);
  const result = await asking;
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /\[Data answered\] Ayse and Jonas/);
  h.turnStates.w1 = "turn_complete";
  await h.hub.tick();
  assert.equal(h.delivered.filter((d) => d.to === "w1").length, 0, "the answer is not delivered again");
  assert.ok(fs.statSync(path.join(h.repo, ".termcanvas", "agent", "w1", "tc.mjs")).mode & 0o100);
});
