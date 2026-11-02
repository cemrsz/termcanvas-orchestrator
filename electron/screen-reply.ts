/**
 * Read an agent's answer off its terminal screen.
 *
 * Claude and Codex keep transcripts TermCanvas can read; Gemini CLI (and any
 * agent without one) only has its screen. Their TUIs draw the conversation
 * between boxes and status lines, so the answer is the text between the
 * message we sent and the input box at the bottom.
 */

const BOX_TOP = /^\s*[╭┌]/;
const BOX_BOTTOM = /^\s*[╰└]/;
const BOX_SIDE = /^\s*[│┃]\s?|\s?[│┃]\s*$/g;
const INPUT_HINT = /Type your message|^\s*[│┃]?\s*>\s*$|^\s*[│┃]\s*>\s/;

const APPROVAL_PATTERNS = [
  /Allow execution/i,
  /Apply this change\?/i,
  /Do you want to proceed/i,
  /Do you want to make this edit/i,
  /Yes, allow once/i,
  /Allow once/i,
  /Waiting for user confirmation/i,
  /\(y\/n\)\s*$/i,
];

function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

function firstMeaningfulLine(text: string): string {
  for (const line of text.split("\n")) {
    const cleaned = line.trim();
    if (cleaned) return cleaned;
  }
  return "";
}

/** Index of the input box the TUI draws at the bottom, if any. */
function findInputBox(lines: string[], from: number): number {
  for (let i = lines.length - 1; i >= from; i--) {
    if (!BOX_TOP.test(lines[i])) continue;
    const window = lines.slice(i, i + 4).join("\n");
    if (INPUT_HINT.test(window)) return i;
    // Only the lowest box can be the input box.
    if (i < lines.length - 12) break;
  }
  return -1;
}

export function extractScreenReply(screen: string, sentText?: string): string {
  const lines = screen.replace(/\r/g, "").split("\n").map((line) => line.trimEnd());

  let end = lines.length;
  const inputBox = findInputBox(lines, 0);
  if (inputBox >= 0) end = inputBox;

  let start = Math.max(0, end - 80);
  const needle = sentText ? normalize(firstMeaningfulLine(sentText)).slice(0, 32) : "";
  if (needle) {
    for (let i = end - 1; i >= 0; i--) {
      if (normalize(lines[i].replace(BOX_SIDE, "")).includes(needle)) {
        start = i + 1;
        // A prompt drawn inside a box ends at the box's bottom edge.
        if (/^\s*[│┃]/.test(lines[i])) {
          for (let j = i + 1; j < end; j++) {
            if (BOX_BOTTOM.test(lines[j])) {
              start = j + 1;
              break;
            }
          }
        }
        break;
      }
    }
  }

  // Gemini marks its answer with ✦: start there when it is present.
  const marked = lines.slice(start, end).findIndex((line) => /^\s*✦/.test(line));
  if (marked > 0) start += marked;

  const kept = lines
    .slice(start, end)
    .map((line) => line.replace(/^(\s*)✦\s?/, "$1"));
  // An empty input prompt left at the bottom is not part of the answer.
  while (kept.length > 0 && /^\s*[>❯$]?\s*$/.test(kept[kept.length - 1])) {
    kept.pop();
  }
  return kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** Does the screen show the agent asking the user to approve something? */
export function detectApprovalPrompt(screen: string): boolean {
  const tail = screen.replace(/\r/g, "").split("\n").slice(-25).join("\n");
  return APPROVAL_PATTERNS.some((pattern) => pattern.test(tail));
}
