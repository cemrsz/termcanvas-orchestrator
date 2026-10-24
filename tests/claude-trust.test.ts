import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  claudeGlobalConfigPath,
  detectBlockingPrompt,
  isClaudeFolderTrusted,
  trustClaudeFolder,
} from "../electron/claude-trust.ts";

test("trusting a folder keeps the rest of Claude's config", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tc-trust-"));
  const config = path.join(dir, ".claude.json");
  fs.writeFileSync(config, JSON.stringify({ userID: "u1", projects: { "/other": { allowedTools: ["x"] } } }));
  const project = path.join(dir, "repo");
  assert.equal(isClaudeFolderTrusted(project, config), false);
  trustClaudeFolder(project, config);
  assert.equal(isClaudeFolderTrusted(project, config), true);
  assert.equal(isClaudeFolderTrusted(path.join(project, "sub"), config), true, "children inherit");
  const saved = JSON.parse(fs.readFileSync(config, "utf-8"));
  assert.equal(saved.userID, "u1");
  assert.deepEqual(saved.projects["/other"], { allowedTools: ["x"] });
  assert.equal(saved.projects[project].hasTrustDialogAccepted, true);
});

test("a missing config is created; CLAUDE_CONFIG_DIR is honoured", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tc-trust-"));
  const config = path.join(dir, "nested", ".claude.json");
  trustClaudeFolder("/srv/app", config);
  assert.equal(isClaudeFolderTrusted("/srv/app", config), true);
  assert.equal(claudeGlobalConfigPath({ CLAUDE_CONFIG_DIR: "/cfg" }, "/home/x"), path.join("/cfg", ".claude.json"));
  assert.equal(claudeGlobalConfigPath({}, "/home/x"), path.join("/home/x", ".claude.json"));
});

// What Claude Code 2.1 prints at its trust prompt, as captured from a PTY:
// words are spaced with cursor moves, so they arrive without spaces.
const TRUST_SCREEN =
  "\x1b[2J─────\r\n\x1b[1mAccessing\x1b[1Cworkspace:\x1b[0m\r\n/tmp/proj\r\n" +
  "Quick\x1b[1Csafety\x1b[1Ccheck:\x1b[1CIs\x1b[1Cthis\x1b[1Ca\x1b[1Cproject…\r\n" +
  "❯\x1b[1CNo,\x1b[1Cexit\r\nYes,\x1b[1CI\x1b[1Ctrust\x1b[1Cthis\x1b[1Cfolder\r\n" +
  "Enter\x1b[1Cto\x1b[1Cconfirm\x1b[1C·\x1b[1CEsc\x1b[1Cto\x1b[1Ccancel\r\n";

test("start-up prompts are detected until Claude's input box appears", () => {
  assert.equal(detectBlockingPrompt(TRUST_SCREEN), "trust");
  assert.equal(
    detectBlockingPrompt(TRUST_SCREEN + "╭──╮\r\n│ > \r\n╰──╯\r\n  ? for shortcuts\r\n"),
    null,
  );
  assert.equal(detectBlockingPrompt("Choose the text style that looks best"), "onboarding");
  assert.equal(detectBlockingPrompt("Select login method:"), "login");
  assert.equal(detectBlockingPrompt("WARNING: Bypass Permissions mode … 2. Yes, I accept"), "bypass");
  assert.equal(detectBlockingPrompt("just a normal reply about trust"), null);
});
