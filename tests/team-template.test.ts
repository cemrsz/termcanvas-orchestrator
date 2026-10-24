import test from "node:test";
import assert from "node:assert/strict";

import {
  FULL_TEAM,
  SMALL_TEAM,
  TEAM_MODELS,
  planTeam,
} from "../src/actions/teamTemplate.ts";

function overlaps(a: { x: number; y: number; width: number; height: number }, b: typeof a) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

test("the full team is 1 Opus lead, 4 Sonnet managers and 20 Haiku workers", () => {
  const plan = planTeam(FULL_TEAM, { x: 0, y: 0 });
  const byTier = (tier: string) => plan.filter((agent) => agent.tier === tier);
  assert.equal(plan.length, 25);
  assert.equal(byTier("lead").length, 1);
  assert.equal(byTier("manager").length, 4);
  assert.equal(byTier("worker").length, 20);
  assert.ok(byTier("lead").every((a) => a.model === TEAM_MODELS.lead && a.model.includes("opus")));
  assert.ok(byTier("manager").every((a) => a.model.includes("sonnet") && a.managerKey === "lead"));
  assert.ok(byTier("worker").every((a) => a.model.includes("haiku")));
  for (const manager of byTier("manager")) {
    assert.equal(plan.filter((a) => a.managerKey === manager.key).length, 5);
  }
});

test("team tiles never overlap and names are unique", () => {
  for (const template of [FULL_TEAM, SMALL_TEAM]) {
    const plan = planTeam(template, { x: 500, y: 200 });
    for (let i = 0; i < plan.length; i++) {
      for (let j = i + 1; j < plan.length; j++) {
        assert.equal(overlaps(plan[i], plan[j]), false, `${plan[i].name} overlaps ${plan[j].name}`);
      }
    }
    assert.equal(new Set(plan.map((a) => a.name)).size, plan.length);
  }
  assert.equal(planTeam(SMALL_TEAM, { x: 0, y: 0 }).length, 9);
});
