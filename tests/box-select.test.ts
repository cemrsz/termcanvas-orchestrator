import test from "node:test";
import assert from "node:assert/strict";

import {
  activateSingleBoxSelectionItem,
  prioritizeBoxSelectionItems,
} from "../src/hooks/useBoxSelect.ts";

function installBoxSelectGlobals() {
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
    termcanvas: undefined as unknown,
  }) as Window & { termcanvas: unknown };

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
}

test("prioritizeBoxSelectionItems prefers annotations over parent scene containers", () => {
  const items = prioritizeBoxSelectionItems([
    { type: "project", projectId: "project-1" },
    { type: "worktree", projectId: "project-1", worktreeId: "worktree-1" },
    { type: "annotation", annotationId: "annotation-1" },
  ]);

  assert.deepEqual(items, [{ type: "annotation", annotationId: "annotation-1" }]);
});

test("prioritizeBoxSelectionItems prefers cards over project hits", () => {
  const items = prioritizeBoxSelectionItems([
    { type: "project", projectId: "project-1" },
    { type: "card", cardId: "browser:card-1" },
  ]);

  assert.deepEqual(items, [{ type: "card", cardId: "browser:card-1" }]);
});

test("activateSingleBoxSelectionItem clears focus when selecting a single card", async () => {
  installBoxSelectGlobals();
  const { useProjectStore } = await import("../src/stores/projectStore.ts");
  const { useSelectionStore } = await import("../src/stores/selectionStore.ts");

  const previousProjectState = useProjectStore.getState();
  const previousSelectionState = useSelectionStore.getState();

  try {
    useProjectStore.setState({
      focusedProjectId: "project-1",
      focusedWorktreeId: "worktree-1",
      projects: [
        {
          id: "project-1",
          name: "Project One",
          path: "/tmp/project-1",
          position: { x: 0, y: 0 },
          collapsed: false,
          zIndex: 1,
          worktrees: [
            {
              id: "worktree-1",
              name: "main",
              path: "/tmp/project-1",
              position: { x: 0, y: 0 },
              collapsed: false,
              terminals: [
                {
                  id: "terminal-1",
                  title: "Terminal",
                  type: "shell",
                  minimized: false,
                  focused: true,
                  ptyId: null,
                  status: "idle",
                  span: { cols: 1, rows: 1 },
                },
              ],
            },
          ],
        },
      ],
    });
    useSelectionStore.setState({
      selectedItems: [],
      selectionRect: null,
    });

    activateSingleBoxSelectionItem({
      type: "card",
      cardId: "browser:card-1",
    });

    assert.equal(useProjectStore.getState().focusedProjectId, null);
    assert.equal(useProjectStore.getState().focusedWorktreeId, null);
    assert.equal(
      useProjectStore.getState().projects[0].worktrees[0].terminals[0]?.focused,
      false,
    );
    assert.deepEqual(useSelectionStore.getState().selectedItems, [
      {
        type: "card",
        cardId: "browser:card-1",
      },
    ]);
  } finally {
    useProjectStore.setState(previousProjectState);
    useSelectionStore.setState(previousSelectionState);
  }
});

test("swallowNextClick stops only the click that ends a drag", async () => {
  const { JSDOM } = await import("jsdom");
  const { swallowNextClick } = await import("../src/hooks/useBoxSelect.ts");
  const dom = new JSDOM("<!doctype html><html><body><div id='pane'></div></body></html>");
  const pane = dom.window.document.getElementById("pane")!;
  let paneClicks = 0;
  pane.addEventListener("click", () => paneClicks++);
  const click = () =>
    pane.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));

  swallowNextClick(dom.window as unknown as Window);
  click();
  assert.equal(paneClicks, 0);
  click();
  assert.equal(paneClicks, 1);

  // A drag that ends without a click must not eat a later, unrelated click.
  swallowNextClick(dom.window as unknown as Window);
  await new Promise((resolve) => setTimeout(resolve, 0));
  click();
  assert.equal(paneClicks, 2);
});
