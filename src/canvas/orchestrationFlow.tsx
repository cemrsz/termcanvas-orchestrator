import { useCallback, useState } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  Handle,
  Position,
  getBezierPath,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import {
  FileText,
  Globe,
  Sheet,
  StickyNote,
  Workflow,
  X,
  type LucideIcon,
} from "lucide-react";
import { useOrchestrationStore } from "../stores/orchestrationStore";
import type {
  OrchestrationLink,
  OrchestrationSource,
  OrchestrationSourceKind,
} from "../types/orchestration";

/** Handle ids are `<prefix>-left` / `<prefix>-right`. */
export const ORCHESTRATOR_OUT_HANDLE = "orchestrator-out";
export const ORCHESTRATION_IN_HANDLE = "orchestration-in";
type PortSide = "left" | "right";
export const ORCHESTRATOR_COLOR = "var(--purple)";

/** Ports sit at header height so they never cover the mid-edge resizers. */
const PORT_TOP = 17;

export const SOURCE_KIND_META: Record<
  OrchestrationSourceKind,
  {
    label: string;
    color: string;
    icon: LucideIcon;
    urlPlaceholder: string;
    notesPlaceholder: string;
  }
> = {
  sheet: {
    label: "Google Sheet",
    color: "var(--green)",
    icon: Sheet,
    urlPlaceholder: "https://docs.google.com/spreadsheets/d/…",
    notesPlaceholder: "What is in it, e.g. leads: name, email, company, status",
  },
  n8n: {
    label: "n8n Webhook",
    color: "var(--git-graph-pink)",
    icon: Workflow,
    urlPlaceholder: "http://localhost:5678/webhook/…",
    notesPlaceholder: "What it does when triggered and the JSON it expects",
  },
  api: {
    label: "HTTP API",
    color: "var(--cyan)",
    icon: Globe,
    urlPlaceholder: "https://api.example.com/…",
    notesPlaceholder: "What it returns and how to call it",
  },
  file: {
    label: "Local File",
    color: "var(--text-secondary)",
    icon: FileText,
    urlPlaceholder: "C:\\path\\to\\file-or-folder",
    notesPlaceholder: "What is in it",
  },
  note: {
    label: "Note",
    color: "var(--amber)",
    icon: StickyNote,
    urlPlaceholder: "",
    notesPlaceholder: "Context or rules for the orchestrator, e.g. brand voice",
  },
};

export interface SourceNodeData {
  sourceId: string;
  [key: string]: unknown;
}

export type SourceFlowNode = Node<SourceNodeData, "orchestrationSource">;

export function buildSourceFlowNodes(
  sources: Record<string, OrchestrationSource>,
): SourceFlowNode[] {
  return Object.values(sources).map((source) => ({
    id: source.id,
    type: "orchestrationSource",
    position: { x: source.x, y: source.y },
    data: { sourceId: source.id },
    style: { width: source.w },
    draggable: true,
    selectable: true,
  }));
}

export function sourcesLayoutKey(
  sources: Record<string, OrchestrationSource>,
): string {
  return Object.values(sources)
    .map((source) => `${source.id}:${source.x},${source.y},${source.w}`)
    .join("|");
}

const portStyle = (color: string, side: PortSide) => ({
  top: PORT_TOP,
  [side]: -7,
  width: 12,
  height: 12,
  borderRadius: 999,
  border: `2px solid ${color}`,
  background: "var(--surface)",
});

/**
 * Ports exist on both sides; each wire uses the pair that faces the other
 * node, so wires never run underneath a tile.
 */
export function OrchestratorOutPort() {
  return (
    <>
      {(["left", "right"] as const).map((side) => (
        <Handle
          key={side}
          type="source"
          id={`${ORCHESTRATOR_OUT_HANDLE}-${side}`}
          position={side === "left" ? Position.Left : Position.Right}
          className="nodrag nopan"
          style={portStyle(ORCHESTRATOR_COLOR, side)}
          title="Drag to an agent or a source to wire it to this orchestrator"
        />
      ))}
    </>
  );
}

/** Input ports of a worker agent tile or a source node. */
export function OrchestrationInPort({ color }: { color: string }) {
  return (
    <>
      {(["left", "right"] as const).map((side) => (
        <Handle
          key={side}
          type="target"
          id={`${ORCHESTRATION_IN_HANDLE}-${side}`}
          position={side === "left" ? Position.Left : Position.Right}
          className="nodrag nopan"
          style={portStyle(color, side)}
        />
      ))}
    </>
  );
}

export function isOrchestratorOutHandle(id: string | null | undefined) {
  return !!id && id.startsWith(`${ORCHESTRATOR_OUT_HANDLE}-`);
}

export function isOrchestrationInHandle(id: string | null | undefined) {
  return !!id && id.startsWith(`${ORCHESTRATION_IN_HANDLE}-`);
}

export interface NodeRect {
  x: number;
  y: number;
  w: number;
}

function facingSides(from: NodeRect, to: NodeRect): [PortSide, PortSide] {
  const fromCenter = from.x + from.w / 2;
  const toCenter = to.x + to.w / 2;
  return toCenter >= fromCenter ? ["right", "left"] : ["left", "right"];
}

function SourceNode({ data }: NodeProps<SourceFlowNode>) {
  const source = useOrchestrationStore(
    useCallback((state) => state.sources[data.sourceId], [data.sourceId]),
  );
  const wiredCount = useOrchestrationStore(
    useCallback(
      (state) =>
        state.links.filter(
          (link) =>
            link.targetKind === "source" && link.targetId === data.sourceId,
        ).length,
      [data.sourceId],
    ),
  );
  const updateSource = useOrchestrationStore((state) => state.updateSource);
  const removeSource = useOrchestrationStore((state) => state.removeSource);

  if (!source) return null;
  const meta = SOURCE_KIND_META[source.kind] ?? SOURCE_KIND_META.note;
  const Icon = meta.icon;
  const isNote = source.kind === "note";

  return (
    <div
      data-scene-box-select-block
      className="rounded-lg border bg-[var(--surface)] flex flex-col overflow-visible"
      style={{
        borderColor: `color-mix(in srgb, ${meta.color} 55%, var(--border))`,
        boxShadow: "var(--shadow-elev-1)",
      }}
    >
      <OrchestrationInPort color={meta.color} />
      <div
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-t-lg border-b border-[var(--border)] cursor-grab active:cursor-grabbing select-none"
        style={{
          background: `color-mix(in srgb, ${meta.color} 14%, var(--bg))`,
        }}
      >
        <Icon size={13} strokeWidth={1.8} style={{ color: meta.color }} />
        <input
          className="nodrag tc-meta min-w-0 flex-1 bg-transparent font-medium text-[var(--text-primary)] outline-none"
          value={source.name}
          placeholder={meta.label}
          onChange={(e) => updateSource(source.id, { name: e.target.value })}
          onMouseDown={(e) => e.stopPropagation()}
        />
        <span
          className="tc-caption shrink-0 uppercase tracking-wide"
          style={{ color: meta.color }}
        >
          {source.kind}
        </span>
        <button
          type="button"
          className="nodrag shrink-0 rounded p-0.5 text-[var(--text-faint)] hover:text-[var(--text-primary)] hover:bg-[var(--border)]"
          title="Remove source"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            removeSource(source.id);
          }}
        >
          <X size={11} strokeWidth={1.8} />
        </button>
      </div>
      <div className="flex flex-col gap-1.5 p-2.5">
        {!isNote && (
          <input
            className="nodrag tc-meta tc-mono w-full rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-[var(--text-primary)] outline-none focus:border-[var(--text-secondary)]"
            value={source.url}
            placeholder={meta.urlPlaceholder}
            spellCheck={false}
            onChange={(e) => updateSource(source.id, { url: e.target.value })}
            onMouseDown={(e) => e.stopPropagation()}
          />
        )}
        <textarea
          className="nodrag nowheel tc-meta w-full resize-none rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-[var(--text-primary)] outline-none focus:border-[var(--text-secondary)]"
          rows={isNote ? 6 : 3}
          value={source.description}
          placeholder={meta.notesPlaceholder}
          onChange={(e) =>
            updateSource(source.id, { description: e.target.value })
          }
          onMouseDown={(e) => e.stopPropagation()}
        />
        <div className="tc-caption flex items-center gap-1.5 text-[var(--text-faint)]">
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{
              background: wiredCount > 0 ? meta.color : "var(--border-hover)",
            }}
          />
          {wiredCount > 0
            ? `Wired to ${wiredCount === 1 ? "the orchestrator" : `${wiredCount} orchestrators`}`
            : "Not wired — drag from an orchestrator's port to here"}
        </div>
      </div>
    </div>
  );
}

export interface OrchestrationEdgeData {
  linkId: string;
  color: string;
  busy: boolean;
  [key: string]: unknown;
}

export type OrchestrationFlowEdge = Edge<OrchestrationEdgeData, "orchestration">;

function OrchestrationEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps<OrchestrationFlowEdge>) {
  const [hovered, setHovered] = useState(false);
  const disconnect = useOrchestrationStore((state) => state.disconnect);
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });
  const color = data?.color ?? "var(--accent)";

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        className={data?.busy ? "tc-orchestration-edge-busy" : undefined}
        style={{
          stroke: color,
          strokeWidth: hovered ? 3 : 2,
          opacity: hovered ? 1 : 0.8,
        }}
        interactionWidth={18}
      />
      {/* Invisible wide path to drive hover without blocking the canvas. */}
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={18}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />
      <EdgeLabelRenderer>
        <button
          type="button"
          className="nodrag nopan absolute flex h-5 w-5 items-center justify-center rounded-full border bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--red)]"
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: "all",
            borderColor: color,
            opacity: hovered ? 1 : 0.55,
          }}
          title="Disconnect"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onClick={(e) => {
            e.stopPropagation();
            if (data?.linkId) disconnect(data.linkId);
          }}
        >
          <X size={10} strokeWidth={2} />
        </button>
      </EdgeLabelRenderer>
    </>
  );
}

export function buildOrchestrationEdges(options: {
  links: OrchestrationLink[];
  orchestratorIds: string[];
  sources: Record<string, OrchestrationSource>;
  terminalRects: Map<string, NodeRect>;
  busyTerminalIds: Set<string>;
}): OrchestrationFlowEdge[] {
  const orchestrators = new Set(options.orchestratorIds);
  const edges: OrchestrationFlowEdge[] = [];
  for (const link of options.links) {
    if (!orchestrators.has(link.orchestratorId)) continue;
    const orchestratorRect = options.terminalRects.get(link.orchestratorId);
    if (!orchestratorRect) continue;
    let color: string;
    let busy = false;
    let targetRect: NodeRect | undefined;
    if (link.targetKind === "terminal") {
      targetRect = options.terminalRects.get(link.targetId);
      color = ORCHESTRATOR_COLOR;
      busy = options.busyTerminalIds.has(link.targetId);
    } else {
      const source = options.sources[link.targetId];
      if (source) targetRect = { x: source.x, y: source.y, w: source.w };
      color = source
        ? (SOURCE_KIND_META[source.kind] ?? SOURCE_KIND_META.note).color
        : ORCHESTRATOR_COLOR;
    }
    if (!targetRect) continue;
    const [outSide, inSide] = facingSides(orchestratorRect, targetRect);
    edges.push({
      id: link.id,
      type: "orchestration",
      source: link.orchestratorId,
      sourceHandle: `${ORCHESTRATOR_OUT_HANDLE}-${outSide}`,
      target: link.targetId,
      targetHandle: `${ORCHESTRATION_IN_HANDLE}-${inSide}`,
      data: { linkId: link.id, color, busy },
      selectable: false,
      focusable: false,
    });
  }
  return edges;
}

export const orchestrationNodeTypes = {
  orchestrationSource: SourceNode,
};

export const orchestrationEdgeTypes = {
  orchestration: OrchestrationEdge,
};
