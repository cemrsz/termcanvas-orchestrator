import { useCallback, useEffect, useId } from "react";
import type { NodeProps } from "@xyflow/react";
import { Sparkles, X } from "lucide-react";
import {
  getAiConnector,
  sortedAiConnectors,
  type AiConnectorStatus,
  type AiTransport,
} from "../../shared/ai-connectors";
import { useT } from "../i18n/useT";
import { useOrchestrationStore, pipeOtherEnd } from "../stores/orchestrationStore";
import { useProjectStore } from "../stores/projectStore";
import {
  modelSuggestions,
  useAiConnectorStore,
} from "../stores/aiConnectorStore";
import { OrchestrationInPort, type SourceFlowNode } from "./orchestrationFlow";

type Translate = ReturnType<typeof useT>;

/** One line telling whether this node can be called, and how. */
function readiness(
  t: Translate,
  transport: AiTransport,
  status: AiConnectorStatus | undefined,
  local: boolean,
): { ok: boolean | null; text: string } {
  if (!status) return { ok: null, text: "…" };
  if (transport === "cli") {
    if (!status.cli) return { ok: null, text: t["ai.node.cliCheck"] };
    return status.cli.installed
      ? { ok: true, text: t["ai.node.cliReady"](status.cli.version ?? "") }
      : { ok: false, text: t["ai.node.cliMissing"] };
  }
  if (status.hasStoredKey && status.keyHint) {
    return { ok: true, text: t["ai.node.keySaved"](status.keyHint) };
  }
  if (status.envKey) return { ok: true, text: t["ai.node.keyEnv"](status.envKey) };
  if (local || status.apiReady) return { ok: true, text: t["ai.node.local"] };
  return { ok: false, text: t["ai.node.noKey"] };
}

/**
 * An AI model on the canvas (Claude, Gemini, ChatGPT…). Agents wired to it
 * can consult it through their bridge; it answers over its API or CLI.
 */
export function AiNode({ data }: NodeProps<SourceFlowNode>) {
  const t = useT();
  const datalistId = useId();
  const source = useOrchestrationStore(
    useCallback((state) => state.sources[data.sourceId], [data.sourceId]),
  );
  const wiredIds = useOrchestrationStore(
    useCallback(
      (state) => {
        const ids: string[] = [];
        for (const pipe of state.pipes) {
          const other = pipeOtherEnd(pipe, data.sourceId);
          if (other) ids.push(other);
        }
        for (const link of state.links) {
          if (link.targetId === data.sourceId) ids.push(link.orchestratorId);
        }
        return ids.join("|");
      },
      [data.sourceId],
    ),
  );
  const wiredNames = useProjectStore(
    useCallback(
      (state) => {
        if (!wiredIds) return "";
        const wanted = new Set(wiredIds.split("|"));
        const names: string[] = [];
        for (const project of state.projects) {
          for (const worktree of project.worktrees) {
            for (const terminal of worktree.terminals) {
              if (wanted.has(terminal.id)) {
                names.push(terminal.customTitle?.trim() || terminal.title);
              }
            }
          }
        }
        return names.join(", ");
      },
      [wiredIds],
    ),
  );
  const updateSource = useOrchestrationStore((state) => state.updateSource);
  const updateAiConfig = useOrchestrationStore((state) => state.updateAiConfig);
  const removeSource = useOrchestrationStore((state) => state.removeSource);
  const connector = source?.ai?.connector;
  const status = useAiConnectorStore((state) =>
    connector ? state.statuses[connector] : undefined,
  );
  const fetched = useAiConnectorStore((state) =>
    connector ? state.models[connector] : undefined,
  );
  const ensureLoaded = useAiConnectorStore((state) => state.ensureLoaded);
  const checkCli = useAiConnectorStore((state) => state.checkCli);

  useEffect(() => {
    ensureLoaded();
  }, [ensureLoaded]);

  const transport = source?.ai?.transport;
  useEffect(() => {
    // Learn whether the CLI is installed the first time a node needs it.
    if (connector && transport === "cli" && status && !status.cli) {
      void checkCli(connector);
    }
  }, [connector, transport, status, checkCli]);

  if (!source || !source.ai) return null;
  const plugin = getAiConnector(source.ai.connector);
  if (!plugin) return null;
  const color = plugin.color;
  const ready = readiness(t, source.ai.transport, status, !!plugin.local);
  const stop = (event: React.SyntheticEvent) => event.stopPropagation();

  return (
    <div
      data-scene-box-select-block
      className="flex flex-col overflow-visible rounded-lg border bg-[var(--surface)]"
      style={{
        borderColor: `color-mix(in srgb, ${color} 60%, var(--border))`,
        boxShadow: "var(--shadow-elev-1)",
      }}
    >
      <OrchestrationInPort color={color} />
      <div
        className="flex cursor-grab select-none items-center gap-2 rounded-t-lg border-b border-[var(--border)] px-2.5 py-1.5 active:cursor-grabbing"
        style={{ background: `color-mix(in srgb, ${color} 16%, var(--bg))` }}
      >
        <Sparkles size={13} strokeWidth={1.8} style={{ color }} aria-hidden="true" />
        <input
          className="nodrag tc-meta min-w-0 flex-1 bg-transparent font-medium text-[var(--text-primary)] outline-none"
          value={source.name}
          placeholder={plugin.name}
          aria-label={t["ai.node.provider"]}
          onChange={(e) => updateSource(source.id, { name: e.target.value })}
          onMouseDown={stop}
        />
        <select
          className="nodrag tc-caption max-w-[110px] cursor-pointer rounded border border-[var(--border)] bg-[var(--surface)] px-1 py-0.5 outline-none hover:border-[var(--border-hover)]"
          // .tc-caption sets a faint color; the picker must stay readable.
          style={{ color: "var(--text-secondary)" }}
          value={plugin.id}
          title={t["ai.node.provider"]}
          aria-label={t["ai.node.provider"]}
          onMouseDown={stop}
          onChange={(e) =>
            updateAiConfig(source.id, {
              connector: e.target.value as typeof plugin.id,
              model: "",
              transport:
                source.ai?.transport === "cli" && getAiConnector(e.target.value)?.cli
                  ? "cli"
                  : "api",
            })
          }
        >
          {sortedAiConnectors().map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="nodrag shrink-0 rounded p-0.5 text-[var(--text-faint)] hover:bg-[var(--border)] hover:text-[var(--text-primary)]"
          title={t["ai.node.remove"]}
          aria-label={t["ai.node.remove"]}
          onMouseDown={stop}
          onClick={(e) => {
            e.stopPropagation();
            removeSource(source.id);
          }}
        >
          <X size={11} strokeWidth={1.8} />
        </button>
      </div>

      <div className="flex flex-col gap-2 p-2.5">
        <label className="flex items-center gap-2">
          <span className="tc-caption w-12 shrink-0" style={{ color: "var(--text-muted)" }}>
            {t["ai.node.model"]}
          </span>
          <input
            className="nodrag tc-meta tc-mono min-w-0 flex-1 rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-[var(--text-primary)] outline-none focus:border-[var(--text-secondary)]"
            value={source.ai.model}
            list={datalistId}
            spellCheck={false}
            placeholder={
              source.ai.transport === "cli"
                ? t["ai.node.cliDefault"]
                : t["ai.node.modelDefault"](status?.model ?? plugin.defaultModel)
            }
            onMouseDown={stop}
            onChange={(e) => updateAiConfig(source.id, { model: e.target.value })}
          />
          <datalist id={datalistId}>
            {modelSuggestions(plugin.id, fetched).map((model) => (
              <option key={model} value={model} />
            ))}
          </datalist>
        </label>

        <div className="flex items-center gap-2">
          <span className="tc-caption w-12 shrink-0" style={{ color: "var(--text-muted)" }}>
            {t["ai.node.via"]}
          </span>
          <div
            role="radiogroup"
            aria-label={t["ai.node.via"]}
            className="nodrag flex overflow-hidden rounded border border-[var(--border)]"
          >
            {(["api", "cli"] as const).map((option) => {
              const disabled = option === "cli" && !plugin.cli;
              const active = source.ai?.transport === option;
              return (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={disabled}
                  title={
                    disabled
                      ? t["ai.node.noCli"](plugin.name)
                      : option === "cli"
                        ? plugin.cli?.label
                        : plugin.baseURL || undefined
                  }
                  className="tc-caption px-2 py-0.5 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                  style={
                    active
                      ? { background: color, color: "#fff" }
                      : { color: "var(--text-secondary)" }
                  }
                  onMouseDown={stop}
                  onClick={() => updateAiConfig(source.id, { transport: option })}
                >
                  {option === "api" ? t["ai.node.api"] : t["ai.node.cli"]}
                </button>
              );
            })}
          </div>
          <span
            className="tc-caption flex min-w-0 items-center gap-1 truncate"
            style={{
              color:
                ready.ok === false
                  ? "var(--red)"
                  : ready.ok
                    ? "var(--text-secondary)"
                    : "var(--text-faint)",
            }}
            title={ready.text}
          >
            <span
              aria-hidden="true"
              className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
              style={{
                background:
                  ready.ok === false
                    ? "var(--red)"
                    : ready.ok
                      ? "var(--green)"
                      : "var(--border-hover)",
              }}
            />
            {ready.text}
          </span>
        </div>

        <textarea
          className="nodrag nowheel tc-meta w-full resize-none rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-[var(--text-primary)] outline-none focus:border-[var(--text-secondary)]"
          rows={2}
          value={source.description}
          placeholder={t["ai.node.rolePlaceholder"]}
          onMouseDown={stop}
          onChange={(e) => updateSource(source.id, { description: e.target.value })}
        />

        <div className="tc-caption flex items-center gap-1.5 text-[var(--text-faint)]">
          <span
            aria-hidden="true"
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ background: wiredIds ? color : "var(--border-hover)" }}
          />
          <span className="truncate">
            {wiredNames
              ? t["ai.node.wired"](wiredNames)
              : wiredIds
                ? t["ai.node.wiredCount"](wiredIds.split("|").length)
                : t["ai.node.notWired"]}
          </span>
        </div>
      </div>
    </div>
  );
}
