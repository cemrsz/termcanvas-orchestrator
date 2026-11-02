import { useEffect, useMemo } from "react";
import { create } from "zustand";
import { Copy, LoaderCircle, Send, Sparkles } from "lucide-react";
import {
  getAiConnector,
  sortedAiConnectors,
  type AiConnectorId,
  type AiConnectorStatus,
  type AiTransport,
} from "../../../shared/ai-connectors";
import { useT } from "../../i18n/useT";
import { invokeFromUi, useAiConnectorStore } from "../../stores/aiConnectorStore";

interface CouncilAnswer {
  connector: AiConnectorId;
  transport: AiTransport;
  status: "pending" | "done" | "error";
  text: string;
  latencyMs?: number;
  model?: string;
}

interface CouncilStore {
  question: string;
  selected: Partial<Record<AiConnectorId, AiTransport>>;
  answers: CouncilAnswer[];
  synthesis: CouncilAnswer | null;
  setQuestion: (question: string) => void;
  toggle: (id: AiConnectorId, transport: AiTransport) => void;
  setTransport: (id: AiConnectorId, transport: AiTransport) => void;
  setAnswers: (answers: CouncilAnswer[]) => void;
  updateAnswer: (connector: AiConnectorId, patch: Partial<CouncilAnswer>) => void;
  setSynthesis: (synthesis: CouncilAnswer | null) => void;
}

/** Kept outside the modal so the last council survives closing the hub. */
const useCouncilStore = create<CouncilStore>((set) => ({
  question: "",
  selected: {},
  answers: [],
  synthesis: null,
  setQuestion: (question) => set({ question }),
  toggle: (id, transport) =>
    set((state) => {
      const selected = { ...state.selected };
      if (selected[id]) delete selected[id];
      else selected[id] = transport;
      return { selected };
    }),
  setTransport: (id, transport) =>
    set((state) => ({ selected: { ...state.selected, [id]: transport } })),
  setAnswers: (answers) => set({ answers, synthesis: null }),
  updateAnswer: (connector, patch) =>
    set((state) => ({
      answers: state.answers.map((answer) =>
        answer.connector === connector ? { ...answer, ...patch } : answer,
      ),
    })),
  setSynthesis: (synthesis) => set({ synthesis }),
}));

/** Transports this connector can use right now, best first. */
function usableTransports(status: AiConnectorStatus | undefined): AiTransport[] {
  if (!status) return [];
  const transports: AiTransport[] = [];
  if (status.apiReady) transports.push("api");
  if (status.cli?.installed) transports.push("cli");
  return transports;
}

function feedParty(connector: AiConnectorId) {
  const plugin = getAiConnector(connector);
  return {
    kind: "model" as const,
    id: `hub-${connector}`,
    name: plugin?.name ?? connector,
    type: connector,
  };
}

function AnswerCard({ answer, title }: { answer: CouncilAnswer; title?: string }) {
  const t = useT();
  const plugin = getAiConnector(answer.connector);
  const color = plugin?.color ?? "var(--accent)";
  return (
    <article
      className="flex min-h-[140px] flex-col gap-2 rounded-lg border bg-[var(--surface)] p-3"
      style={{ borderColor: `color-mix(in srgb, ${color} 40%, var(--border))` }}
    >
      <header className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="inline-block h-2 w-2 rounded-full"
          style={{ background: color }}
        />
        <span className="text-[13px] font-semibold text-[var(--text-primary)]">
          {title ?? plugin?.name}
        </span>
        <span className="tc-caption uppercase">{answer.transport}</span>
        {answer.status === "done" && (
          <span className="tc-caption ml-auto">
            {answer.latencyMs !== undefined && `${(answer.latencyMs / 1000).toFixed(1)}s · `}
            {answer.model}
          </span>
        )}
        {answer.status === "done" && (
          <button
            type="button"
            title={t["ai.hub.copy"]}
            aria-label={t["ai.hub.copy"]}
            className="rounded p-1 text-[var(--text-faint)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
            onClick={() => void navigator.clipboard?.writeText(answer.text)}
          >
            <Copy size={11} />
          </button>
        )}
      </header>
      {answer.status === "pending" ? (
        <div className="tc-meta flex flex-1 items-center justify-center gap-2 text-[var(--text-muted)]">
          <LoaderCircle size={14} className="animate-spin" style={{ color }} />
          {t["ai.node.thinking"]}
        </div>
      ) : (
        <div
          className="tc-meta flex-1 select-text whitespace-pre-wrap break-words"
          style={{ color: answer.status === "error" ? "var(--red)" : "var(--text-primary)" }}
        >
          {answer.text}
        </div>
      )}
    </article>
  );
}

export function CouncilTab() {
  const t = useT();
  const statuses = useAiConnectorStore((state) => state.statuses);
  const council = useCouncilStore();
  const plugins = sortedAiConnectors();

  const available = useMemo(
    () =>
      plugins
        .map((plugin) => ({ plugin, transports: usableTransports(statuses[plugin.id]) }))
        .filter((entry) => entry.transports.length > 0),
    [plugins, statuses],
  );

  // First visit: preselect the ready featured connectors (Claude, Gemini, ChatGPT).
  useEffect(() => {
    if (Object.keys(council.selected).length > 0) return;
    for (const { plugin, transports } of available) {
      if (plugin.featured) council.toggle(plugin.id, transports[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [available.length]);

  const selectedIds = Object.keys(council.selected) as AiConnectorId[];
  const running = council.answers.some((answer) => answer.status === "pending");
  const synthesizing = council.synthesis?.status === "pending";
  const doneAnswers = council.answers.filter((answer) => answer.status === "done");

  const ask = async () => {
    const question = council.question.trim();
    if (!question || selectedIds.length === 0 || running) return;
    council.setAnswers(
      selectedIds.map((connector) => ({
        connector,
        transport: council.selected[connector]!,
        status: "pending",
        text: "",
      })),
    );
    await Promise.all(
      selectedIds.map(async (connector) => {
        const outcome = await invokeFromUi({
          connector,
          transport: council.selected[connector]!,
          prompt: question,
          feedAs: feedParty(connector),
          label: "council",
        });
        useCouncilStore.getState().updateAnswer(
          connector,
          outcome.ok
            ? { status: "done", text: outcome.text, latencyMs: outcome.latencyMs, model: outcome.model }
            : { status: "error", text: outcome.error },
        );
      }),
    );
  };

  const synthesize = async (connector: AiConnectorId, transport: AiTransport) => {
    const answers = useCouncilStore.getState().answers.filter((a) => a.status === "done");
    const prompt = [
      t["ai.hub.council.synthesisPrompt"],
      "",
      `Question: ${council.question.trim()}`,
      "",
      ...answers.map(
        (answer) => `--- ${getAiConnector(answer.connector)?.name}:\n${answer.text}`,
      ),
    ].join("\n");
    council.setSynthesis({ connector, transport, status: "pending", text: "" });
    const outcome = await invokeFromUi({
      connector,
      transport,
      prompt,
      feedAs: feedParty(connector),
      label: "council · synthesis",
    });
    useCouncilStore.getState().setSynthesis(
      outcome.ok
        ? { connector, transport, status: "done", text: outcome.text, latencyMs: outcome.latencyMs, model: outcome.model }
        : { connector, transport, status: "error", text: outcome.error },
    );
  };

  const synthesizer = available.find(({ plugin }) => council.selected[plugin.id]) ?? available[0];

  return (
    <div className="flex flex-col gap-4">
      <p className="tc-meta">{t["ai.hub.council.intro"]}</p>

      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t["ai.hub.council.who"]}>
        <span className="tc-eyebrow mr-1">{t["ai.hub.council.who"]}</span>
        {available.length === 0 && (
          <span className="tc-meta" style={{ color: "var(--amber)" }}>
            {t["ai.hub.council.noneReady"]}
          </span>
        )}
        {available.map(({ plugin, transports }) => {
          const transport = council.selected[plugin.id];
          const on = !!transport;
          return (
            <span
              key={plugin.id}
              className="inline-flex items-center overflow-hidden rounded-full border"
              style={{
                borderColor: on ? plugin.color : "var(--border)",
                background: on ? `color-mix(in srgb, ${plugin.color} 14%, transparent)` : undefined,
              }}
            >
              <button
                type="button"
                aria-pressed={on}
                className="tc-meta inline-flex items-center gap-1.5 px-2.5 py-1"
                style={{ color: on ? "var(--text-primary)" : "var(--text-muted)" }}
                onClick={() => council.toggle(plugin.id, transports[0])}
              >
                <span
                  aria-hidden="true"
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: plugin.color, opacity: on ? 1 : 0.5 }}
                />
                {plugin.name}
              </button>
              {on && transports.length > 1 && (
                <button
                  type="button"
                  title={t["ai.hub.council.switchTransport"]}
                  className="tc-caption border-l px-1.5 py-1 uppercase"
                  style={{ borderColor: plugin.color, color: "var(--text-secondary)" }}
                  onClick={() =>
                    council.setTransport(plugin.id, transport === "api" ? "cli" : "api")
                  }
                >
                  {transport}
                </button>
              )}
            </span>
          );
        })}
      </div>

      <div className="flex items-end gap-2">
        <textarea
          rows={3}
          value={council.question}
          placeholder={t["ai.hub.council.placeholder"]}
          aria-label={t["ai.hub.council.placeholder"]}
          className="tc-meta min-h-[72px] flex-1 resize-y rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text-primary)] outline-none focus:border-[var(--text-secondary)]"
          onChange={(e) => council.setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void ask();
            }
          }}
        />
        <button
          type="button"
          disabled={!council.question.trim() || selectedIds.length === 0 || running}
          className="tc-meta inline-flex h-9 items-center gap-1.5 rounded-md px-3 font-medium disabled:cursor-not-allowed disabled:opacity-40"
          style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}
          onClick={() => void ask()}
        >
          {running ? <LoaderCircle size={13} className="animate-spin" /> : <Send size={13} />}
          {t["ai.hub.council.ask"](selectedIds.length)}
        </button>
      </div>

      {council.answers.length > 0 && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {council.answers.map((answer) => (
            <AnswerCard key={answer.connector} answer={answer} />
          ))}
        </div>
      )}

      {doneAnswers.length >= 2 && !running && synthesizer && (
        <div className="flex flex-col gap-2">
          {!council.synthesis && (
            <button
              type="button"
              className="tc-meta inline-flex items-center gap-1.5 self-start rounded-md border border-[var(--border)] px-3 py-1.5 text-[var(--text-secondary)] hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]"
              disabled={synthesizing}
              onClick={() =>
                void synthesize(synthesizer.plugin.id, council.selected[synthesizer.plugin.id] ?? synthesizer.transports[0])
              }
            >
              <Sparkles size={12} />
              {t["ai.hub.council.synthesize"](synthesizer.plugin.name)}
            </button>
          )}
          {council.synthesis && (
            <AnswerCard answer={council.synthesis} title={t["ai.hub.council.synthesisTitle"]} />
          )}
        </div>
      )}
    </div>
  );
}
