import test from "node:test";
import assert from "node:assert/strict";

import { resolveWireIntent } from "../src/canvas/orchestrationFlow.tsx";

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
