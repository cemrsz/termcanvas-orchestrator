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

test("connectPipeInScene wires agents and models but never shells", async () => {
  setup();
  const { connectPipeInScene } = await import("../src/actions/orchestrationSceneActions.ts");
  const store = useOrchestrationStore.getState();
  const model = store.addAiNode("gemini", { x: 0, y: 0 });
  const otherModel = store.addAiNode("claude", { x: 0, y: 0 });

  assert.ok(connectPipeInScene("claude", "codex"));
  assert.ok(connectPipeInScene("gemini", model));
  assert.equal(connectPipeInScene("claude", "sh"), null, "shells are not peers");
  assert.equal(connectPipeInScene(model, otherModel), null, "needs an agent end");
  assert.equal(connectPipeInScene("claude", "nope"), null, "unknown node");
  assert.equal(useOrchestrationStore.getState().pipes.length, 2);
});

test("the trio template opens Claude, Gemini and Codex fully wired and briefed", async () => {
  setup();
  const prepared: { id: string; peers: string }[] = [];
  (window as any).termcanvas = {
    bridge: {
      prepare: async (id: string, _worktree: string, peers: { name: string }[]) => {
        prepared.push({ id, peers: peers.map((peer) => peer.name).join("+") });
        return {
          instructionsRelPath: `.termcanvas/bridge/${id}/BRIDGE.md`,
          scriptRelPath: `.termcanvas/bridge/${id}/tc.mjs`,
          briefPrompt: `brief:${peers.map((peer) => peer.name).join(",")}`,
        };
      },
    },
  };
  try {
    const { createAgentTrioInScene } = await import("../src/actions/orchestrationSceneActions.ts");
    const created = await createAgentTrioInScene({ projectId: "p1", worktreeId: "w1", position: { x: 0, y: 2000 } });
    assert.deepEqual(created.map((t) => [t.type, t.customTitle]), [
      ["claude", "Claude"],
      ["gemini", "Gemini"],
      ["codex", "Codex"],
    ]);
    assert.deepEqual(
      created.map((t) => t.initialPrompt),
      ["brief:Gemini,Codex", "brief:Claude,Codex", "brief:Claude,Gemini"],
    );
    assert.equal(useOrchestrationStore.getState().pipes.length, 3, "every pair is wired");
    assert.equal(prepared.length, 3);
    const manifest = buildBridgeManifest(created[0].id);
    assert.deepEqual(manifest?.agents.map((a) => a.name).sort(), ["Codex", "Gemini"]);
  } finally {
    (window as any).termcanvas = undefined;
  }
});
