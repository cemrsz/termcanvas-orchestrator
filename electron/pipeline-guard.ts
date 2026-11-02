/**
 * Pipeline delivery rules for agent ↔ agent messages.
 *
 * - Framing: a peer message is pasted into the receiver's chat with a header
 *   naming the sender and a footer pointing at the receiver's own bridge, so
 *   any agent (Claude, Gemini, Codex…) understands where it came from and how
 *   to answer.
 * - Deadlock guard: when A is waiting for B's reply and B tries to *send* to
 *   A, B is told to answer in its reply instead (A reads it automatically).
 * - Runaway guard: at most N messages per pair of agents in a time window,
 *   so two agents cannot ping-pong forever and burn the user's quota.
 */

export const PIPELINE_HEADER = "[TermCanvas pipeline]";

export function framePipelineMessage(options: {
  fromName: string;
  fromType: string;
  text: string;
  /** The receiver's bridge CLI, relative to its worktree. */
  receiverScriptRelPath: string;
}): string {
  return (
    `${PIPELINE_HEADER} Message from ${options.fromName} (${options.fromType}):\n\n` +
    `${options.text.trim()}\n\n` +
    `— Answer in your reply; ${options.fromName} reads it automatically. ` +
    `To message wired agents yourself: node ${options.receiverScriptRelPath} peers`
  );
}

export type SendVerdict =
  | { ok: true }
  | { ok: false; status: number; reason: string };

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export class PipelineGuard {
  private waits = new Map<string, { target: string; at: number }>();
  private sends = new Map<string, number[]>();
  private readonly now: () => number;
  private readonly waitWindowMs: number;
  private readonly rateWindowMs: number;
  private readonly maxPerWindow: number;

  constructor(
    options: {
      now?: () => number;
      waitWindowMs?: number;
      rateWindowMs?: number;
      maxPerWindow?: number;
    } = {},
  ) {
    this.now = options.now ?? (() => Date.now());
    // `wait` polls every 2.5 s; a poll in the last 10 s means "still waiting".
    this.waitWindowMs = options.waitWindowMs ?? 10_000;
    this.rateWindowMs = options.rateWindowMs ?? 10 * 60_000;
    this.maxPerWindow = options.maxPerWindow ?? 30;
  }

  /** `waiter` is polling for `target`'s reply. */
  noteWaiting(waiter: string, target: string) {
    this.waits.set(waiter, { target, at: this.now() });
  }

  isWaitingOn(waiter: string, target: string): boolean {
    const wait = this.waits.get(waiter);
    return !!wait && wait.target === target && this.now() - wait.at < this.waitWindowMs;
  }

  /** Decide whether `from` may message `to`; records the send when allowed. */
  checkSend(
    from: { id: string; name: string },
    to: { id: string; name: string },
  ): SendVerdict {
    if (this.isWaitingOn(to.id, from.id)) {
      return {
        ok: false,
        status: 409,
        reason:
          `${to.name} is waiting for your reply to its message. Do not send it a new ` +
          `message: answer in your normal reply, ${to.name} reads it automatically.`,
      };
    }
    const key = pairKey(from.id, to.id);
    const now = this.now();
    const recent = (this.sends.get(key) ?? []).filter(
      (at) => now - at < this.rateWindowMs,
    );
    if (recent.length >= this.maxPerWindow) {
      this.sends.set(key, recent);
      return {
        ok: false,
        status: 429,
        reason:
          `Pipeline paused: ${from.name} and ${to.name} exchanged ${recent.length} messages ` +
          `in ${Math.round(this.rateWindowMs / 60_000)} minutes. Stop and ask the user how to continue.`,
      };
    }
    recent.push(now);
    this.sends.set(key, recent);
    return { ok: true };
  }
}
