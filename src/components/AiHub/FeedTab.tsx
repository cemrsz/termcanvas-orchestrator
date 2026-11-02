import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Search, Trash2 } from "lucide-react";
import { getAiConnector } from "../../../shared/ai-connectors";
import type { CommsEntry, CommsKind, CommsParty } from "../../../shared/comms";
import { useT } from "../../i18n/useT";
import { useCommsStore } from "../../stores/commsStore";
import { TERMINAL_TYPE_CONFIG } from "../../terminal/terminalTypeConfig";
import { SOURCE_KIND_META } from "../../canvas/orchestrationFlow";

type Filter = "all" | "agents" | "models" | "sources" | "errors";

const FILTERS: Filter[] = ["all", "agents", "models", "sources", "errors"];

export function partyColor(party: CommsParty): string {
  if (party.kind === "user") return "var(--text-secondary)";
  if (party.kind === "model") {
    return getAiConnector(party.type ?? "")?.color ?? "var(--accent)";
  }
  if (party.kind === "source") {
    return (
      SOURCE_KIND_META[party.type as keyof typeof SOURCE_KIND_META]?.color ??
      "var(--text-secondary)"
    );
  }
  return TERMINAL_TYPE_CONFIG[party.type ?? ""]?.color ?? "var(--accent)";
}

function matchesFilter(entry: CommsEntry, filter: Filter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "agents":
      return entry.kind === "message" || entry.kind === "reply" || entry.kind === "brief";
    case "models":
      return entry.kind === "ask" || entry.kind === "answer";
    case "sources":
      return entry.kind === "read" || entry.kind === "trigger";
    case "errors":
      return entry.kind === "error";
  }
}

const KIND_TONE: Record<CommsKind, string> = {
  message: "var(--accent)",
  reply: "var(--green)",
  ask: "var(--cyan)",
  answer: "var(--green)",
  error: "var(--red)",
  read: "var(--text-muted)",
  trigger: "var(--amber)",
  brief: "var(--purple)",
};

function Party({ party }: { party: CommsParty }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <span
        aria-hidden="true"
        className="inline-block h-2 w-2 shrink-0 rounded-full"
        style={{ background: partyColor(party) }}
      />
      <span className="truncate font-medium text-[var(--text-primary)]">{party.name}</span>
    </span>
  );
}

function FeedRow({ entry }: { entry: CommsEntry }) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  const time = new Date(entry.at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const meta = entry.meta;
  const details = [
    meta?.label,
    meta?.latencyMs !== undefined ? `${(meta.latencyMs / 1000).toFixed(1)}s` : null,
    meta?.outputTokens ? `${meta.outputTokens} tok` : null,
    meta?.model,
    meta?.transport?.toUpperCase(),
    meta?.status !== undefined ? `HTTP ${meta.status}` : null,
  ].filter(Boolean);

  return (
    <li className="tc-row-hover flex gap-3 rounded-md px-2 py-2">
      <span className="tc-caption tc-mono w-[64px] shrink-0 pt-0.5">{time}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="tc-meta flex min-w-0 flex-wrap items-center gap-1.5">
          <Party party={entry.from} />
          <ArrowRight size={11} aria-hidden="true" className="shrink-0 text-[var(--text-faint)]" />
          <Party party={entry.to} />
          <span
            className="tc-caption rounded px-1.5 py-px uppercase"
            style={{
              color: KIND_TONE[entry.kind],
              background: `color-mix(in srgb, ${KIND_TONE[entry.kind]} 12%, transparent)`,
            }}
          >
            {t[`ai.feed.kind.${entry.kind}`]}
          </span>
          {details.length > 0 && (
            <span className="tc-caption truncate">{details.join(" · ")}</span>
          )}
        </div>
        {entry.text && (
          <button
            type="button"
            className={`tc-meta select-text whitespace-pre-wrap break-words text-left text-[var(--text-secondary)] ${expanded ? "" : "line-clamp-3"}`}
            style={{ color: entry.kind === "error" ? "var(--red)" : undefined }}
            title={expanded ? undefined : t["ai.feed.expand"]}
            onClick={() => setExpanded((value) => !value)}
          >
            {entry.text}
            {entry.truncated ? ` … (+${entry.truncated})` : ""}
          </button>
        )}
      </div>
    </li>
  );
}

export function FeedTab() {
  const t = useT();
  const entries = useCommsStore((state) => state.entries);
  const clear = useCommsStore((state) => state.clear);
  const setFeedOpen = useCommsStore((state) => state.setFeedOpen);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const listRef = useRef<HTMLUListElement>(null);
  const stickToBottom = useRef(true);

  useEffect(() => {
    setFeedOpen(true);
    return () => setFeedOpen(false);
  }, [setFeedOpen]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return entries.filter(
      (entry) =>
        matchesFilter(entry, filter) &&
        (!needle ||
          entry.text.toLowerCase().includes(needle) ||
          entry.from.name.toLowerCase().includes(needle) ||
          entry.to.name.toLowerCase().includes(needle)),
    );
  }, [entries, filter, query]);

  // Follow new messages while the user is at the bottom, like a chat.
  useEffect(() => {
    const list = listRef.current?.parentElement;
    if (list && stickToBottom.current) list.scrollTop = list.scrollHeight;
  }, [visible.length]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label={t["ai.feed.filter"]} className="flex gap-1">
          {FILTERS.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={filter === item}
              className={`tc-meta rounded-full border px-2.5 py-0.5 ${
                filter === item
                  ? "border-[var(--text-secondary)] text-[var(--text-primary)]"
                  : "border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
              onClick={() => setFilter(item)}
            >
              {t[`ai.feed.filter.${item}`]}
            </button>
          ))}
        </div>
        <label className="relative ml-auto">
          <Search
            size={11}
            aria-hidden="true"
            className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-faint)]"
          />
          <input
            value={query}
            placeholder={t["ai.feed.search"]}
            aria-label={t["ai.feed.search"]}
            className="tc-meta w-48 rounded border border-[var(--border)] bg-[var(--surface)] py-1 pl-6 pr-2 text-[var(--text-primary)] outline-none focus:border-[var(--text-secondary)]"
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <button
          type="button"
          disabled={entries.length === 0}
          className="tc-meta inline-flex items-center gap-1 rounded border border-[var(--border)] px-2 py-1 text-[var(--text-muted)] hover:border-[var(--red)] hover:text-[var(--red)] disabled:opacity-40"
          onClick={clear}
        >
          <Trash2 size={11} />
          {t["ai.feed.clear"]}
        </button>
      </div>

      <div
        className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1"
        onScroll={(e) => {
          const el = e.currentTarget;
          stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
        }}
      >
        {visible.length === 0 ? (
          <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-2 px-8 text-center">
            <span className="text-[13px] font-medium text-[var(--text-primary)]">
              {entries.length === 0 ? t["ai.feed.emptyTitle"] : t["ai.feed.noMatch"]}
            </span>
            {entries.length === 0 && (
              <span className="tc-meta max-w-[520px]">{t["ai.feed.emptyBody"]}</span>
            )}
          </div>
        ) : (
          <ul ref={listRef} className="flex flex-col">
            {visible.map((entry) => (
              <FeedRow key={entry.id} entry={entry} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
