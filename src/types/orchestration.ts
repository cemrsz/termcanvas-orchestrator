/**
 * Orchestration graph: one orchestrator agent (a regular Claude/Codex
 * terminal marked as orchestrator) wired n8n-style to the worker agents it
 * may drive and to the data sources it may use (sheets, n8n webhooks,
 * HTTP APIs, local files, notes).
 *
 * The graph is plain scene data. Orchestrators can be wired to other
 * orchestrators, which makes a hierarchy (lead -> managers -> workers);
 * everything connected by wires is one team (see shared/team.ts).
 * Agents reach the graph through the TermCanvas API (`/team/:id`), which
 * only exposes their own team.
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
  /**
   * Sheets only: a bridge URL (Apps Script web app or n8n webhook) that
   * reads and writes rows, so agents can change a private sheet.
   */
  writeUrl?: string;
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
  /** What each agent is for, by terminal id. Shown to the whole team. */
  roles?: Record<string, string>;
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
