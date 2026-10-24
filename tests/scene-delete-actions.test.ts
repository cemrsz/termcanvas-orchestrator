import test from "node:test";
import assert from "node:assert/strict";

function installSceneDeleteGlobals() {
  const storage = new Map<string, string>();
  const navigator = {
    language: "en-US",
    userAgent: "node-test",
    clipboard: {
      writeText: async () => {},
    },
  };
  const target = new EventTarget();
  const mockWindow = Object.assign(target, {
    navigator,
  }) as Window;

  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem(key: string) {
        return storage.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        storage.set(key, value);
      },
      removeItem(key: string) {
        storage.delete(key);
      },
      clear() {
        storage.clear();
      },
    },
  });

  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: navigator,
  });

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: mockWindow,
  });

  return mockWindow;
}

test("deleteSelectedSceneItems removes selected annotations and cards", async () => {
  installSceneDeleteGlobals();
  const { useDrawingStore } = await import("../src/stores/drawingStore.ts");
  const { useSelectionStore } = await import("../src/stores/selectionStore.ts");
  const { useBrowserCardStore } = await import("../src/stores/browserCardStore.ts");
  const { deleteSelectedSceneItems } = await import(
    "../src/actions/sceneDeleteActions.ts"
  );

  const previousDrawingState = useDrawingStore.getState();
  const previousSelectionState = useSelectionStore.getState();
  const previousBrowserState = useBrowserCardStore.getState();

  try {
    useDrawingStore.setState({
      tool: "select",
      color: "#ededed",
      elements: [
        {
          id: "annotation-1",
          type: "rect",
          x: 10,
          y: 20,
          w: 100,
          h: 60,
          color: "#fff",
          strokeWidth: 2,
        },
      ],
      activeElement: null,
    });
    useBrowserCardStore.setState({
      cards: {
        "browser-card-1": {
          id: "browser-card-1",
          url: "https://example.com",
          title: "Example",
          x: 10,
          y: 20,
          w: 200,
          h: 100,
        },
      },
    });
    useSelectionStore.setState({
      selectedItems: [
        { type: "annotation", annotationId: "annotation-1" },
        { type: "card", cardId: "browser:browser-card-1" },
      ],
      selectionRect: null,
    });

    assert.equal(deleteSelectedSceneItems(), true);
    assert.deepEqual(useDrawingStore.getState().elements, []);
    assert.deepEqual(useBrowserCardStore.getState().cards, {});
    assert.deepEqual(useSelectionStore.getState().selectedItems, []);
  } finally {
    useDrawingStore.setState(previousDrawingState);
    useSelectionStore.setState(previousSelectionState);
    useBrowserCardStore.setState(previousBrowserState);
  }
});

async function withTwoTerminals(
  run: (modules: {
    useProjectStore: typeof import("../src/stores/projectStore.ts").useProjectStore;
    useSelectionStore: typeof import("../src/stores/selectionStore.ts").useSelectionStore;
    deleteSelectedSceneItems: typeof import("../src/actions/sceneDeleteActions.ts").deleteSelectedSceneItems;
  }) => void,
) {
  installSceneDeleteGlobals();
  const { useProjectStore, createTerminal } = await import("../src/stores/projectStore.ts");
  const { useSelectionStore } = await import("../src/stores/selectionStore.ts");
  const { deleteSelectedSceneItems } = await import(
    "../src/actions/sceneDeleteActions.ts"
  );
  const previousProjectState = useProjectStore.getState();
  const previousSelectionState = useSelectionStore.getState();

  try {
    useProjectStore.setState({
      focusedProjectId: null,
      focusedWorktreeId: null,
      projects: [
        {
          id: "project-1",
          name: "Project One",
          path: "/tmp/project-1",
          position: { x: 0, y: 0 },
          collapsed: false,
          zIndex: 0,
          worktrees: [
            {
              id: "worktree-1",
              name: "main",
              path: "/tmp/project-1",
              position: { x: 0, y: 0 },
              collapsed: false,
              terminals: [
                { ...createTerminal("shell"), id: "t-1" },
                { ...createTerminal("shell"), id: "t-2" },
                { ...createTerminal("shell"), id: "t-3" },
              ],
            },
          ],
        },
      ],
    });
    useSelectionStore.setState({
      selectedItems: ["t-1", "t-2"].map((terminalId) => ({
        type: "terminal" as const,
        projectId: "project-1",
        worktreeId: "worktree-1",
        terminalId,
      })),
      selectionRect: null,
    });
    run({ useProjectStore, useSelectionStore, deleteSelectedSceneItems });
  } finally {
    useProjectStore.setState(previousProjectState);
    useSelectionStore.setState(previousSelectionState);
  }
}

test("deleteSelectedSceneItems closes selected terminals after confirmation", async () => {
  await withTwoTerminals(({ useProjectStore, useSelectionStore, deleteSelectedSceneItems }) => {
    const asked: number[] = [];
    assert.equal(
      deleteSelectedSceneItems((count) => {
        asked.push(count);
        return true;
      }),
      true,
    );
    assert.deepEqual(asked, [2]);
    const remaining = useProjectStore.getState().projects[0].worktrees[0].terminals;
    assert.deepEqual(remaining.map((terminal) => terminal.id), ["t-3"]);
    assert.deepEqual(useSelectionStore.getState().selectedItems, []);
  });
});

test("deleteSelectedSceneItems keeps terminals when the close is not confirmed", async () => {
  await withTwoTerminals(({ useProjectStore, useSelectionStore, deleteSelectedSceneItems }) => {
    assert.equal(deleteSelectedSceneItems(() => false), true);
    const remaining = useProjectStore.getState().projects[0].worktrees[0].terminals;
    assert.equal(remaining.length, 3);
    assert.equal(useSelectionStore.getState().selectedItems.length, 2);
  });
});
