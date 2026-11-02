/**
 * Orchestration graph: one orchestrator agent (a regular Claude/Codex
 * terminal marked as orchestrator) wired n8n-style to the worker agents it
 * may drive and to the data sources it may use (sheets, n8n webhooks,
 * HTTP APIs, local files, notes, AI models).
 *
 * Next to that hub-and-spoke wiring there are pipelines: undirected wires
 * between any two agent terminals (Claude ↔ Gemini ↔ Codex…), or between an
 * agent and a source / AI model node. Both ends of a pipeline can talk to
 * each other.
 *
 * The graph is plain scene data. Each agent reaches it through the
 * TermCanvas API (`/bridge/:id`), which only exposes what is wired to it.
 */

import type { AiConnectorId, AiTransport } from "../../shared/ai-connectors";

export type OrchestrationSourceKind =
  | "sheet"
  | "n8n"
  | "api"
  | "file"
  | "note"
  | "ai";

/** An AI model node: which connector answers, with which model and transport. */
export interface OrchestrationAiConfig {
  connector: AiConnectorId;
  /** Empty: the connector's default model. */
  model: string;
  transport: AiTransport;
}

export interface OrchestrationSource {
  id: string;
  kind: OrchestrationSourceKind;
  name: string;
  /**
   * Sheet URL, webhook URL, API URL or local path. Unused for notes. For AI
   * nodes an optional base URL override (e.g. a second Ollama server).
   */
  url: string;
  /**
   * What the source is and how to use it. For notes, the note body. For AI
   * nodes, the persona / role the model answers as.
   */
  description: string;
  /** Only for kind "ai". */
  ai?: OrchestrationAiConfig;
  x: number;
  y: number;
  w: number;
  h: number;
}

export type OrchestrationTargetKind = "terminal" | "source";

export interface OrchestrationLink {
  id: string;
  orchestratorId: string;
  targetKind: OrchestrationTargetKind;
  targetId: string;
}

/**
 * A pipeline: an undirected wire between two nodes. At least one end is an
 * agent terminal; the other is another agent, a source or an AI model.
 * Orchestrators are never pipeline ends (their wires are links).
 */
export interface OrchestrationPipe {
  id: string;
  a: string;
  b: string;
}

export interface OrchestrationDocument {
  orchestratorIds: string[];
  sources: Record<string, OrchestrationSource>;
  links: OrchestrationLink[];
  pipes: OrchestrationPipe[];
}

export const EMPTY_ORCHESTRATION: OrchestrationDocument = {
  orchestratorIds: [],
  sources: {},
  links: [],
  pipes: [],
};

export interface BridgeAgent {
  id: string;
  name: string;
  type: string;
  status: string;
  ptyId: number | null;
  worktreePath: string;
  project: string;
  /** How it is wired to the caller. */
  via: "orchestrator" | "pipeline";
}

export interface BridgeModel {
  id: string;
  name: string;
  connector: AiConnectorId;
  connectorName: string;
  /** Empty: the connector's default. */
  model: string;
  transport: AiTransport;
  /** Role the model answers as (the node's notes). */
  persona: string;
  /** Base URL override, if any. */
  baseURL: string;
}

export type BridgeSource = Omit<OrchestrationSource, "x" | "y" | "w" | "h" | "ai">;

/**
 * What one agent may reach: for an orchestrator the agents, sources and
 * models wired to it; for any other agent its pipeline peers.
 */
export interface BridgeManifest {
  self: {
    id: string;
    title: string;
    type: string;
    worktreePath: string;
    role: "orchestrator" | "agent";
  };
  agents: BridgeAgent[];
  models: BridgeModel[];
  sources: BridgeSource[];
}

/** Payload the renderer hands the API for one orchestrator. */
export interface OrchestratorManifest extends BridgeManifest {
  /** Same as `self`; kept for bridge scripts written by older versions. */
  orchestrator: BridgeManifest["self"];
}
