import { useProjectStore } from "../stores/projectStore";
import { useOrchestrationStore } from "../stores/orchestrationStore";
import { useTerminalRuntimeStateStore } from "../stores/terminalRuntimeStateStore";
import { useTeamStore } from "../stores/teamStore";
import { buildTeamDirectory } from "./teamDirectory";

const SYNC_DEBOUNCE_MS = 250;

/**
 * Keep the main process's team directory in step with the canvas: who is
 * on which team, names, models, running PTYs, sources and wiring. The API
 * that agents call answers from it, and the main process writes each new
 * member's bridge files from it.
 */
export function startTeamDirectorySync(): () => void {
  const team = window.termcanvas?.team;
  if (!team) return () => {};

  let timer: ReturnType<typeof setTimeout> | null = null;
  let last = "";
  const push = () => {
    timer = null;
    const directory = buildTeamDirectory(useTeamStore.getState().lang);
    const serialized = JSON.stringify(directory);
    if (serialized === last) return;
    last = serialized;
    team.syncDirectory(directory);
  };
  const schedule = () => {
    if (timer) return;
    timer = setTimeout(push, SYNC_DEBOUNCE_MS);
  };

  const unsubscribers = [
    useProjectStore.subscribe(schedule),
    useOrchestrationStore.subscribe(schedule),
    useTerminalRuntimeStateStore.subscribe(schedule),
    useTeamStore.subscribe((state, prev) => {
      if (state.lang !== prev.lang) schedule();
    }),
  ];
  push();

  const removeActivity = team.onActivity((entries) => {
    useTeamStore.getState().append(entries);
  });
  void useTeamStore.getState().load();

  return () => {
    if (timer) clearTimeout(timer);
    for (const unsubscribe of unsubscribers) unsubscribe();
    removeActivity();
  };
}
