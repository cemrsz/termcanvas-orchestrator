/**
 * Orchestration graph: one orchestrator agent (a regular Claude/Codex
 * terminal marked as orchestrator) wired n8n-style to the worker agents it
 * may drive and to the data sources it may use (sheets, n8n webhooks,
 * HTTP APIs, local files, notes).
 *
 * The graph is plain scene data. The orchestrator itself reaches it through
 * the TermCanvas API (`/orchestrator/:id`), which only exposes what is wired.
 */

export type OrchestrationSourceKind = "sheet" | "n8n" | "api" | "file" | "note";

export interface OrchestrationSource {
  id: string;
  kind: OrchestrationSourceKind;
  name: string;
  /** Sheet URL, webhook URL, API URL or local path. Unused for notes. */
  url: string;
  /** What the source is and how to use it. For notes, the note body. */
  description: string;
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

export interface OrchestrationDocument {
  orchestratorIds: string[];
  sources: Record<string, OrchestrationSource>;
  links: OrchestrationLink[];
}

export const EMPTY_ORCHESTRATION: OrchestrationDocument = {
  orchestratorIds: [],
  sources: {},
  links: [],
};

/** Payload the renderer hands the API for one orchestrator. */
export interface OrchestratorManifest {
  orchestrator: {
    id: string;
    title: string;
    type: string;
    worktreePath: string;
  };
  agents: {
    id: string;
    name: string;
    type: string;
    status: string;
    ptyId: number | null;
    worktreePath: string;
    project: string;
  }[];
  sources: Omit<OrchestrationSource, "x" | "y" | "w" | "h">[];
}
