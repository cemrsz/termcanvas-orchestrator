import { create } from "zustand";
import { useWorkspaceStore } from "./workspaceStore";
import type { TerminalType } from "../types";
import {
  getAiConnector,
  type AiConnectorId,
  type AiTransport,
} from "../../shared/ai-connectors";
import type {
  OrchestrationAiConfig,
  OrchestrationDocument,
  OrchestrationLink,
  OrchestrationPipe,
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
export const AI_NODE_WIDTH = 320;
export const AI_NODE_HEIGHT = 250;

const DEFAULT_SOURCE_NAMES: Record<OrchestrationSourceKind, string> = {
  sheet: "Google Sheet",
  n8n: "n8n Webhook",
  api: "HTTP API",
  file: "Local File",
  note: "Note",
  ai: "AI Model",
};

interface OrchestrationStore extends OrchestrationDocument {
  markOrchestrator: (terminalId: string) => void;
  unmarkOrchestrator: (terminalId: string) => void;
  addSource: (
    kind: OrchestrationSourceKind,
    position: { x: number; y: number },
  ) => string;
  updateSource: (id: string, patch: Partial<OrchestrationSource>) => void;
  /** Add an AI model node answered by `connector` (Claude, Gemini, …). */
  addAiNode: (
    connector: AiConnectorId,
    position: { x: number; y: number },
    options?: { transport?: AiTransport; model?: string; name?: string; persona?: string },
  ) => string;
  updateAiConfig: (id: string, patch: Partial<OrchestrationAiConfig>) => void;
  removeSource: (id: string) => void;
  connect: (
    orchestratorId: string,
    targetKind: OrchestrationTargetKind,
    targetId: string,
  ) => boolean;
  disconnect: (linkId: string) => void;
  /**
   * Wire two nodes with a pipeline. One end must be an agent terminal (the
   * caller checks terminal-ness); orchestrators and source↔source pairs are
   * refused, as are duplicates in either direction.
   */
  connectPipe: (a: string, b: string) => string | null;
  disconnectPipe: (pipeId: string) => void;
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
  pipes: [],

  markOrchestrator: (terminalId) => {
    if (get().orchestratorIds.includes(terminalId)) return;
    set((state) => {
      // An orchestrator is never a worker of another orchestrator.
      const links = state.links.filter(
        (link) => !(link.targetKind === "terminal" && link.targetId === terminalId),
      );
      // Its pipelines become its links: the peers turn into its workers.
      const pipes: OrchestrationPipe[] = [];
      for (const pipe of state.pipes) {
        const other = pipeOtherEnd(pipe, terminalId);
        if (other === null) {
          pipes.push(pipe);
          continue;
        }
        const targetKind: OrchestrationTargetKind =
          other in state.sources ? "source" : "terminal";
        if (state.orchestratorIds.includes(other)) continue;
        if (
          links.some(
            (link) =>
              link.orchestratorId === terminalId && link.targetId === other,
          )
        ) {
          continue;
        }
        links.push({
          id: nextId("link"),
          orchestratorId: terminalId,
          targetKind,
          targetId: other,
        });
      }
      return {
        orchestratorIds: [...state.orchestratorIds, terminalId],
        links,
        pipes,
      };
    });
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

  addAiNode: (connector, position, options = {}) => {
    const plugin = getAiConnector(connector);
    const id = nextId("ai");
    const source: OrchestrationSource = {
      id,
      kind: "ai",
      name: options.name?.trim() || plugin?.name || DEFAULT_SOURCE_NAMES.ai,
      url: "",
      description: options.persona ?? "",
      ai: {
        connector,
        model: options.model ?? "",
        transport: options.transport ?? "api",
      },
      x: position.x,
      y: position.y,
      w: AI_NODE_WIDTH,
      h: AI_NODE_HEIGHT,
    };
    set((state) => ({ sources: { ...state.sources, [id]: source } }));
    markDirty();
    return id;
  },

  updateAiConfig: (id, patch) => {
    const existing = get().sources[id];
    if (!existing || existing.kind !== "ai" || !existing.ai) return;
    const ai: OrchestrationAiConfig = { ...existing.ai, ...patch };
    const renamed =
      patch.connector &&
      patch.connector !== existing.ai.connector &&
      existing.name === (getAiConnector(existing.ai.connector)?.name ?? "");
    set((state) => ({
      sources: {
        ...state.sources,
        [id]: {
          ...existing,
          ai,
          // A node still named after its old connector follows the new one.
          ...(renamed ? { name: getAiConnector(ai.connector)?.name ?? existing.name } : {}),
        },
      },
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
        pipes: state.pipes.filter((pipe) => pipeOtherEnd(pipe, id) === null),
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

  connectPipe: (a, b) => {
    const state = get();
    if (!a || !b || a === b) return null;
    if (state.orchestratorIds.includes(a) || state.orchestratorIds.includes(b)) {
      return null;
    }
    if (a in state.sources && b in state.sources) return null;
    if (findPipe(state.pipes, a, b)) return null;
    const pipe: OrchestrationPipe = { id: nextId("pipe"), a, b };
    set({ pipes: [...state.pipes, pipe] });
    markDirty();
    return pipe.id;
  },

  disconnectPipe: (pipeId) => {
    if (!get().pipes.some((pipe) => pipe.id === pipeId)) return;
    set((state) => ({
      pipes: state.pipes.filter((pipe) => pipe.id !== pipeId),
    }));
    markDirty();
  },

  restore: (doc) => {
    set({
      orchestratorIds: doc?.orchestratorIds ?? [],
      sources: doc?.sources ?? {},
      links: doc?.links ?? [],
      pipes: doc?.pipes ?? [],
    });
  },
}));

/** The other end of a pipe, or null when `nodeId` is not one of its ends. */
export function pipeOtherEnd(
  pipe: OrchestrationPipe,
  nodeId: string,
): string | null {
  if (pipe.a === nodeId) return pipe.b;
  if (pipe.b === nodeId) return pipe.a;
  return null;
}

export function findPipe(
  pipes: OrchestrationPipe[],
  a: string,
  b: string,
): OrchestrationPipe | undefined {
  return pipes.find(
    (pipe) => (pipe.a === a && pipe.b === b) || (pipe.a === b && pipe.b === a),
  );
}

/** Node ids wired to `nodeId` by a pipeline. */
export function pipePeers(pipes: OrchestrationPipe[], nodeId: string): string[] {
  const peers: string[] = [];
  for (const pipe of pipes) {
    const other = pipeOtherEnd(pipe, nodeId);
    if (other !== null) peers.push(other);
  }
  return peers;
}

/**
 * True for orchestrators, the agents wired to them and agents on a
 * pipeline. Their titles are the names others address them by, so they must
 * stay stable.
 */
export function isOrchestratedTerminal(terminalId: string): boolean {
  const { orchestratorIds, links, pipes } = useOrchestrationStore.getState();
  return (
    orchestratorIds.includes(terminalId) ||
    links.some(
      (link) => link.targetKind === "terminal" && link.targetId === terminalId,
    ) ||
    pipes.some((pipe) => pipeOtherEnd(pipe, terminalId) !== null)
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
  const { orchestratorIds, sources, links, pipes } =
    useOrchestrationStore.getState();
  if (
    orchestratorIds.length === 0 &&
    Object.keys(sources).length === 0 &&
    pipes.length === 0
  ) {
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
    pipes: pipes.filter((pipe) => {
      const alive = (id: string) => liveTerminalIds.has(id) || id in sources;
      return (
        alive(pipe.a) &&
        alive(pipe.b) &&
        !orchestratorSet.has(pipe.a) &&
        !orchestratorSet.has(pipe.b)
      );
    }),
  };
}
