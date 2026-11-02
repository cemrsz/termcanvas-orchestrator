import { create } from "zustand";
import {
  getAiConnector,
  type AiCliStatus,
  type AiConnectorId,
  type AiConnectorStatus,
  type AiInvokeOutcome,
  type AiTransport,
} from "../../shared/ai-connectors";
import type { CommsParty } from "../../shared/comms";

/**
 * Renderer view of the AI connectors: what the main process reports about
 * each one (never the key itself), plus the model lists fetched from the
 * providers. Shared by AI nodes on the canvas and the AI Hub.
 */
interface AiConnectorStore {
  statuses: Partial<Record<AiConnectorId, AiConnectorStatus>>;
  loaded: boolean;
  loading: boolean;
  /** Models the provider listed for the current key. */
  models: Partial<Record<AiConnectorId, string[]>>;
  /** CLI checks in flight. */
  checkingCli: Partial<Record<AiConnectorId, boolean>>;

  refresh: () => Promise<void>;
  ensureLoaded: () => void;
  setKey: (id: AiConnectorId, key: string) => Promise<void>;
  clearKey: (id: AiConnectorId) => Promise<void>;
  setConfig: (
    id: AiConnectorId,
    patch: { model?: string | null; baseURL?: string | null },
  ) => Promise<void>;
  checkCli: (id: AiConnectorId) => Promise<AiCliStatus | null>;
  fetchModels: (
    id: AiConnectorId,
    baseURL?: string,
  ) => Promise<{ ok: true; models: string[] } | { ok: false; error: string }>;
}

function api() {
  return window.termcanvas?.ai;
}

export const useAiConnectorStore = create<AiConnectorStore>((set, get) => ({
  statuses: {},
  loaded: false,
  loading: false,
  models: {},
  checkingCli: {},

  refresh: async () => {
    const bridge = api();
    if (!bridge) return;
    set({ loading: true });
    try {
      const list = await bridge.status();
      const statuses: AiConnectorStore["statuses"] = {};
      for (const status of list) statuses[status.id] = status;
      set({ statuses, loaded: true });
    } finally {
      set({ loading: false });
    }
  },

  ensureLoaded: () => {
    const { loaded, loading } = get();
    if (!loaded && !loading) void get().refresh();
  },

  setKey: async (id, key) => {
    const bridge = api();
    if (!bridge) return;
    const status = await bridge.setKey(id, key);
    set((state) => ({ statuses: { ...state.statuses, [id]: status } }));
  },

  clearKey: async (id) => {
    const bridge = api();
    if (!bridge) return;
    const status = await bridge.clearKey(id);
    set((state) => ({
      statuses: { ...state.statuses, [id]: status },
      models: { ...state.models, [id]: undefined },
    }));
  },

  setConfig: async (id, patch) => {
    const bridge = api();
    if (!bridge) return;
    const status = await bridge.setConfig(id, patch);
    set((state) => ({ statuses: { ...state.statuses, [id]: status } }));
  },

  checkCli: async (id) => {
    const bridge = api();
    if (!bridge || !getAiConnector(id)?.cli) return null;
    set((state) => ({ checkingCli: { ...state.checkingCli, [id]: true } }));
    try {
      const cli = await bridge.checkCli(id);
      set((state) => {
        const current = state.statuses[id];
        return {
          statuses: current
            ? { ...state.statuses, [id]: { ...current, cli } }
            : state.statuses,
        };
      });
      return cli;
    } finally {
      set((state) => ({ checkingCli: { ...state.checkingCli, [id]: false } }));
    }
  },

  fetchModels: async (id, baseURL) => {
    const bridge = api();
    if (!bridge) return { ok: false, error: "Not available in this window." };
    const result = await bridge.listModels(id, baseURL);
    if (result.ok) {
      set((state) => ({ models: { ...state.models, [id]: result.models } }));
      return { ok: true, models: result.models };
    }
    return { ok: false, error: result.error };
  },
}));

/** Suggestions for a model field: what the provider listed, else the catalog. */
export function modelSuggestions(
  id: AiConnectorId,
  fetched: string[] | undefined,
): string[] {
  const plugin = getAiConnector(id);
  return [...new Set([...(fetched ?? []), ...(plugin?.models ?? [])])];
}

/** Can a node with this transport be called right now, as far as we know? */
export function transportReady(
  status: AiConnectorStatus | undefined,
  transport: AiTransport,
): boolean | null {
  if (!status) return null;
  if (transport === "api") return status.apiReady;
  return status.cli ? status.cli.installed : null;
}

/** Ask a connector from the UI; the call shows up in the comms feed. */
export async function invokeFromUi(options: {
  connector: AiConnectorId;
  transport: AiTransport;
  model?: string;
  baseURL?: string;
  system?: string;
  prompt: string;
  feedAs?: CommsParty;
  label?: string;
}): Promise<AiInvokeOutcome> {
  const bridge = api();
  if (!bridge) {
    return { ok: false, code: "unknown", error: "Not available in this window." };
  }
  return bridge.invoke(
    {
      connector: options.connector,
      transport: options.transport,
      model: options.model,
      baseURL: options.baseURL,
      system: options.system,
      prompt: options.prompt,
    },
    options.feedAs ? { to: options.feedAs, label: options.label } : undefined,
  );
}
