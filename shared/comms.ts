/**
 * Comms: what the AIs on the canvas say to each other. Every message that
 * crosses a wire (orchestrator → worker, agent ↔ agent over a pipeline,
 * agent → AI model, hub → model) is recorded once by the main process and
 * streamed to the renderer, which shows it in the AI Hub feed and pulses the
 * wire it travelled on.
 *
 * Shared by the main process and the renderer: no Node or DOM imports.
 */

export type CommsPartyKind = "user" | "agent" | "model" | "source";

export interface CommsParty {
  kind: CommsPartyKind;
  /** Terminal id, AI node id, source id, or "user". */
  id: string;
  name: string;
  /** Terminal type (claude, gemini, codex…) or connector id. */
  type?: string;
}

export type CommsKind =
  /** A wrote to B (pipeline or orchestrator dispatch). */
  | "message"
  /** B's answer, as read back by A. */
  | "reply"
  /** A asked an AI model. */
  | "ask"
  /** The model answered. */
  | "answer"
  /** A call or delivery failed. */
  | "error"
  /** A data source was read. */
  | "read"
  /** A source was triggered (POST). */
  | "trigger"
  /** TermCanvas told an agent who it is wired to. */
  | "brief";

export interface CommsMeta {
  latencyMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  model?: string;
  transport?: "api" | "cli";
  /** Free label, e.g. "council" or "discuss · round 2". */
  label?: string;
  /** HTTP status of a trigger. */
  status?: number;
  via?: "pipeline" | "orchestrator" | "hub";
}

export interface CommsEntry {
  id: string;
  /** Epoch milliseconds. */
  at: number;
  kind: CommsKind;
  from: CommsParty;
  to: CommsParty;
  text: string;
  /** Characters cut from `text` to keep the feed light. */
  truncated?: number;
  meta?: CommsMeta;
  /** Links a request to its answer (ask → answer, message → reply). */
  correlationId?: string;
}

export type CommsEntryInput = Omit<CommsEntry, "id" | "at" | "truncated"> & {
  at?: number;
};

export const COMMS_TEXT_LIMIT = 4000;

export function clipCommsText(
  text: string,
  limit = COMMS_TEXT_LIMIT,
): { text: string; truncated?: number } {
  if (text.length <= limit) return { text };
  return { text: text.slice(0, limit), truncated: text.length - limit };
}

export const USER_PARTY: CommsParty = { kind: "user", id: "user", name: "You" };

/** Key of the wire between two nodes, independent of direction. */
export function commsWireKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}
