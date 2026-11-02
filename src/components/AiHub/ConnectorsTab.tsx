import { useEffect, useRef, useState } from "react";
import { ExternalLink, KeyRound, ShieldAlert, Trash2 } from "lucide-react";
import {
  sortedAiConnectors,
  type AiConnectorPlugin,
  type AiConnectorStatus,
} from "../../../shared/ai-connectors";
import { useT } from "../../i18n/useT";
import { useAiConnectorStore } from "../../stores/aiConnectorStore";
import { useAiHubStore } from "../../stores/aiHubStore";

type Translate = ReturnType<typeof useT>;

export function StatusDot({ ok }: { ok: boolean | null }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
      style={{
        background:
          ok === null ? "var(--border-hover)" : ok ? "var(--green)" : "var(--red)",
      }}
    />
  );
}

function apiState(
  t: Translate,
  plugin: AiConnectorPlugin,
  status: AiConnectorStatus | undefined,
): { ok: boolean | null; text: string } {
  if (!status) return { ok: null, text: "…" };
  if (status.hasStoredKey && status.keyHint) {
    return { ok: true, text: t["ai.hub.keySaved"](status.keyHint) };
  }
  if (status.envKey) return { ok: true, text: t["ai.hub.keyEnv"](status.envKey) };
  if (!plugin.keyRequired) {
    return status.apiReady
      ? { ok: true, text: t["ai.hub.noKeyNeeded"] }
      : { ok: false, text: t["ai.hub.needsUrl"] };
  }
  return { ok: false, text: t["ai.hub.noKey"] };
}

/** Save / replace / remove the API key; the key never comes back from main. */
function KeyEditor({
  plugin,
  status,
}: {
  plugin: AiConnectorPlugin;
  status: AiConnectorStatus | undefined;
}) {
  const t = useT();
  const setKey = useAiConnectorStore((state) => state.setKey);
  const clearKey = useAiConnectorStore((state) => state.clearKey);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!draft.trim()) return;
    setBusy(true);
    try {
      await setKey(plugin.id, draft);
      setDraft("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <div className="relative min-w-0 flex-1">
        <KeyRound
          size={11}
          aria-hidden="true"
          className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-faint)]"
        />
        <input
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={draft}
          placeholder={
            status?.hasStoredKey ? t["ai.hub.replaceKey"] : plugin.keyPlaceholder
          }
          aria-label={t["ai.hub.apiKeyFor"](plugin.name)}
          className="tc-meta tc-mono w-full rounded border border-[var(--border)] bg-[var(--bg)] py-1 pl-6 pr-2 text-[var(--text-primary)] outline-none focus:border-[var(--text-secondary)]"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void save();
          }}
        />
      </div>
      <button
        type="button"
        disabled={!draft.trim() || busy}
        className="tc-meta rounded border border-[var(--border)] px-2 py-1 text-[var(--text-secondary)] hover:border-[var(--border-hover)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-40"
        onClick={() => void save()}
      >
        {t.save}
      </button>
      {status?.hasStoredKey && (
        <button
          type="button"
          title={t["ai.hub.removeKey"]}
          aria-label={t["ai.hub.removeKey"]}
          className="rounded border border-[var(--border)] p-1 text-[var(--text-faint)] hover:border-[var(--red)] hover:text-[var(--red)]"
          onClick={() => void clearKey(plugin.id)}
        >
          <Trash2 size={12} />
        </button>
      )}
    </div>
  );
}

export function ConnectorCard({
  plugin,
  highlighted,
  children,
}: {
  plugin: AiConnectorPlugin;
  highlighted: boolean;
  children?: React.ReactNode;
}) {
  const t = useT();
  const status = useAiConnectorStore((state) => state.statuses[plugin.id]);
  const ref = useRef<HTMLElement>(null);
  const api = apiState(t, plugin, status);

  useEffect(() => {
    if (highlighted) ref.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [highlighted]);

  return (
    <section
      ref={ref}
      aria-label={plugin.name}
      className="flex flex-col gap-2 rounded-lg border bg-[var(--surface)] p-3 transition-shadow"
      style={{
        borderColor: highlighted
          ? plugin.color
          : `color-mix(in srgb, ${plugin.color} 30%, var(--border))`,
        boxShadow: highlighted ? `0 0 0 1px ${plugin.color}` : undefined,
      }}
    >
      <header className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ background: plugin.color }}
        />
        <span className="text-[13px] font-semibold text-[var(--text-primary)]">
          {plugin.name}
        </span>
        <span className="tc-caption">{plugin.vendor}</span>
        {plugin.keyUrl && (
          <a
            href={plugin.keyUrl}
            target="_blank"
            rel="noreferrer"
            className="tc-caption ml-auto inline-flex items-center gap-1 hover:underline"
            style={{ color: "var(--text-muted)" }}
          >
            {t["ai.hub.getKey"]}
            <ExternalLink size={10} aria-hidden="true" />
          </a>
        )}
      </header>

      <div className="flex items-center gap-2">
        <span className="tc-eyebrow w-8 shrink-0">API</span>
        <StatusDot ok={api.ok} />
        <span
          className="tc-meta truncate"
          style={{ color: api.ok === false ? "var(--red)" : undefined }}
        >
          {api.text}
        </span>
      </div>
      {/* Local servers need no key; custom endpoints often do. */}
      {!plugin.local && <KeyEditor plugin={plugin} status={status} />}
      {status?.insecureStorage && (
        <p
          className="tc-caption flex items-start gap-1.5"
          style={{ color: "var(--amber)" }}
        >
          <ShieldAlert size={12} className="mt-px shrink-0" aria-hidden="true" />
          {t["ai.hub.insecure"]}
        </p>
      )}
      {children}
    </section>
  );
}

export function ConnectorsTab() {
  const t = useT();
  const focusConnector = useAiHubStore((state) => state.focusConnector);
  const plugins = sortedAiConnectors();
  const featured = plugins.filter((plugin) => plugin.featured);
  const others = plugins.filter((plugin) => !plugin.featured);

  return (
    <div className="flex flex-col gap-4">
      <p className="tc-meta">{t["ai.hub.connectorsIntro"]}</p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {featured.map((plugin) => (
          <ConnectorCard
            key={plugin.id}
            plugin={plugin}
            highlighted={focusConnector === plugin.id}
          />
        ))}
      </div>
      <h3 className="tc-eyebrow">{t["ai.hub.moreProviders"]}</h3>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {others.map((plugin) => (
          <ConnectorCard
            key={plugin.id}
            plugin={plugin}
            highlighted={focusConnector === plugin.id}
          />
        ))}
      </div>
    </div>
  );
}
