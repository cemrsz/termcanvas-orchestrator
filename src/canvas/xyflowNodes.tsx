import { useCallback, useMemo, useState } from "react";
import {
  type Node,
  type NodeProps,
  type NodeTypes,
  NodeResizer,
} from "@xyflow/react";
import { useProjectStore } from "../stores/projectStore";
import { useCanvasStore } from "../stores/canvasStore";
import { usePinStore } from "../stores/pinStore";
import { usePreferencesStore } from "../stores/preferencesStore";
import { useViewportFocusStore } from "../stores/viewportFocusStore";
import { TerminalTile } from "../terminal/TerminalTile";
import { resolveTerminalMountMode } from "../terminal/terminalRuntimePolicy";
import {
  fitTerminalRuntime,
  useTerminalRuntimeStore,
} from "../terminal/terminalRuntimeStore";
import { panToTerminal } from "../utils/panToTerminal";
import { type TerminalNodeData, type CanvasFlowNode } from "./nodeProjection";
import { rectIntersectsCanvasViewport } from "./viewportBounds";
import { resolveCollisions } from "./collisionResolver";
import {
  isAgentTerminalType,
  useOrchestrationStore,
} from "../stores/orchestrationStore";
import {
  AgentPort,
  ORCHESTRATOR_COLOR,
  OrchestratorOutPort,
  orchestrationNodeTypes,
  type SourceFlowNode,
} from "./orchestrationFlow";
import { TERMINAL_TYPE_CONFIG } from "../terminal/terminalTypeConfig";

const SNAP_GRID = 10;

function snapTo(value: number, grid: number): number {
  return Math.round(value / grid) * grid;
}

type TerminalFlowNode = Node<TerminalNodeData, "terminal">;

function TerminalNode({ data }: NodeProps<TerminalFlowNode>) {
  const [hovered, setHovered] = useState(false);
  const viewport = useCanvasStore((state) => state.viewport);
  const rightPanelCollapsed = useCanvasStore(
    (state) => state.rightPanelCollapsed,
  );
  const leftPanelCollapsed = useCanvasStore(
    (state) => state.leftPanelCollapsed,
  );
  const leftPanelWidth = useCanvasStore((state) => state.leftPanelWidth);
  const rightPanelWidth = useCanvasStore((state) => state.rightPanelWidth);
  const taskDrawerOpen = usePinStore(
    (state) => state.openProjectPath !== null,
  );

  const terminal = useProjectStore(
    useCallback(
      (state) => {
        for (const p of state.projects) {
          if (p.id !== data.projectId) continue;
          for (const w of p.worktrees) {
            if (w.id !== data.worktreeId) continue;
            return w.terminals.find((t) => t.id === data.terminalId) ?? null;
          }
        }
        return null;
      },
      [data.projectId, data.worktreeId, data.terminalId],
    ),
  );

  const worktree = useProjectStore(
    useCallback(
      (state) => {
        const project = state.projects.find((p) => p.id === data.projectId);
        return project?.worktrees.find((w) => w.id === data.worktreeId) ?? null;
      },
      [data.projectId, data.worktreeId],
    ),
  );

  const isOrchestrator = useOrchestrationStore(
    useCallback(
      (state) => state.orchestratorIds.includes(data.terminalId),
      [data.terminalId],
    ),
  );
  const wiredSummary = useOrchestrationStore(
    useCallback(
      (state) => {
        if (!state.orchestratorIds.includes(data.terminalId)) return "";
        let agents = 0;
        let sources = 0;
        for (const link of state.links) {
          if (link.orchestratorId !== data.terminalId) continue;
          if (link.targetKind === "terminal") agents++;
          else sources++;
        }
        return `${agents} agent${agents === 1 ? "" : "s"} · ${sources} source${sources === 1 ? "" : "s"}`;
      },
      [data.terminalId],
    ),
  );

  const updateTerminalSize = useProjectStore(
    (state) => state.updateTerminalSize,
  );
  const updateTerminalPosition = useProjectStore(
    (state) => state.updateTerminalPosition,
  );

  const visible = useMemo(() => {
    if (!terminal) return false;
    return rectIntersectsCanvasViewport(
      { x: terminal.x, y: terminal.y, w: terminal.width, h: terminal.height },
      viewport,
      rightPanelCollapsed,
      leftPanelCollapsed,
      leftPanelWidth,
      rightPanelWidth,
      taskDrawerOpen,
    );
  }, [
    terminal,
    viewport,
    rightPanelCollapsed,
    leftPanelCollapsed,
    leftPanelWidth,
    rightPanelWidth,
    taskDrawerOpen,
  ]);

  const lodMode = useTerminalRuntimeStore(
    useCallback(
      (state) =>
        state.terminals[data.terminalId]?.mode ??
        resolveTerminalMountMode({
          focused: terminal?.focused ?? false,
          visible,
        }),
      [data.terminalId, terminal?.focused, visible],
    ),
  );

  // Live resize: update the store on every frame so the inner TerminalTile
  // follows the React Flow wrapper while the user drags a handle.
  const handleResize = useCallback(
    (
      _event: unknown,
      params: { x: number; y: number; width: number; height: number },
    ) => {
      updateTerminalPosition(
        data.projectId,
        data.worktreeId,
        data.terminalId,
        params.x,
        params.y,
      );
      updateTerminalSize(
        data.projectId,
        data.worktreeId,
        data.terminalId,
        params.width,
        params.height,
      );
    },
    [
      data.projectId,
      data.worktreeId,
      data.terminalId,
      updateTerminalPosition,
      updateTerminalSize,
    ],
  );

  const handleResizeEnd = useCallback(
    (
      _event: unknown,
      params: { x: number; y: number; width: number; height: number },
    ) => {
      const snappedX = snapTo(params.x, SNAP_GRID);
      const snappedY = snapTo(params.y, SNAP_GRID);
      const snappedW = snapTo(params.width, SNAP_GRID);
      const snappedH = snapTo(params.height, SNAP_GRID);
      updateTerminalPosition(
        data.projectId,
        data.worktreeId,
        data.terminalId,
        snappedX,
        snappedY,
      );
      updateTerminalSize(
        data.projectId,
        data.worktreeId,
        data.terminalId,
        snappedW,
        snappedH,
      );

      // Remember this as the user's preferred size for future new
      // terminals. Sanitizer in preferencesStore rejects implausible
      // values (e.g. near-zero), so we can write unconditionally here
      // and not worry about corrupting the pref from an accidental
      // zero-sized resize.
      usePreferencesStore
        .getState()
        .setDefaultTerminalSize({ w: snappedW, h: snappedH });

      // Resolve collisions after resize
      const projects = useProjectStore.getState().projects;
      const allRects = projects.flatMap((p) =>
        p.worktrees.flatMap((w) =>
          w.terminals
            .filter((t) => !t.stashed)
            .map((t) => ({
              id: t.id,
              x: t.id === data.terminalId ? snappedX : t.x,
              y: t.id === data.terminalId ? snappedY : t.y,
              width: t.id === data.terminalId ? snappedW : t.width,
              height: t.id === data.terminalId ? snappedH : t.height,
            })),
        ),
      );
      const resolved = resolveCollisions(allRects, 10, data.terminalId);
      const updatePos = useProjectStore.getState().updateTerminalPosition;
      for (const rect of resolved) {
        if (rect.id === data.terminalId) continue;
        const original = allRects.find((r) => r.id === rect.id);
        if (original && (original.x !== rect.x || original.y !== rect.y)) {
          // Find which project/worktree owns this terminal
          for (const p of projects) {
            for (const w of p.worktrees) {
              if (w.terminals.some((t) => t.id === rect.id)) {
                updatePos(p.id, w.id, rect.id, rect.x, rect.y);
              }
            }
          }
        }
      }

      // Explicitly refit xterm once the drag settles. TerminalTile also has a
      // width/height effect that refits, but calling it here guarantees fit
      // runs against the final DOM size even if the effect races with the
      // React Flow dimension sync.
      requestAnimationFrame(() => {
        fitTerminalRuntime(data.terminalId);
        const resizedTerminal = useProjectStore
          .getState()
          .projects.find((p) => p.id === data.projectId)
          ?.worktrees.find((w) => w.id === data.worktreeId)
          ?.terminals.find((t) => t.id === data.terminalId);
        if (
          resizedTerminal?.focused &&
          useViewportFocusStore.getState().zoomedOutTerminalId === null
        ) {
          panToTerminal(data.terminalId, { immediate: true });
        }
      });
    },
    [
      data.projectId,
      data.worktreeId,
      data.terminalId,
      updateTerminalPosition,
      updateTerminalSize,
    ],
  );

  if (!terminal || !worktree) {
    return null;
  }

  // Every agent can be wired: to an orchestrator or to other agents.
  const showAgentPort = !isOrchestrator && isAgentTerminalType(terminal.type);
  const agentColor =
    TERMINAL_TYPE_CONFIG[terminal.type]?.color ?? ORCHESTRATOR_COLOR;

  return (
    <div
      className="relative h-full w-full"
      style={
        isOrchestrator
          ? {
              borderRadius: 6,
              boxShadow: `0 0 0 2px ${ORCHESTRATOR_COLOR}, 0 0 28px color-mix(in srgb, ${ORCHESTRATOR_COLOR} 30%, transparent)`,
            }
          : undefined
      }
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {isOrchestrator && (
        <>
          <div
            className="tc-caption pointer-events-none absolute left-0 flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 font-medium"
            style={{
              // Below the tile: the worktree label owns the space above it.
              top: "calc(100% + 8px)",
              color: "var(--accent-foreground)",
              background: ORCHESTRATOR_COLOR,
            }}
          >
            <span aria-hidden="true">◆</span>
            ORCHESTRATOR
            <span style={{ opacity: 0.8 }}>· {wiredSummary}</span>
          </div>
          <OrchestratorOutPort />
        </>
      )}
      {showAgentPort && <AgentPort color={agentColor} />}
      <NodeResizer
        isVisible={hovered}
        minWidth={300}
        minHeight={200}
        handleStyle={{
          width: 8,
          height: 8,
          background: "var(--surface)",
          borderColor: "var(--border-hover)",
        }}
        onResize={handleResize}
        onResizeEnd={handleResizeEnd}
      />
      <TerminalTile
        lodMode={lodMode}
        projectId={data.projectId}
        worktreeId={data.worktreeId}
        worktreeName={worktree.name}
        worktreePath={worktree.path}
        terminal={terminal}
        width={terminal.width}
        height={terminal.height}
      />
    </div>
  );
}

export const xyflowNodeTypes = {
  terminal: TerminalNode,
  ...orchestrationNodeTypes,
} satisfies NodeTypes;

export type AnyCanvasFlowNode = CanvasFlowNode | SourceFlowNode;

export type { CanvasFlowNode, TerminalNodeData };
