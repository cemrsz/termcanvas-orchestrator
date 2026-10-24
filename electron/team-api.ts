/**
 * `/team/<agentId>/<action>` — the API behind each agent's `tc.mjs`.
 *
 * The agent id in the path is the caller. Everything it can see is its own
 * team (shared/team.ts); it may give tasks only to its direct reports and
 * message any teammate.
 */

import type { PtyManager } from "./pty-manager";
import type { TelemetryService } from "./telemetry-service";
import type { TeamHub } from "./team-hub";
import {
  createDefaultComposerSubmitDeps,
  submitComposerRequest,
} from "./composer-submit";
import { extractLastAssistantReply, stripAnsi } from "./orchestrator-bridge";
import type { TerminalType } from "../src/types";
import { resolveMemberRef, type TeamMemberInfo } from "../shared/team";
import {
  clip,
  firstLine,
  formatActivity,
  parseSince,
  type TeamActivityKind,
} from "../shared/teamActivity";

type PtyAccess = Pick<PtyManager, "getPid" | "write" | "getOutput">;
type TelemetryAccess = Pick<TelemetryService, "getTerminalSnapshot">;

export interface TeamApiDeps {
  hub: TeamHub;
  ptyManager: PtyAccess;
  telemetryService: TelemetryAccess;
}

/** Kinds `tc.mjs` may log on its own behalf (the rest the API records). */
const SELF_LOGGED_KINDS = new Set<TeamActivityKind>(["sheet", "read", "trigger"]);

export function matchTeamRoute(
  pathname: string,
): { agentId: string; action: string } | null {
  const match = /^\/team\/([^/]+)(?:\/([a-z]+))?$/.exec(pathname);
  if (!match) return null;
  return { agentId: decodeURIComponent(match[1]), action: match[2] ?? "" };
}

/** Paste a prompt into an agent's terminal the same way the composer does. */
export async function submitTextToAgent(
  ptyManager: Pick<PtyManager, "getPid" | "write">,
  agent: Pick<TeamMemberInfo, "id" | "name" | "type" | "worktreePath" | "ptyId">,
  text: string,
): Promise<void> {
  if (!agent.ptyId || !ptyManager.getPid(agent.ptyId)) {
    throw Object.assign(
      new Error(`${agent.name} is not running on the canvas`),
      { status: 409 },
    );
  }
  const result = await submitComposerRequest(
    {
      terminalId: agent.id,
      ptyId: agent.ptyId,
      terminalType: agent.type as TerminalType,
      worktreePath: agent.worktreePath,
      text,
      images: [],
    },
    createDefaultComposerSubmitDeps(
      process.platform as "darwin" | "win32" | "linux",
      () => {
        throw new Error("Images are not supported over the team API");
      },
      (ptyId, data) => ptyManager.write(ptyId, data),
    ),
  );
  if (!result.ok) {
    throw Object.assign(
      new Error(result.detail ?? result.error ?? "Send failed"),
      { status: 500 },
    );
  }
}

function requireText(body: any, field = "text"): string {
  const value = body?.[field];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw Object.assign(new Error(`${field} is required`), { status: 400 });
  }
  return value;
}

export class TeamApi {
  constructor(private readonly deps: TeamApiDeps) {}

  private live<T extends TeamMemberInfo>(member: T) {
    const { hub, telemetryService } = this.deps;
    const snapshot = telemetryService.getTerminalSnapshot(member.id);
    return {
      ...member,
      turnState: snapshot?.turn_state ?? null,
      turnStartedAt: snapshot?.turn_started_at ?? null,
      lastOutputAt: snapshot?.last_output_at ?? null,
      doing: hub.latestDoing(member.id),
      queued: hub.queuedFor(member.id),
    };
  }

  private readReply(agent: { id: string; ptyId: number | null }) {
    const { ptyManager, telemetryService } = this.deps;
    const sessionFile = telemetryService.getTerminalSnapshot(agent.id)?.session_file;
    const sessionReply = sessionFile ? extractLastAssistantReply(sessionFile) : null;
    if (sessionReply) {
      return { source: "session", reply: sessionReply };
    }
    // No transcript (e.g. a shell worker): fall back to the screen buffer.
    const lines = agent.ptyId ? ptyManager.getOutput(agent.ptyId, 80) : [];
    return { source: "terminal", reply: stripAnsi(lines.join("\n")).trim() };
  }

  async handle(
    method: string,
    agentId: string,
    action: string,
    url: URL,
    body: any,
  ): Promise<unknown> {
    const { hub } = this.deps;
    const view = hub.requireView(agentId);
    const teamIds = new Set(view.members.map((member) => member.id));
    const teammates = view.members;

    if (method === "GET" && action === "") {
      return {
        teamId: view.teamId,
        me: this.live(view.me),
        managers: view.managers.map((m) => this.live(m)),
        reports: view.reports.map((m) => this.live(m)),
        members: view.members.map((m) => this.live(m)),
        sources: view.sources,
        queued: hub.queuedFor(agentId),
      };
    }

    if (method === "GET" && action === "agent") {
      const agent = resolveMemberRef(teammates, url.searchParams.get("agent"));
      return { agent: this.live(agent) };
    }

    if (method === "POST" && action === "send") {
      const text = requireText(body);
      if (!view.me.isManager) {
        throw Object.assign(
          new Error(
            "Only managers send tasks. Use msg to ask a teammate, or ask the user to make you an orchestrator.",
          ),
          { status: 403 },
        );
      }
      const agent = resolveMemberRef(view.reports, body?.agent);
      await submitTextToAgent(
        this.deps.ptyManager,
        agent,
        hub.buildTaskText(view.me, agent, text),
      );
      hub.noteDirectSend(agent.id);
      hub.recordFor(agentId, {
        kind: "task",
        targetId: agent.id,
        targetName: agent.name,
        text: firstLine(text),
      });
      return { ok: true, agent: { id: agent.id, name: agent.name } };
    }

    if (method === "GET" && action === "reply") {
      const agent = this.live(
        resolveMemberRef(teammates, url.searchParams.get("agent")),
      );
      return { agent, ...this.readReply(agent) };
    }

    if (method === "POST" && action === "msg") {
      const text = requireText(body);
      const agent = resolveMemberRef(
        teammates.filter((member) => member.id !== agentId),
        body?.agent,
      );
      hub.sendMessage(agentId, agent.id, text);
      return { ok: true, agent: { id: agent.id, name: agent.name } };
    }

    if (method === "POST" && action === "say") {
      hub.recordFor(agentId, { kind: "say", text: clip(requireText(body), 200) });
      return { ok: true };
    }

    if (method === "GET" && action === "board") {
      const limit = parseInt(url.searchParams.get("limit") ?? "30", 10) || 30;
      return { notes: hub.boardFor(teamIds, limit) };
    }
    if (method === "POST" && action === "board") {
      return { ok: true, note: hub.post(agentId, requireText(body)) };
    }

    if (method === "GET" && action === "log") {
      const limit = parseInt(url.searchParams.get("limit") ?? "100", 10) || 100;
      const sinceRaw = url.searchParams.get("since");
      const sinceMs = sinceRaw ? (parseSince(sinceRaw) ?? undefined) : undefined;
      const lang = hub.getDirectory().lang;
      const entries = hub
        .listActivity({ terminalIds: teamIds, sinceMs, limit: limit * 4 })
        // Tool calls are the noisy middle of the story; reports need the rest.
        .filter((entry) => entry.kind !== "tool")
        .slice(-limit)
        .map((entry) => ({ ...entry, sentence: formatActivity(entry, lang) }));
      return { entries };
    }
    if (method === "POST" && action === "log") {
      const kind = body?.kind as TeamActivityKind;
      if (!SELF_LOGGED_KINDS.has(kind)) {
        throw Object.assign(new Error("Unsupported log kind"), { status: 400 });
      }
      hub.recordFor(agentId, {
        kind,
        ...(typeof body.action === "string" ? { action: body.action } : {}),
        ...(typeof body.count === "number" ? { count: body.count } : {}),
        ...(typeof body.status === "number" ? { status: body.status } : {}),
        ...(typeof body.sourceName === "string"
          ? { sourceName: clip(body.sourceName, 80) }
          : {}),
      });
      return { ok: true };
    }

    if (method === "POST" && action === "report") {
      const report = hub.saveReport(
        agentId,
        requireText(body, "title"),
        requireText(body, "markdown"),
      );
      return { ok: true, path: report.path, id: report.id };
    }

    throw Object.assign(new Error("Not found"), { status: 404 });
  }
}
