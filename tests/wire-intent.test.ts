import test from "node:test";
import assert from "node:assert/strict";

import { buildPipeEdges, resolveWireIntent } from "../src/canvas/orchestrationFlow.tsx";

const agents = new Set(["claude", "gemini", "codex", "lead"]);
const context = {
  orchestratorIds: ["lead"],
  sources: { "ai-1": {}, "sheet-1": {} },
  isAgent: (id: string) => agents.has(id),
};
const port = (side: string) => `orchestration-in-${side}`;
const out = (side: string) => `orchestrator-out-${side}`;

test("agent to agent is a pipeline, whichever way it is drawn", () => {
  assert.deepEqual(
    resolveWireIntent(
      { source: "claude", target: "gemini", sourceHandle: port("right"), targetHandle: port("left") },
      context,
    ),
    { kind: "pipe", a: "claude", b: "gemini" },
  );
  assert.deepEqual(
    resolveWireIntent(
      { source: "ai-1", target: "codex", sourceHandle: port("left"), targetHandle: port("right") },
      context,
    ),
    { kind: "pipe", a: "ai-1", b: "codex" },
  );
});

test("anything wired to an orchestrator becomes its link", () => {
  assert.deepEqual(
    resolveWireIntent(
      { source: "lead", target: "codex", sourceHandle: out("right"), targetHandle: port("left") },
      context,
    ),
    { kind: "link", orchestratorId: "lead", targetKind: "terminal", targetId: "codex" },
  );
  assert.deepEqual(
    resolveWireIntent(
      { source: "sheet-1", target: "lead", sourceHandle: port("right"), targetHandle: out("left") },
      context,
    ),
    { kind: "link", orchestratorId: "lead", targetKind: "source", targetId: "sheet-1" },
  );
});

test("nonsense wires are refused", () => {
  const cases = [
    { source: "claude", target: "claude" },
    { source: "ai-1", target: "sheet-1" },
    { source: "claude", target: "shell-1" },
    { source: "lead", target: "lead" },
  ];
  for (const c of cases) {
    assert.equal(
      resolveWireIntent({ ...c, sourceHandle: port("left"), targetHandle: port("right") }, context),
      null,
      `${c.source} → ${c.target}`,
    );
  }
  assert.equal(
    resolveWireIntent(
      { source: "claude", target: "gemini", sourceHandle: "other", targetHandle: port("left") },
      context,
    ),
    null,
    "foreign handles",
  );
});

test("pipe edges start at an agent and blend the two ends' colors", () => {
  const terminalRects = new Map([
    ["claude", { x: 0, y: 0, w: 600 }],
    ["gemini", { x: 900, y: 0, w: 600 }],
  ]);
  const terminalColors = new Map([
    ["claude", "#f5a623"],
    ["gemini", "#4285f4"],
  ]);
  const sources = {
    "ai-1": {
      id: "ai-1",
      kind: "ai" as const,
      name: "ChatGPT",
      url: "",
      description: "",
      ai: { connector: "chatgpt" as const, model: "", transport: "api" as const },
      x: -500,
      y: 0,
      w: 320,
      h: 250,
    },
  };
  const edges = buildPipeEdges({
    pipes: [
      { id: "p1", a: "gemini", b: "claude" },
      { id: "p2", a: "ai-1", b: "claude" },
      { id: "p3", a: "claude", b: "gone" },
    ],
    sources,
    terminalRects,
    terminalColors,
    busyTerminalIds: new Set(["gemini"]),
  });
  assert.equal(edges.length, 2, "edges to missing nodes are skipped");
  const [toClaude, toModel] = edges;
  assert.equal(toClaude.source, "gemini");
  assert.equal(toClaude.sourceHandle, "orchestration-in-left", "gemini faces left to claude");
  assert.equal(toClaude.targetHandle, "orchestration-in-right");
  assert.deepEqual(
    [toClaude.data?.sourceColor, toClaude.data?.targetColor, toClaude.data?.busy],
    ["#4285f4", "#f5a623", true],
  );
  assert.equal(toModel.source, "claude", "the agent end is the edge source");
  assert.equal(toModel.target, "ai-1");
  assert.equal(toModel.data?.targetColor, "#10a37f", "AI nodes use their connector color");
});
