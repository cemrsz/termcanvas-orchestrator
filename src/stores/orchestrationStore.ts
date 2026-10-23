import { create } from "zustand";
import { useWorkspaceStore } from "./workspaceStore";
import type { TerminalType } from "../types";
import type {
  OrchestrationDocument,
  OrchestrationLink,
  OrchestrationSource,
  OrchestrationSourceKind,
  OrchestrationTargetKind,
} from "../types/orchestration";

/** Terminal types that can act as orchestrator or worker agents. */
const AGENT_TERMINAL_TYPES = new Set<TerminalType>([
  "claude",
  "codex",
  "kimi",
  "gemini",
  "opencode",
  "wuu",
]);

export function isAgentTerminalType(type: TerminalType): boolean {
  return AGENT_TERMINAL_TYPES.has(type);
}

export const SOURCE_NODE_WIDTH = 300;
export const SOURCE_NODE_HEIGHT = 190;

const DEFAULT_SOURCE_NAMES: Record<OrchestrationSourceKind, string> = {
  sheet: "Google Sheet",
  n8n: "n8n Webhook",
  api: "HTTP API",
  file: "Local File",
  note: "Note",
};

interface OrchestrationStore extends OrchestrationDocument {
  markOrchestrator: (terminalId: string) => void;
  unmarkOrchestrator: (terminalId: string) => void;
  addSource: (
    kind: OrchestrationSourceKind,
    position: { x: number; y: number },
  ) => string;
  updateSource: (id: string, patch: Partial<OrchestrationSource>) => void;
  removeSource: (id: string) => void;
  connect: (
    orchestratorId: string,
    targetKind: OrchestrationTargetKind,
    targetId: string,
  ) => boolean;
  disconnect: (linkId: string) => void;
  restore: (doc: OrchestrationDocument | undefined) => void;
}

let counter = 0;

function nextId(prefix: string): string {
  return `${prefix}-${Date.now()}-${++counter}`;
}

function markDirty() {
  useWorkspaceStore.getState().markDirty();
}

export const useOrchestrationStore = create<OrchestrationStore>((set, get) => ({
  orchestratorIds: [],
  sources: {},
  links: [],

  markOrchestrator: (terminalId) => {
    if (get().orchestratorIds.includes(terminalId)) return;
    set((state) => ({
      orchestratorIds: [...state.orchestratorIds, terminalId],
      // An orchestrator is never a worker of another orchestrator.
      links: state.links.filter(
        (link) => !(link.targetKind === "terminal" && link.targetId === terminalId),
      ),
    }));
    markDirty();
  },

  unmarkOrchestrator: (terminalId) => {
    if (!get().orchestratorIds.includes(terminalId)) return;
    set((state) => ({
      orchestratorIds: state.orchestratorIds.filter((id) => id !== terminalId),
      links: state.links.filter((link) => link.orchestratorId !== terminalId),
    }));
    markDirty();
  },

  addSource: (kind, position) => {
    const id = nextId("source");
    const source: OrchestrationSource = {
      id,
      kind,
      name: DEFAULT_SOURCE_NAMES[kind],
      url: "",
      description: "",
      x: position.x,
      y: position.y,
      w: SOURCE_NODE_WIDTH,
      h: SOURCE_NODE_HEIGHT,
    };
    set((state) => ({ sources: { ...state.sources, [id]: source } }));
    markDirty();
    return id;
  },

  updateSource: (id, patch) => {
    const existing = get().sources[id];
    if (!existing) return;
    set((state) => ({
      sources: { ...state.sources, [id]: { ...existing, ...patch, id } },
    }));
    markDirty();
  },

  removeSource: (id) => {
    if (!get().sources[id]) return;
    set((state) => {
      const { [id]: _removed, ...rest } = state.sources;
      return {
        sources: rest,
        links: state.links.filter(
          (link) => !(link.targetKind === "source" && link.targetId === id),
        ),
      };
    });
    markDirty();
  },

  connect: (orchestratorId, targetKind, targetId) => {
    const state = get();
    if (!state.orchestratorIds.includes(orchestratorId)) return false;
    if (targetKind === "terminal" && state.orchestratorIds.includes(targetId)) {
      return false;
    }
    if (targetKind === "source" && !state.sources[targetId]) return false;
    const exists = state.links.some(
      (link) =>
        link.orchestratorId === orchestratorId &&
        link.targetKind === targetKind &&
        link.targetId === targetId,
    );
    if (exists) return false;
    const link: OrchestrationLink = {
      id: nextId("link"),
      orchestratorId,
      targetKind,
      targetId,
    };
    set({ links: [...state.links, link] });
    markDirty();
    return true;
  },

  disconnect: (linkId) => {
    if (!get().links.some((link) => link.id === linkId)) return;
    set((state) => ({
      links: state.links.filter((link) => link.id !== linkId),
    }));
    markDirty();
  },

  restore: (doc) => {
    set({
      orchestratorIds: doc?.orchestratorIds ?? [],
      sources: doc?.sources ?? {},
      links: doc?.links ?? [],
    });
  },
}));

/**
 * True for orchestrators and the agents wired to them. Their titles are the
 * names the orchestrator routes work by, so they must stay stable.
 */
export function isOrchestratedTerminal(terminalId: string): boolean {
  const { orchestratorIds, links } = useOrchestrationStore.getState();
  return (
    orchestratorIds.includes(terminalId) ||
    links.some(
      (link) => link.targetKind === "terminal" && link.targetId === terminalId,
    )
  );
}

/**
 * Snapshot the graph for persistence, dropping references to terminals
 * that no longer exist on the canvas. Returns undefined for an empty graph
 * so scenes without orchestration keep their old shape.
 */
export function captureOrchestration(
  liveTerminalIds: Set<string>,
): OrchestrationDocument | undefined {
  const { orchestratorIds, sources, links } = useOrchestrationStore.getState();
  if (orchestratorIds.length === 0 && Object.keys(sources).length === 0) {
    return undefined;
  }
  const liveOrchestrators = orchestratorIds.filter((id) =>
    liveTerminalIds.has(id),
  );
  const orchestratorSet = new Set(liveOrchestrators);
  return {
    orchestratorIds: liveOrchestrators,
    sources,
    links: links.filter(
      (link) =>
        orchestratorSet.has(link.orchestratorId) &&
        (link.targetKind === "terminal"
          ? liveTerminalIds.has(link.targetId)
          : link.targetId in sources),
    ),
  };
}
