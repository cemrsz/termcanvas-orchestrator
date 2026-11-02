import test from "node:test";
import assert from "node:assert/strict";

import { CommsLog } from "../electron/comms-log.ts";
import {
  clipCommsText,
  commsWireKey,
  USER_PARTY,
  type CommsEntry,
  type CommsParty,
} from "../shared/comms.ts";

const claude: CommsParty = { kind: "agent", id: "t-claude", name: "Claude", type: "claude" };
const gemini: CommsParty = { kind: "agent", id: "t-gemini", name: "Gemini", type: "gemini" };

test("record stamps id and time, notifies listeners and keeps order", () => {
  let clock = 100;
  const log = new CommsLog({ now: () => ++clock });
  const seen: CommsEntry[] = [];
  const unsubscribe = log.subscribe((entry) => seen.push(entry));
  const first = log.record({ kind: "message", from: claude, to: gemini, text: "Selam" });
  log.record({ kind: "reply", from: gemini, to: claude, text: "Merhaba" });
  unsubscribe();
  log.record({ kind: "message", from: claude, to: gemini, text: "unseen" });

  assert.equal(first.at, 101);
  assert.match(first.id, /^comms-/);
  assert.deepEqual(seen.map((entry) => entry.text), ["Selam", "Merhaba"]);
  assert.deepEqual(log.list().map((entry) => entry.kind), ["message", "reply", "message"]);
  assert.notEqual(log.list()[0].id, log.list()[2].id);
});

test("the buffer keeps only the newest entries and clips long text", () => {
  const log = new CommsLog({ limit: 3 });
  for (let i = 0; i < 5; i++) {
    log.record({ kind: "ask", from: USER_PARTY, to: gemini, text: `q${i}` });
  }
  assert.deepEqual(log.list().map((entry) => entry.text), ["q2", "q3", "q4"]);
  assert.deepEqual(log.list(2).map((entry) => entry.text), ["q3", "q4"]);

  const long = log.record({ kind: "answer", from: gemini, to: USER_PARTY, text: "x".repeat(4100) });
  assert.equal(long.text.length, 4000);
  assert.equal(long.truncated, 100);
  assert.deepEqual(clipCommsText("short"), { text: "short" });

  log.clear();
  assert.equal(log.list().length, 0);
});

test("last finds the newest entry of a kind between two parties", () => {
  const log = new CommsLog();
  log.record({ kind: "reply", from: gemini, to: claude, text: "old" });
  log.record({ kind: "reply", from: claude, to: gemini, text: "other way" });
  log.record({ kind: "reply", from: gemini, to: claude, text: "new" });
  assert.equal(log.last("reply", "t-gemini", "t-claude")?.text, "new");
  assert.equal(log.last("message", "t-gemini", "t-claude"), undefined);
});

test("a throwing listener does not block the others", () => {
  const log = new CommsLog();
  const seen: string[] = [];
  log.subscribe(() => {
    throw new Error("boom");
  });
  log.subscribe((entry) => seen.push(entry.text));
  log.record({ kind: "brief", from: USER_PARTY, to: claude, text: "wired" });
  assert.deepEqual(seen, ["wired"]);
});

test("wire keys ignore direction", () => {
  assert.equal(commsWireKey("a", "b"), commsWireKey("b", "a"));
  assert.notEqual(commsWireKey("a", "b"), commsWireKey("a", "c"));
});
