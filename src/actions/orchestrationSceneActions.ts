import { createTerminal, useProjectStore } from "../stores/projectStore";
import {
  isAgentTerminalType,
  useOrchestrationStore,
} from "../stores/orchestrationStore";
import { resolveTerminalWithRuntimeState } from "../stores/terminalRuntimeStateStore";
import { useNotificationStore } from "../stores/notificationStore";
import {
  createTerminalInScene,
  focusTerminalInScene,
} from "./terminalSceneActions";
import { FULL_TEAM, planTeam, type TeamTemplate } from "./teamTemplate";
import { panToTerminal } from "../utils/panToTerminal";
import type { ProjectData, TerminalData } from "../types";
import type {
  OrchestrationSourceKind,
  OrchestratorManifest,
} from "../types/orchestration";

interface TerminalLocation {
  project: ProjectData;
  worktree: ProjectData["worktrees"][number];
  terminal: TerminalData;
}

function findTerminal(terminalId: string): TerminalLocation | null {
  for (const project of useProjectStore.getState().projects) {
    for (const worktree of project.worktrees) {
      const terminal = worktree.terminals.find((t) => t.id === terminalId);
      if (terminal) return { project, worktree, terminal };
    }
  }
  return null;
}

function notifyError(message: string) {
  useNotificationStore.getState().notify("error", message);
}

/**
 * Wire every free agent terminal of the project to the orchestrator, so a
 * fresh orchestrator starts out "connected to my agents". Agents that
 * already report to someone stay in their team.
 */
function connectProjectAgents(orchestratorId: string, projectId: string) {
  const project = useProjectStore
    .getState()
    .projects.find((candidate) => candidate.id === projectId);
  if (!project) return;
  const store = useOrchestrationStore.getState();
  for (const worktree of project.worktrees) {
    for (const terminal of worktree.terminals) {
      if (terminal.id === orchestratorId || terminal.stashed) continue;
      if (!isAgentTerminalType(terminal.type)) continue;
      if (store.orchestratorIds.includes(terminal.id)) continue;
      const hasManager = useOrchestrationStore
        .getState()
        .links.some(
          (link) =>
            link.targetKind === "terminal" && link.targetId === terminal.id,
        );
      if (hasManager) continue;
      store.connect(orchestratorId, "terminal", terminal.id);
    }
  }
}

export async function createOrchestratorInScene(options: {
  projectId: string;
  worktreeId: string;
  position?: { x: number; y: number };
}): Promise<TerminalData | null> {
  const project = useProjectStore
    .getState()
    .projects.find((candidate) => candidate.id === options.projectId);
  const worktree = project?.worktrees.find(
    (candidate) => candidate.id === options.worktreeId,
  );
  if (!project || !worktree) return null;

  const base = createTerminal("claude");
  let startPrompt: string;
  try {
    ({ startPrompt } = await window.termcanvas.orchestrator.prepare(
      base.id,
      worktree.path,
    ));
  } catch (error) {
    notifyError(
      `Could not prepare the orchestrator: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }

  const terminal = createTerminalInScene({
    projectId: project.id,
    worktreeId: worktree.id,
    terminal: {
      ...base,
      customTitle: "Orchestrator",
      initialPrompt: startPrompt,
    },
    position: options.position,
  });
  useOrchestrationStore.getState().markOrchestrator(terminal.id);
  connectProjectAgents(terminal.id, project.id);
  return terminal;
}

/**
 * Lay out and wire a whole team of Claude terminals: a lead, managers that
 * report to it and workers that report to each manager. Each agent starts
 * with its model, its role name and its team brief; the lead is briefed
 * and waits for the user's first command.
 */
export async function createTeamInScene(options: {
  projectId: string;
  worktreeId: string;
  position: { x: number; y: number };
  template?: TeamTemplate;
}): Promise<TerminalData[] | null> {
  const project = useProjectStore
    .getState()
    .projects.find((candidate) => candidate.id === options.projectId);
  const worktree = project?.worktrees.find(
    (candidate) => candidate.id === options.worktreeId,
  );
  if (!project || !worktree) return null;

  const plan = planTeam(options.template ?? FULL_TEAM, options.position);
  const terminals = new Map<string, TerminalData>();
  for (const agent of plan) {
    terminals.set(agent.key, {
      ...createTerminal("claude"),
      customTitle: agent.name,
      model: agent.model,
      width: agent.width,
      height: agent.height,
    });
  }
  const lead = terminals.get("lead")!;

  let startPrompt: string;
  try {
    ({ startPrompt } = await window.termcanvas.orchestrator.prepare(
      lead.id,
      worktree.path,
    ));
  } catch (error) {
    notifyError(
      `Could not prepare the team: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }

  // Wire everything before the terminals exist, so each one launches
  // already knowing it is on a team (system prompt, allowed tools).
  const store = useOrchestrationStore.getState();
  for (const agent of plan) {
    if (agent.tier !== "worker") store.markOrchestrator(terminals.get(agent.key)!.id);
  }
  for (const agent of plan) {
    const id = terminals.get(agent.key)!.id;
    if (agent.managerKey) {
      store.connect(terminals.get(agent.managerKey)!.id, "terminal", id);
    }
    store.setRole(id, agent.role);
  }

  const created: TerminalData[] = [];
  for (const agent of plan) {
    const terminal = terminals.get(agent.key)!;
    created.push(
      createTerminalInScene({
        projectId: project.id,
        worktreeId: worktree.id,
        terminal: {
          ...terminal,
          ...(agent.key === "lead" ? { initialPrompt: startPrompt } : {}),
        },
        position: { x: agent.x, y: agent.y },
      }),
    );
  }

  focusTerminalInScene(lead.id);
  panToTerminal(lead.id);
  useNotificationStore
    .getState()
    .notify(
      "info",
      `Team ready: ${plan.length} agents. Give your command to ${getTerminalDisplayName({ ...lead, customTitle: lead.customTitle })}.`,
    );
  return created;
}

/**
 * Turn an existing agent terminal into an orchestrator. Its running session
 * gets the orchestrator brief pasted in as the next prompt.
 */
export async function makeTerminalOrchestrator(terminalId: string) {
  const location = findTerminal(terminalId);
  if (!location || !isAgentTerminalType(location.terminal.type)) return;
  const { project, worktree, terminal } = location;

  let startPrompt: string;
  try {
    ({ startPrompt } = await window.termcanvas.orchestrator.prepare(
      terminal.id,
      worktree.path,
    ));
  } catch (error) {
    notifyError(
      `Could not prepare the orchestrator: ${error instanceof Error ? error.message : String(error)}`,
    );
    return;
  }

  useOrchestrationStore.getState().markOrchestrator(terminal.id);
  connectProjectAgents(terminal.id, project.id);

  const live = resolveTerminalWithRuntimeState(terminal);
  if (live.ptyId === null) return;
  const result = await window.termcanvas.composer.submit({
    terminalId: terminal.id,
    ptyId: live.ptyId,
    terminalType: terminal.type,
    worktreePath: worktree.path,
    text: startPrompt,
    images: [],
  });
  if (!result.ok) {
    notifyError(
      `Could not brief the orchestrator: ${result.detail ?? result.error ?? "unknown error"}`,
    );
  }
}

export function removeOrchestratorRole(terminalId: string) {
  useOrchestrationStore.getState().unmarkOrchestrator(terminalId);
}

/** Rewrite the bridge files of restored orchestrators (port file, CLI). */
export function refreshOrchestratorWorkspaces(orchestratorIds: string[]) {
  for (const id of orchestratorIds) {
    const location = findTerminal(id);
    if (!location) continue;
    void window.termcanvas.orchestrator
      .prepare(id, location.worktree.path)
      .catch(() => {
        // The worktree may be gone; the orchestrator then reports errors itself.
      });
  }
}

export function addOrchestrationSourceInScene(
  kind: OrchestrationSourceKind,
  position: { x: number; y: number },
  connectTo?: string,
): string {
  const store = useOrchestrationStore.getState();
  const id = store.addSource(kind, position);
  const orchestratorId =
    connectTo ?? (store.orchestratorIds.length === 1 ? store.orchestratorIds[0] : undefined);
  if (orchestratorId) {
    useOrchestrationStore.getState().connect(orchestratorId, "source", id);
  }
  return id;
}

export function getTerminalDisplayName(terminal: TerminalData): string {
  return terminal.customTitle?.trim() || terminal.title;
}

/** What the API exposes to one orchestrator: only its wired nodes. */
export function buildOrchestratorManifest(
  orchestratorId: string,
): OrchestratorManifest | null {
  const { orchestratorIds, links, sources } = useOrchestrationStore.getState();
  if (!orchestratorIds.includes(orchestratorId)) return null;
  const orchestrator = findTerminal(orchestratorId);
  if (!orchestrator) return null;

  const agents: OrchestratorManifest["agents"] = [];
  const wiredSources: OrchestratorManifest["sources"] = [];
  for (const link of links) {
    if (link.orchestratorId !== orchestratorId) continue;
    if (link.targetKind === "terminal") {
      const target = findTerminal(link.targetId);
      if (!target || target.terminal.stashed) continue;
      const live = resolveTerminalWithRuntimeState(target.terminal);
      agents.push({
        id: target.terminal.id,
        name: getTerminalDisplayName(target.terminal),
        type: target.terminal.type,
        status: live.status,
        ptyId: live.ptyId,
        worktreePath: target.worktree.path,
        project: target.project.name,
      });
    } else {
      const source = sources[link.targetId];
      if (!source) continue;
      wiredSources.push({
        id: source.id,
        kind: source.kind,
        name: source.name,
        url: source.url,
        description: source.description,
      });
    }
  }

  return {
    orchestrator: {
      id: orchestrator.terminal.id,
      title: getTerminalDisplayName(orchestrator.terminal),
      type: orchestrator.terminal.type,
      worktreePath: orchestrator.worktree.path,
    },
    agents,
    sources: wiredSources,
  };
}

export function listOrchestrators() {
  return useOrchestrationStore
    .getState()
    .orchestratorIds.map((id) => buildOrchestratorManifest(id))
    .filter((manifest): manifest is OrchestratorManifest => manifest !== null)
    .map((manifest) => ({
      ...manifest.orchestrator,
      agents: manifest.agents.length,
      sources: manifest.sources.length,
    }));
}
