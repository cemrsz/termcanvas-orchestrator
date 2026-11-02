import test from "node:test";
import assert from "node:assert/strict";

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
  value: { addEventListener() {}, innerHeight: 900, innerWidth: 1440, navigator, termcanvas: undefined },
});

const { useProjectStore } = await import("../src/stores/projectStore.ts");
const { useOrchestrationStore } = await import("../src/stores/orchestrationStore.ts");
const { buildBridgeManifest, buildOrchestratorManifest } = await import(
  "../src/actions/orchestrationSceneActions.ts"
);

function terminal(id: string, type: string, customTitle?: string) {
  return {
    id,
    title: type,
    customTitle,
    type,
    ptyId: 7,
    status: "idle",
    x: 0,
    y: 0,
    width: 600,
    height: 400,
    starred: false,
    tags: [],
  };
}

function setup() {
  useProjectStore.setState({
    projects: [
      {
        id: "p1",
        name: "demo",
        path: "/repo",
        collapsed: false,
        zIndex: 0,
        worktrees: [
          {
            id: "w1",
            name: "main",
            path: "/repo",
            collapsed: false,
            terminals: [
              terminal("claude", "claude", "Planner"),
              terminal("gemini", "gemini", "Researcher"),
              terminal("codex", "codex", "Coder"),
              terminal("sh", "shell"),
              terminal("lead", "claude", "Lead"),
            ],
          },
        ],
      },
    ] as any,
  });
  useOrchestrationStore.getState().restore(undefined);
}

test("an agent sees its pipeline peers, models and sources — never shells", () => {
  setup();
  const store = useOrchestrationStore.getState();
  const model = store.addAiNode("chatgpt", { x: 0, y: 0 }, { persona: "Critic" });
  const note = store.addSource("note", { x: 0, y: 0 });
  store.connectPipe("claude", "gemini");
  store.connectPipe("codex", "claude");
  store.connectPipe("claude", model);
  store.connectPipe("claude", note);
  store.connectPipe("claude", "sh");

  const manifest = buildBridgeManifest("claude");
  assert.ok(manifest);
  assert.deepEqual(manifest.self, {
    id: "claude",
    title: "Planner",
    type: "claude",
    worktreePath: "/repo",
    role: "agent",
  });
  assert.deepEqual(
    manifest.agents.map((agent) => [agent.name, agent.type, agent.via]),
    [
      ["Researcher", "gemini", "pipeline"],
      ["Coder", "codex", "pipeline"],
    ],
  );
  assert.deepEqual(manifest.models, [
    {
      id: model,
      name: "ChatGPT",
      connector: "chatgpt",
      connectorName: "ChatGPT",
      model: "",
      transport: "api",
      persona: "Critic",
      baseURL: "",
    },
  ]);
  assert.deepEqual(manifest.sources.map((source) => source.kind), ["note"]);

  const gemini = buildBridgeManifest("gemini");
  assert.deepEqual(gemini?.agents.map((agent) => agent.name), ["Planner"]);
  assert.equal(buildBridgeManifest("missing"), null);
});

test("an orchestrator sees its links; the old manifest shape is kept", () => {
  setup();
  const store = useOrchestrationStore.getState();
  store.markOrchestrator("lead");
  store.connect("lead", "terminal", "codex");
  const model = store.addAiNode("gemini", { x: 0, y: 0 });
  store.connect("lead", "source", model);

  assert.equal(buildOrchestratorManifest("claude"), null, "not an orchestrator");
  const manifest = buildOrchestratorManifest("lead");
  assert.ok(manifest);
  assert.equal(manifest.self.role, "orchestrator");
  assert.deepEqual(manifest.orchestrator, manifest.self);
  assert.deepEqual(manifest.agents.map((agent) => [agent.name, agent.via]), [["Coder", "orchestrator"]]);
  assert.deepEqual(manifest.models.map((m) => m.connector), ["gemini"]);
  assert.deepEqual(manifest.sources, []);
});
