/**
 * Agent teams on the canvas.
 *
 * Wires form the team: every agent and data source reachable through
 * orchestration links (in either direction) belongs to the same team.
 * Within a team, a link from a manager to an agent is a reporting line, so
 * an Opus lead can manage Sonnet managers who in turn manage Haiku workers.
 *
 * Everything here is pure so the Electron main process, the renderer and
 * the tests share one definition of "who is on my team".
 */

export type TeamLang = "tr" | "en";

export interface TeamLinkInfo {
  /** The manager end of the wire (an orchestrator terminal). */
  orchestratorId: string;
  targetKind: "terminal" | "source";
  targetId: string;
}

export interface TeamMemberInfo {
  id: string;
  name: string;
  type: string;
  model?: string;
  /** What this agent is for, shown to the whole team. */
  role?: string;
  worktreePath: string;
  project: string;
  ptyId: number | null;
  status: string;
}

export interface TeamSourceInfo {
  id: string;
  kind: string;
  name: string;
  url: string;
  /** Sheet bridge (Apps Script or n8n) that reads and writes rows. */
  writeUrl?: string;
  description: string;
}

/** What the renderer tells the main process about the canvas. */
export interface TeamDirectory {
  managerIds: string[];
  members: TeamMemberInfo[];
  sources: TeamSourceInfo[];
  links: TeamLinkInfo[];
  lang: TeamLang;
}

export interface TeamRosterEntry extends TeamMemberInfo {
  isManager: boolean;
  managerIds: string[];
  reportIds: string[];
  /** 0 for the top of the team, 1 for its direct reports, … */
  depth: number;
}

export interface TeamView {
  teamId: string;
  me: TeamRosterEntry;
  managers: TeamRosterEntry[];
  reports: TeamRosterEntry[];
  /** The whole team, top-down. */
  members: TeamRosterEntry[];
  /** Every source wired to anyone on the team. */
  sources: TeamSourceInfo[];
}

export const EMPTY_TEAM_DIRECTORY: TeamDirectory = {
  managerIds: [],
  members: [],
  sources: [],
  links: [],
  lang: "tr",
};

/**
 * True if wiring `managerId -> targetId` would make a manager report to
 * someone below it (or to itself).
 */
export function wouldCreateCycle(
  links: readonly TeamLinkInfo[],
  managerId: string,
  targetId: string,
): boolean {
  if (managerId === targetId) return true;
  // Walk down from the target; reaching the manager means a loop.
  const seen = new Set<string>();
  const stack = [targetId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === managerId) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    for (const link of links) {
      if (link.targetKind === "terminal" && link.orchestratorId === current) {
        stack.push(link.targetId);
      }
    }
  }
  return false;
}

function nodeKey(kind: "terminal" | "source", id: string) {
  return `${kind === "terminal" ? "t" : "s"}:${id}`;
}

/** Terminal and source ids of the team that contains `terminalId`. */
export function teamComponentOf(
  directory: TeamDirectory,
  terminalId: string,
): { terminalIds: Set<string>; sourceIds: Set<string> } {
  const terminalIds = new Set<string>();
  const sourceIds = new Set<string>();
  const adjacency = new Map<string, string[]>();
  const add = (a: string, b: string) => {
    if (!adjacency.has(a)) adjacency.set(a, []);
    adjacency.get(a)!.push(b);
  };
  for (const link of directory.links) {
    const from = nodeKey("terminal", link.orchestratorId);
    const to = nodeKey(link.targetKind, link.targetId);
    add(from, to);
    add(to, from);
  }
  const start = nodeKey("terminal", terminalId);
  const seen = new Set<string>([start]);
  const queue = [start];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const id = current.slice(2);
    if (current.startsWith("t:")) terminalIds.add(id);
    else sourceIds.add(id);
    for (const next of adjacency.get(current) ?? []) {
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  return { terminalIds, sourceIds };
}

export function isTeamMember(
  directory: TeamDirectory,
  terminalId: string,
): boolean {
  return (
    directory.managerIds.includes(terminalId) ||
    directory.links.some(
      (link) =>
        link.orchestratorId === terminalId ||
        (link.targetKind === "terminal" && link.targetId === terminalId),
    )
  );
}

export function buildTeamView(
  directory: TeamDirectory,
  terminalId: string,
): TeamView | null {
  const membersById = new Map(
    directory.members.map((member) => [member.id, member]),
  );
  if (!membersById.has(terminalId) || !isTeamMember(directory, terminalId)) {
    return null;
  }
  const { terminalIds, sourceIds } = teamComponentOf(directory, terminalId);
  const managerSet = new Set(directory.managerIds);

  const managersOf = new Map<string, string[]>();
  const reportsOf = new Map<string, string[]>();
  for (const link of directory.links) {
    if (link.targetKind !== "terminal") continue;
    if (!terminalIds.has(link.orchestratorId)) continue;
    if (!membersById.has(link.targetId) || !membersById.has(link.orchestratorId)) {
      continue;
    }
    managersOf.set(link.targetId, [
      ...(managersOf.get(link.targetId) ?? []),
      link.orchestratorId,
    ]);
    reportsOf.set(link.orchestratorId, [
      ...(reportsOf.get(link.orchestratorId) ?? []),
      link.targetId,
    ]);
  }

  const present = [...terminalIds].filter((id) => membersById.has(id));
  const roots = present
    .filter((id) => (managersOf.get(id) ?? []).length === 0)
    .sort();
  const depth = new Map<string, number>();
  const queue = [...roots];
  for (const root of roots) depth.set(root, 0);
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const report of reportsOf.get(current) ?? []) {
      if (depth.has(report)) continue;
      depth.set(report, depth.get(current)! + 1);
      queue.push(report);
    }
  }

  const toEntry = (id: string): TeamRosterEntry => ({
    ...membersById.get(id)!,
    isManager: managerSet.has(id),
    managerIds: managersOf.get(id) ?? [],
    reportIds: reportsOf.get(id) ?? [],
    depth: depth.get(id) ?? 0,
  });

  // Top-down: each manager is followed by its reports, in wiring order.
  const ordered: string[] = [];
  const placed = new Set<string>();
  const place = (id: string) => {
    if (placed.has(id)) return;
    placed.add(id);
    ordered.push(id);
    for (const report of reportsOf.get(id) ?? []) place(report);
  };
  for (const root of roots) place(root);
  for (const id of present.sort()) place(id);

  const members = ordered.map(toEntry);
  const me = members.find((member) => member.id === terminalId)!;
  const sourcesById = new Map(
    directory.sources.map((source) => [source.id, source]),
  );
  const sources: TeamSourceInfo[] = [];
  for (const link of directory.links) {
    if (link.targetKind !== "source" || !sourceIds.has(link.targetId)) continue;
    const source = sourcesById.get(link.targetId);
    if (source && !sources.includes(source)) sources.push(source);
  }

  return {
    teamId: roots[0] ?? [...present].sort()[0] ?? terminalId,
    me,
    managers: me.managerIds.map(toEntry),
    reports: me.reportIds.map(toEntry),
    members,
    sources,
  };
}

/** Every distinct team on the canvas, keyed by team id. */
export function listTeams(directory: TeamDirectory): TeamView[] {
  const seen = new Set<string>();
  const teams: TeamView[] = [];
  for (const member of directory.members) {
    if (seen.has(member.id)) continue;
    const view = buildTeamView(directory, member.id);
    if (!view) continue;
    for (const entry of view.members) seen.add(entry.id);
    teams.push(view);
  }
  return teams;
}

/**
 * Resolve an agent reference — a 1-based number, an id or a name (exact,
 * then unique partial match) — against a list of candidates.
 */
export function resolveMemberRef<T extends { id: string; name: string }>(
  candidates: readonly T[],
  ref: string | null | undefined,
): T {
  const value = (ref ?? "").trim();
  if (!value) {
    throw Object.assign(new Error("agent is required"), { status: 400 });
  }
  if (/^\d+$/.test(value)) {
    const byIndex = candidates[parseInt(value, 10) - 1];
    if (byIndex) return byIndex;
  }
  const lower = value.toLowerCase();
  const exact = candidates.filter(
    (candidate) =>
      candidate.id === value || candidate.name.toLowerCase() === lower,
  );
  if (exact.length === 1) return exact[0];
  const partial = candidates.filter((candidate) =>
    candidate.name.toLowerCase().includes(lower),
  );
  if (exact.length === 0 && partial.length === 1) return partial[0];
  const listed =
    candidates.map((candidate, i) => `${i + 1}. ${candidate.name}`).join(", ") ||
    "none";
  throw Object.assign(
    new Error(`No single agent matches '${value}'. Candidates: ${listed}`),
    { status: 404 },
  );
}
