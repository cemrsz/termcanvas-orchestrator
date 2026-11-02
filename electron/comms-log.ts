/**
 * In-memory ring buffer of comms entries (see shared/comms.ts). The API
 * server and the AI IPC handlers record into it; main.ts forwards every new
 * entry to the window. Nothing is written to disk: prompts and replies can
 * hold private data, and the agents' own transcripts already persist them.
 */

import {
  clipCommsText,
  type CommsEntry,
  type CommsEntryInput,
} from "../shared/comms";

export const COMMS_LOG_LIMIT = 400;

type Listener = (entry: CommsEntry) => void;

export class CommsLog {
  private entries: CommsEntry[] = [];
  private listeners = new Set<Listener>();
  private counter = 0;
  private readonly limit: number;
  private readonly now: () => number;

  constructor(options: { limit?: number; now?: () => number } = {}) {
    this.limit = options.limit ?? COMMS_LOG_LIMIT;
    this.now = options.now ?? (() => Date.now());
  }

  record(input: CommsEntryInput): CommsEntry {
    const { text, truncated } = clipCommsText(input.text ?? "");
    const at = input.at ?? this.now();
    const entry: CommsEntry = {
      ...input,
      id: `comms-${at.toString(36)}-${(++this.counter).toString(36)}`,
      at,
      text,
      ...(truncated ? { truncated } : {}),
    };
    this.entries.push(entry);
    if (this.entries.length > this.limit) {
      this.entries.splice(0, this.entries.length - this.limit);
    }
    for (const listener of this.listeners) {
      try {
        listener(entry);
      } catch {
        // A broken listener must not stop the others.
      }
    }
    return entry;
  }

  list(limit = this.limit): CommsEntry[] {
    return this.entries.slice(-Math.max(0, limit));
  }

  clear() {
    this.entries = [];
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Latest entry of `kind` from one party to another. Used to skip
   * recording the same reply twice when an agent reads it again.
   */
  last(kind: CommsEntry["kind"], fromId: string, toId: string): CommsEntry | undefined {
    for (let i = this.entries.length - 1; i >= 0; i--) {
      const entry = this.entries[i];
      if (entry.kind === kind && entry.from.id === fromId && entry.to.id === toId) {
        return entry;
      }
    }
    return undefined;
  }
}
