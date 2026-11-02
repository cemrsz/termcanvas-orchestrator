import test from "node:test";
import assert from "node:assert/strict";

import {
  PIPELINE_HEADER,
  PipelineGuard,
  framePipelineMessage,
} from "../electron/pipeline-guard.ts";

const claude = { id: "t-claude", name: "Claude" };
const gemini = { id: "t-gemini", name: "Gemini" };
const codex = { id: "t-codex", name: "Codex" };

test("peer messages carry the sender and the receiver's bridge", () => {
  const framed = framePipelineMessage({
    fromName: "Claude",
    fromType: "claude",
    text: "  Can you review src/auth.ts?  ",
    receiverScriptRelPath: ".termcanvas/bridge/t-gemini/tc.mjs",
  });
  assert.ok(framed.startsWith(`${PIPELINE_HEADER} Message from Claude (claude):\n\nCan you review src/auth.ts?\n\n`));
  assert.ok(framed.includes("Claude reads it automatically"));
  assert.ok(framed.endsWith("node .termcanvas/bridge/t-gemini/tc.mjs peers"));
});

test("an agent cannot message the agent that is waiting for its reply", () => {
  let now = 0;
  const guard = new PipelineGuard({ now: () => now });
  assert.deepEqual(guard.checkSend(claude, gemini), { ok: true });
  guard.noteWaiting(claude.id, gemini.id);

  const verdict = guard.checkSend(gemini, claude);
  assert.equal(verdict.ok, false);
  assert.equal(verdict.ok === false && verdict.status, 409);
  assert.match(verdict.ok === false ? verdict.reason : "", /Claude is waiting for your reply/);

  assert.deepEqual(guard.checkSend(gemini, codex), { ok: true }, "others are fine");
  now += 11_000;
  assert.deepEqual(guard.checkSend(gemini, claude), { ok: true }, "wait expired");
});

test("a pair of agents is paused after too many messages", () => {
  let now = 0;
  const guard = new PipelineGuard({ now: () => now, maxPerWindow: 3, rateWindowMs: 60_000 });
  for (let i = 0; i < 3; i++) {
    assert.equal(guard.checkSend(i % 2 ? claude : codex, i % 2 ? codex : claude).ok, true);
  }
  const blocked = guard.checkSend(claude, codex);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.ok === false && blocked.status, 429);
  assert.equal(guard.checkSend(claude, gemini).ok, true, "other pairs unaffected");
  now += 61_000;
  assert.equal(guard.checkSend(claude, codex).ok, true, "window slid");
});
