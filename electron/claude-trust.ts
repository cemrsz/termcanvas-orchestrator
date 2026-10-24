/**
 * Claude Code's folder trust and the start-up prompts that block an agent.
 *
 * In a folder it has not been told to trust, every interactive Claude stops
 * at "Do you trust this folder?" with "No, exit" preselected. With a team of
 * 25 agents that is 25 prompts, and a task pasted into one of them with
 * Enter would answer "No, exit". So TermCanvas offers to mark the folder as
 * trusted before it launches a team (the same flag the dialog sets:
 * `projects[<folder>].hasTrustDialogAccepted` in Claude's global config),
 * and never types into an agent that sits at one of these prompts.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function claudeGlobalConfigPath(
  env: Record<string, string | undefined> = process.env,
  home = os.homedir(),
): string {
  const configDir = env.CLAUDE_CONFIG_DIR?.trim();
  return configDir
    ? path.join(configDir, ".claude.json")
    : path.join(home, ".claude.json");
}

/** Keys Claude may use for a folder: native and forward-slash spellings. */
function folderKeys(folder: string): string[] {
  const resolved = path.resolve(folder);
  const forward = resolved.replace(/\\/g, "/");
  return [...new Set([resolved, forward])];
}

function readConfig(configPath: string): Record<string, unknown> | null {
  try {
    return JSON.parse(fs.readFileSync(configPath, "utf-8"));
  } catch {
    return null;
  }
}

/** True if the folder or one of its parents was trusted in Claude. */
export function isClaudeFolderTrusted(
  folder: string,
  configPath = claudeGlobalConfigPath(),
): boolean {
  const config = readConfig(configPath);
  const projects = config?.projects;
  if (!projects || typeof projects !== "object") return false;
  let current = path.resolve(folder);
  while (true) {
    for (const key of folderKeys(current)) {
      const entry = (projects as Record<string, { hasTrustDialogAccepted?: unknown }>)[key];
      if (entry?.hasTrustDialogAccepted === true) return true;
    }
    const parent = path.dirname(current);
    if (parent === current) return false;
    current = parent;
  }
}

export function trustClaudeFolder(
  folder: string,
  configPath = claudeGlobalConfigPath(),
): void {
  const config = readConfig(configPath) ?? {};
  const projects =
    config.projects && typeof config.projects === "object"
      ? (config.projects as Record<string, Record<string, unknown>>)
      : {};
  for (const key of folderKeys(folder)) {
    projects[key] = { ...(projects[key] ?? {}), hasTrustDialogAccepted: true };
  }
  config.projects = projects;
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  const tmp = `${configPath}.termcanvas-${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(config, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, configPath);
}

export type BlockingPrompt = "trust" | "bypass" | "onboarding" | "login";

const ANSI =
  // eslint-disable-next-line no-control-regex
  /\x1b\[[0-?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[@-Z\\-_]/g;

/** Text Claude shows once its normal input box is up. */
const READY_MARKERS = [
  "forshortcuts",
  "esctointerrupt",
  "shift+tabtocycle",
  "permissionson",
  "acceptedits",
  "planmodeon",
];

const PROMPT_MARKERS: [BlockingPrompt, string[]][] = [
  ["trust", ["itrustthisfolder", "doyoutrustthefilesinthisfolder"]],
  ["bypass", ["yes,iaccept"]],
  ["onboarding", ["choosethetextstyle"]],
  ["login", ["selectloginmethod", "pastecodehere"]],
];

/**
 * Which start-up prompt, if any, the terminal is sitting at: the prompt
 * whose text came last, unless Claude's normal input box was drawn after
 * it. Claude spaces words with cursor moves, so the text is compared with
 * all whitespace removed.
 */
export function detectBlockingPrompt(outputTail: string): BlockingPrompt | null {
  const text = outputTail.replace(ANSI, "").replace(/\s+/g, "").toLowerCase();
  const lastReady = Math.max(...READY_MARKERS.map((marker) => text.lastIndexOf(marker)));
  let found: BlockingPrompt | null = null;
  let foundAt = -1;
  for (const [prompt, markers] of PROMPT_MARKERS) {
    for (const marker of markers) {
      const at = text.lastIndexOf(marker);
      if (at > foundAt) {
        found = prompt;
        foundAt = at;
      }
    }
  }
  return found && foundAt > lastReady ? found : null;
}

export function describeBlockingPrompt(
  name: string,
  prompt: BlockingPrompt,
): string {
  switch (prompt) {
    case "trust":
      return `${name} is waiting at Claude's "trust this folder?" prompt. Answer it in its terminal first.`;
    case "bypass":
      return `${name} is waiting for its bypass-permissions warning to be accepted in its terminal.`;
    case "onboarding":
      return `${name} is still in Claude's first-run setup. Finish it in its terminal first.`;
    case "login":
      return `${name} is not logged in to Claude. Log in in its terminal first.`;
  }
}
