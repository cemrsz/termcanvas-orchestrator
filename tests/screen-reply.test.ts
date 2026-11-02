import test from "node:test";
import assert from "node:assert/strict";

import { detectApprovalPrompt, extractScreenReply } from "../electron/screen-reply.ts";

const SENT =
  "[TermCanvas pipeline] Message from Claude (claude):\n\nCan you review src/auth.ts?\n\n— Answer in your reply";

const GEMINI_SCREEN = [
  " ███ GEMINI",
  "Tips for getting started:",
  "1. Ask questions, edit files, or run commands.",
  "",
  "╭──────────────────────────────────────────────────────────────╮",
  "│ > [TermCanvas pipeline] Message from Claude (claude):        │",
  "│                                                              │",
  "│   Can you review src/auth.ts?                                │",
  "╰──────────────────────────────────────────────────────────────╯",
  "",
  " ╭──────────────────────────────╮",
  " │ ✔  ReadFile src/auth.ts      │",
  " ╰──────────────────────────────╯",
  "✦ The token check compares strings with ===, which leaks timing.",
  "  Use crypto.timingSafeEqual instead.",
  "",
  "",
  "",
  "  Everything else looks fine.",
  "",
  "╭──────────────────────────────────────────────────────────────╮",
  "│ >   Type your message or @path/to/file                       │",
  "╰──────────────────────────────────────────────────────────────╯",
  "~/repo (main*)          no sandbox          gemini-2.5-pro (97% context left)",
].join("\n");

test("the answer is the text between our message and the input box", () => {
  assert.equal(
    extractScreenReply(GEMINI_SCREEN, SENT),
    [
      "The token check compares strings with ===, which leaks timing.",
      "  Use crypto.timingSafeEqual instead.",
      "",
      "  Everything else looks fine.",
    ].join("\n"),
  );
});

test("only the newest exchange is returned", () => {
  const screen = GEMINI_SCREEN.replace(
    " ███ GEMINI",
    [
      "╭────╮",
      "│ > [TermCanvas pipeline] Message from Claude (claude): │",
      "╰────╯",
      "✦ An older answer.",
    ].join("\n"),
  );
  assert.ok(!extractScreenReply(screen, SENT).includes("older answer"));
});

test("without the sent text the tail above the input box is used", () => {
  const reply = extractScreenReply(GEMINI_SCREEN);
  assert.ok(reply.includes("Everything else looks fine."));
  assert.ok(!reply.includes("Type your message"));
  assert.ok(!reply.includes("context left"));
});

test("plain TUIs without boxes still work", () => {
  const screen = ["> hello there", "Hi! How can I help?", "> "].join("\n");
  assert.equal(extractScreenReply(screen, "hello there"), "Hi! How can I help?");
});

test("approval prompts at the bottom of the screen are detected", () => {
  assert.equal(detectApprovalPrompt(GEMINI_SCREEN), false);
  const asking = GEMINI_SCREEN + "\n│ Allow execution of: 'npm test'? │\n│ ● 1. Yes, allow once │";
  assert.equal(detectApprovalPrompt(asking), true);
  assert.equal(detectApprovalPrompt("Continue? (y/n) "), true);
});
