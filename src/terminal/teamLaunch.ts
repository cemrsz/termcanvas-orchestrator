import type { TerminalData } from "../types";
import type { TerminalLaunchExtras } from "./cliConfig";

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

/** Extra launch flags for a terminal, such as the model it runs. */
export function getTerminalLaunchExtras(
  terminal: Pick<TerminalData, "id" | "type" | "model">,
): TerminalLaunchExtras {
  const extras: TerminalLaunchExtras = {};
  if (terminal.model) extras.model = toCommandLineSafe(terminal.model);
  return extras;
}
