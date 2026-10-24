import test from "node:test";
import assert from "node:assert/strict";

import {
  buildTeamView,
  listTeams,
  resolveMemberRef,
  teamComponentOf,
  wouldCreateCycle,
  type TeamDirectory,
  type TeamMemberInfo,
} from "../shared/team.ts";

function member(id: string, name = id): TeamMemberInfo {
  return {
    id,
    name,
    type: "claude",
    worktreePath: "/repo",
    project: "repo",
    ptyId: 1,
    status: "running",
  };
}

function link(orchestratorId: string, targetId: string, targetKind: "terminal" | "source" = "terminal") {
  return { orchestratorId, targetKind, targetId };
}

/** lead -> m1, m2; m1 -> w1, w2; m2 -> w3; m1 -> sheet; lone stays out. */
function hierarchy(): TeamDirectory {
  return {
    managerIds: ["lead", "m1", "m2"],
    members: ["lead", "m1", "m2", "w1", "w2", "w3", "lone"].map((id) => member(id)),
    sources: [
      { id: "sheet", kind: "sheet", name: "Leads", url: "u", description: "" },
      { id: "other", kind: "note", name: "Other", url: "", description: "" },
    ],
    links: [
      link("lead", "m1"),
      link("lead", "m2"),
      link("m1", "w1"),
      link("m1", "w2"),
      link("m2", "w3"),
      link("m1", "sheet", "source"),
    ],
    lang: "tr",
  };
}

test("cycle check refuses wiring a manager under its own report", () => {
  const { links } = hierarchy();
  assert.equal(wouldCreateCycle(links, "m1", "lead"), true);
  assert.equal(wouldCreateCycle(links, "w1", "lead"), true);
  assert.equal(wouldCreateCycle(links, "m1", "m1"), true);
  assert.equal(wouldCreateCycle(links, "m2", "w1"), false);
  assert.equal(wouldCreateCycle(links, "lead", "lone"), false);
});

test("everyone connected by wires is one team and sees every wired source", () => {
  const dir = hierarchy();
  const view = buildTeamView(dir, "w3");
  assert.ok(view);
  assert.deepEqual(
    view.members.map((m) => m.id),
    ["lead", "m1", "w1", "w2", "m2", "w3"],
  );
  // The sheet is wired to m1 only, but w3 (under m2) still sees it.
  assert.deepEqual(view.sources.map((s) => s.id), ["sheet"]);
  assert.equal(view.teamId, "lead");
  assert.deepEqual(view.managers.map((m) => m.id), ["m2"]);
  assert.deepEqual(view.reports, []);
});

test("a middle manager has a manager and reports", () => {
  const view = buildTeamView(hierarchy(), "m1");
  assert.ok(view);
  assert.equal(view.me.isManager, true);
  assert.equal(view.me.depth, 1);
  assert.deepEqual(view.managers.map((m) => m.id), ["lead"]);
  assert.deepEqual(view.reports.map((m) => m.id), ["w1", "w2"]);
  assert.equal(view.members.find((m) => m.id === "w2")?.depth, 2);
});

test("unwired agents are not on a team", () => {
  const dir = hierarchy();
  assert.equal(buildTeamView(dir, "lone"), null);
  assert.equal(buildTeamView(dir, "missing"), null);
  const { terminalIds } = teamComponentOf(dir, "lead");
  assert.equal(terminalIds.has("lone"), false);
});

test("separate wire groups are separate teams", () => {
  const dir = hierarchy();
  dir.managerIds.push("lone");
  dir.members.push(member("x"));
  dir.links.push(link("lone", "x"));
  const teams = listTeams(dir);
  assert.deepEqual(
    teams.map((team) => team.teamId).sort(),
    ["lead", "lone"],
  );
});

test("agent references resolve by number, id, name and unique prefix", () => {
  const list = [member("a", "Research Manager"), member("b", "Research 1"), member("c", "Copywriter")];
  assert.equal(resolveMemberRef(list, "2").id, "b");
  assert.equal(resolveMemberRef(list, "c").id, "c");
  assert.equal(resolveMemberRef(list, "copy").id, "c");
  assert.equal(resolveMemberRef(list, "research manager").id, "a");
  assert.throws(() => resolveMemberRef(list, "research"), /No single agent/);
  assert.throws(() => resolveMemberRef(list, ""), /required/);
});
