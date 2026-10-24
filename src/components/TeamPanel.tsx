import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { useProjectStore } from "../stores/projectStore";
import { useOrchestrationStore } from "../stores/orchestrationStore";
import { useTerminalRuntimeStateStore } from "../stores/terminalRuntimeStateStore";
import { useTerminalRuntimeStore } from "../terminal/terminalRuntimeStore";
import { useTeamStore } from "../stores/teamStore";
import { buildTeamDirectory } from "../actions/teamDirectory";
import { panToTerminal } from "../utils/panToTerminal";
import {
  listTeams,
  type TeamLang,
  type TeamRosterEntry,
  type TeamView,
} from "../../shared/team";
import {
  formatActivity,
  type TeamActivityEntry,
} from "../../shared/teamActivity";

/*
 * Team panel — the left-panel tab that tells, in one sentence per line,
 * what every agent on the team is doing, like a group chat. Lines come
 * from hook events (tools, prompts, turn ends) and from the agents' own
 * `tc.mjs say` sentences; reports the lead saves open in a reader.
 */

const STRINGS: Record<TeamLang, Record<string, string>> = {
  tr: {
    team: "Ekip",
    allAgents: "Tüm agent'lar",
    working: "çalışıyor",
    idle: "boşta",
    roster: "Kadro",
    reports: "Raporlar",
    activity: "Akış",
    tools: "Araç adımları",
    empty: "Henüz bir ekip yok.",
    emptyHint:
      "Kanvasa sağ tıkla → “New Team in <proje> (1 Opus · 4 Sonnet · 20 Haiku)” ya da “New Orchestrator in <proje>”. Agent'lar kablolarla bağlandıkça burada ne yaptıklarını anlatırlar.",
    noActivity: "Henüz etkinlik yok. Lidere bir komut yaz; ekip çalışmaya başlayınca burada görünür.",
    openReport: "Raporu aç",
    close: "Kapat",
    copy: "Markdown'ı kopyala",
    copied: "Kopyalandı",
    editRole: "Rolü düzenle",
    rolePlaceholder: "Bu agent ne iş yapar?",
    notRunning: "çalışmıyor",
    waiting: "onay bekliyor",
    queued: "mesaj bekliyor",
    newLines: "yeni satır",
  },
  en: {
    team: "Team",
    allAgents: "All agents",
    working: "working",
    idle: "idle",
    roster: "Roster",
    reports: "Reports",
    activity: "Activity",
    tools: "Tool steps",
    empty: "No team yet.",
    emptyHint:
      "Right-click the canvas → “New Team in <project> (1 Opus · 4 Sonnet · 20 Haiku)” or “New Orchestrator in <project>”. As agents are wired together they narrate what they do here.",
    noActivity: "No activity yet. Give the lead a command; the team's work shows up here.",
    openReport: "Open report",
    close: "Close",
    copy: "Copy markdown",
    copied: "Copied",
    editRole: "Edit role",
    rolePlaceholder: "What does this agent do?",
    notRunning: "not running",
    waiting: "needs approval",
    queued: "message waiting",
    newLines: "new lines",
  },
};

const BUSY_STATES = new Set(["thinking", "in_turn", "tool_running", "tool_pending"]);

function modelColor(model: string | undefined, type: string): string {
  const value = (model ?? "").toLowerCase();
  if (value.includes("opus")) return "var(--purple)";
  if (value.includes("sonnet")) return "var(--git-graph-blue)";
  if (value.includes("haiku")) return "var(--git-graph-green)";
  if (type === "codex") return "var(--cyan)";
  return "var(--amber)";
}

function shortModel(model: string | undefined): string | null {
  if (!model) return null;
  const match = /(opus|sonnet|haiku|fable)[-\s]?([\d-.]*)/i.exec(model);
  if (!match) return model;
  const version = match[2].replace(/-/g, ".").replace(/^\.|\.$/g, "");
  return `${match[1].toLowerCase()}${version ? ` ${version}` : ""}`;
}

function initials(name: string): string {
  const words = name.split(/[\s_-]+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + (/\d/.test(words[1][0]) ? words[1] : words[1][0]))
    .slice(0, 3)
    .toUpperCase();
}

function timeOf(at: number, lang: TeamLang) {
  return new Date(at).toLocaleTimeString(lang === "tr" ? "tr-TR" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

type AgentState = "working" | "waiting" | "idle" | "stopped";

function useAgentStates(): (id: string, ptyId: number | null) => AgentState {
  const runtime = useTerminalRuntimeStore((state) => state.terminals);
  return useCallback(
    (id, ptyId) => {
      if (ptyId === null) return "stopped";
      const turnState = runtime[id]?.telemetry?.turn_state;
      if (turnState === "awaiting_input") return "waiting";
      if (turnState && BUSY_STATES.has(turnState)) return "working";
      return "idle";
    },
    [runtime],
  );
}

const STATE_COLOR: Record<AgentState, string> = {
  working: "var(--green)",
  waiting: "var(--amber)",
  idle: "var(--text-faint)",
  stopped: "var(--red)",
};

function Avatar({ name, color, size = 22 }: { name: string; color: string; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold"
      style={{
        width: size,
        height: size,
        fontSize: size <= 18 ? 8 : 9,
        color,
        background: `color-mix(in srgb, ${color} 16%, var(--surface))`,
        border: `1px solid color-mix(in srgb, ${color} 45%, transparent)`,
      }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

function RosterRow({
  member,
  state,
  doing,
  t,
}: {
  member: TeamRosterEntry;
  state: AgentState;
  doing: string | null;
  t: Record<string, string>;
}) {
  const role = useOrchestrationStore((s) => s.roles[member.id] ?? "");
  const setRole = useOrchestrationStore((s) => s.setRole);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(role);
  const color = modelColor(member.model, member.type);
  const model = shortModel(member.model);
  const stateLabel =
    state === "stopped" ? t.notRunning : state === "waiting" ? t.waiting : state === "working" ? t.working : t.idle;

  return (
    <div
      className="tc-row-hover group flex items-start gap-2 rounded-md py-1 pr-2 cursor-pointer"
      style={{ paddingLeft: 8 + Math.min(member.depth, 4) * 14 }}
      onClick={() => panToTerminal(member.id)}
      title={member.role ? `${member.name} — ${member.role}` : member.name}
    >
      <span className="relative mt-0.5">
        <Avatar name={member.name} color={color} size={20} />
        <span
          className={`absolute -right-0.5 -bottom-0.5 h-2 w-2 rounded-full border border-[var(--surface)] ${state === "working" ? "animate-pulse" : ""}`}
          style={{ background: STATE_COLOR[state] }}
          title={stateLabel}
        />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="tc-meta truncate font-medium text-[var(--text-primary)]">
            {member.name}
          </span>
          {model && (
            <span className="tc-caption shrink-0 rounded px-1" style={{ color, background: `color-mix(in srgb, ${color} 12%, transparent)` }}>
              {model}
            </span>
          )}
          <button
            type="button"
            className="tc-caption ml-auto shrink-0 opacity-0 group-hover:opacity-100 text-[var(--text-faint)] hover:text-[var(--text-primary)]"
            title={t.editRole}
            onClick={(e) => {
              e.stopPropagation();
              setDraft(role);
              setEditing(true);
            }}
          >
            ✎
          </button>
        </div>
        {editing ? (
          <input
            autoFocus
            className="tc-caption mt-0.5 w-full rounded border border-[var(--border)] bg-[var(--bg)] px-1.5 py-0.5 text-[var(--text-primary)] outline-none"
            value={draft}
            placeholder={t.rolePlaceholder}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              setRole(member.id, draft);
              setEditing(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") setEditing(false);
            }}
          />
        ) : (
          <div className="tc-caption truncate text-[var(--text-muted)]">
            {doing ?? (member.role || stateLabel)}
          </div>
        )}
      </div>
    </div>
  );
}

function FeedLine({
  entry,
  lang,
  color,
  t,
  onOpenReport,
}: {
  entry: TeamActivityEntry;
  lang: TeamLang;
  color: string;
  t: Record<string, string>;
  onOpenReport: (path: string) => void;
}) {
  const sentence = formatActivity(entry, lang);
  if (entry.kind === "tool") {
    return (
      <div className="flex items-baseline gap-2 py-0.5 pl-[30px] pr-2">
        <span className="tc-caption shrink-0 text-[var(--text-faint)]">⋯</span>
        <span className="tc-caption min-w-0 truncate text-[var(--text-muted)]" title={`${entry.agentName}: ${sentence}`}>
          <span style={{ color }}>{entry.agentName}</span> · {sentence}
        </span>
      </div>
    );
  }

  const accent =
    entry.kind === "event"
      ? "var(--git-graph-pink)"
      : entry.kind === "waiting"
        ? "var(--amber)"
        : entry.kind === "error"
          ? "var(--red)"
          : entry.kind === "report"
            ? "var(--purple)"
            : entry.kind === "done"
              ? "var(--green)"
              : null;
  const bubble =
    entry.kind === "say" || entry.kind === "board" || entry.kind === "report";

  return (
    <div className="flex items-start gap-2 px-2 py-1.5">
      <Avatar name={entry.agentName} color={color} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <span className="tc-meta truncate font-medium" style={{ color }}>
            {entry.agentName}
          </span>
          {entry.kind === "event" && (
            <span className="tc-caption rounded px-1" style={{ color: accent ?? undefined, background: "color-mix(in srgb, var(--git-graph-pink) 14%, transparent)" }}>
              n8n
            </span>
          )}
          {entry.kind === "board" && (
            <span className="tc-caption rounded px-1 text-[var(--amber)]" style={{ background: "color-mix(in srgb, var(--amber) 14%, transparent)" }}>
              📌
            </span>
          )}
          <span className="tc-caption ml-auto shrink-0 text-[var(--text-faint)]">
            {timeOf(entry.at, lang)}
          </span>
        </div>
        <div
          className={`tc-body-sm mt-0.5 break-words ${bubble ? "rounded-lg rounded-tl-sm px-2 py-1" : ""}`}
          style={{
            color: accent ?? "var(--text-secondary)",
            background: bubble ? "var(--surface-hover)" : undefined,
          }}
        >
          {entry.kind === "done" && <span aria-hidden="true">✓ </span>}
          {entry.kind === "waiting" && <span aria-hidden="true">⏸ </span>}
          {sentence}
        </div>
        {entry.kind === "report" && entry.reportPath && (
          <button
            type="button"
            className="tc-caption mt-1 rounded-md border px-2 py-0.5 hover:bg-[var(--surface-hover)]"
            style={{ borderColor: "var(--purple)", color: "var(--purple)" }}
            onClick={() => onOpenReport(entry.reportPath!)}
          >
            {t.openReport}
          </button>
        )}
      </div>
    </div>
  );
}

/** Consecutive tool steps of one agent collapse into the latest one. */
function collapseToolRuns(entries: TeamActivityEntry[]): TeamActivityEntry[] {
  const out: TeamActivityEntry[] = [];
  for (const entry of entries) {
    const previous = out[out.length - 1];
    if (
      entry.kind === "tool" &&
      previous?.kind === "tool" &&
      previous.agentId === entry.agentId
    ) {
      out[out.length - 1] = entry;
    } else {
      out.push(entry);
    }
  }
  return out;
}

function ReportReader({
  path,
  t,
  onClose,
}: {
  path: string;
  t: Record<string, string>;
  onClose: () => void;
}) {
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    let cancelled = false;
    window.termcanvas.team
      .readReport(path)
      .then((text) => !cancelled && setMarkdown(text))
      .catch((err) => !cancelled && setError(String(err?.message ?? err)));
    return () => {
      cancelled = true;
    };
  }, [path]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const html = useMemo(
    () =>
      markdown
        ? DOMPurify.sanitize(marked.parse(markdown, { async: false }) as string)
        : "",
    [markdown],
  );

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 p-6"
      onMouseDown={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]"
        style={{ boxShadow: "var(--shadow-elev-2, 0 20px 60px rgba(0,0,0,.4))" }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-2.5">
          <span className="tc-caption min-w-0 flex-1 truncate text-[var(--text-faint)]" title={path}>
            {path}
          </span>
          {markdown && (
            <button
              type="button"
              className="tc-caption rounded-md px-2 py-1 text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
              onClick={() => {
                void navigator.clipboard.writeText(markdown).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1200);
                });
              }}
            >
              {copied ? t.copied : t.copy}
            </button>
          )}
          <button
            type="button"
            className="tc-caption rounded-md px-2 py-1 text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
            onClick={onClose}
          >
            {t.close}
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-auto px-6 py-5">
          {error ? (
            <div className="tc-body-sm text-[var(--red)]">{error}</div>
          ) : (
            <div
              className="tc-body-sm prose prose-sm dark:prose-invert max-w-none text-[var(--text-secondary)] [&_h1]:text-[18px] [&_h1]:font-semibold [&_h1]:mb-2 [&_h2]:font-semibold [&_h2]:text-[14px] [&_h2]:mt-5 [&_h2]:mb-1.5 [&_h3]:text-[13px] [&_h1]:text-[var(--text-primary)] [&_h2]:text-[var(--text-primary)] [&_h3]:text-[var(--text-primary)] [&_a]:text-[var(--accent)] [&_code]:text-[var(--accent)] [&_code]:bg-[var(--bg)] [&_code]:px-1 [&_code]:rounded [&_ul]:pl-5 [&_ul]:list-disc [&_ol]:pl-5 [&_ol]:list-decimal [&_li]:my-0.5 [&_table]:w-full [&_table]:my-2 [&_th]:text-left [&_th]:border-b [&_th]:border-[var(--border)] [&_th]:py-1 [&_th]:pr-3 [&_td]:border-b [&_td]:border-[var(--border)] [&_td]:py-1 [&_td]:pr-3 [&_td]:align-top [&_strong]:text-[var(--text-primary)]"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function TeamPanel() {
  const lang = useTeamStore((s) => s.lang);
  const setLang = useTeamStore((s) => s.setLang);
  const showTools = useTeamStore((s) => s.showTools);
  const setShowTools = useTeamStore((s) => s.setShowTools);
  const entries = useTeamStore((s) => s.entries);
  const reports = useTeamStore((s) => s.reports);
  const openReportPath = useTeamStore((s) => s.openReportPath);
  const openReport = useTeamStore((s) => s.openReport);
  const t = STRINGS[lang];

  // Rebuild the roster whenever the canvas, wiring or PTYs change.
  const projects = useProjectStore((s) => s.projects);
  const orchestratorIds = useOrchestrationStore((s) => s.orchestratorIds);
  const links = useOrchestrationStore((s) => s.links);
  const roles = useOrchestrationStore((s) => s.roles);
  const runtimeStates = useTerminalRuntimeStateStore((s) => s.terminals);
  const teams = useMemo(
    () => listTeams(buildTeamDirectory(lang)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projects, orchestratorIds, links, roles, runtimeStates, lang],
  );
  const stateOf = useAgentStates();

  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const team: TeamView | null =
    teams.find((candidate) => candidate.teamId === selectedTeamId) ??
    teams[0] ??
    null;

  const colorById = useMemo(() => {
    const map = new Map<string, string>();
    for (const candidate of teams) {
      for (const member of candidate.members) {
        map.set(member.id, modelColor(member.model, member.type));
      }
    }
    return map;
  }, [teams]);

  const memberIds = useMemo(
    () => (team ? new Set(team.members.map((member) => member.id)) : null),
    [team],
  );
  const visible = useMemo(() => {
    const scoped = memberIds
      ? entries.filter((entry) => memberIds.has(entry.agentId))
      : entries;
    const withTools = showTools
      ? collapseToolRuns(scoped)
      : scoped.filter((entry) => entry.kind !== "tool");
    return withTools.slice(-400);
  }, [entries, memberIds, showTools]);

  const latestByAgent = useMemo(() => {
    const map = new Map<string, string>();
    for (const entry of entries) {
      map.set(entry.agentId, formatActivity(entry, lang));
    }
    return map;
  }, [entries, lang]);

  const working = team
    ? team.members.filter((member) => stateOf(member.id, member.ptyId) === "working").length
    : 0;

  // Follow the newest line unless the user scrolled up to read.
  const feedRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const lastScrollTop = useRef(0);
  const [unseen, setUnseen] = useState(0);
  // Keyed on the newest line, not the count: the feed is capped, so past
  // the cap the count stops changing while lines keep arriving.
  const newestId = visible[visible.length - 1]?.id;
  useLayoutEffect(() => {
    const node = feedRef.current;
    if (!node || !newestId) return;
    if (stickToBottom.current) {
      node.scrollTop = node.scrollHeight;
      setUnseen(0);
    } else {
      setUnseen((count) => count + 1);
    }
  }, [newestId]);

  const [rosterOpen, setRosterOpen] = useState(true);
  const teamReports = useMemo(
    () =>
      (memberIds ? reports.filter((report) => memberIds.has(report.agentId)) : reports).slice(0, 5),
    [reports, memberIds],
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-1.5 px-3 pb-2">
        {teams.length > 1 ? (
          <select
            className="tc-meta min-w-0 flex-1 truncate rounded border border-[var(--border)] bg-[var(--bg)] px-1.5 py-0.5 text-[var(--text-primary)] outline-none"
            value={team?.teamId ?? ""}
            onChange={(e) => setSelectedTeamId(e.target.value)}
          >
            {teams.map((candidate) => (
              <option key={candidate.teamId} value={candidate.teamId}>
                {candidate.members[0]?.name ?? candidate.teamId} · {candidate.members.length}
              </option>
            ))}
          </select>
        ) : (
          <span className="tc-meta min-w-0 flex-1 truncate font-medium text-[var(--text-primary)]">
            {team ? `${t.team}: ${team.members[0]?.name ?? ""}` : t.allAgents}
          </span>
        )}
        {team && (
          <span className="tc-caption shrink-0 text-[var(--text-faint)]">
            <span style={{ color: working > 0 ? "var(--green)" : undefined }}>
              {working} {t.working}
            </span>{" "}
            · {team.members.length - working} {t.idle}
          </span>
        )}
        <button
          type="button"
          className="tc-caption shrink-0 rounded px-1 text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
          title="Türkçe / English"
          onClick={() => setLang(lang === "tr" ? "en" : "tr")}
        >
          {lang.toUpperCase()}
        </button>
      </div>

      {!team && entries.length === 0 && (
        <div className="tc-label px-4 py-6 text-center">
          <div className="mb-1.5 text-[var(--text-secondary)]">{t.empty}</div>
          <div className="text-[var(--text-faint)]">{t.emptyHint}</div>
        </div>
      )}

      {team && (
        <div className="shrink-0 border-b border-[var(--border)] pb-1">
          <button
            type="button"
            className="tc-caption flex w-full items-center gap-1 px-3 py-0.5 uppercase tracking-wide text-[var(--text-faint)] hover:text-[var(--text-secondary)]"
            onClick={() => setRosterOpen(!rosterOpen)}
          >
            <span>{rosterOpen ? "▾" : "▸"}</span>
            {t.roster} · {team.members.length}
          </button>
          {rosterOpen && (
            <div className="max-h-[38vh] overflow-y-auto px-1">
              {team.members.map((member) => (
                <RosterRow
                  key={member.id}
                  member={member}
                  state={stateOf(member.id, member.ptyId)}
                  doing={latestByAgent.get(member.id) ?? null}
                  t={t}
                />
              ))}
            </div>
          )}
          {teamReports.length > 0 && (
            <div className="px-3 pt-1.5">
              <div className="tc-caption pb-0.5 uppercase tracking-wide text-[var(--text-faint)]">
                {t.reports}
              </div>
              {teamReports.map((report) => (
                <button
                  key={report.id}
                  type="button"
                  className="tc-row-hover flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-left"
                  onClick={() => openReport(report.path)}
                >
                  <span style={{ color: "var(--purple)" }}>▤</span>
                  <span className="tc-meta min-w-0 flex-1 truncate text-[var(--text-primary)]">
                    {report.title}
                  </span>
                  <span className="tc-caption shrink-0 text-[var(--text-faint)]">
                    {timeOf(report.at, lang)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {(team || entries.length > 0) && (
        <>
          <div className="flex shrink-0 items-center gap-2 px-3 pt-1.5 pb-1">
            <span className="tc-caption uppercase tracking-wide text-[var(--text-faint)]">
              {t.activity}
            </span>
            <label className="tc-caption ml-auto flex cursor-pointer items-center gap-1 text-[var(--text-faint)]">
              <input
                type="checkbox"
                checked={showTools}
                onChange={(e) => setShowTools(e.target.checked)}
              />
              {t.tools}
            </label>
          </div>
          <div
            ref={feedRef}
            className="relative flex-1 min-h-0 overflow-y-auto pb-2"
            onScroll={(e) => {
              // Only the user scrolls up; following the feed always scrolls
              // down, and growing content scrolls nothing.
              const node = e.currentTarget;
              const nearBottom =
                node.scrollHeight - node.scrollTop - node.clientHeight < 40;
              if (nearBottom) {
                stickToBottom.current = true;
                setUnseen(0);
              } else if (node.scrollTop < lastScrollTop.current) {
                stickToBottom.current = false;
              }
              lastScrollTop.current = node.scrollTop;
            }}
          >
            {visible.length === 0 ? (
              <div className="tc-label px-4 py-6 text-center text-[var(--text-faint)]">
                {t.noActivity}
              </div>
            ) : (
              visible.map((entry) => (
                <FeedLine
                  key={entry.id}
                  entry={entry}
                  lang={lang}
                  color={colorById.get(entry.agentId) ?? "var(--text-secondary)"}
                  t={t}
                  onOpenReport={openReport}
                />
              ))
            )}
          </div>
          {unseen > 0 && (
            <button
              type="button"
              className="tc-caption mx-auto -mt-8 mb-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-0.5 text-[var(--text-secondary)] shadow"
              onClick={() => {
                const node = feedRef.current;
                if (node) node.scrollTop = node.scrollHeight;
                stickToBottom.current = true;
                setUnseen(0);
              }}
            >
              ↓ {unseen} {t.newLines}
            </button>
          )}
        </>
      )}

      {openReportPath && (
        <ReportReader path={openReportPath} t={t} onClose={() => openReport(null)} />
      )}
    </div>
  );
}
