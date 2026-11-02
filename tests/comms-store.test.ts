import test from "node:test";
import assert from "node:assert/strict";

import {
  COMMS_PULSE_MS,
  EMPTY_COMMS_STATE,
  applyCommsEntry,
  prunePulses,
  useCommsStore,
} from "../src/stores/commsStore.ts";
import { commsWireKey, USER_PARTY, type CommsEntry, type CommsParty } from "../shared/comms.ts";

const claude: CommsParty = { kind: "agent", id: "t1", name: "Claude", type: "claude" };
const gemini: CommsParty = { kind: "model", id: "m1", name: "Gemini", type: "gemini" };

let n = 0;
function entry(partial: Partial<CommsEntry>): CommsEntry {
  n++;
  return {
    id: `e${n}`,
    at: n,
    kind: "message",
    from: claude,
    to: gemini,
    text: `t${n}`,
    ...partial,
  };
}

test("an ask marks the model busy until its answer arrives", () => {
  let state = applyCommsEntry(
    EMPTY_COMMS_STATE,
    entry({ kind: "ask", correlationId: "c1" }),
    1000,
  );
  state = applyCommsEntry(state, entry({ kind: "ask", correlationId: "c2" }), 1000);
  assert.equal(state.pending.m1, 2);
  state = applyCommsEntry(
    state,
    entry({ kind: "answer", from: gemini, to: claude, correlationId: "c1" }),
    1100,
  );
  assert.equal(state.pending.m1, 1);
  state = applyCommsEntry(
    state,
    entry({ kind: "error", from: gemini, to: claude, correlationId: "c2" }),
    1200,
  );
  assert.equal(state.pending.m1, undefined);
  assert.deepEqual(state.openAsks, {});
});

test("messages between canvas nodes light their wire; user calls do not", () => {
  const state = applyCommsEntry(EMPTY_COMMS_STATE, entry({}), 5000);
  assert.equal(state.pulses[commsWireKey("t1", "m1")], 5000 + COMMS_PULSE_MS);
  assert.equal(state.pulseFrom[commsWireKey("m1", "t1")], "t1", "pulse knows its sender");
  const back = applyCommsEntry(state, entry({ kind: "answer", from: gemini, to: claude }), 5100);
  assert.equal(back.pulseFrom[commsWireKey("t1", "m1")], "m1");
  const hub = applyCommsEntry(
    EMPTY_COMMS_STATE,
    entry({ kind: "ask", from: USER_PARTY, correlationId: "h1" }),
    5000,
  );
  assert.deepEqual(hub.pulses, {});
  assert.equal(hub.pending.m1, 1, "hub asks still show the model as busy");
});

test("unread counts only when asked and duplicates are ignored", () => {
  const e = entry({});
  let state = applyCommsEntry(EMPTY_COMMS_STATE, e, 0);
  state = applyCommsEntry(state, e, 0);
  assert.equal(state.entries.length, 1);
  assert.equal(state.unread, 1);
  state = applyCommsEntry(state, entry({}), 0, { countUnread: false });
  assert.equal(state.unread, 1);
});

test("prunePulses drops ended glows and keeps identity when nothing ended", () => {
  const pulses = { a: 10, b: 30 };
  assert.deepEqual(prunePulses(pulses, 20), { b: 30 });
  assert.equal(prunePulses(pulses, 5), pulses);
});

test("hydrate loads history without glows or unread badge; feed open marks read", () => {
  const store = useCommsStore;
  store.getState().hydrate([entry({}), entry({ kind: "ask", correlationId: "x" })]);
  assert.equal(store.getState().entries.length, 2);
  assert.equal(store.getState().unread, 0);
  assert.deepEqual(store.getState().pulses, {});
  assert.equal(store.getState().pending.m1, 1);

  store.getState().setFeedOpen(true);
  store.getState().push(entry({}));
  assert.equal(store.getState().unread, 0, "feed is open");
  store.getState().setFeedOpen(false);
  store.getState().push(entry({}));
  assert.equal(store.getState().unread, 1);
  store.getState().markRead();
  assert.equal(store.getState().unread, 0);
});
