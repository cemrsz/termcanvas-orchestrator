/**
 * Team hub — the main-process side of agent teams.
 *
 * Holds the team directory the renderer syncs, the activity feed behind the
 * Team panel, the team board, saved reports, and the delivery queue that
 * hands teammate messages and n8n events to an agent once it is idle (so a
 * message never lands in the middle of a tool call or an approval prompt).
 *
 * It has no Electron dependencies; main.ts injects how to read an agent's
 * turn state and how to type into its terminal.
 */

import fs from "node:fs";
import path from "node:path";
import {
  EMPTY_TEAM_DIRECTORY,
  buildTeamView,
  isTeamMember,
  type TeamDirectory,
  type TeamMemberInfo,
  type TeamSourceInfo,
  type TeamView,
} from "../shared/team";
import {
  TEAM_MESSAGE_PREFIX,
  clip,
  describeHookEvent,
  firstLine,
  formatActivity,
  type TeamActivityDraft,
  type TeamActivityEntry,
} from "../shared/teamActivity";

export interface TeamHubDeps {
  dataDir: string;
  /** Telemetry turn state of a terminal (turn_complete, tool_running, …). */
  getTurnState: (terminalId: string) => string | null;
  isPtyAlive: (ptyId: number) => boolean;
  /** Type a prompt into the agent's terminal and submit it. */
  deliver: (member: TeamMemberInfo, text: string) => Promise<void>;
  /** (Re)write the agent's AGENT.md and tc.mjs. */
  writeWorkspace: (
    member: TeamMemberInfo,
    role: { isManager: boolean; hasManager: boolean },
  ) => void;
  onActivity?: (entries: TeamActivityEntry[]) => void;
  /** Last assistant reply in a Claude/Codex transcript. */
  readLastReply?: (transcriptPath: string) => string | null;
  now?: () => number;
}

export interface TeamHookEvent {
  hook_event_name: string;
  terminal_id?: string;
  [key: string]: unknown;
}

/** Tool calls closer together than this collapse into one feed line. */
const TOOL_THROTTLE_MS = 1200;

export interface TeamReport {
  id: string;
  at: number;
  title: string;
  agentId: string;
  agentName: string;
  path: string;
}

interface BoardNote {
  id: string;
  at: number;
  agentId: string;
  agentName: string;
  text: string;
}

interface QueuedDelivery {
  id: string;
  agentId: string;
  text: string;
  enqueuedAt: number;
}

const ACTIVITY_MEMORY = 3000;
const BOARD_MEMORY = 500;
const BUSY_STATES = new Set([
  "thinking",
  "in_turn",
  "tool_running",
  "tool_pending",
  "awaiting_input",
]);
/** After typing a prompt, give the CLI time to report its new turn. */
const DELIVERY_SETTLE_MS = 8000;
const MAX_BATCH = 6;

let idCounter = 0;
function newId(prefix: string, now: number) {
  return `${prefix}-${now.toString(36)}-${(++idCounter).toString(36)}`;
}

function readJsonl<T>(filePath: string, limit: number): T[] {
  try {
    const lines = fs.readFileSync(filePath, "utf-8").split("\n");
    const out: T[] = [];
    for (const line of lines.slice(-limit - 1)) {
      if (!line.trim()) continue;
      try {
        out.push(JSON.parse(line) as T);
      } catch {
        // Skip a torn line from a crash mid-write.
      }
    }
    return out.slice(-limit);
  } catch {
    return [];
  }
}

/** Letters NFKD does not split into a base letter plus a mark. */
const SLUG_LETTERS: Record<string, string> = {
  ı: "i",
  İ: "i",
  ş: "s",
  Ş: "s",
  ğ: "g",
  Ğ: "g",
  ß: "ss",
  ø: "o",
  Ø: "o",
  æ: "ae",
  Æ: "ae",
  ł: "l",
  Ł: "l",
};

function slugify(text: string) {
  const slug = text
    .replace(/[ıİşŞğĞßøØæÆłŁ]/g, (letter) => SLUG_LETTERS[letter] ?? letter)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "report";
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export class TeamHub {
  private directory: TeamDirectory = EMPTY_TEAM_DIRECTORY;
  private activity: TeamActivityEntry[] = [];
  private board: BoardNote[] = [];
  private reports: TeamReport[] = [];
  private queue: QueuedDelivery[] = [];
  private settlingUntil = new Map<string, number>();
  private delivering = new Set<string>();
  private preparedRoles = new Map<string, string>();
  private readonly activityFile: string;
  private readonly boardFile: string;
  private readonly reportsFile: string;

  constructor(private readonly deps: TeamHubDeps) {
    fs.mkdirSync(deps.dataDir, { recursive: true });
    this.activityFile = path.join(deps.dataDir, "activity.jsonl");
    this.boardFile = path.join(deps.dataDir, "board.jsonl");
    this.reportsFile = path.join(deps.dataDir, "reports.jsonl");
    this.activity = readJsonl<TeamActivityEntry>(this.activityFile, ACTIVITY_MEMORY);
    this.board = readJsonl<BoardNote>(this.boardFile, BOARD_MEMORY);
    this.reports = readJsonl<TeamReport>(this.reportsFile, 200);
    this.compactActivityFile();
  }

  private now() {
    return this.deps.now ? this.deps.now() : Date.now();
  }

  /** Keep the on-disk log bounded: rewrite it with what is in memory. */
  private compactActivityFile() {
    try {
      const stat = fs.statSync(this.activityFile);
      if (stat.size < 8 * 1024 * 1024) return;
      fs.writeFileSync(
        this.activityFile,
        this.activity.map((entry) => JSON.stringify(entry)).join("\n") + "\n",
      );
    } catch {
      // No log yet.
    }
  }

  // ── Directory ─────────────────────────────────────────────────────────

  getDirectory(): TeamDirectory {
    return this.directory;
  }

  setDirectory(directory: TeamDirectory) {
    this.directory = directory;
    // Every team member gets its bridge files; rewrite them when its place
    // in the hierarchy changes (AGENT.md differs for managers and the lead).
    for (const member of directory.members) {
      if (!isTeamMember(directory, member.id)) continue;
      const role = {
        isManager: directory.managerIds.includes(member.id),
        hasManager: directory.links.some(
          (link) =>
            link.targetKind === "terminal" && link.targetId === member.id,
        ),
      };
      const signature = `${member.worktreePath}|${role.isManager}|${role.hasManager}`;
      if (this.preparedRoles.get(member.id) === signature) continue;
      try {
        this.deps.writeWorkspace(member, role);
        this.preparedRoles.set(member.id, signature);
      } catch (err) {
        console.warn(`[TeamHub] could not write workspace for ${member.id}:`, err);
      }
    }
  }

  getMember(terminalId: string): TeamMemberInfo | undefined {
    return this.directory.members.find((member) => member.id === terminalId);
  }

  view(terminalId: string): TeamView | null {
    return buildTeamView(this.directory, terminalId);
  }

  requireView(terminalId: string): TeamView {
    const view = this.view(terminalId);
    if (!view) {
      throw Object.assign(
        new Error(
          "This agent is not on a team. Wire it to an orchestrator on the canvas (or wire agents/sources to it).",
        ),
        { status: 404 },
      );
    }
    return view;
  }

  /** What a member is doing now: its latest activity sentence. */
  latestDoing(terminalId: string): string | null {
    for (let i = this.activity.length - 1; i >= 0; i--) {
      const entry = this.activity[i];
      if (entry.agentId !== terminalId) continue;
      return formatActivity(entry, this.directory.lang);
    }
    return null;
  }

  queuedFor(terminalId: string): number {
    return this.queue.filter((item) => item.agentId === terminalId).length;
  }

  // ── Activity ──────────────────────────────────────────────────────────

  record(draft: TeamActivityDraft): TeamActivityEntry {
    const at = draft.at ?? this.now();
    const entry: TeamActivityEntry = {
      ...draft,
      id: newId("act", at),
      at,
    };
    this.activity.push(entry);
    if (this.activity.length > ACTIVITY_MEMORY) {
      this.activity.splice(0, this.activity.length - ACTIVITY_MEMORY);
    }
    try {
      fs.appendFileSync(this.activityFile, JSON.stringify(entry) + "\n");
    } catch (err) {
      console.warn("[TeamHub] could not persist activity:", err);
    }
    this.deps.onActivity?.([entry]);
    return entry;
  }

  /** Record for an agent known to the directory; unknown terminals are ignored. */
  recordFor(
    terminalId: string,
    draft: Omit<TeamActivityDraft, "agentId" | "agentName">,
  ): TeamActivityEntry | null {
    const member = this.getMember(terminalId);
    if (!member) return null;
    return this.record({ ...draft, agentId: member.id, agentName: member.name });
  }

  /** Turn Claude/Codex hook events into feed lines for agents on the canvas. */
  recordHookEvent(event: TeamHookEvent) {
    const terminalId = event.terminal_id;
    if (!terminalId) return;
    const member = this.getMember(terminalId);
    if (!member) return;
    if (event.hook_event_name === "Stop") {
      let reply: string | null = null;
      const transcript = event.transcript_path;
      if (typeof transcript === "string" && transcript && this.deps.readLastReply) {
        try {
          reply = this.deps.readLastReply(transcript);
        } catch {
          reply = null;
        }
      }
      this.record({
        agentId: member.id,
        agentName: member.name,
        kind: "done",
        text: reply ? firstLine(reply, 140) : "",
      });
      this.settlingUntil.delete(member.id);
      void this.tick();
      return;
    }
    const draft = describeHookEvent(event, member);
    if (!draft) return;
    if (draft.kind === "tool") {
      const last = this.lastEntryOf(member.id);
      if (last?.kind === "tool" && this.now() - last.at < TOOL_THROTTLE_MS) {
        return;
      }
    }
    this.record(draft);
  }

  private lastEntryOf(terminalId: string): TeamActivityEntry | undefined {
    for (let i = this.activity.length - 1; i >= 0; i--) {
      if (this.activity[i].agentId === terminalId) return this.activity[i];
    }
    return undefined;
  }

  listActivity(options: {
    terminalIds?: Set<string>;
    sinceMs?: number;
    limit?: number;
  } = {}): TeamActivityEntry[] {
    const limit = options.limit ?? 200;
    const out: TeamActivityEntry[] = [];
    for (let i = this.activity.length - 1; i >= 0 && out.length < limit; i--) {
      const entry = this.activity[i];
      if (options.sinceMs !== undefined && entry.at < options.sinceMs) break;
      if (options.terminalIds && !options.terminalIds.has(entry.agentId)) continue;
      out.push(entry);
    }
    return out.reverse();
  }

  // ── Board ─────────────────────────────────────────────────────────────

  post(terminalId: string, text: string): BoardNote {
    const member = this.getMember(terminalId);
    const at = this.now();
    const note: BoardNote = {
      id: newId("note", at),
      at,
      agentId: terminalId,
      agentName: member?.name ?? terminalId,
      text: text.trim(),
    };
    this.board.push(note);
    if (this.board.length > BOARD_MEMORY) this.board.shift();
    try {
      fs.appendFileSync(this.boardFile, JSON.stringify(note) + "\n");
    } catch (err) {
      console.warn("[TeamHub] could not persist board note:", err);
    }
    this.recordFor(terminalId, { kind: "board", text: clip(note.text, 140) });
    return note;
  }

  boardFor(terminalIds: Set<string>, limit = 30): BoardNote[] {
    return this.board
      .filter((note) => terminalIds.has(note.agentId))
      .slice(-limit);
  }

  // ── Reports ───────────────────────────────────────────────────────────

  saveReport(
    terminalId: string,
    title: string,
    markdown: string,
  ): TeamReport {
    const member = this.getMember(terminalId);
    if (!member) {
      throw Object.assign(new Error("Unknown agent"), { status: 404 });
    }
    const at = this.now();
    const date = new Date(at);
    const stamp =
      `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
      `-${pad(date.getHours())}${pad(date.getMinutes())}`;
    const dir = path.join(member.worktreePath, ".termcanvas", "reports");
    fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, `${stamp}-${slugify(title)}.md`);
    fs.writeFileSync(filePath, markdown, "utf-8");
    const report: TeamReport = {
      id: newId("report", at),
      at,
      title: title.trim(),
      agentId: member.id,
      agentName: member.name,
      path: filePath,
    };
    this.reports.push(report);
    try {
      fs.appendFileSync(this.reportsFile, JSON.stringify(report) + "\n");
    } catch (err) {
      console.warn("[TeamHub] could not persist report index:", err);
    }
    this.recordFor(terminalId, {
      kind: "report",
      title: report.title,
      reportPath: filePath,
    });
    return report;
  }

  listReports(): TeamReport[] {
    return [...this.reports].reverse();
  }

  /** Read a saved report; only files the hub itself indexed are readable. */
  readReport(filePath: string): string {
    const known = this.reports.some((report) => report.path === filePath);
    if (!known) {
      throw Object.assign(new Error("Unknown report"), { status: 404 });
    }
    return fs.readFileSync(filePath, "utf-8");
  }

  // ── Delivery queue ────────────────────────────────────────────────────

  enqueue(agentId: string, text: string) {
    const at = this.now();
    this.queue.push({ id: newId("dlv", at), agentId, text, enqueuedAt: at });
    void this.tick();
  }

  private isIdle(member: TeamMemberInfo): boolean {
    if (member.ptyId === null || !this.deps.isPtyAlive(member.ptyId)) {
      return false;
    }
    if ((this.settlingUntil.get(member.id) ?? 0) > this.now()) return false;
    const state = this.deps.getTurnState(member.id);
    return !state || !BUSY_STATES.has(state);
  }

  /** Deliver queued items to every agent that is idle right now. */
  async tick(): Promise<void> {
    const agentIds = [...new Set(this.queue.map((item) => item.agentId))];
    await Promise.all(
      agentIds.map(async (agentId) => {
        if (this.delivering.has(agentId)) return;
        const member = this.getMember(agentId);
        if (!member || !this.isIdle(member)) return;
        const batch = this.queue
          .filter((item) => item.agentId === agentId)
          .slice(0, MAX_BATCH);
        if (batch.length === 0) return;
        this.delivering.add(agentId);
        try {
          const text = batch.map((item) => item.text).join("\n\n---\n\n");
          await this.deps.deliver(member, text);
          const delivered = new Set(batch.map((item) => item.id));
          this.queue = this.queue.filter((item) => !delivered.has(item.id));
          this.settlingUntil.set(agentId, this.now() + DELIVERY_SETTLE_MS);
        } catch (err) {
          console.warn(`[TeamHub] delivery to ${agentId} failed:`, err);
        } finally {
          this.delivering.delete(agentId);
        }
      }),
    );
  }

  /** Mark a direct send so queued messages wait until that turn starts. */
  noteDirectSend(agentId: string) {
    this.settlingUntil.set(agentId, this.now() + DELIVERY_SETTLE_MS);
  }

  // ── Messages and inbound events ───────────────────────────────────────

  buildTaskText(from: TeamMemberInfo, to: TeamMemberInfo, task: string) {
    const dir = `.termcanvas/agent/${to.id}`;
    return (
      `${TEAM_MESSAGE_PREFIX}task from ${from.name} to you (${to.name})]\n` +
      `Team tool: node ${dir}/tc.mjs — rules in ${dir}/AGENT.md (read it first if you have not yet). ` +
      "Narrate with `say`; end your turn with a short structured result, your manager reads it.\n\n" +
      task.trim()
    );
  }

  sendMessage(fromId: string, toId: string, text: string) {
    const from = this.getMember(fromId);
    const to = this.getMember(toId);
    if (!from || !to) {
      throw Object.assign(new Error("Unknown agent"), { status: 404 });
    }
    const dir = `.termcanvas/agent/${to.id}`;
    const body =
      `${TEAM_MESSAGE_PREFIX}message from ${from.name}${from.role ? ` (${from.role})` : ""}]\n` +
      `Answer only if needed: node ${dir}/tc.mjs msg "${from.name}" "<answer>"\n\n` +
      text.trim();
    this.enqueue(to.id, body);
    this.recordFor(fromId, {
      kind: "msg",
      targetId: to.id,
      targetName: to.name,
      text: firstLine(text),
    });
  }

  /** Sources an inbound event can name: id, exact name, or unique prefix. */
  private findSource(ref: string): TeamSourceInfo | undefined {
    const sources = this.directory.sources;
    const byId = sources.find((source) => source.id === ref);
    if (byId) return byId;
    const lower = ref.toLowerCase();
    const exact = sources.filter((source) => source.name.toLowerCase() === lower);
    if (exact.length === 1) return exact[0];
    return undefined;
  }

  /**
   * An n8n workflow (or any HTTP client) pushed an event for a source.
   * Every manager the source is wired to gets it as its next prompt.
   */
  handleInbound(
    sourceRef: string,
    payload: unknown,
  ): { source: string; deliveredTo: string[] } {
    const source = this.findSource(sourceRef);
    if (!source) {
      throw Object.assign(
        new Error(`No source '${sourceRef}' on the canvas`),
        { status: 404 },
      );
    }
    const recipients = this.directory.links
      .filter(
        (link) => link.targetKind === "source" && link.targetId === source.id,
      )
      .map((link) => this.getMember(link.orchestratorId))
      .filter((member): member is TeamMemberInfo => !!member);
    if (recipients.length === 0) {
      throw Object.assign(
        new Error(`Source '${source.name}' is not wired to any orchestrator`),
        { status: 409 },
      );
    }
    let pretty: string;
    try {
      pretty = JSON.stringify(payload, null, 2) ?? "null";
    } catch {
      pretty = String(payload);
    }
    if (pretty.length > 6000) {
      pretty = `${pretty.slice(0, 6000)}\n… [truncated ${pretty.length - 6000} chars]`;
    }
    const stamp = new Date(this.now()).toISOString();
    const summary = summarizePayload(payload);
    for (const member of recipients) {
      const text =
        `${TEAM_MESSAGE_PREFIX}n8n event from source "${source.name}" at ${stamp}]\n` +
        (source.description ? `Source notes: ${clip(source.description, 400)}\n` : "") +
        "This is an automatic workflow output, not a message from the user. " +
        "Handle it as the source notes and your instructions say.\n\n" +
        pretty;
      this.enqueue(member.id, text);
      this.record({
        agentId: member.id,
        agentName: member.name,
        kind: "event",
        sourceName: source.name,
        targetName: member.name,
        text: summary,
      });
    }
    return {
      source: source.name,
      deliveredTo: recipients.map((member) => member.name),
    };
  }
}

/** One line describing an event payload for the activity feed. */
export function summarizePayload(payload: unknown): string {
  if (payload === null || payload === undefined) return "(empty)";
  if (typeof payload !== "object") return clip(String(payload), 80);
  if (Array.isArray(payload)) return `${payload.length} item(s)`;
  const record = payload as Record<string, unknown>;
  for (const key of ["summary", "message", "event", "type", "status", "title"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return clip(value, 80);
  }
  const keys = Object.keys(record);
  return clip(keys.slice(0, 5).join(", ") || "{}", 80);
}
