import { create } from "zustand";
import type { TeamLang } from "../../shared/team";
import type { TeamActivityEntry } from "../../shared/teamActivity";
import type { TeamInboxInfo, TeamReportInfo } from "../types";

const MAX_ENTRIES = 1500;
const LANG_KEY = "termcanvas.team.lang";
const TOOLS_KEY = "termcanvas.team.showTools";

function readSetting(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSetting(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Settings are a convenience; private storage may be unavailable.
  }
}

interface TeamStore {
  lang: TeamLang;
  showTools: boolean;
  entries: TeamActivityEntry[];
  reports: TeamReportInfo[];
  inbox: TeamInboxInfo | null;
  /** Report shown in the reader, by file path. */
  openReportPath: string | null;
  setLang: (lang: TeamLang) => void;
  setShowTools: (show: boolean) => void;
  append: (entries: TeamActivityEntry[]) => void;
  load: () => Promise<void>;
  refreshReports: () => Promise<void>;
  openReport: (path: string | null) => void;
}

export const useTeamStore = create<TeamStore>((set, get) => ({
  lang: readSetting(LANG_KEY) === "en" ? "en" : "tr",
  showTools: readSetting(TOOLS_KEY) !== "0",
  entries: [],
  reports: [],
  inbox: null,
  openReportPath: null,

  setLang: (lang) => {
    writeSetting(LANG_KEY, lang);
    set({ lang });
  },

  setShowTools: (showTools) => {
    writeSetting(TOOLS_KEY, showTools ? "1" : "0");
    set({ showTools });
  },

  append: (incoming) => {
    if (incoming.length === 0) return;
    const known = new Set(get().entries.map((entry) => entry.id));
    const fresh = incoming.filter((entry) => !known.has(entry.id));
    if (fresh.length === 0) return;
    const entries = [...get().entries, ...fresh].slice(-MAX_ENTRIES);
    set({ entries });
    if (fresh.some((entry) => entry.kind === "report")) {
      void get().refreshReports();
    }
  },

  load: async () => {
    const team = window.termcanvas?.team;
    if (!team) return;
    const [entries, reports, inbox] = await Promise.all([
      team.listActivity(MAX_ENTRIES).catch(() => []),
      team.listReports().catch(() => []),
      team.inboxInfo().catch(() => null),
    ]);
    set({ reports, inbox });
    get().append(entries);
  },

  refreshReports: async () => {
    const reports = await window.termcanvas?.team
      ?.listReports()
      .catch(() => null);
    if (reports) set({ reports });
  },

  openReport: (openReportPath) => set({ openReportPath }),
}));
