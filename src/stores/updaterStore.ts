import { create } from "zustand";
import { getDictionary } from "../i18n/useT";
import type { UpdateEventInfo } from "../types";
import { useNotificationStore } from "./notificationStore";

export type UpdateStatus = "idle" | "checking" | "downloading" | "ready" | "error";

interface UpdaterStore {
  status: UpdateStatus;
  info: UpdateEventInfo | null;
  downloadPercent: number;
  errorMessage: string | null;
}

export const useUpdaterStore = create<UpdaterStore>((set) => ({
  status: "idle",
  info: null,
  downloadPercent: 0,
  errorMessage: null,
}));

export function initUpdaterListeners(): () => void {
  if (!window.termcanvas?.updater) {
    return () => {};
  }

  const cleanups: (() => void)[] = [];

  cleanups.push(
    window.termcanvas.updater.onUpdateAvailable((info) => {
      useUpdaterStore.setState({ status: "downloading", info, downloadPercent: 0 });
    }),
  );

  cleanups.push(
    window.termcanvas.updater.onDownloadProgress((progress) => {
      useUpdaterStore.setState({ downloadPercent: progress.percent });
    }),
  );

  cleanups.push(
    window.termcanvas.updater.onUpdateDownloaded((info) => {
      useUpdaterStore.setState({ status: "ready", info, downloadPercent: 100 });
    }),
  );

  cleanups.push(
    window.termcanvas.updater.onError((error) => {
      useUpdaterStore.setState({ status: "error", errorMessage: error.message });
    }),
  );

  if (window.termcanvas.updater.onLocationWarning) {
    cleanups.push(
      window.termcanvas.updater.onLocationWarning(() => {
        const dict = getDictionary();
        useNotificationStore
          .getState()
          .notify("warn", dict.update_location_warning);
      }),
    );
  }

  return () => cleanups.forEach((fn) => fn());
}
