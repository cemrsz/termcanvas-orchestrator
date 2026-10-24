import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { TeamHub } from "../electron/team-hub.ts";
import type { TeamDirectory, TeamMemberInfo } from "../shared/team.ts";
import {
  classifyPrompt,
  describeHookEvent,
  formatActivity,
  parseSince,
  summarizePayload,
} from "../shared/teamActivity.ts";

function member(id: string, name: string, worktreePath: string): TeamMemberInfo {
  return { id, name, type: "claude", worktreePath, project: "p", ptyId: 7, status: "running" };
}

function setup(turnState: Record<string, string> = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "tc-team-"));
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "tc-repo-"));
  const delivered: { to: string; text: string }[] = [];
  const written: { id: string; isManager: boolean; hasManager: boolean }[] = [];
  let now = 1_000_000;
  const hub = new TeamHub({
    dataDir,
    getTurnState: (id) => turnState[id] ?? "turn_complete",
    isPtyAlive: () => true,
    deliver: async (m, text) => {
      delivered.push({ to: m.id, text });
    },
    writeWorkspace: (m, role) => written.push({ id: m.id, ...role }),
    readLastReply: () => "All 12 leads enriched.\nDetails follow.",
    now: () => now,
  });
  const directory: TeamDirectory = {
    managerIds: ["lead", "mgr"],
    members: [
      member("lead", "Lead", repo),
      member("mgr", "Research Manager", repo),
      member("w1", "Research 1", repo),
      member("solo", "Solo", repo),
    ],
    sources: [
      { id: "src-1", kind: "n8n", name: "New Leads", url: "", description: "New lead rows" },
      { id: "src-2", kind: "note", name: "Loose", url: "", description: "" },
    ],
    links: [
      { orchestratorId: "lead", targetKind: "terminal", targetId: "mgr" },
      { orchestratorId: "mgr", targetKind: "terminal", targetId: "w1" },
      { orchestratorId: "mgr", targetKind: "source", targetId: "src-1" },
    ],
    lang: "tr",
  };
  hub.setDirectory(directory);
  return { hub, delivered, written, dataDir, repo, advance: (ms: number) => (now += ms), turnState };
}

test("team members get role-aware bridge files, once per role", () => {
  const { hub, written } = setup();
  assert.deepEqual(
    written.map((w) => [w.id, w.isManager, w.hasManager]),
    [
      ["lead", true, false],
      ["mgr", true, true],
      ["w1", false, true],
    ],
  );
  hub.setDirectory(hub.getDirectory());
  assert.equal(written.length, 3, "unchanged roles are not rewritten");
});

test("hook events become activity and Stop quotes the reply", () => {
  const { hub } = setup();
  hub.recordHookEvent({
    hook_event_name: "PreToolUse",
    terminal_id: "w1",
    tool_name: "Read",
    tool_input: { file_path: "/repo/leads.csv" },
  });
  hub.recordHookEvent({
    hook_event_name: "PreToolUse",
    terminal_id: "w1",
    tool_name: "Bash",
    tool_input: { command: "node .termcanvas/agent/w1/tc.mjs say hi" },
  });
  hub.recordHookEvent({ hook_event_name: "Stop", terminal_id: "w1", transcript_path: "/t.jsonl" });
  hub.recordHookEvent({ hook_event_name: "PreToolUse", terminal_id: "stranger", tool_name: "Read" });
  const entries = hub.listActivity();
  assert.deepEqual(
    entries.map((e) => formatActivity(e, "tr")),
    ["leads.csv dosyasını okuyorum", "Bitirdim: All 12 leads enriched."],
  );
  assert.equal(hub.latestDoing("w1"), "Bitirdim: All 12 leads enriched.");
});

test("rapid tool calls collapse into one feed line", () => {
  const { hub, advance } = setup();
  const tool = { hook_event_name: "PreToolUse", terminal_id: "w1", tool_name: "Grep", tool_input: { pattern: "x" } };
  hub.recordHookEvent(tool);
  advance(300);
  hub.recordHookEvent(tool);
  advance(2000);
  hub.recordHookEvent(tool);
  assert.equal(hub.listActivity().length, 2);
});

test("teammate messages wait until the receiver is idle", async () => {
  const { hub, delivered, turnState } = setup({ w1: "tool_running" });
  hub.sendMessage("lead", "w1", "Use the new template");
  await hub.tick();
  assert.equal(delivered.length, 0);
  assert.equal(hub.queuedFor("w1"), 1);
  turnState.w1 = "turn_complete";
  await hub.tick();
  assert.equal(delivered.length, 1);
  assert.match(delivered[0].text, /^\[TermCanvas · message from Lead\]/);
  assert.match(delivered[0].text, /Use the new template$/);
  assert.equal(hub.queuedFor("w1"), 0);
});

test("inbound n8n events go to the managers the source is wired to", async () => {
  const { hub, delivered } = setup();
  const result = hub.handleInbound("New Leads", { summary: "3 new leads", rows: [1, 2, 3] });
  assert.deepEqual(result, { source: "New Leads", deliveredTo: ["Research Manager"] });
  await hub.tick();
  assert.equal(delivered.length, 1);
  assert.equal(delivered[0].to, "mgr");
  assert.match(delivered[0].text, /n8n event from source "New Leads"/);
  assert.match(delivered[0].text, /"rows": \[/);
  assert.throws(() => hub.handleInbound("Loose", {}), /not wired/);
  assert.throws(() => hub.handleInbound("nope", {}), /No source/);
  const event = hub.listActivity().find((e) => e.kind === "event");
  assert.ok(event);
  assert.equal(formatActivity(event, "en"), "n8n · New Leads → Research Manager: 3 new leads");
});

test("reports are saved in the author's worktree and readable by path", () => {
  const { hub, repo } = setup();
  const report = hub.saveReport("lead", "Haftalık Özet", "# Özet\n- ok");
  assert.ok(report.path.startsWith(path.join(repo, ".termcanvas", "reports")));
  assert.match(path.basename(report.path), /haftalik-ozet\.md$/);
  assert.equal(hub.readReport(report.path), "# Özet\n- ok");
  assert.throws(() => hub.readReport("/etc/passwd"), /Unknown report/);
  assert.equal(hub.listReports()[0].title, "Haftalık Özet");
});

test("activity, board and reports survive a restart", () => {
  const { hub, dataDir } = setup();
  hub.post("w1", "Leads tab has a new column: score");
  hub.recordFor("w1", { kind: "say", text: "Skorları hesaplıyorum" });
  const reopened = new TeamHub({
    dataDir,
    getTurnState: () => null,
    isPtyAlive: () => true,
    deliver: async () => {},
    writeWorkspace: () => {},
  });
  reopened.setDirectory(hub.getDirectory());
  assert.equal(reopened.boardFor(new Set(["w1"]))[0].text, "Leads tab has a new column: score");
  assert.equal(reopened.latestDoing("w1"), "Skorları hesaplıyorum");
});

test("prompts from the bridge are classified by their header", () => {
  const task = classifyPrompt(
    "[TermCanvas · task from Lead to you (Research 1)]\nTeam tool: …\n\nFind 10 leads in Berlin",
  );
  assert.deepEqual(task, { origin: "task", body: "Find 10 leads in Berlin", from: "Lead" });
  assert.equal(classifyPrompt("just do it").origin, "user");
  assert.deepEqual(
    classifyPrompt('[TermCanvas · n8n event from source "New Leads" at 2026-10-24T02:09:05Z]\nSource notes: x\nThis is…\n\n{\n  "summary": "2 new leads"\n}'),
    { origin: "event", body: "2 new leads", from: "New Leads" },
  );
  const draft = describeHookEvent(
    { hook_event_name: "UserPromptSubmit", prompt: "[TermCanvas · message from Data 2 (scores)]\nAnswer…\n\nDone?" },
    { id: "w1", name: "Research 1" },
  );
  assert.ok(draft);
  assert.equal(formatActivity({ ...draft, id: "x", at: 0 }, "tr"), "Data 2 mesaj attı: Done?");
});

test("payload summaries and since parsing", () => {
  assert.equal(summarizePayload({ message: "Workflow finished" }), "Workflow finished");
  assert.equal(summarizePayload([1, 2]), "2 item(s)");
  assert.equal(summarizePayload(null), "(empty)");
  assert.equal(parseSince("90m", 10_000_000), 10_000_000 - 90 * 60_000);
  assert.equal(parseSince("nonsense"), null);
});

test("hook events that beat the directory sync are replayed", () => {
  const { hub } = setup();
  hub.recordHookEvent({ hook_event_name: "UserPromptSubmit", terminal_id: "new-1", prompt: "hello there" });
  assert.equal(hub.listActivity().length, 0);
  const directory = hub.getDirectory();
  hub.setDirectory({
    ...directory,
    members: [...directory.members, member("new-1", "Newcomer", "/tmp")],
  });
  const entries = hub.listActivity();
  assert.equal(entries.length, 1);
  assert.equal(formatActivity(entries[0], "en"), "New command: hello there");
});

test("a silent 'thinking' state does not block deliveries forever", async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "tc-team-"));
  let now = 10_000_000;
  const delivered: string[] = [];
  const hub = new TeamHub({
    dataDir,
    getTurnState: () => "in_turn",
    getLastActivityAt: () => 10_000_000,
    isPtyAlive: () => true,
    deliver: async (m) => {
      delivered.push(m.id);
    },
    writeWorkspace: () => {},
    now: () => now,
  });
  hub.setDirectory({
    managerIds: ["a"],
    members: [member("a", "A", "/r"), member("b", "B", "/r")],
    sources: [],
    links: [{ orchestratorId: "a", targetKind: "terminal", targetId: "b" }],
    lang: "en",
  });
  hub.sendMessage("a", "b", "ping");
  await hub.tick();
  assert.deepEqual(delivered, []);
  now += 4 * 60_000;
  await hub.tick();
  assert.deepEqual(delivered, ["b"]);
});
