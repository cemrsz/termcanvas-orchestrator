/**
 * Orchestrator bridge — prepares an orchestrator terminal.
 *
 * An orchestrator is a team manager, so its files are the team bridge
 * (see team-bridge.ts) under `.termcanvas/agent/<terminalId>/`. Sessions
 * briefed before teams existed were told to use
 * `.termcanvas/orchestrator/<terminalId>/`; that folder gets the same CLI
 * and instructions so resumed conversations keep working.
 */

import fs from "node:fs";
import path from "node:path";
import {
  buildAgentInstructions,
  buildTeamScript,
  writeAgentWorkspace,
  type AgentWorkspace,
} from "./team-bridge";

export type OrchestratorWorkspace = AgentWorkspace;

export function getOrchestratorRelDir(terminalId: string): string {
  return `.termcanvas/orchestrator/${terminalId}`;
}

export function writeOrchestratorWorkspace(options: {
  terminalId: string;
  worktreePath: string;
  portFile: string;
  /** True when this orchestrator reports to another one. */
  hasManager?: boolean;
}): OrchestratorWorkspace {
  const role = { isManager: true, hasManager: options.hasManager ?? false };
  const workspace = writeAgentWorkspace({ ...options, role });

  const legacyRoot = path.join(options.worktreePath, ".termcanvas", "orchestrator");
  const legacyDir = path.join(legacyRoot, options.terminalId);
  fs.mkdirSync(legacyDir, { recursive: true });
  fs.writeFileSync(path.join(legacyRoot, ".gitignore"), "*\n", "utf-8");
  const legacyRelDir = getOrchestratorRelDir(options.terminalId);
  fs.writeFileSync(
    path.join(legacyDir, "tc.mjs"),
    buildTeamScript(options.terminalId, options.portFile),
    "utf-8",
  );
  fs.writeFileSync(
    path.join(legacyDir, "ORCHESTRATOR.md"),
    buildAgentInstructions({
      terminalId: options.terminalId,
      scriptRelPath: `${legacyRelDir}/tc.mjs`,
      relDir: legacyRelDir,
      role,
    }),
    "utf-8",
  );
  return workspace;
}

export function buildOrchestratorStartPrompt(instructionsRelPath: string): string {
  return (
    `You are a TermCanvas orchestrator (a team manager). Read ${instructionsRelPath} now and ` +
    "follow it for the rest of this session. Then run its status command, " +
    "tell me in one short message who and what is wired to your team, and wait for my command."
  );
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
