import { create } from "zustand";
import {
  commsWireKey,
  type CommsEntry,
} from "../../shared/comms";

/** How long a wire glows after a message crossed it. */
export const COMMS_PULSE_MS = 2200;
const MAX_ENTRIES = 400;

export interface CommsState {
  entries: CommsEntry[];
  /** Wire key → time the glow ends. */
  pulses: Record<string, number>;
  /** Wire key → node the last message on it came from (pulse direction). */
  pulseFrom: Record<string, string>;
  /** Model node id → calls in flight (the node shows it is thinking). */
  pending: Record<string, number>;
  /** Correlation ids of asks that have not been answered yet. */
  openAsks: Record<string, string>;
  /** Entries that arrived while the feed was closed. */
  unread: number;
}

export const EMPTY_COMMS_STATE: CommsState = {
  entries: [],
  pulses: {},
  pulseFrom: {},
  pending: {},
  openAsks: {},
  unread: 0,
};

function bump(map: Record<string, number>, key: string, delta: number) {
  const next = { ...map };
  const value = (next[key] ?? 0) + delta;
  if (value > 0) next[key] = value;
  else delete next[key];
  return next;
}

/** Pure reducer: fold one entry into the state. */
export function applyCommsEntry(
  state: CommsState,
  entry: CommsEntry,
  now: number,
  options: { countUnread?: boolean } = {},
): CommsState {
  if (state.entries.some((existing) => existing.id === entry.id)) return state;
  const entries = [...state.entries, entry].slice(-MAX_ENTRIES);

  let pending = state.pending;
  let openAsks = state.openAsks;
  if (entry.kind === "ask" && entry.to.kind === "model" && entry.correlationId) {
    pending = bump(pending, entry.to.id, 1);
    openAsks = { ...openAsks, [entry.correlationId]: entry.to.id };
  } else if (
    (entry.kind === "answer" || entry.kind === "error") &&
    entry.correlationId &&
    openAsks[entry.correlationId]
  ) {
    pending = bump(pending, openAsks[entry.correlationId], -1);
    const { [entry.correlationId]: _closed, ...rest } = openAsks;
    openAsks = rest;
  }

  let pulses = state.pulses;
  let pulseFrom = state.pulseFrom;
  if (entry.from.kind !== "user" && entry.to.kind !== "user") {
    const key = commsWireKey(entry.from.id, entry.to.id);
    pulses = { ...pulses, [key]: now + COMMS_PULSE_MS };
    pulseFrom = { ...pulseFrom, [key]: entry.from.id };
  }

  return {
    entries,
    pulses,
    pulseFrom,
    pending,
    openAsks,
    unread: state.unread + (options.countUnread === false ? 0 : 1),
  };
}

/** Drop glows that ended; returns the same object when nothing changed. */
export function prunePulses(
  pulses: Record<string, number>,
  now: number,
): Record<string, number> {
  let changed = false;
  const next: Record<string, number> = {};
  for (const [key, until] of Object.entries(pulses)) {
    if (until > now) next[key] = until;
    else changed = true;
  }
  return changed ? next : pulses;
}

interface CommsStore extends CommsState {
  push: (entry: CommsEntry) => void;
  hydrate: (entries: CommsEntry[]) => void;
  markRead: () => void;
  clear: () => void;
  /** True while the AI Hub feed is on screen (new entries are read). */
  feedOpen: boolean;
  setFeedOpen: (open: boolean) => void;
}

let pruneTimer: ReturnType<typeof setTimeout> | null = null;

function schedulePrune() {
  if (pruneTimer) return;
  pruneTimer = setTimeout(() => {
    pruneTimer = null;
    const { pulses } = useCommsStore.getState();
    const next = prunePulses(pulses, Date.now());
    if (next !== pulses) useCommsStore.setState({ pulses: next });
    if (Object.keys(next).length > 0) schedulePrune();
  }, 400);
}

export const useCommsStore = create<CommsStore>((set, get) => ({
  ...EMPTY_COMMS_STATE,
  feedOpen: false,

  push: (entry) => {
    set((state) => ({
      ...applyCommsEntry(state, entry, Date.now(), {
        countUnread: !get().feedOpen,
      }),
    }));
    schedulePrune();
  },

  hydrate: (entries) => {
    let state: CommsState = { ...EMPTY_COMMS_STATE, unread: 0 };
    // Old entries neither glow nor count as unread.
    for (const entry of entries) {
      state = applyCommsEntry(state, entry, 0, { countUnread: false });
    }
    set({ ...state, pulses: {}, pulseFrom: {} });
  },

  markRead: () => set({ unread: 0 }),

  clear: () => {
    set({ ...EMPTY_COMMS_STATE });
    void window.termcanvas?.comms?.clear();
  },

  setFeedOpen: (open) => set(open ? { feedOpen: true, unread: 0 } : { feedOpen: false }),
}));

/** Load the main-process log and follow new entries. Returns a stop function. */
export function startCommsSync(): () => void {
  const api = window.termcanvas?.comms;
  if (!api) return () => {};
  let stopped = false;
  void api
    .list()
    .then((entries) => {
      if (!stopped) useCommsStore.getState().hydrate(entries);
    })
    .catch(() => {});
  const unsubscribe = api.onEntry((entry) => {
    if (!stopped) useCommsStore.getState().push(entry);
  });
  return () => {
    stopped = true;
    unsubscribe();
  };
}

/**
 * Is a message travelling on the wire between these two nodes right now?
 * Expired glows are pruned from the store, so presence is enough (and keeps
 * the selector pure).
 */
export function useWirePulse(a: string, b: string): boolean {
  return useCommsStore((state) => commsWireKey(a, b) in state.pulses);
}

/** The node a message is travelling from on this wire, or null. */
export function useWirePulseFrom(a: string, b: string): string | null {
  return useCommsStore((state) => {
    const key = commsWireKey(a, b);
    return key in state.pulses ? (state.pulseFrom[key] ?? a) : null;
  });
}
