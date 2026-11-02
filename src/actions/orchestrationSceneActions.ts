import { createTerminal, useProjectStore } from "../stores/projectStore";
import {
  AI_NODE_HEIGHT,
  AI_NODE_WIDTH,
  isAgentTerminalType,
  pipePeers,
  useOrchestrationStore,
} from "../stores/orchestrationStore";
import {
  getAiConnector,
  pickTransport,
  type AiConnectorId,
  type AiTransport,
} from "../../shared/ai-connectors";
import { useAiConnectorStore } from "../stores/aiConnectorStore";
import { useCanvasStore } from "../stores/canvasStore";
import { usePinStore } from "../stores/pinStore";
import { getVisibleCanvasWorldRect } from "../canvas/viewportBounds";
import { resolveTerminalWithRuntimeState } from "../stores/terminalRuntimeStateStore";
import { useNotificationStore } from "../stores/notificationStore";
import { createTerminalInScene } from "./terminalSceneActions";
import type { ProjectData, TerminalData } from "../types";
import type {
  BridgeAgent,
  BridgeManifest,
  BridgeModel,
  BridgeSource,
  OrchestrationSource,
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

function isAgentNode(nodeId: string): TerminalLocation | null {
  const location = findTerminal(nodeId);
  return location && isAgentTerminalType(location.terminal.type) ? location : null;
}

/** Agent conversations already told about their pipelines (terminal:session). */
const briefedConversations = new Set<string>();
const pendingBriefs = new Map<string, ReturnType<typeof setTimeout>>();
const BRIEF_POLL_MS = 2_000;
const BRIEF_GIVE_UP_MS = 3 * 60_000;

function conversationKey(terminal: TerminalData): string {
  const live = resolveTerminalWithRuntimeState(terminal);
  return `${terminal.id}:${live.sessionId ?? ""}`;
}

/**
 * Tell an agent who it is wired to, so "ask Gemini …" works right away.
 * Writes its bridge files, then pastes a one-line brief once per
 * conversation, waiting until the agent is not busy printing.
 */
export async function briefAgentAboutPipes(
  terminalId: string,
  options: { force?: boolean } = {},
): Promise<void> {
  const location = isAgentNode(terminalId);
  if (!location || !window.termcanvas?.bridge) return;
  const manifest = buildBridgeManifest(terminalId);
  if (!manifest || manifest.self.role === "orchestrator") return;
  const peers = [
    ...manifest.agents.map((agent) => ({ name: agent.name, type: agent.type })),
    ...manifest.models.map((model) => ({
      name: model.name,
      type: `${model.connectorName} model`,
    })),
    ...manifest.sources.map((source) => ({ name: source.name, type: source.kind })),
  ];
  if (peers.length === 0) return;

  let briefPrompt: string;
  try {
    ({ briefPrompt } = await window.termcanvas.bridge.prepare(
      terminalId,
      location.worktree.path,
      peers,
    ));
  } catch (error) {
    notifyError(
      `Could not prepare the pipeline bridge: ${error instanceof Error ? error.message : String(error)}`,
    );
    return;
  }
  if (!options.force && briefedConversations.has(conversationKey(location.terminal))) {
    return;
  }

  const existing = pendingBriefs.get(terminalId);
  if (existing) clearTimeout(existing);
  const deadline = Date.now() + BRIEF_GIVE_UP_MS;
  const attempt = async () => {
    pendingBriefs.delete(terminalId);
    const current = findTerminal(terminalId);
    if (!current) return;
    const live = resolveTerminalWithRuntimeState(current.terminal);
    if (live.ptyId === null) return; // Not running: it gets briefed when wired again.
    if (live.status === "active" && Date.now() < deadline) {
      pendingBriefs.set(terminalId, setTimeout(() => void attempt(), BRIEF_POLL_MS));
      return;
    }
    const result = await window.termcanvas.composer.submit({
      terminalId,
      ptyId: live.ptyId,
      terminalType: current.terminal.type,
      worktreePath: current.worktree.path,
      text: briefPrompt,
      images: [],
    });
    if (!result.ok) {
      notifyError(
        `Could not brief ${getTerminalDisplayName(current.terminal)}: ${result.detail ?? result.error ?? "unknown error"}`,
      );
      return;
    }
    briefedConversations.add(conversationKey(current.terminal));
    void window.termcanvas.comms?.recordBrief?.(
      {
        kind: "agent",
        id: terminalId,
        name: getTerminalDisplayName(current.terminal),
        type: current.terminal.type,
      },
      briefPrompt,
    );
  };
  await attempt();
}

/**
 * Wire two canvas nodes with a pipeline and brief the agents on it. At
 * least one end must be an agent terminal; shells are never wired.
 */
export function connectPipeInScene(a: string, b: string): string | null {
  const store = useOrchestrationStore.getState();
  const ends = [a, b].map((id) => ({
    id,
    agent: isAgentNode(id),
    source: store.sources[id],
  }));
  if (ends.some((end) => !end.agent && !end.source)) return null;
  if (!ends.some((end) => end.agent)) return null;
  const pipeId = store.connectPipe(a, b);
  if (!pipeId) return null;
  for (const end of ends) {
    if (end.agent) void briefAgentAboutPipes(end.id);
  }
  return pipeId;
}

/**
 * Wire every agent terminal of the project to the orchestrator, so a fresh
 * orchestrator starts out "connected to my agents".
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
      store.connect(orchestratorId, "terminal", terminal.id);
    }
  }
}

/** Agent CLIs that can run the orchestrator (they all run shell commands). */
export const ORCHESTRATOR_TYPES = ["claude", "codex", "gemini"] as const;
export type OrchestratorType = (typeof ORCHESTRATOR_TYPES)[number];

export async function createOrchestratorInScene(options: {
  projectId: string;
  worktreeId: string;
  position?: { x: number; y: number };
  type?: OrchestratorType;
}): Promise<TerminalData | null> {
  const project = useProjectStore
    .getState()
    .projects.find((candidate) => candidate.id === options.projectId);
  const worktree = project?.worktrees.find(
    (candidate) => candidate.id === options.worktreeId,
  );
  if (!project || !worktree) return null;

  const base = createTerminal(options.type ?? "claude");
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

const TRIO_TYPES = ["claude", "gemini", "codex"] as const;
const TRIO_NAMES: Record<(typeof TRIO_TYPES)[number], string> = {
  claude: "Claude",
  gemini: "Gemini",
  codex: "Codex",
};
const TEMPLATE_GAP = 80;

/**
 * Open Claude, Gemini and Codex side by side, wired to each other with
 * pipelines, each one started with a brief naming the other two — so all
 * three can talk from their first turn.
 */
export async function createAgentTrioInScene(options: {
  projectId: string;
  worktreeId: string;
  position?: { x: number; y: number };
}): Promise<TerminalData[]> {
  const project = useProjectStore
    .getState()
    .projects.find((candidate) => candidate.id === options.projectId);
  const worktree = project?.worktrees.find(
    (candidate) => candidate.id === options.worktreeId,
  );
  if (!project || !worktree || !window.termcanvas?.bridge) return [];

  const bases = TRIO_TYPES.map((type) => createTerminal(type));
  let briefs: string[];
  try {
    briefs = await Promise.all(
      bases.map(async (base, index) => {
        const peers = bases
          .filter((_, other) => other !== index)
          .map((peer) => ({
            name: TRIO_NAMES[peer.type as (typeof TRIO_TYPES)[number]],
            type: peer.type,
          }));
        const { briefPrompt } = await window.termcanvas.bridge.prepare(
          base.id,
          worktree.path,
          peers,
        );
        return briefPrompt;
      }),
    );
  } catch (error) {
    notifyError(
      `Could not prepare the pipelines: ${error instanceof Error ? error.message : String(error)}`,
    );
    return [];
  }

  const origin = options.position ?? { x: 0, y: 0 };
  const created = bases.map((base, index) =>
    createTerminalInScene({
      projectId: project.id,
      worktreeId: worktree.id,
      terminal: {
        ...base,
        customTitle: TRIO_NAMES[base.type as (typeof TRIO_TYPES)[number]],
        // The brief is the first prompt, so the agent knows its peers at once.
        initialPrompt: briefs[index],
      },
      position: options.position
        ? { x: origin.x + index * (base.width + TEMPLATE_GAP), y: origin.y }
        : undefined,
    }),
  );
  const store = useOrchestrationStore.getState();
  for (let i = 0; i < created.length; i++) {
    for (let j = i + 1; j < created.length; j++) {
      store.connectPipe(created[i].id, created[j].id);
    }
  }
  return created;
}

const COUNCIL_CONNECTORS: AiConnectorId[] = ["claude", "gemini", "chatgpt"];

/**
 * An orchestrator with Claude, Gemini and ChatGPT model nodes wired to it:
 * ask it for a second opinion, a council or a debate between the models.
 */
export async function createModelCouncilInScene(options: {
  projectId: string;
  worktreeId: string;
  position?: { x: number; y: number };
  type?: OrchestratorType;
}): Promise<TerminalData | null> {
  const orchestrator = await createOrchestratorInScene(options);
  if (!orchestrator) return null;
  const x = orchestrator.x + orchestrator.width + 140;
  COUNCIL_CONNECTORS.forEach((connector, index) => {
    addAiNodeInScene(
      connector,
      { x, y: orchestrator.y + index * (AI_NODE_HEIGHT + 40) },
      { connectTo: orchestrator.id },
    );
  });
  return orchestrator;
}

/**
 * Add an AI model node. It starts on the API when that can be called, on
 * the CLI when only the CLI is set up (e.g. Gemini with a Google login), and
 * joins the orchestrator when there is exactly one.
 */
export function addAiNodeInScene(
  connector: AiConnectorId,
  position: { x: number; y: number },
  options: {
    connectTo?: string;
    transport?: AiTransport;
    persona?: string;
    name?: string;
  } = {},
): string | null {
  const plugin = getAiConnector(connector);
  if (!plugin) return null;
  const status = useAiConnectorStore.getState().statuses[connector];
  const store = useOrchestrationStore.getState();
  const id = store.addAiNode(connector, position, {
    transport: options.transport ?? pickTransport(plugin, status),
    persona: options.persona,
    name: options.name,
  });
  const orchestratorId =
    options.connectTo ??
    (store.orchestratorIds.length === 1 ? store.orchestratorIds[0] : undefined);
  if (orchestratorId && store.orchestratorIds.includes(orchestratorId)) {
    useOrchestrationStore.getState().connect(orchestratorId, "source", id);
  }
  return id;
}

/** Center of the canvas area the user currently sees, in world coordinates. */
export function visibleCanvasCenter(): { x: number; y: number } {
  const canvas = useCanvasStore.getState();
  const rect = getVisibleCanvasWorldRect(
    canvas.viewport,
    canvas.rightPanelCollapsed,
    canvas.leftPanelCollapsed,
    canvas.leftPanelWidth,
    canvas.rightPanelWidth,
    usePinStore.getState().openProjectPath !== null,
  );
  return {
    x: Math.round(rect.x + rect.w / 2 - AI_NODE_WIDTH / 2),
    y: Math.round(rect.y + rect.h / 2 - AI_NODE_HEIGHT / 2),
  };
}

export function getTerminalDisplayName(terminal: TerminalData): string {
  return terminal.customTitle?.trim() || terminal.title;
}

function toBridgeModel(source: OrchestrationSource): BridgeModel | null {
  if (source.kind !== "ai" || !source.ai) return null;
  const plugin = getAiConnector(source.ai.connector);
  if (!plugin) return null;
  return {
    id: source.id,
    name: source.name.trim() || plugin.name,
    connector: plugin.id,
    connectorName: plugin.name,
    model: source.ai.model,
    transport: source.ai.transport,
    persona: source.description,
    baseURL: source.url,
  };
}

function toBridgeSource(source: OrchestrationSource): BridgeSource {
  return {
    id: source.id,
    kind: source.kind,
    name: source.name,
    url: source.url,
    description: source.description,
  };
}

/**
 * What the API exposes to one agent: only what is wired to it. An
 * orchestrator sees its links; every agent sees its pipeline peers. Only
 * agent terminals can be peers — a shell would run a message as a command.
 */
export function buildBridgeManifest(terminalId: string): BridgeManifest | null {
  const { orchestratorIds, links, pipes, sources } =
    useOrchestrationStore.getState();
  const self = findTerminal(terminalId);
  if (!self) return null;
  const isOrchestrator = orchestratorIds.includes(terminalId);

  const agents: BridgeAgent[] = [];
  const models: BridgeModel[] = [];
  const wiredSources: BridgeSource[] = [];
  const seen = new Set<string>([terminalId]);

  const addNode = (nodeId: string, via: BridgeAgent["via"]) => {
    if (seen.has(nodeId)) return;
    seen.add(nodeId);
    const source = sources[nodeId];
    if (source) {
      if (source.kind === "ai") {
        const model = toBridgeModel(source);
        if (model) models.push(model);
      } else {
        wiredSources.push(toBridgeSource(source));
      }
      return;
    }
    const target = findTerminal(nodeId);
    if (!target || target.terminal.stashed) return;
    if (!isAgentTerminalType(target.terminal.type)) return;
    const live = resolveTerminalWithRuntimeState(target.terminal);
    agents.push({
      id: target.terminal.id,
      name: getTerminalDisplayName(target.terminal),
      type: target.terminal.type,
      status: live.status,
      ptyId: live.ptyId,
      worktreePath: target.worktree.path,
      project: target.project.name,
      via,
    });
  };

  if (isOrchestrator) {
    for (const link of links) {
      if (link.orchestratorId === terminalId) addNode(link.targetId, "orchestrator");
    }
  }
  for (const peer of pipePeers(pipes, terminalId)) addNode(peer, "pipeline");

  return {
    self: {
      id: self.terminal.id,
      title: getTerminalDisplayName(self.terminal),
      type: self.terminal.type,
      worktreePath: self.worktree.path,
      role: isOrchestrator ? "orchestrator" : "agent",
    },
    agents,
    models,
    sources: wiredSources,
  };
}

/** What the API exposes to one orchestrator: only its wired nodes. */
export function buildOrchestratorManifest(
  orchestratorId: string,
): OrchestratorManifest | null {
  if (!useOrchestrationStore.getState().orchestratorIds.includes(orchestratorId)) {
    return null;
  }
  const manifest = buildBridgeManifest(orchestratorId);
  return manifest ? { ...manifest, orchestrator: manifest.self } : null;
}

export function listOrchestrators() {
  return useOrchestrationStore
    .getState()
    .orchestratorIds.map((id) => buildOrchestratorManifest(id))
    .filter((manifest): manifest is OrchestratorManifest => manifest !== null)
    .map((manifest) => ({
      ...manifest.orchestrator,
      agents: manifest.agents.length,
      models: manifest.models.length,
      sources: manifest.sources.length,
    }));
}
