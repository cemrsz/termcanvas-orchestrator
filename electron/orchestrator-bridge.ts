/**
 * Bridge workspaces — the files an agent uses to reach what is wired to it
 * on the canvas.
 *
 * Orchestrators get, inside their worktree:
 *   .termcanvas/orchestrator/<terminalId>/ORCHESTRATOR.md  (operating rules)
 *   .termcanvas/orchestrator/<terminalId>/tc.mjs           (bridge CLI)
 *
 * Agents on a pipeline (Claude ↔ Gemini ↔ Codex…) get:
 *   .termcanvas/bridge/<terminalId>/BRIDGE.md              (how to talk to peers)
 *   .termcanvas/bridge/<terminalId>/tc.mjs                 (bridge CLI)
 *
 * The CLI only talks to `/bridge/<id>/*`, so an agent can reach exactly what
 * is wired to it and nothing else.
 */

import fs from "node:fs";
import path from "node:path";
import { buildBridgeScript } from "./bridge-script";

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
    buildBridgeScript({
      terminalId: options.terminalId,
      portFile: options.portFile,
      role: "orchestrator",
    }),
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

export function getAgentBridgeRelDir(terminalId: string): string {
  return `.termcanvas/bridge/${terminalId}`;
}

/** Files for an agent on a pipeline: BRIDGE.md and its own tc.mjs. */
export function writeAgentBridgeWorkspace(options: {
  terminalId: string;
  worktreePath: string;
  portFile: string;
}): OrchestratorWorkspace {
  const relDir = getAgentBridgeRelDir(options.terminalId);
  const rootDir = path.join(options.worktreePath, ".termcanvas", "bridge");
  const dir = path.join(rootDir, options.terminalId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(rootDir, ".gitignore"), "*\n", "utf-8");

  const scriptRelPath = `${relDir}/tc.mjs`;
  const instructionsRelPath = `${relDir}/BRIDGE.md`;
  const scriptPath = path.join(dir, "tc.mjs");
  const instructionsPath = path.join(dir, "BRIDGE.md");
  fs.writeFileSync(
    scriptPath,
    buildBridgeScript({
      terminalId: options.terminalId,
      portFile: options.portFile,
      role: "agent",
    }),
    "utf-8",
  );
  fs.writeFileSync(
    instructionsPath,
    buildAgentBridgeInstructions(scriptRelPath, scriptPath),
    "utf-8",
  );
  return { dir, instructionsPath, scriptPath, instructionsRelPath, scriptRelPath };
}

/** Sent into an agent when it is first wired to peers. */
export function buildPipelineBriefPrompt(
  instructionsRelPath: string,
  peers: { name: string; type: string }[],
): string {
  const list =
    peers.length > 0
      ? peers.map((peer) => `${peer.name} (${peer.type})`).join(", ")
      : "other agents";
  return (
    `[TermCanvas] You are now wired by pipelines to: ${list}. ` +
    `Read ${instructionsRelPath} now and follow it to talk to them when I ask ` +
    "or when their help clearly serves my request. Reply with one short line."
  );
}

function buildAgentBridgeInstructions(
  scriptRelPath: string,
  scriptAbsPath: string,
): string {
  const cli = `node ${scriptRelPath}`;
  return `# TermCanvas pipelines

You are an AI agent running in a terminal on the user's TermCanvas canvas.
The user wired you with pipelines to other AI agents (for example Claude,
Gemini and Codex, each in its own terminal) and maybe to AI models and data
sources. Everything wired to you can be reached with this CLI. The user can
rewire at any time, so run \`peers\` before you rely on the wiring.

## Bridge CLI

Run from the repository root (absolute path: \`${scriptAbsPath.replace(/\\/g, "/")}\`):

\`\`\`
${cli} peers                              who is wired to you: agents (1, 2…), models (M1…), sources (S1…)
${cli} ask <agent|model> <text>           message an agent and wait for its reply, or ask a model
${cli} send <agent> <text>                message an agent without waiting (then use wait)
${cli} wait <agent> [--timeout 100]       wait for the agent's reply and print it
${cli} reply <agent>                      print the agent's latest reply again
${cli} consult <model> <text>             ask a wired AI model (Claude, Gemini, ChatGPT… over API or CLI)
${cli} council <question> [--agents]      ask every wired model (and agent) the same question, compare
${cli} broadcast <text>                   message every wired agent (then wait on each)
${cli} discuss <p1,p2[,p3]> <topic> [--rounds 2]   let peers discuss in turns; prints the transcript
${cli} source <S#|name> / trigger <S#|name>   read / trigger a wired data source
\`\`\`

Put flags after the text (\`council "…" --agents\`), or write the text to a
file and pass \`--file\`. Models answer in one shot and cannot see files:
include the code or data they need in the message.

\`<agent>\` is the number from \`peers\`, the agent's name, its type
(e.g. \`gemini\`) when only one of that type is wired, or its id. For long or
multi-line text write it to a file under \`.termcanvas/\` and pass
\`--file <path>\`. \`wait\` exit codes: 0 = reply printed, 2 = still working
(run \`wait\` again), 3 = the agent waits for the user's approval in its
own terminal.

## Rules

1. Talk to peers when the user asks you to, or when a peer's help clearly
   serves the user's request. Do not chat for its own sake.
2. Messages from peers arrive in your chat and start with
   "[TermCanvas pipeline]". Answer them in your normal reply: the sender reads
   your reply automatically. While answering, do not \`send\`/\`ask\` that
   sender back (it is waiting for you); ask other peers if you need to.
3. Peers do not see your conversation. Write self-contained messages: the
   goal, the context, file paths, and the answer format you expect.
4. You share the machine with your peers. Say which files you change and do
   not edit a file a peer is working on.
5. If a bridge command fails with a sandbox or network error, run it again
   with escalated permissions: it only talks to TermCanvas on 127.0.0.1.
6. Keep peer conversations short. Tell the user who said what, in the
   language the user writes in.
`;
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
commands only to you. Worker agents (other Claude / Codex / Gemini
terminals), AI models (Claude, Gemini, ChatGPT… nodes that answer over their
API or CLI) and data sources (Google Sheets, n8n webhooks, HTTP APIs, local
files, notes) are wired to you on the canvas, like nodes in n8n. You can only
use what is wired to you, and the user can rewire at any time, so check the
wiring before each command.

## Bridge CLI

Run from the repository root (absolute path: \`${scriptAbsPath.replace(/\\/g, "/")}\`):

\`\`\`
${cli} status                          wired agents (number, name, state), models (M-number) and sources (S-number)
${cli} send <agent> <text>             give a task to an agent; use --file <path> for long or multi-line prompts
${cli} wait <agent> [--timeout 100]    wait for the agent's turn to end and print its final reply
${cli} ask <agent|model> <text>        agent: send, then wait; model: ask it and print the answer
${cli} reply <agent>                   print the agent's latest reply again
${cli} consult <M#|name> <text>        ask a wired AI model (one shot, no tools, no files)
${cli} council <question> [--models M1,M2] [--agents]   same question to several models/agents, answers side by side
${cli} discuss <p1,p2[,p3]> <topic> [--rounds 2]         let models/agents debate in turns; prints the transcript
${cli} broadcast <text>                give every wired agent the same message
${cli} source <S#|name> [--lines 200] [--query "status=Pending&limit=20"]
                                        read a source: sheet -> CSV rows, n8n/api -> GET response, file -> content, note -> text
${cli} trigger <S#|name> [--data '<json>' | --file payload.json]   POST JSON to an n8n/API source (actions)
\`\`\`

\`<agent>\` is the number from \`status\`, the agent's name, its type (e.g.
\`gemini\`) when only one of that type is wired, or its id. Put flags after
the text, or pass long text with \`--file\`.
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
7. Models are for thinking, not doing: second opinions, reviews of a diff
   you paste in, brainstorming, translations, fact checks. They answer in one
   shot and cannot see files, so include what they need. Use \`council\` when
   the user wants several opinions, \`discuss\` when the user asks the AIs to
   debate or agree on something. Agents do the actual work in the repository.
8. Report back briefly: which agent or model did what, and the outcome. Reply
   in the language the user writes in.
`;
}

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
