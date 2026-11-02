import test from "node:test";
import assert from "node:assert/strict";

function installBrowserGlobals() {
  const storage = new Map<string, string>();
  const navigator = { language: "en-US", userAgent: "node-test" };
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
      clear: () => storage.clear(),
    },
  });
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: navigator });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      addEventListener() {},
      innerHeight: 900,
      innerWidth: 1440,
      navigator,
      termcanvas: undefined,
    },
  });
}

installBrowserGlobals();

const {
  captureOrchestration,
  findPipe,
  isOrchestratedTerminal,
  pipePeers,
  useOrchestrationStore,
} = await import("../src/stores/orchestrationStore.ts");
const { readWorkspaceSnapshot } = await import("../src/snapshotBridge.ts");

function reset() {
  useOrchestrationStore.getState().restore(undefined);
}

test("pipelines connect agents both ways and refuse bad pairs", () => {
  reset();
  const store = useOrchestrationStore.getState();
  const id = store.connectPipe("claude", "gemini");
  assert.ok(id);
  assert.equal(store.connectPipe("gemini", "claude"), null, "no duplicate in reverse");
  assert.equal(store.connectPipe("codex", "codex"), null, "no self pipe");
  assert.ok(store.connectPipe("codex", "claude"));

  const { pipes } = useOrchestrationStore.getState();
  assert.deepEqual(pipePeers(pipes, "claude").sort(), ["codex", "gemini"]);
  assert.deepEqual(pipePeers(pipes, "gemini"), ["claude"]);
  assert.ok(findPipe(pipes, "gemini", "claude"));
  assert.equal(isOrchestratedTerminal("codex"), true, "piped titles stay stable");
  assert.equal(isOrchestratedTerminal("shell-1"), false);

  useOrchestrationStore.getState().disconnectPipe(id!);
  assert.deepEqual(pipePeers(useOrchestrationStore.getState().pipes, "gemini"), []);
});

test("AI nodes join pipelines but never pair with another source", () => {
  reset();
  const store = useOrchestrationStore.getState();
  const gemini = store.addAiNode("gemini", { x: 10, y: 20 });
  const gpt = store.addAiNode("chatgpt", { x: 10, y: 300 }, { transport: "cli" });
  const node = useOrchestrationStore.getState().sources[gemini];
  assert.equal(node.kind, "ai");
  assert.equal(node.name, "Gemini");
  assert.deepEqual(node.ai, { connector: "gemini", model: "", transport: "api" });
  assert.equal(useOrchestrationStore.getState().sources[gpt].ai?.transport, "cli");

  assert.ok(store.connectPipe("claude", gemini));
  assert.equal(store.connectPipe(gemini, gpt), null);

  useOrchestrationStore.getState().removeSource(gemini);
  assert.equal(useOrchestrationStore.getState().pipes.length, 0, "pipes of removed node go");
});

test("updateAiConfig renames a node that still carries its connector's name", () => {
  reset();
  const store = useOrchestrationStore.getState();
  const id = store.addAiNode("gemini", { x: 0, y: 0 });
  store.updateAiConfig(id, { connector: "claude" });
  assert.equal(useOrchestrationStore.getState().sources[id].name, "Claude");
  store.updateSource(id, { name: "Reviewer" });
  store.updateAiConfig(id, { connector: "chatgpt", model: "gpt-5" });
  const node = useOrchestrationStore.getState().sources[id];
  assert.equal(node.name, "Reviewer", "custom names are kept");
  assert.deepEqual(node.ai, { connector: "chatgpt", model: "gpt-5", transport: "api" });
});

test("orchestrators are never pipe ends; making one turns its pipes into links", () => {
  reset();
  const store = useOrchestrationStore.getState();
  const model = store.addAiNode("gemini", { x: 0, y: 0 });
  store.connectPipe("lead", "worker-a");
  store.connectPipe("lead", "worker-b");
  store.connectPipe("lead", model);
  store.connectPipe("worker-a", "worker-b");

  useOrchestrationStore.getState().markOrchestrator("lead");
  const state = useOrchestrationStore.getState();
  assert.deepEqual(
    state.pipes.map((pipe) => [pipe.a, pipe.b]),
    [["worker-a", "worker-b"]],
    "only the pipe between the two workers stays",
  );
  assert.deepEqual(
    state.links
      .filter((link) => link.orchestratorId === "lead")
      .map((link) => [link.targetKind, link.targetId])
      .sort(),
    [
      ["source", model],
      ["terminal", "worker-a"],
      ["terminal", "worker-b"],
    ].sort(),
  );
  assert.equal(store.connectPipe("lead", "worker-c"), null);
});

test("captureOrchestration keeps pipes whose ends still exist", () => {
  reset();
  const store = useOrchestrationStore.getState();
  const model = store.addAiNode("claude", { x: 0, y: 0 });
  store.connectPipe("t1", "t2");
  store.connectPipe("t1", model);
  store.connectPipe("t1", "t-gone");

  const captured = captureOrchestration(new Set(["t1", "t2"]));
  assert.ok(captured);
  assert.deepEqual(
    captured.pipes.map((pipe) => pipe.b).sort(),
    [model, "t2"].sort(),
  );

  reset();
  assert.equal(captureOrchestration(new Set()), undefined, "empty graph is not saved");
});

test("saved scenes restore pipes and AI nodes, dropping broken entries", () => {
  const restored = readWorkspaceSnapshot({
    scene: {
      version: 2,
      camera: { x: 0, y: 0, zoom: 1 },
      projects: [],
      annotations: [],
      orchestration: {
        orchestratorIds: [],
        links: [],
        sources: {
          "ai-1": {
            kind: "ai",
            name: "Gemini",
            url: "",
            description: "Reviewer",
            ai: { connector: "gemini", model: "gemini-2.5-pro", transport: "warp" },
            x: 1,
            y: 2,
            w: 320,
            h: 250,
          },
          "ai-bad": { kind: "ai", name: "?", ai: { connector: "nope" } },
        },
        pipes: [
          { id: "p1", a: "t1", b: "t2" },
          { id: "p2", a: "t2", b: "t1" },
          { id: "p3", a: "t1", b: "t1" },
          { id: "p4", a: "t1", b: "ai-1" },
          { id: 5, a: "x", b: "y" },
        ],
      },
    },
  });
  assert.ok(restored && "scene" in restored);
  const orchestration = restored.scene.orchestration;
  assert.ok(orchestration);
  assert.deepEqual(Object.keys(orchestration.sources), ["ai-1"]);
  assert.deepEqual(orchestration.sources["ai-1"].ai, {
    connector: "gemini",
    model: "gemini-2.5-pro",
    transport: "api",
  });
  assert.deepEqual(
    orchestration.pipes.map((pipe) => pipe.id),
    ["p1", "p4"],
  );
});

test("scenes saved before pipelines existed still load", () => {
  const restored = readWorkspaceSnapshot({
    scene: {
      version: 2,
      camera: { x: 0, y: 0, zoom: 1 },
      projects: [],
      annotations: [],
      orchestration: { orchestratorIds: ["o"], links: [], sources: {} },
    },
  });
  assert.ok(restored && "scene" in restored);
  assert.deepEqual(restored.scene.orchestration?.pipes, []);
});
