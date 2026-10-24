import type { ProjectData } from "../types";

export interface ContextMenuTarget {
  projectId: string;
  worktreeId: string;
  /** Project name, plus the worktree when the project has several. */
  label: string;
}

/**
 * Where a canvas menu action that needs a folder (a team, an orchestrator)
 * can go: every worktree on the canvas, the focused one first. The menu
 * names each one, so nothing lands silently in a project the user did not
 * mean — focus is easy to lose (a click on empty canvas) and easy to keep
 * by accident (it stays on a project after its terminals are closed).
 */
export function contextMenuTargets(
  projects: ProjectData[],
  focusedProjectId: string | null,
  focusedWorktreeId: string | null,
): ContextMenuTarget[] {
  const all = projects.flatMap((project) =>
    project.worktrees.map((worktree) => ({
      projectId: project.id,
      worktreeId: worktree.id,
      label:
        project.worktrees.length > 1
          ? `${project.name} / ${worktree.name}`
          : project.name,
    })),
  );
  const isFocused = (target: ContextMenuTarget) =>
    target.projectId === focusedProjectId &&
    target.worktreeId === focusedWorktreeId;
  return [...all.filter(isFocused), ...all.filter((target) => !isFocused(target))];
}
