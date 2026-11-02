import { useEffect, useId, useRef, useState } from "react";
import {
  ExternalLink,
  KeyRound,
  List,
  LoaderCircle,
  Play,
  Plus,
  RefreshCw,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import {
  sortedAiConnectors,
  type AiConnectorPlugin,
  type AiConnectorStatus,
} from "../../../shared/ai-connectors";
import { useT } from "../../i18n/useT";
import {
  invokeFromUi,
  modelSuggestions,
  useAiConnectorStore,
} from "../../stores/aiConnectorStore";
import { useAiHubStore } from "../../stores/aiHubStore";
import {
  addAiNodeInScene,
  visibleCanvasCenter,
} from "../../actions/orchestrationSceneActions";
import type { AiTransport } from "../../../shared/ai-connectors";

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
        <span className="tc-eyebrow w-12 shrink-0">API</span>
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

const smallButton =
  "tc-meta inline-flex items-center gap-1 rounded border border-[var(--border)] px-2 py-1 text-[var(--text-secondary)] hover:border-[var(--border-hover)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-40";

/** A text field that saves on Enter or when it loses focus. */
function SavingInput({
  value,
  placeholder,
  list,
  label,
  onSave,
}: {
  value: string;
  placeholder: string;
  list?: string;
  label: string;
  onSave: (next: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => {
    if (draft.trim() !== value.trim()) onSave(draft.trim());
  };
  return (
    <input
      className="tc-meta tc-mono min-w-0 flex-1 rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-[var(--text-primary)] outline-none focus:border-[var(--text-secondary)]"
      value={draft}
      list={list}
      spellCheck={false}
      placeholder={placeholder}
      aria-label={label}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
      }}
    />
  );
}

/** CLI, server URL, default model, test and add-to-canvas for one connector. */
function ConnectorDetails({ plugin }: { plugin: AiConnectorPlugin }) {
  const t = useT();
  const datalistId = useId();
  const status = useAiConnectorStore((state) => state.statuses[plugin.id]);
  const fetched = useAiConnectorStore((state) => state.models[plugin.id]);
  const checking = useAiConnectorStore((state) => !!state.checkingCli[plugin.id]);
  const checkCli = useAiConnectorStore((state) => state.checkCli);
  const setConfig = useAiConnectorStore((state) => state.setConfig);
  const fetchModels = useAiConnectorStore((state) => state.fetchModels);
  const closeHub = useAiHubStore((state) => state.closeHub);
  const [modelNote, setModelNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [fetching, setFetching] = useState(false);
  const [testing, setTesting] = useState<AiTransport | null>(null);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (plugin.cli && status && !status.cli) void checkCli(plugin.id);
  }, [plugin, status, checkCli]);

  const cli = status?.cli ?? null;
  const showServer = plugin.local || plugin.id === "custom";

  const test = async (transport: AiTransport) => {
    setTesting(transport);
    setResult(null);
    try {
      const outcome = await invokeFromUi({
        connector: plugin.id,
        transport,
        prompt: t["ai.node.testPrompt"],
        feedAs: { kind: "model", id: `hub-${plugin.id}`, name: plugin.name, type: plugin.id },
        label: "test",
      });
      setResult(
        outcome.ok
          ? {
              ok: true,
              text: `${outcome.text} · ${(outcome.latencyMs / 1000).toFixed(1)}s · ${outcome.model}`,
            }
          : { ok: false, text: outcome.error },
      );
    } finally {
      setTesting(null);
    }
  };

  return (
    <>
      {plugin.cli && (
        <div className="flex items-center gap-2">
          <span className="tc-eyebrow w-12 shrink-0">CLI</span>
          <StatusDot ok={cli ? cli.installed : null} />
          <span className="tc-meta min-w-0 flex-1 truncate" title={cli?.path ?? undefined}>
            {checking
              ? t["ai.hub.cliChecking"]
              : !cli
                ? t["ai.hub.cliUnknown"]
                : cli.installed
                  ? t["ai.hub.cliReady"](plugin.cli.label, cli.version ?? "")
                  : t["ai.hub.cliMissing"](plugin.cli.install)}
          </span>
          <button
            type="button"
            className={smallButton}
            disabled={checking}
            title={t["ai.hub.cliCheck"]}
            aria-label={t["ai.hub.cliCheck"]}
            onClick={() => void checkCli(plugin.id)}
          >
            <RefreshCw size={11} className={checking ? "animate-spin" : undefined} />
          </button>
        </div>
      )}

      {showServer && (
        <div className="flex items-center gap-2">
          <span className="tc-eyebrow w-12 shrink-0">URL</span>
          <SavingInput
            value={status?.baseURLOverride ?? ""}
            placeholder={plugin.baseURL || "http://localhost:8000/v1"}
            label={t["ai.hub.serverUrl"]}
            onSave={(next) => void setConfig(plugin.id, { baseURL: next || null })}
          />
        </div>
      )}

      <div className="flex items-center gap-2">
        <span className="tc-eyebrow w-12 shrink-0">{t["ai.node.model"]}</span>
        <SavingInput
          value={status?.modelOverride ?? ""}
          placeholder={plugin.defaultModel || t["ai.hub.serverDefault"]}
          list={datalistId}
          label={t["ai.hub.defaultModel"]}
          onSave={(next) => void setConfig(plugin.id, { model: next || null })}
        />
        <datalist id={datalistId}>
          {modelSuggestions(plugin.id, fetched).map((model) => (
            <option key={model} value={model} />
          ))}
        </datalist>
        <button
          type="button"
          className={smallButton}
          disabled={fetching || status?.apiReady === false}
          title={t["ai.hub.fetchModels"]}
          aria-label={t["ai.hub.fetchModels"]}
          onClick={async () => {
            setFetching(true);
            try {
              const outcome = await fetchModels(plugin.id);
              setModelNote(
                outcome.ok
                  ? { ok: true, text: t["ai.hub.modelsFound"](outcome.models.length) }
                  : { ok: false, text: outcome.error },
              );
            } finally {
              setFetching(false);
            }
          }}
        >
          {fetching ? <LoaderCircle size={11} className="animate-spin" /> : <List size={11} />}
        </button>
      </div>
      {modelNote && (
        <p
          className="tc-caption"
          style={{ color: modelNote.ok ? "var(--text-muted)" : "var(--red)" }}
        >
          {modelNote.text}
        </p>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
        <button
          type="button"
          className={smallButton}
          disabled={testing !== null || status?.apiReady === false}
          onClick={() => void test("api")}
        >
          {testing === "api" ? (
            <LoaderCircle size={11} className="animate-spin" />
          ) : (
            <Play size={11} />
          )}
          {t["ai.hub.testApi"]}
        </button>
        {plugin.cli && (
          <button
            type="button"
            className={smallButton}
            disabled={testing !== null || cli?.installed === false}
            onClick={() => void test("cli")}
          >
            {testing === "cli" ? (
              <LoaderCircle size={11} className="animate-spin" />
            ) : (
              <Play size={11} />
            )}
            {t["ai.hub.testCli"]}
          </button>
        )}
        <button
          type="button"
          className={`${smallButton} ml-auto`}
          style={{ borderColor: `color-mix(in srgb, ${plugin.color} 55%, var(--border))` }}
          onClick={() => {
            addAiNodeInScene(plugin.id, visibleCanvasCenter());
            closeHub();
          }}
        >
          <Plus size={11} />
          {t["ai.hub.addToCanvas"]}
        </button>
      </div>
      {result && (
        <p
          className="tc-caption line-clamp-3 rounded border-l-2 px-2 py-1"
          style={{
            borderColor: result.ok ? plugin.color : "var(--red)",
            color: result.ok ? "var(--text-secondary)" : "var(--red)",
          }}
          title={result.text}
        >
          {result.text}
        </p>
      )}
    </>
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
          >
            <ConnectorDetails plugin={plugin} />
          </ConnectorCard>
        ))}
      </div>
      <h3 className="tc-eyebrow">{t["ai.hub.moreProviders"]}</h3>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {others.map((plugin) => (
          <ConnectorCard
            key={plugin.id}
            plugin={plugin}
            highlighted={focusConnector === plugin.id}
          >
            <ConnectorDetails plugin={plugin} />
          </ConnectorCard>
        ))}
      </div>
    </div>
  );
}
