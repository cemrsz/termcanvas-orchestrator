import { create } from "zustand";
import type { AiConnectorId } from "../../shared/ai-connectors";

export type AiHubTab = "connectors" | "council" | "feed";

interface AiHubStore {
  open: boolean;
  tab: AiHubTab;
  /** Connector card to scroll to and highlight when the hub opens. */
  focusConnector: AiConnectorId | null;
  openHub: (tab?: AiHubTab, connector?: AiConnectorId) => void;
  closeHub: () => void;
  toggleHub: () => void;
  setTab: (tab: AiHubTab) => void;
}

export const useAiHubStore = create<AiHubStore>((set, get) => ({
  open: false,
  tab: "connectors",
  focusConnector: null,
  openHub: (tab, connector) =>
    set((state) => ({
      open: true,
      tab: tab ?? state.tab,
      focusConnector: connector ?? null,
    })),
  closeHub: () => set({ open: false, focusConnector: null }),
  toggleHub: () => (get().open ? get().closeHub() : get().openHub()),
  setTab: (tab) => set({ tab, focusConnector: null }),
}));
