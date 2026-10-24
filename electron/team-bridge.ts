/**
 * Team bridge — the files every agent on a team uses to see and work with
 * the rest of its team.
 *
 * For each team member we write, inside its worktree:
 *   .termcanvas/agent/<terminalId>/AGENT.md  (role-aware operating rules)
 *   .termcanvas/agent/<terminalId>/tc.mjs    (CLI over the TermCanvas API)
 *
 * The CLI only talks to `/team/<terminalId>/*`; the API decides what the
 * agent may see (its own team) and do (tasks only to its direct reports).
 */

import fs from "node:fs";
import path from "node:path";

export interface AgentWorkspace {
  dir: string;
  instructionsPath: string;
  scriptPath: string;
  /** Paths relative to the worktree, with forward slashes. */
  instructionsRelPath: string;
  scriptRelPath: string;
}

export interface AgentWorkspaceRole {
  /** Has direct reports it can give tasks to. */
  isManager: boolean;
  /** Reports to someone; false for the top of the team. */
  hasManager: boolean;
}

export function getAgentRelDir(terminalId: string): string {
  return `.termcanvas/agent/${terminalId}`;
}

function ensureIgnoredDir(rootDir: string) {
  fs.mkdirSync(rootDir, { recursive: true });
  // Generated files never belong in the user's git history.
  fs.writeFileSync(path.join(rootDir, ".gitignore"), "*\n", "utf-8");
}

export function writeAgentWorkspace(options: {
  terminalId: string;
  worktreePath: string;
  portFile: string;
  role: AgentWorkspaceRole;
}): AgentWorkspace {
  const relDir = getAgentRelDir(options.terminalId);
  const rootDir = path.join(options.worktreePath, ".termcanvas", "agent");
  const dir = path.join(rootDir, options.terminalId);
  ensureIgnoredDir(rootDir);
  fs.mkdirSync(dir, { recursive: true });

  const scriptRelPath = `${relDir}/tc.mjs`;
  const instructionsRelPath = `${relDir}/AGENT.md`;
  const scriptPath = path.join(dir, "tc.mjs");
  const instructionsPath = path.join(dir, "AGENT.md");
  fs.writeFileSync(
    scriptPath,
    buildTeamScript(options.terminalId, options.portFile),
    "utf-8",
  );
  fs.writeFileSync(
    instructionsPath,
    buildAgentInstructions({
      terminalId: options.terminalId,
      scriptRelPath,
      relDir,
      role: options.role,
    }),
    "utf-8",
  );
  return {
    dir,
    instructionsPath,
    scriptPath,
    instructionsRelPath,
    scriptRelPath,
  };
}

export function buildAgentInstructions(options: {
  terminalId: string;
  scriptRelPath: string;
  relDir: string;
  role: AgentWorkspaceRole;
}): string {
  const cli = `node ${options.scriptRelPath}`;
  const { isManager, hasManager } = options.role;
  const isLead = isManager && !hasManager;

  const managerCommands = isManager
    ? `${cli} send <report> <text> | --file <p>      give a task to one of your direct reports
${cli} wait <agent> [--timeout 100]          wait for that agent's turn to end, print its reply
${cli} ask <report> <text> | --file <p>       send, then wait
`
    : "";
  const leadCommands = isLead
    ? `${cli} report --title "<title>" --file <p.md> save the final report; the user sees it in the Team panel
`
    : "";

  const managerSection = isManager
    ? `
## As a manager

- Your direct reports are listed under "Reports" in \`status\`. Split the
  work and give each one a self-contained task with \`send\`: they do not see
  your conversation, so include the context, the data rows they need, file
  paths and the exact output you expect back. For anything longer than one
  line, write the prompt to a file under \`${options.relDir}/\` and use \`--file\`.
- Independent tasks: \`send\` to everyone first, then \`wait\` on each.
  Dependent tasks: run them in order and pass results along.
- Give work to the report whose name/role fits. Do not do a report's job
  yourself unless nobody fitting is wired; if something is missing, say so.
- If \`wait\` exits with 3, the agent needs the user's approval in its own
  terminal: tell ${hasManager ? "your manager" : "the user"} which agent, then \`wait\` again.
- Check the results. Send a correction if a result is wrong or incomplete.
- When your reports are done, end your turn with a concise summary for
  ${hasManager ? "your manager" : "the user"}: who did what, the results, the problems.
`
    : "";

  const leadSection = isLead
    ? `
## Final report (you are the top of the team)

The user gives commands to you. When a command took more than one agent or
more than a few steps, finish with a written report:

1. Run \`log --since <when the command started, e.g. 90m>\` and collect every result.
2. Write the report as markdown to \`${options.relDir}/report.md\`:

   # <title>
   **Command:** <the user's command> · **Date:** <date> · **Team:** <who took part>
   ## Summary
   3–6 bullet points: the outcome, in numbers where possible.
   ## Who did what
   | Agent | Task | Result | Status |   (status: ✅ done, ⚠️ partial, ❌ failed)
   ## Outputs
   Files (paths), sheet rows added/changed, workflows triggered, links.
   ## Problems and open questions
   ## Next steps

3. Run \`report --title "<title>" --file ${options.relDir}/report.md\`.
4. Answer the user with the summary and tell them the full report is in the
   Team panel. Write the report in the user's language.
`
    : "";

  return `# TermCanvas team member

You are an agent on the user's TermCanvas canvas. Agents and data sources
wired together on the canvas form one **team**: everyone on it sees the whole
roster, what each member is doing right now, and every data source wired to
the team (Google Sheets, n8n webhooks, HTTP APIs, local files, notes). The
user can rewire at any time, so run \`status\` at the start of each task.

${isManager ? "You manage the agents wired below you." : "You take tasks from your manager."}${hasManager ? " You report to the manager shown in `status`." : ""}

## Team tool

Run from your working directory:

\`\`\`
${cli} status                             you, your manager, your reports, the whole team, team sources
${cli} say "<one short sentence>"         tell the team panel what you are doing right now
${cli} reply <agent>                      the latest reply of any teammate
${cli} msg <teammate> <text> | --file <p> message a teammate (delivered when they are idle)
${cli} board                              read the team board (shared findings and decisions)
${cli} post <text> | --file <p>           add a note to the team board
${cli} source <S#|name> [--lines 200] [--query "status=Pending&limit=20"]
                                           read a team source: sheet -> rows, n8n/api -> GET, file -> content, note -> text
${cli} sheet <S#|name> read [--tab Leads] [--limit 50] [--where status=Pending]
${cli} sheet <S#|name> append --rows '<json array of row objects>' [--tab Leads]
${cli} sheet <S#|name> update --key <column> --rows '<json array>' [--tab Leads]
${cli} trigger <S#|name> --data '<json>' | --file payload.json   POST to an n8n/API source
${cli} log [--limit 100] [--since 2h]     what the team has done
${managerCommands}${leadCommands}\`\`\`

\`<agent>\` is a number from \`status\`, a name, or an id. Pass long or
multi-line text with \`--file\`. \`wait\` exit codes: 0 = done (reply printed),
2 = still working (run \`wait\` again), 3 = waiting for the user's approval.

## How to work

1. **Narrate.** When you start a task and at each meaningful step, run \`say\`
   with ONE short first-person sentence in the user's language, e.g.
   \`say "Lead listesini okuyorum"\`, \`say "3 e-posta taslağı hazırladım"\`.
   The user watches these in the Team panel. Do not narrate every tool call.
2. **Team messages.** Text that starts with \`[TermCanvas · …]\` comes from your
   team, not the user: a task from your manager, a message from a teammate,
   or an automatic n8n event. Treat a task as your instruction; answer a
   teammate with \`msg\` only when an answer is needed.
3. **Automatic events.** \`[TermCanvas · n8n event …]\` messages are outputs of
   n8n workflows wired to the team. Handle them as the source notes say${isManager ? "; delegate to your reports as usual" : ""}.
4. **Data.** Read team sources yourself and pass on only the rows a task
   needs. A sheet with a write bridge can be changed with \`sheet append\` /
   \`sheet update\`: change only the rows the task is about, never delete or
   rewrite a whole sheet, and \`say\` what you changed.
5. **Coordinate.** When your work depends on or affects a teammate, check the
   \`board\` and \`msg\` them. Put findings others will need on the board with
   \`post\`. No chit-chat: every message costs the receiver a turn.
6. **Finish** every task with a short structured result: what you did,
   outputs (file paths, rows changed), open issues. Your manager reads it.
${managerSection}${leadSection}
## Safety

- \`trigger\` and sheet writes act on the outside world (they can send
  emails, change rows, start workflows). Only run them when the task asks
  for that action.
- Lead lists and emails are personal data: hand on only the fields a task needs.
- Reply in the language the user writes in.
`;
}

/**
 * The CLI is plain Node (no dependencies) so it runs from any agent shell.
 * Written without template literals so it can be embedded in String.raw.
 */
export function buildTeamScript(terminalId: string, portFile: string): string {
  const header =
    "#!/usr/bin/env node\n" +
    "// TermCanvas team bridge. Generated by TermCanvas; edits are overwritten.\n" +
    `const AGENT_ID = ${JSON.stringify(terminalId)};\n` +
    `const PORT_FILE = ${JSON.stringify(portFile)};\n`;
  return header + TEAM_SCRIPT_BODY;
}

const TEAM_SCRIPT_BODY = String.raw`
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";

const BASE = "/team/" + encodeURIComponent(AGENT_ID);
const DONE_STATES = new Set(["turn_complete", "turn_aborted"]);
const ACTIVE_STATES = new Set(["thinking", "in_turn", "tool_running", "tool_pending"]);
const STATE_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), ".state");
const START_GRACE_MS = 30000;
const MAX_PRINT_CHARS = 20000;

function readPort() {
  let raw;
  try {
    raw = fs.readFileSync(PORT_FILE, "utf-8");
  } catch {
    throw new Error("TermCanvas is not running (no port file at " + PORT_FILE + ")");
  }
  const port = parseInt(raw.split("\n")[0].trim(), 10);
  if (!port) throw new Error("TermCanvas port file is empty: " + PORT_FILE);
  return port;
}

function api(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? undefined : JSON.stringify(body);
    const headers = data
      ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) }
      : {};
    const req = http.request(
      { hostname: "127.0.0.1", port: readPort(), path: urlPath, method, headers, timeout: 30000 },
      (res) => {
        let text = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (text += chunk));
        res.on("end", () => {
          let json;
          try {
            json = text ? JSON.parse(text) : {};
          } catch {
            json = { error: text };
          }
          if (res.statusCode >= 400) reject(new Error(json.error || "HTTP " + res.statusCode));
          else resolve(json);
        });
      },
    );
    req.on("timeout", () => req.destroy(new Error("TermCanvas API timed out")));
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags };
}

function truncate(text, max) {
  if (text.length <= max) return text;
  return text.slice(0, max) + "\n... [truncated " + (text.length - max) + " chars]";
}

function readTextArg(rest, flags) {
  if (typeof flags.file === "string") return fs.readFileSync(flags.file, "utf-8");
  const text = rest.join(" ");
  if (!text.trim()) throw new Error("No text given. Pass the text or --file <path>.");
  return text;
}

function sentMarkerPath(agentId) {
  return path.join(STATE_DIR, agentId.replace(/[^A-Za-z0-9_-]/g, "_") + ".json");
}

function recordSent(agentId) {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(sentMarkerPath(agentId), JSON.stringify({ sentAt: Date.now() }));
}

function readSentAt(agentId) {
  try {
    return JSON.parse(fs.readFileSync(sentMarkerPath(agentId), "utf-8")).sentAt || 0;
  } catch {
    return 0;
  }
}

function logActivity(entry) {
  return api("POST", BASE + "/log", entry).catch(() => {});
}

function describeMember(m) {
  const state = m.turnState || m.status;
  return (
    m.name +
    (m.model ? "  (" + m.model + ")" : "") +
    "  state=" + state +
    (m.ptyId ? "" : " (not running)") +
    (m.doing ? "  doing: " + m.doing : "")
  );
}

async function cmdStatus() {
  const v = await api("GET", BASE);
  const lines = [];
  lines.push("You: " + v.me.name + (v.me.role ? " - " + v.me.role : "") + "  id=" + v.me.id +
    (v.me.isManager ? "  [manager]" : ""));
  lines.push("Manager: " + (v.managers.length ? v.managers.map((m) => m.name).join(", ") : "(none - you are the top of the team)"));
  if (v.me.isManager) {
    lines.push("");
    lines.push("Reports (you can send them tasks) (" + v.reports.length + "):");
    if (v.reports.length === 0) lines.push("  (none - ask the user to wire agents to you on the canvas)");
    v.reports.forEach((r, i) => lines.push("  " + (i + 1) + ". " + describeMember(r) + "  id=" + r.id));
  }
  lines.push("");
  lines.push("Whole team (" + v.members.length + "):");
  for (const m of v.members) {
    lines.push("  " + "  ".repeat(m.depth) + "- " + describeMember(m) + (m.role ? "  role: " + m.role : ""));
  }
  lines.push("");
  lines.push("Team sources (" + v.sources.length + "):");
  if (v.sources.length === 0) lines.push("  (none)");
  v.sources.forEach((s, i) => {
    lines.push("  S" + (i + 1) + ". " + s.name + "  [" + s.kind + "]" + (s.url ? "  " + s.url : "") +
      (s.writeUrl ? "  (writable: sheet append/update)" : ""));
    if (s.description) for (const line of s.description.split("\n")) lines.push("      " + line);
  });
  if (v.queued) lines.push("\n" + v.queued + " message(s) waiting to be delivered to you.");
  console.log(lines.join("\n"));
}

async function cmdSend(rest, flags) {
  const agent = rest.shift();
  if (!agent) throw new Error("Usage: send <report> <text> | --file <path>");
  const text = readTextArg(rest, flags);
  const result = await api("POST", BASE + "/send", { agent, text });
  recordSent(result.agent.id);
  console.log("Sent to " + result.agent.name + " (" + result.agent.id + ").");
  return result.agent;
}

async function cmdWait(rest, flags) {
  const agentRef = rest.shift();
  if (!agentRef) throw new Error("Usage: wait <agent> [--timeout 100]");
  const timeoutMs = (parseInt(flags.timeout, 10) || 100) * 1000;
  const deadline = Date.now() + timeoutMs;
  let agentId = null;
  let sentAt = 0;
  while (true) {
    const info = await api("GET", BASE + "/agent?agent=" + encodeURIComponent(agentRef));
    const a = info.agent;
    if (!agentId) {
      agentId = a.id;
      sentAt = readSentAt(agentId);
    }
    const state = a.turnState || "unknown";
    const startedAt = a.turnStartedAt ? Date.parse(a.turnStartedAt) : 0;
    const started =
      !sentAt ||
      startedAt >= sentAt - 2000 ||
      (a.lastDoneAt && a.lastDoneAt >= sentAt) ||
      ACTIVE_STATES.has(state) ||
      Date.now() - sentAt > START_GRACE_MS;
    if (started && DONE_STATES.has(state) && !a.queued) {
      const r = await api("GET", BASE + "/reply?agent=" + encodeURIComponent(agentId));
      console.log("[" + a.name + " finished: " + state + "]");
      console.log(truncate(r.reply || "(no reply text found)", MAX_PRINT_CHARS));
      return 0;
    }
    if (state === "awaiting_input") {
      console.log("WAITING_FOR_APPROVAL: " + a.name + " is waiting for the user to approve or answer something in its terminal.");
      process.exitCode = 3;
      return 3;
    }
    if (!a.ptyId) {
      throw new Error(a.name + " is not running. Ask the user to open or restart that terminal.");
    }
    if (Date.now() >= deadline) {
      console.log("STILL_WORKING: " + a.name + " state=" + state + (a.doing ? " doing: " + a.doing : "") + ". Run wait again.");
      process.exitCode = 2;
      return 2;
    }
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }
}

async function cmdReply(rest) {
  const agentRef = rest.shift();
  if (!agentRef) throw new Error("Usage: reply <agent>");
  const r = await api("GET", BASE + "/reply?agent=" + encodeURIComponent(agentRef));
  console.log("[" + r.agent.name + " state=" + (r.agent.turnState || "unknown") + "]");
  console.log(truncate(r.reply || "(no reply text found)", MAX_PRINT_CHARS));
}

async function cmdMsg(rest, flags) {
  const agent = rest.shift();
  if (!agent) throw new Error("Usage: msg <teammate> <text> | --file <path>");
  const text = readTextArg(rest, flags);
  const result = await api("POST", BASE + "/msg", { agent, text });
  console.log("Message for " + result.agent.name + " queued; it is delivered when they are idle.");
}

async function cmdSay(rest, flags) {
  const text = readTextArg(rest, flags).trim();
  await api("POST", BASE + "/say", { text });
  console.log("ok");
}

async function cmdBoard(flags) {
  const r = await api("GET", BASE + "/board?limit=" + (parseInt(flags.limit, 10) || 30));
  if (r.notes.length === 0) {
    console.log("(the team board is empty)");
    return;
  }
  for (const n of r.notes) {
    console.log("[" + new Date(n.at).toLocaleString() + "] " + n.agentName + ": " + n.text);
  }
}

async function cmdPost(rest, flags) {
  const text = readTextArg(rest, flags).trim();
  await api("POST", BASE + "/board", { text });
  console.log("Posted to the team board.");
}

async function cmdLog(flags) {
  const params = new URLSearchParams();
  params.set("limit", String(parseInt(flags.limit, 10) || 100));
  if (typeof flags.since === "string") params.set("since", flags.since);
  const r = await api("GET", BASE + "/log?" + params.toString());
  if (r.entries.length === 0) {
    console.log("(no team activity in that window)");
    return;
  }
  for (const e of r.entries) {
    console.log("[" + new Date(e.at).toLocaleString() + "] " + e.agentName + ": " + e.sentence);
  }
}

async function cmdReport(rest, flags) {
  const title = typeof flags.title === "string" ? flags.title : rest.join(" ");
  if (!title.trim()) throw new Error("Usage: report --title \"<title>\" --file report.md");
  if (typeof flags.file !== "string") throw new Error("Pass the report markdown with --file <path.md>");
  const markdown = fs.readFileSync(flags.file, "utf-8");
  const r = await api("POST", BASE + "/report", { title, markdown });
  console.log("Report saved: " + r.path + "\nThe user can open it in the Team panel.");
}

function resolveSource(view, ref) {
  const sources = view.sources;
  const m = /^S?(\d+)$/i.exec(ref);
  if (m) {
    const s = sources[parseInt(m[1], 10) - 1];
    if (s) return s;
  }
  const lower = ref.toLowerCase();
  const exact = sources.filter((s) => s.id === ref || s.name.toLowerCase() === lower);
  if (exact.length === 1) return exact[0];
  const partial = sources.filter((s) => s.name.toLowerCase().includes(lower));
  if (partial.length === 1) return partial[0];
  throw new Error(
    "No single team source matches '" + ref + "'. Team sources: " +
      (sources.map((s, i) => "S" + (i + 1) + " " + s.name).join(", ") || "none"),
  );
}

function sheetCsvUrl(url) {
  const m = /\/spreadsheets\/d\/([A-Za-z0-9_-]+)/.exec(url);
  if (!m) return url;
  const gid = /[#?&]gid=(\d+)/.exec(url);
  return "https://docs.google.com/spreadsheets/d/" + m[1] + "/export?format=csv" + (gid ? "&gid=" + gid[1] : "");
}

function limitLines(text, maxLines) {
  const lines = text.split(/\r?\n/);
  if (lines.length <= maxLines) return text;
  return lines.slice(0, maxLines).join("\n") + "\n... [" + (lines.length - maxLines) + " more lines, use --lines]";
}

async function bridgeCall(s, payload) {
  if (!s.writeUrl) {
    throw new Error(
      "Sheet '" + s.name + "' has no write bridge. Ask the user to deploy integrations/google-sheets/termcanvas-sheet-bridge.gs " +
        "(or the n8n sheet bridge) and paste its URL into the sheet node's second field.",
    );
  }
  const res = await fetch(s.writeUrl, {
    method: "POST",
    redirect: "follow",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await res.text();
  let json;
  try {
    json = JSON.parse(body);
  } catch {
    throw new Error("The sheet bridge did not answer with JSON (HTTP " + res.status + "): " + truncate(body, 300));
  }
  if (!res.ok || json.ok === false) throw new Error("Sheet bridge error: " + (json.error || "HTTP " + res.status));
  return json;
}

function printRows(rows, maxLines) {
  if (!Array.isArray(rows) || rows.length === 0) {
    console.log("(no rows)");
    return;
  }
  const lines = rows.map((row) => JSON.stringify(row));
  console.log(truncate(limitLines(lines.join("\n"), maxLines), MAX_PRINT_CHARS));
}

function parseWhere(value) {
  if (typeof value !== "string" || !value) return undefined;
  const where = {};
  for (const part of value.split("&")) {
    const i = part.indexOf("=");
    if (i > 0) where[part.slice(0, i)] = part.slice(i + 1);
  }
  return where;
}

function parseRows(flags) {
  let raw;
  if (typeof flags.rows === "string") raw = flags.rows;
  else if (typeof flags.file === "string") raw = fs.readFileSync(flags.file, "utf-8");
  else throw new Error("Pass the rows as --rows '<json array>' or --file rows.json");
  const rows = JSON.parse(raw);
  if (!Array.isArray(rows) || rows.some((r) => !r || typeof r !== "object" || Array.isArray(r))) {
    throw new Error("Rows must be a JSON array of objects, e.g. [{\"email\":\"a@b.c\",\"status\":\"Sent\"}]");
  }
  return rows;
}

async function cmdSheet(rest, flags) {
  const ref = rest.shift();
  const action = rest.shift() || "read";
  if (!ref) throw new Error("Usage: sheet <S#|name> read|append|update ...");
  const view = await api("GET", BASE);
  const s = resolveSource(view, ref);
  if (s.kind !== "sheet") throw new Error("Source '" + s.name + "' is not a sheet.");
  const tab = typeof flags.tab === "string" ? flags.tab : undefined;
  if (action === "read") {
    const r = await bridgeCall(s, {
      action: "read",
      tab,
      limit: parseInt(flags.limit, 10) || 200,
      where: parseWhere(flags.where),
    });
    console.log("[" + s.name + (r.tab ? " / " + r.tab : "") + "] " + (r.count ?? (r.rows || []).length) + " rows");
    printRows(r.rows, parseInt(flags.lines, 10) || 200);
    await logActivity({ kind: "sheet", action: "read", count: (r.rows || []).length, sourceName: s.name });
    return;
  }
  if (action !== "append" && action !== "update" && action !== "upsert") {
    throw new Error("Unknown sheet action '" + action + "'. Use read, append, update or upsert.");
  }
  const rows = parseRows(flags);
  const key = typeof flags.key === "string" ? flags.key : undefined;
  if ((action === "update" || action === "upsert") && !key) {
    throw new Error(action + " needs --key <column> to find the rows to change.");
  }
  const r = await bridgeCall(s, { action, tab, key, rows });
  const count = r.count ?? r.updated ?? r.appended ?? rows.length;
  console.log("[" + s.name + "] " + action + ": " + count + " row(s)." + (r.missing ? " Not found: " + JSON.stringify(r.missing) : ""));
  await logActivity({ kind: "sheet", action, count, sourceName: s.name });
}

async function cmdSource(rest, flags) {
  const ref = rest.shift();
  if (!ref) throw new Error("Usage: source <S#|name> [--lines 200] [--query \"k=v&k2=v2\"]");
  const view = await api("GET", BASE);
  const s = resolveSource(view, ref);
  const maxLines = parseInt(flags.lines, 10) || 200;
  console.log("[" + s.name + " - " + s.kind + "]");
  if (s.description && s.kind !== "note") console.log("Notes: " + s.description);
  if (s.kind === "note") {
    console.log(s.description || "(empty note)");
    return;
  }
  if (s.kind === "sheet" && s.writeUrl) {
    return cmdSheet([ref, "read"], flags);
  }
  if (!s.url) throw new Error("Source '" + s.name + "' has no URL/path set on the canvas.");
  if (s.kind === "file") {
    const stat = fs.statSync(s.url);
    if (stat.isDirectory()) {
      console.log(fs.readdirSync(s.url).join("\n"));
    } else {
      console.log(truncate(limitLines(fs.readFileSync(s.url, "utf-8"), maxLines), MAX_PRINT_CHARS));
    }
    await logActivity({ kind: "read", sourceName: s.name });
    return;
  }
  let target = s.kind === "sheet" ? sheetCsvUrl(s.url) : s.url;
  if (typeof flags.query === "string" && flags.query && s.kind !== "sheet") {
    target += (target.includes("?") ? "&" : "?") + flags.query.replace(/^\?/, "");
  }
  const res = await fetch(target, { redirect: "follow" });
  const body = await res.text();
  const type = res.headers.get("content-type") || "";
  if (s.kind === "sheet" && (type.includes("text/html") || !res.ok)) {
    throw new Error(
      "Could not read the sheet as CSV (HTTP " + res.status + "). Share it as 'Anyone with the link: Viewer', " +
        "or add a write bridge URL to the sheet node (integrations/google-sheets).",
    );
  }
  if (s.kind === "n8n" && res.status === 404 && body.includes("not registered")) {
    throw new Error(
      "This n8n webhook does not accept GET (or its workflow is not published). " +
        "If it is an action webhook, use: trigger " + ref + " --data '<json>'",
    );
  }
  if (!res.ok) console.log("HTTP " + res.status);
  console.log(truncate(limitLines(body, maxLines), MAX_PRINT_CHARS));
  await logActivity({ kind: "read", sourceName: s.name });
}

async function cmdTrigger(rest, flags) {
  const ref = rest.shift();
  if (!ref) throw new Error("Usage: trigger <S#|name> [--data '<json>' | --file payload.json]");
  const view = await api("GET", BASE);
  const s = resolveSource(view, ref);
  if (!s.url) throw new Error("Source '" + s.name + "' has no URL set on the canvas.");
  if (s.kind === "file" || s.kind === "note") throw new Error("Source '" + s.name + "' cannot be triggered.");
  let payload = {};
  if (typeof flags.file === "string") payload = JSON.parse(fs.readFileSync(flags.file, "utf-8"));
  else if (typeof flags.data === "string") payload = JSON.parse(flags.data);
  const res = await fetch(s.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await res.text();
  console.log("[" + s.name + "] HTTP " + res.status);
  console.log(truncate(body, MAX_PRINT_CHARS));
  await logActivity({ kind: "trigger", sourceName: s.name, status: res.status });
  if (!res.ok) process.exitCode = 1;
}

const HELP = [
  "TermCanvas team bridge",
  "  status | team",
  "  say <one sentence>",
  "  send <report> <text> | --file <path>        (managers)",
  "  wait <agent> [--timeout 100]",
  "  ask <report> <text> | --file <path>          (managers)",
  "  reply <agent>",
  "  msg <teammate> <text> | --file <path>",
  "  board [--limit 30]  |  post <text> | --file <path>",
  "  log [--limit 100] [--since 2h]",
  "  source <S#|name> [--lines 200] [--query \"k=v&k2=v2\"]",
  "  sheet <S#|name> read [--tab T] [--limit 50] [--where col=value]",
  "  sheet <S#|name> append|update|upsert --rows '<json array>' [--key col] [--tab T]",
  "  trigger <S#|name> [--data '<json>' | --file payload.json]",
  "  report --title \"<title>\" --file report.md   (top of the team)",
].join("\n");

async function main() {
  const [command, ...argv] = process.argv.slice(2);
  const { positional, flags } = parseArgs(argv);
  switch (command) {
    case "status":
    case "team":
      return cmdStatus();
    case "send":
      return cmdSend(positional, flags);
    case "wait":
      return cmdWait(positional, flags);
    case "ask": {
      const agent = await cmdSend(positional, flags);
      return cmdWait([agent.id], flags);
    }
    case "reply":
      return cmdReply(positional);
    case "msg":
      return cmdMsg(positional, flags);
    case "say":
      return cmdSay(positional, flags);
    case "board":
      return cmdBoard(flags);
    case "post":
      return cmdPost(positional, flags);
    case "log":
      return cmdLog(flags);
    case "report":
      return cmdReport(positional, flags);
    case "source":
      return cmdSource(positional, flags);
    case "sheet":
      return cmdSheet(positional, flags);
    case "trigger":
      return cmdTrigger(positional, flags);
    default:
      console.log(HELP);
  }
}

main().catch((err) => {
  console.error("Error: " + (err && err.message ? err.message : String(err)));
  process.exitCode = 1;
});
`;
