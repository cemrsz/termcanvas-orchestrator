import { removeAnnotationFromScene } from "./annotationSceneActions";
import { removeBrowserCardFromScene } from "./sceneCardActions";
import { closeTerminalInScene } from "./terminalSceneActions";
import { useSelectionStore } from "../stores/selectionStore";

function confirmTerminalClose(count: number): boolean {
  const what = count === 1 ? "this terminal" : `${count} terminals`;
  return window.confirm(
    `Close ${what}? Anything running in ${count === 1 ? "it" : "them"} will be stopped.`,
  );
}

/**
 * Deletes the selected annotations, browser cards and terminals. Terminals
 * stop running processes, so they are closed only after a confirmation.
 * Returns true when the key press was handled.
 */
export function deleteSelectedSceneItems(
  confirmClose: (count: number) => boolean = confirmTerminalClose,
): boolean {
  const selectedItems = useSelectionStore.getState().selectedItems;
  let deleted = false;

  for (const item of selectedItems) {
    if (item.type === "annotation") {
      removeAnnotationFromScene(item.annotationId);
      deleted = true;
      continue;
    }

    if (item.type === "card") {
      if (item.cardId.startsWith("browser:")) {
        removeBrowserCardFromScene(item.cardId.slice("browser:".length));
        deleted = true;
      } else {
        continue;
      }
    }
  }

  if (deleted) {
    useSelectionStore.setState((state) => ({
      selectedItems: state.selectedItems.filter(
        (item) => item.type !== "annotation" && item.type !== "card",
      ),
    }));
  }

  const terminals = selectedItems.filter((item) => item.type === "terminal");
  if (terminals.length === 0) return deleted;
  if (!confirmClose(terminals.length)) return true;

  for (const item of terminals) {
    closeTerminalInScene(item.projectId, item.worktreeId, item.terminalId);
  }
  useSelectionStore.setState((state) => ({
    selectedItems: state.selectedItems.filter((item) => item.type !== "terminal"),
  }));
  return true;
}
