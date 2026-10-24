import type { TerminalData } from "../types";
import type { TerminalLaunchExtras } from "./cliConfig";
import { isOrchestratedTerminal } from "../stores/orchestrationStore";

/** Where an agent's team files live, relative to its worktree. */
export function getAgentWorkspaceRelDir(terminalId: string): string {
  return `.termcanvas/agent/${terminalId}`;
}

/**
 * Team tools the agent may run without a permission prompt: the bridge CLI
 * and the prompt/report files it writes under `.termcanvas/`.
 */
export const TEAM_ALLOWED_TOOLS = [
  "Bash(node .termcanvas/*)",
  "Write(.termcanvas/**)",
  "Edit(.termcanvas/**)",
];

/**
 * Launch arguments end up on a Windows cmd.exe command line for npm shims,
 * so keep the generated text free of quotes, newlines and cmd metacharacters.
 */
export function toCommandLineSafe(text: string): string {
  return text
    .replace(/[\r\n]+/g, " ")
    .replace(/["&|<>^%!`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildTeamSystemPrompt(terminalId: string): string {
  const dir = getAgentWorkspaceRelDir(terminalId);
  return toCommandLineSafe(
    "You are a member of a TermCanvas agent team. Teammates, your manager and " +
      "shared data sources are wired to you on the canvas. Your team tool is " +
      `node ${dir}/tc.mjs and your rules are in ${dir}/AGENT.md. ` +
      "Read that file before your first task and follow it for the rest of this session.",
  );
}

/** Extra launch flags for a terminal: its model and, in a team, its brief. */
export function getTerminalLaunchExtras(
  terminal: Pick<TerminalData, "id" | "type" | "model">,
): TerminalLaunchExtras {
  const extras: TerminalLaunchExtras = {};
  if (terminal.model) extras.model = toCommandLineSafe(terminal.model);
  if (terminal.type === "claude" && isOrchestratedTerminal(terminal.id)) {
    extras.appendSystemPrompt = buildTeamSystemPrompt(terminal.id);
    extras.allowedTools = TEAM_ALLOWED_TOOLS;
  }
  return extras;
}
