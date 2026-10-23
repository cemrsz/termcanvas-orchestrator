/**
 * Orchestrator bridge — the files an orchestrator agent uses to drive the
 * agents and sources wired to it on the canvas.
 *
 * For each orchestrator terminal we write, inside its worktree:
 *   .termcanvas/orchestrator/<terminalId>/ORCHESTRATOR.md  (operating rules)
 *   .termcanvas/orchestrator/<terminalId>/tc.mjs           (CLI over the API)
 *
 * The CLI only talks to `/orchestrator/<id>/*`, so the orchestrator can
 * reach exactly what is wired to it and nothing else.
 */

import fs from "node:fs";
import path from "node:path";

export interface OrchestratorWorkspace {
  dir: string;
  instructionsPath: string;
  scriptPath: string;
  /** Paths relative to the worktree, with forward slashes. */
  instructionsRelPath: string;
  scriptRelPath: string;
}

export function getOrchestratorRelDir(terminalId: string): string {
  return `.termcanvas/orchestrator/${terminalId}`;
}

export function writeOrchestratorWorkspace(options: {
  terminalId: string;
  worktreePath: string;
  portFile: string;
}): OrchestratorWorkspace {
  const relDir = getOrchestratorRelDir(options.terminalId);
  const rootDir = path.join(options.worktreePath, ".termcanvas", "orchestrator");
  const dir = path.join(rootDir, options.terminalId);
  fs.mkdirSync(dir, { recursive: true });
  // Generated files never belong in the user's git history.
  fs.writeFileSync(path.join(rootDir, ".gitignore"), "*\n", "utf-8");

  const scriptRelPath = `${relDir}/tc.mjs`;
  const instructionsRelPath = `${relDir}/ORCHESTRATOR.md`;
  const scriptPath = path.join(dir, "tc.mjs");
  const instructionsPath = path.join(dir, "ORCHESTRATOR.md");

  fs.writeFileSync(
    scriptPath,
    buildOrchestratorScript(options.terminalId, options.portFile),
    "utf-8",
  );
  fs.writeFileSync(
    instructionsPath,
    buildOrchestratorInstructions(scriptRelPath, scriptPath),
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

export function buildOrchestratorStartPrompt(instructionsRelPath: string): string {
  return (
    `You are the TermCanvas orchestrator. Read ${instructionsRelPath} now and ` +
    "follow it for the rest of this session. Then run its status command, " +
    "tell me in one short message what is wired to you, and wait for my command."
  );
}

function buildOrchestratorInstructions(
  scriptRelPath: string,
  scriptAbsPath: string,
): string {
  const cli = `node ${scriptRelPath}`;
  return `# TermCanvas Orchestrator

You are the ORCHESTRATOR on the user's TermCanvas canvas. The user gives
commands only to you. Worker agents (other Claude/Codex terminals) and data
sources (Google Sheets, n8n webhooks, HTTP APIs, local files, notes) are wired
to you on the canvas, like nodes in n8n. You can only use what is wired to you,
and the user can rewire at any time, so check the wiring before each command.

## Bridge CLI

Run from the repository root (absolute path: \`${scriptAbsPath.replace(/\\/g, "/")}\`):

\`\`\`
${cli} status                          wired agents (number, name, state) and sources (S-number, kind, url, notes)
${cli} send <agent> <text>             give a task to an agent; use --file <path> for long or multi-line prompts
${cli} wait <agent> [--timeout 100]    wait for the agent's turn to end and print its final reply
${cli} ask <agent> <text>|--file <p>   send, then wait
${cli} reply <agent>                   print the agent's latest reply again
${cli} source <S#|name> [--lines 200] [--query "status=Pending&limit=20"]
                                        read a source: sheet -> CSV rows, n8n/api -> GET response, file -> content, note -> text
${cli} trigger <S#|name> [--data '<json>' | --file payload.json]   POST JSON to an n8n/API source (actions)
\`\`\`

\`<agent>\` is the number from \`status\`, the agent's name, or its id.
\`wait\` exit codes: 0 = done (reply printed), 2 = still working (run \`wait\`
again), 3 = the agent is waiting for the user to approve something in its own
terminal.

## How to work

1. On every new command from the user, run \`status\` first.
2. Split the command into tasks and give each task to the wired agent whose
   name fits it (the user names agents by role, e.g. "Copywriter").
   Workers do not see this conversation: write self-contained prompts with all
   context, data excerpts, file paths and the output format you expect back.
   For anything longer than one line, write the prompt to a file under
   \`.termcanvas/orchestrator/\` and use \`--file\`.
3. Independent tasks: \`send\` to all agents first, then \`wait\` on each.
   Dependent tasks: run them in order and pass the results along.
4. Read sources yourself with \`source\` and hand agents only the rows they need.
   \`source\` on an n8n/API source is a GET that only reads (pass filters with
   \`--query\`; the source notes say which ones it accepts). \`trigger\` is a POST
   that acts on the outside world (it can send emails, write rows, start
   workflows): only run it when the user's command asks for that action.
5. If \`wait\` exits with 3, tell the user which agent needs approval, then
   \`wait\` again once they say it is done.
6. Do not do a worker's job yourself unless no fitting agent is wired; if
   something is missing, say so (e.g. "no agent for research is connected").
7. Report back briefly: which agent did what, and the outcome. Reply in the
   language the user writes in.
`;
}

/**
 * The CLI is plain Node (no dependencies) so it runs from any agent shell.
 * Written without template literals so it can be embedded in String.raw.
 */
function buildOrchestratorScript(orchestratorId: string, portFile: string): string {
  const header =
    "#!/usr/bin/env node\n" +
    "// TermCanvas orchestrator bridge. Generated by TermCanvas; edits are overwritten.\n" +
    `const ORCHESTRATOR_ID = ${JSON.stringify(orchestratorId)};\n` +
    `const PORT_FILE = ${JSON.stringify(portFile)};\n`;
  return header + ORCHESTRATOR_SCRIPT_BODY;
}

const ORCHESTRATOR_SCRIPT_BODY = String.raw`
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";

const BASE = "/orchestrator/" + encodeURIComponent(ORCHESTRATOR_ID);
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

async function cmdStatus() {
  const m = await api("GET", BASE);
  const lines = [];
  lines.push("Orchestrator: " + m.orchestrator.title + " (" + m.orchestrator.id + ")");
  lines.push("");
  lines.push("Agents wired to you (" + m.agents.length + "):");
  if (m.agents.length === 0) lines.push("  (none - ask the user to wire agents to you on the canvas)");
  m.agents.forEach((a, i) => {
    lines.push(
      "  " + (i + 1) + ". " + a.name + "  [" + a.type + "]  state=" + (a.turnState || a.status) +
        (a.ptyId ? "" : "  (not running)") + "  id=" + a.id,
    );
  });
  lines.push("");
  lines.push("Sources wired to you (" + m.sources.length + "):");
  if (m.sources.length === 0) lines.push("  (none)");
  m.sources.forEach((s, i) => {
    lines.push("  S" + (i + 1) + ". " + s.name + "  [" + s.kind + "]" + (s.url ? "  " + s.url : ""));
    if (s.description) {
      for (const line of s.description.split("\n")) lines.push("      " + line);
    }
  });
  console.log(lines.join("\n"));
}

async function cmdSend(rest, flags) {
  const agent = rest.shift();
  if (!agent) throw new Error("Usage: send <agent> <text> | --file <path>");
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
      ACTIVE_STATES.has(state) ||
      Date.now() - sentAt > START_GRACE_MS;
    if (started && DONE_STATES.has(state)) {
      const r = await api("GET", BASE + "/reply?agent=" + encodeURIComponent(agentId));
      console.log("[" + a.name + " finished: " + state + "]");
      console.log(truncate(r.reply || "(no reply text found)", MAX_PRINT_CHARS));
      return 0;
    }
    if (state === "awaiting_input") {
      console.log(
        "WAITING_FOR_APPROVAL: " + a.name + " is waiting for the user to approve or answer something in its terminal.",
      );
      process.exitCode = 3;
      return 3;
    }
    if (!a.ptyId) {
      throw new Error(a.name + " is not running. Ask the user to open or restart that terminal.");
    }
    if (Date.now() >= deadline) {
      console.log("STILL_WORKING: " + a.name + " state=" + state + ". Run wait again.");
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

function resolveSource(manifest, ref) {
  const sources = manifest.sources;
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
    "No single wired source matches '" + ref + "'. Wired: " +
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

async function cmdSource(rest, flags) {
  const ref = rest.shift();
  if (!ref) throw new Error("Usage: source <S#|name> [--lines 200] [--query \"k=v&k2=v2\"]");
  const manifest = await api("GET", BASE);
  const s = resolveSource(manifest, ref);
  const maxLines = parseInt(flags.lines, 10) || 200;
  console.log("[" + s.name + " - " + s.kind + "]");
  if (s.description && s.kind !== "note") console.log("Notes: " + s.description);
  if (s.kind === "note") {
    console.log(s.description || "(empty note)");
    return;
  }
  if (!s.url) throw new Error("Source '" + s.name + "' has no URL/path set on the canvas.");
  if (s.kind === "file") {
    const stat = fs.statSync(s.url);
    if (stat.isDirectory()) {
      console.log(fs.readdirSync(s.url).join("\n"));
    } else {
      console.log(truncate(limitLines(fs.readFileSync(s.url, "utf-8"), maxLines), MAX_PRINT_CHARS));
    }
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
        "or wire an n8n webhook source that reads it.",
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
}

async function cmdTrigger(rest, flags) {
  const ref = rest.shift();
  if (!ref) throw new Error("Usage: trigger <S#|name> [--data '<json>' | --file payload.json]");
  const manifest = await api("GET", BASE);
  const s = resolveSource(manifest, ref);
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
  if (!res.ok) process.exitCode = 1;
}

const HELP = [
  "TermCanvas orchestrator bridge",
  "  status",
  "  send <agent> <text> | --file <path>",
  "  wait <agent> [--timeout 100]",
  "  ask <agent> <text> | --file <path> [--timeout 100]",
  "  reply <agent>",
  "  source <S#|name> [--lines 200] [--query \"k=v&k2=v2\"]",
  "  trigger <S#|name> [--data '<json>' | --file payload.json]",
].join("\n");

async function main() {
  const [command, ...argv] = process.argv.slice(2);
  const { positional, flags } = parseArgs(argv);
  switch (command) {
    case "status":
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
    case "source":
      return cmdSource(positional, flags);
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

const ANSI_PATTERN =
  // eslint-disable-next-line no-control-regex
  /\x1b\[[0-?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[@-Z\\-_]/g;

export function stripAnsi(text: string): string {
  return text.replace(ANSI_PATTERN, "");
}

const MAX_SESSION_TAIL_BYTES = 4 * 1024 * 1024;

function readTail(filePath: string): string {
  const stat = fs.statSync(filePath);
  if (stat.size <= MAX_SESSION_TAIL_BYTES) {
    return fs.readFileSync(filePath, "utf-8");
  }
  const fd = fs.openSync(filePath, "r");
  try {
    const buffer = Buffer.alloc(MAX_SESSION_TAIL_BYTES);
    fs.readSync(fd, buffer, 0, buffer.length, stat.size - buffer.length);
    const text = buffer.toString("utf-8");
    // Drop the partial first line.
    return text.slice(text.indexOf("\n") + 1);
  } finally {
    fs.closeSync(fd);
  }
}

type ContentBlock = { type?: string; text?: string };

function contentBlocks(content: unknown): ContentBlock[] {
  if (typeof content === "string") return [{ type: "text", text: content }];
  return Array.isArray(content) ? (content as ContentBlock[]) : [];
}

/**
 * Pull the assistant text written since the last real user prompt out of a
 * Claude Code or Codex session transcript (JSONL).
 */
export function extractLastAssistantReply(sessionFile: string): string | null {
  let raw: string;
  try {
    raw = readTail(sessionFile);
  } catch {
    return null;
  }

  let replyParts: string[] = [];
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    let entry: Record<string, any>;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    if (entry.isMeta || entry.isSidechain) continue;
    // Claude: { type, message: { role, content } }
    // Codex:  { type: "response_item", payload: { type: "message", role, content } }
    const message = entry.message ?? entry.payload;
    if (!message || typeof message !== "object") continue;
    const role = message.role;
    const blocks = contentBlocks(message.content);
    if (role === "user") {
      if (blocks.some((block) => block.type === "tool_result")) continue;
      const text = blocks
        .filter(
          (block) =>
            (block.type === "text" || block.type === "input_text") &&
            typeof block.text === "string",
        )
        .map((block) => block.text!)
        .join("\n")
        .trim();
      if (!text) continue;
      // Hooks, slash-command echoes and system notices are also "user"
      // entries; only a prompt someone actually typed starts a new turn.
      const originKind = entry.origin?.kind;
      const isPrompt = originKind
        ? originKind === "human"
        : !text.startsWith("<");
      if (isPrompt) replyParts = [];
      continue;
    }
    if (role !== "assistant") continue;
    for (const block of blocks) {
      if (
        (block.type === "text" || block.type === "output_text") &&
        typeof block.text === "string" &&
        block.text.trim()
      ) {
        replyParts.push(block.text.trim());
      }
    }
  }
  return replyParts.length > 0 ? replyParts.join("\n\n") : null;
}
