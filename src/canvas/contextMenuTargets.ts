import type { ProjectData } from "../types";

export interface ContextMenuTarget {
  projectId: string;
  worktreeId: string;
  /** Project name, plus the worktree when the project has several. */
  label: string;
}

/**
 * Where a canvas menu action that needs a folder (a team, an orchestrator)
 * goes: the focused worktree, or else every worktree on the canvas. The menu
 * names each one, so nothing lands silently in the first project — a click
 * on empty canvas clears the focus, and that used to happen unnoticed.
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
  const focused = all.find(
    (target) =>
      target.projectId === focusedProjectId &&
      target.worktreeId === focusedWorktreeId,
  );
  return focused ? [focused] : all;
}
