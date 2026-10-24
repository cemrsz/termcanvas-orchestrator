import { useProjectStore } from "../stores/projectStore";
import {
  isAgentTerminalType,
  useOrchestrationStore,
} from "../stores/orchestrationStore";
import { resolveTerminalWithRuntimeState } from "../stores/terminalRuntimeStateStore";
import type {
  TeamDirectory,
  TeamLang,
  TeamMemberInfo,
} from "../../shared/team";

function displayName(terminal: { customTitle?: string; title: string }) {
  return terminal.customTitle?.trim() || terminal.title;
}

/**
 * Snapshot of every agent and source on the canvas, in the shape the main
 * process and `shared/team.ts` work with.
 */
export function buildTeamDirectory(lang: TeamLang): TeamDirectory {
  const { orchestratorIds, sources, links, roles } =
    useOrchestrationStore.getState();
  const members: TeamMemberInfo[] = [];
  for (const project of useProjectStore.getState().projects) {
    for (const worktree of project.worktrees) {
      for (const terminal of worktree.terminals) {
        if (terminal.stashed || !isAgentTerminalType(terminal.type)) continue;
        const live = resolveTerminalWithRuntimeState(terminal);
        members.push({
          id: terminal.id,
          name: displayName(terminal),
          type: terminal.type,
          ...(terminal.model ? { model: terminal.model } : {}),
          ...(roles[terminal.id] ? { role: roles[terminal.id] } : {}),
          worktreePath: worktree.path,
          project: project.name,
          ptyId: live.ptyId,
          status: live.status,
        });
      }
    }
  }
  return {
    managerIds: [...orchestratorIds],
    members,
    sources: Object.values(sources).map((source) => ({
      id: source.id,
      kind: source.kind,
      name: source.name,
      url: source.url,
      ...(source.writeUrl ? { writeUrl: source.writeUrl } : {}),
      description: source.description,
    })),
    links: links.map((link) => ({
      orchestratorId: link.orchestratorId,
      targetKind: link.targetKind,
      targetId: link.targetId,
    })),
    lang,
  };
}
