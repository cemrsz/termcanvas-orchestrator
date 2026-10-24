import test from "node:test";
import assert from "node:assert/strict";

import { contextMenuTargets } from "../src/canvas/contextMenuTargets.ts";
import type { ProjectData } from "../src/types/index.ts";

function project(id: string, name: string, worktrees: string[]): ProjectData {
  return {
    id,
    name,
    path: `/tmp/${name}`,
    worktrees: worktrees.map((worktree) => ({
      id: `${id}:${worktree}`,
      name: worktree,
      path: `/tmp/${name}/${worktree}`,
      terminals: [],
    })),
  };
}

const projects = [
  project("p1", "Coldmalil", ["master"]),
  project("p2", "ekip", ["master", "feature"]),
];

test("the focused worktree comes first and the others stay on offer", () => {
  assert.deepEqual(
    contextMenuTargets(projects, "p1", "p1:master").map((target) => target.label),
    ["Coldmalil", "ekip / master", "ekip / feature"],
  );
  assert.deepEqual(contextMenuTargets(projects, "p2", "p2:feature")[0], {
    projectId: "p2",
    worktreeId: "p2:feature",
    label: "ekip / feature",
  });
  assert.equal(contextMenuTargets(projects, "p2", "p2:feature").length, 3);
});

test("without focus every worktree is offered, never just the first project", () => {
  assert.deepEqual(
    contextMenuTargets(projects, null, null).map((target) => target.label),
    ["Coldmalil", "ekip / master", "ekip / feature"],
  );
});

test("a focus that no longer exists falls back to every worktree", () => {
  assert.equal(contextMenuTargets(projects, "gone", "gone:master").length, 3);
  assert.deepEqual(contextMenuTargets([], null, null), []);
});
