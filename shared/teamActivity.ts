/**
 * Team activity: the one-line "what is each agent doing" feed.
 *
 * Entries are stored structured and turned into a sentence when shown, so
 * the panel language can change after the fact and reports can quote the
 * log in either language. Most entries come for free from Claude/Codex
 * hook events (tool use, prompts, turn ends); agents add their own
 * sentences with `tc.mjs say`.
 */

import type { TeamLang } from "./team";

export type TeamActivityKind =
  /** Agent's own sentence (tc.mjs say). */
  | "say"
  /** Tool use picked up from a PreToolUse hook. */
  | "tool"
  /** A prompt reached the agent (user, manager, teammate or n8n). */
  | "prompt"
  /** The agent's turn ended; text is the start of its reply. */
  | "done"
  /** The agent waits for the user to approve something. */
  | "waiting"
  | "error"
  /** A manager gave a report a task. */
  | "task"
  /** A teammate-to-teammate message. */
  | "msg"
  | "board"
  /** An n8n/API source pushed an event in. */
  | "event"
  | "read"
  | "sheet"
  | "trigger"
  | "report";

export interface TeamActivityEntry {
  id: string;
  at: number;
  agentId: string;
  agentName: string;
  kind: TeamActivityKind;
  text?: string;
  tool?: string;
  detail?: string;
  targetId?: string;
  targetName?: string;
  sourceName?: string;
  action?: string;
  count?: number;
  status?: number;
  title?: string;
  reportPath?: string;
}

export type TeamActivityDraft = Omit<TeamActivityEntry, "id" | "at"> & {
  at?: number;
};

const MAX_DETAIL = 90;

export function clip(text: string, max = MAX_DETAIL): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length > max ? `${oneLine.slice(0, max - 1)}…` : oneLine;
}

/** First meaningful line of a reply or prompt. */
export function firstLine(text: string, max = MAX_DETAIL): string {
  for (const raw of text.split(/\r?\n/)) {
    // Markdown emphasis and code marks read as noise in a one-line feed.
    const line = raw
      .replace(/^[#>*\-\s]+/, "")
      .replace(/\*\*|__|`/g, "")
      .trim();
    if (line) return clip(line, max);
  }
  return "";
}

function baseName(filePath: string): string {
  const parts = filePath.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? filePath;
}

function hostOf(url: string): string {
  try {
    return new URL(url).host || url;
  } catch {
    return url;
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

/** Header the bridge puts in front of everything it pastes into an agent. */
export const TEAM_MESSAGE_PREFIX = "[TermCanvas · ";

export type TeamPromptOrigin = "task" | "msg" | "event" | "user";

export function classifyPrompt(prompt: string): {
  origin: TeamPromptOrigin;
  body: string;
  from?: string;
} {
  // Claude Code hands pasted text to hooks wrapped in <pasted_content>.
  const trimmed = prompt
    .trim()
    .replace(/^<pasted_content[^>]*>\s*/, "")
    .replace(/\s*<\/pasted_content>$/, "");
  if (!trimmed.startsWith(TEAM_MESSAGE_PREFIX)) {
    return { origin: "user", body: trimmed };
  }
  const headerEnd = trimmed.indexOf("]");
  const header = trimmed.slice(TEAM_MESSAGE_PREFIX.length, headerEnd);
  // Skip the header and the instruction lines right below it.
  const rest = trimmed.slice(headerEnd + 1);
  const blank = rest.search(/\r?\n\s*\r?\n/);
  const body = blank >= 0 ? rest.slice(blank).trim() : rest.trim();
  if (header.startsWith("n8n") || header.startsWith("event")) {
    const source = /source "([^"]+)"/.exec(header)?.[1];
    let summary: string;
    try {
      summary = summarizePayload(JSON.parse(body));
    } catch {
      summary = firstLine(body);
    }
    return { origin: "event", body: summary, ...(source ? { from: source } : {}) };
  }
  const from = /from (.+?)(?: to | \(|$)/.exec(header)?.[1]?.trim();
  if (header.startsWith("task")) return { origin: "task", body, from };
  if (header.startsWith("message")) return { origin: "msg", body, from };
  return { origin: "user", body: prompt };
}

interface HookEventLike {
  hook_event_name?: string;
  tool_name?: unknown;
  tool_input?: unknown;
  prompt?: unknown;
  message?: unknown;
  error?: unknown;
  [key: string]: unknown;
}

function stringField(record: unknown, key: string): string {
  if (!record || typeof record !== "object") return "";
  const value = (record as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

/**
 * Turn one hook event into an activity draft. Returns null for events that
 * would only add noise (session starts, our own bridge CLI calls, which
 * record richer entries through the API themselves).
 */
export function describeHookEvent(
  event: HookEventLike,
  agent: { id: string; name: string },
): TeamActivityDraft | null {
  const base = { agentId: agent.id, agentName: agent.name };
  switch (event.hook_event_name) {
    case "PreToolUse": {
      const tool = typeof event.tool_name === "string" ? event.tool_name : "";
      if (!tool) return null;
      const input = event.tool_input;
      let detail = "";
      if (tool === "Bash" || tool === "PowerShell") {
        const command = stringField(input, "command");
        if (/tc\.mjs/.test(command)) return null;
        detail = stringField(input, "description") || command;
      } else if (
        tool === "Read" ||
        tool === "Write" ||
        tool === "Edit" ||
        tool === "MultiEdit" ||
        tool === "NotebookEdit"
      ) {
        const filePath =
          stringField(input, "file_path") || stringField(input, "notebook_path");
        if (/[\\/]\.termcanvas[\\/]/.test(filePath)) return null;
        detail = baseName(filePath);
      } else if (tool === "Grep" || tool === "Glob") {
        detail = stringField(input, "pattern");
      } else if (tool === "WebSearch") {
        detail = stringField(input, "query");
      } else if (tool === "WebFetch") {
        detail = hostOf(stringField(input, "url"));
      } else if (tool === "Task" || tool === "Agent") {
        detail = stringField(input, "description");
      }
      return { ...base, kind: "tool", tool, detail: clip(detail) };
    }
    case "UserPromptSubmit": {
      const prompt = typeof event.prompt === "string" ? event.prompt : "";
      if (!prompt.trim()) return null;
      const { origin, body, from } = classifyPrompt(prompt);
      return {
        ...base,
        kind: "prompt",
        action: origin,
        text: firstLine(body),
        ...(from ? { targetName: from } : {}),
      };
    }
    case "Notification": {
      const message = typeof event.message === "string" ? event.message : "";
      // Only approval requests. Claude also notifies "waiting for your
      // input" after a minute of idling, which is not a blocker.
      if (!/permission|approv/i.test(message)) return null;
      return { ...base, kind: "waiting", text: clip(message) };
    }
    case "StopFailure": {
      const error = typeof event.error === "string" ? event.error : "";
      return { ...base, kind: "error", text: clip(error || "turn failed") };
    }
    default:
      return null;
  }
}

const TOOL_PHRASES: Record<
  TeamLang,
  {
    run: (d: string) => string;
    read: (d: string) => string;
    write: (d: string) => string;
    edit: (d: string) => string;
    grep: (d: string) => string;
    glob: (d: string) => string;
    search: (d: string) => string;
    fetch: (d: string) => string;
    task: (d: string) => string;
    todo: string;
    mcp: (server: string, tool: string) => string;
    other: (tool: string) => string;
  }
> = {
  tr: {
    run: (d) => `Komut çalıştırıyorum: ${d}`,
    read: (d) => `${d} dosyasını okuyorum`,
    write: (d) => `${d} dosyasını yazıyorum`,
    edit: (d) => `${d} dosyasını düzenliyorum`,
    grep: (d) => `“${d}” arıyorum`,
    glob: (d) => `Dosya arıyorum: ${d}`,
    search: (d) => `Web'de arıyorum: ${d}`,
    fetch: (d) => `${d} sayfasını okuyorum`,
    task: (d) => `Alt görev başlattım: ${d}`,
    todo: "Yapılacaklar listemi güncelliyorum",
    mcp: (server, tool) => `${server} · ${tool} kullanıyorum`,
    other: (tool) => `${tool} aracını kullanıyorum`,
  },
  en: {
    run: (d) => `Running: ${d}`,
    read: (d) => `Reading ${d}`,
    write: (d) => `Writing ${d}`,
    edit: (d) => `Editing ${d}`,
    grep: (d) => `Searching for “${d}”`,
    glob: (d) => `Looking for files: ${d}`,
    search: (d) => `Searching the web: ${d}`,
    fetch: (d) => `Reading ${d}`,
    task: (d) => `Started a subtask: ${d}`,
    todo: "Updating my to-do list",
    mcp: (server, tool) => `Using ${server} · ${tool}`,
    other: (tool) => `Using ${tool}`,
  },
};

function describeTool(entry: TeamActivityEntry, lang: TeamLang): string {
  const p = TOOL_PHRASES[lang];
  const tool = entry.tool ?? "";
  const detail = entry.detail ?? "";
  switch (tool) {
    case "Bash":
    case "PowerShell":
      return p.run(detail);
    case "Read":
      return p.read(detail);
    case "Write":
      return p.write(detail);
    case "Edit":
    case "MultiEdit":
    case "NotebookEdit":
      return p.edit(detail);
    case "Grep":
      return p.grep(detail);
    case "Glob":
      return p.glob(detail);
    case "WebSearch":
      return p.search(detail);
    case "WebFetch":
      return p.fetch(detail);
    case "Task":
    case "Agent":
      return p.task(detail);
    case "TodoWrite":
      return p.todo;
    default: {
      const mcp = /^mcp__(.+?)__(.+)$/.exec(tool);
      if (mcp) return p.mcp(mcp[1], mcp[2]);
      return p.other(tool);
    }
  }
}

const SHEET_ACTIONS: Record<TeamLang, Record<string, (n: number, s: string) => string>> = {
  tr: {
    append: (n, s) => `${s} sheet'ine ${n} satır ekledim`,
    update: (n, s) => `${s} sheet'inde ${n} satırı güncelledim`,
    upsert: (n, s) => `${s} sheet'inde ${n} satırı ekledim/güncelledim`,
    read: (n, s) => `${s} sheet'inden ${n} satır okudum`,
  },
  en: {
    append: (n, s) => `Added ${n} rows to ${s}`,
    update: (n, s) => `Updated ${n} rows in ${s}`,
    upsert: (n, s) => `Added or updated ${n} rows in ${s}`,
    read: (n, s) => `Read ${n} rows from ${s}`,
  },
};

/** The sentence shown for an entry in the team panel and in `tc.mjs log`. */
export function formatActivity(
  entry: TeamActivityEntry,
  lang: TeamLang,
): string {
  const tr = lang === "tr";
  const text = entry.text ?? "";
  switch (entry.kind) {
    case "say":
    case "board":
      return text;
    case "tool":
      return describeTool(entry, lang);
    case "prompt": {
      if (entry.action === "task") {
        const from = entry.targetName ? `${entry.targetName}` : "";
        return tr
          ? `${from ? `${from} görev verdi` : "Görev aldım"}: ${text}`
          : `${from ? `Task from ${from}` : "Got a task"}: ${text}`;
      }
      if (entry.action === "msg") {
        return tr
          ? `${entry.targetName ?? "Ekip"} mesaj attı: ${text}`
          : `Message from ${entry.targetName ?? "the team"}: ${text}`;
      }
      if (entry.action === "event") {
        const from = entry.targetName ? ` (${entry.targetName})` : "";
        return tr
          ? `Otomatik olay geldi${from}: ${text}`
          : `Automatic event${from}: ${text}`;
      }
      return tr ? `Yeni komut: ${text}` : `New command: ${text}`;
    }
    case "done":
      return text
        ? tr
          ? `Bitirdim: ${text}`
          : `Done: ${text}`
        : tr
          ? "Turumu bitirdim"
          : "Finished my turn";
    case "waiting":
      return tr ? `Onay bekliyorum: ${text}` : `Waiting for approval: ${text}`;
    case "error":
      return tr ? `Hata: ${text}` : `Error: ${text}`;
    case "task":
      return `→ ${entry.targetName ?? "?"}: ${text}`;
    case "msg":
      return tr
        ? `→ ${entry.targetName ?? "?"} (mesaj): ${text}`
        : `→ ${entry.targetName ?? "?"} (message): ${text}`;
    case "event": {
      const to = entry.targetName ? ` → ${entry.targetName}` : "";
      return `n8n · ${entry.sourceName ?? "?"}${to}: ${text}`;
    }
    case "read":
      return tr
        ? `${entry.sourceName ?? "?"} kaynağını okudum`
        : `Read the ${entry.sourceName ?? "?"} source`;
    case "sheet": {
      const phrase = SHEET_ACTIONS[lang][entry.action ?? ""];
      return phrase
        ? phrase(entry.count ?? 0, entry.sourceName ?? "?")
        : `${entry.sourceName ?? "?"}: ${entry.action ?? ""}`;
    }
    case "trigger":
      return tr
        ? `${entry.sourceName ?? "?"} tetiklendi (HTTP ${entry.status ?? "?"})`
        : `Triggered ${entry.sourceName ?? "?"} (HTTP ${entry.status ?? "?"})`;
    case "report":
      return tr
        ? `Rapor hazır: ${entry.title ?? ""}`
        : `Report ready: ${entry.title ?? ""}`;
    default:
      return text;
  }
}

/** Parse "90m", "2h", "1d" or an ISO date into epoch ms; null if unusable. */
export function parseSince(value: string, now = Date.now()): number | null {
  const relative = /^(\d+)\s*(m|h|d)$/i.exec(value.trim());
  if (relative) {
    const amount = parseInt(relative[1], 10);
    const unit = relative[2].toLowerCase();
    const ms = unit === "m" ? 60_000 : unit === "h" ? 3_600_000 : 86_400_000;
    return now - amount * ms;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}
