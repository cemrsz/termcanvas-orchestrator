import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Sparkles, X } from "lucide-react";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";
import { useT } from "../../i18n/useT";
import { useAiConnectorStore } from "../../stores/aiConnectorStore";
import { useAiHubStore, type AiHubTab } from "../../stores/aiHubStore";
import { ConnectorsTab } from "./ConnectorsTab";

/**
 * AI Hub: every AI the canvas can talk to in one place — connectors (keys,
 * CLIs, models), a council to ask several at once, and the live feed of what
 * the AIs say to each other.
 */
export function AiHubModal() {
  const t = useT();
  const open = useAiHubStore((state) => state.open);
  const tab = useAiHubStore((state) => state.tab);
  const setTab = useAiHubStore((state) => state.setTab);
  const closeHub = useAiHubStore((state) => state.closeHub);
  const refresh = useAiConnectorStore((state) => state.refresh);
  const panelRef = useRef<HTMLDivElement>(null);
  useBodyScrollLock(open);

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeHub();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, closeHub]);

  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  if (!open) return null;

  const tabs: { id: AiHubTab; label: string }[] = [
    { id: "connectors", label: t["ai.hub.tab.connectors"] },
  ];

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t["ai.hub.title"]}
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-[var(--scrim)] tc-enter-fade-up"
      onClick={closeHub}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className="flex h-[min(780px,88vh)] w-[min(1040px,94vw)] flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg)] shadow-xl outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3">
          <Sparkles size={16} aria-hidden="true" style={{ color: "var(--accent)" }} />
          <div className="flex min-w-0 flex-col">
            <span className="tc-display" style={{ fontSize: "15px" }}>
              {t["ai.hub.title"]}
            </span>
            <span className="tc-caption truncate">{t["ai.hub.subtitle"]}</span>
          </div>
          <nav role="tablist" aria-label={t["ai.hub.title"]} className="ml-auto flex gap-1">
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                className={`tc-meta rounded-md px-3 py-1.5 transition-colors ${
                  tab === item.id
                    ? "bg-[var(--surface-hover)] text-[var(--text-primary)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
                onClick={() => setTab(item.id)}
              >
                {item.label}
              </button>
            ))}
          </nav>
          <button
            type="button"
            aria-label={t.close}
            className="ml-2 inline-flex h-7 w-7 items-center justify-center rounded text-[var(--text-faint)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-secondary)]"
            onClick={closeHub}
          >
            <X size={14} />
          </button>
        </header>
        <div role="tabpanel" className="min-h-0 flex-1 overflow-y-auto p-4">
          {tab === "connectors" && <ConnectorsTab />}
        </div>
      </div>
    </div>,
    document.body,
  );
}
