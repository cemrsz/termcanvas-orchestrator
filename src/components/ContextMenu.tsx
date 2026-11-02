import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import { useT } from "../i18n/useT";

export type MenuItem =
  | {
      type?: "item";
      label: string;
      active?: boolean;
      danger?: boolean;
      /** Small colored dot before the label (e.g. an AI provider's color). */
      color?: string;
      hint?: string;
      onClick: () => void;
    }
  | { type: "separator" }
  | {
      type: "submenu";
      label: string;
      color?: string;
      items: MenuItem[];
    };

interface Props {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}

const VIEWPORT_MARGIN = 8;
const MENU_CLASS =
  "py-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-lg min-w-[160px]";
const FONT = { fontFamily: '"Geist Mono", monospace' };

function itemClass(active?: boolean, danger?: boolean) {
  return `flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] transition-colors duration-quick outline-none ${
    active
      ? "text-[var(--accent)] bg-[var(--accent)]/10"
      : danger
        ? "text-[var(--red)] hover:text-[var(--red-soft)] hover:bg-[var(--border)] focus:bg-[var(--border)]"
        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--border)] focus:bg-[var(--border)] focus:text-[var(--text-primary)]"
  }`;
}

function Dot({ color }: { color?: string }) {
  if (!color) return null;
  return (
    <span
      aria-hidden="true"
      className="inline-block h-2 w-2 shrink-0 rounded-full"
      style={{ background: color }}
    />
  );
}

/**
 * One level of the menu. Handles its own arrow-key navigation; a submenu
 * opens on hover, click, → or Enter and closes on ← (focus returns to its
 * parent item).
 */
function MenuList({
  items,
  onClose,
  onBack,
  autoFocus,
}: {
  items: MenuItem[];
  onClose: () => void;
  onBack?: () => void;
  autoFocus: boolean;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [focusSubmenu, setFocusSubmenu] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!autoFocus) return;
    const first = ownItems()[0];
    if (first) requestAnimationFrame(() => first.focus());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFocus]);

  useEffect(
    () => () => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
    },
    [],
  );

  function ownItems(): HTMLElement[] {
    const node = listRef.current;
    if (!node) return [];
    return Array.from(
      node.querySelectorAll<HTMLElement>(":scope > [data-menu-row] > [role='menuitem']"),
    );
  }

  const openSubmenu = (index: number, withFocus: boolean) => {
    setFocusSubmenu(withFocus);
    setOpenIndex(index);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const menuitems = ownItems();
    const active = document.activeElement as HTMLElement | null;
    const idx = active ? menuitems.indexOf(active) : -1;
    if (idx === -1) return; // The key belongs to a submenu.
    if (e.key === "ArrowDown") {
      e.preventDefault();
      menuitems[(idx + 1) % menuitems.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      menuitems[(idx - 1 + menuitems.length) % menuitems.length]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      menuitems[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      menuitems[menuitems.length - 1]?.focus();
    } else if (e.key === "ArrowRight" || e.key === "Enter" || e.key === " ") {
      const index = Number(active?.dataset.index);
      if (items[index]?.type === "submenu") {
        e.preventDefault();
        e.stopPropagation();
        openSubmenu(index, true);
      }
    } else if (e.key === "ArrowLeft" && onBack) {
      e.preventDefault();
      e.stopPropagation();
      onBack();
    }
  };

  return (
    <div ref={listRef} onKeyDown={handleKeyDown} role="none">
      {items.map((item, i) => {
        if (item.type === "separator") {
          return (
            <div
              key={`sep-${i}`}
              role="separator"
              className="my-1 border-t border-[var(--border)]"
            />
          );
        }
        if (item.type === "submenu") {
          const open = openIndex === i;
          return (
            <div
              key={`${item.label}-${i}`}
              data-menu-row
              className="relative"
              onMouseEnter={() => {
                if (hoverTimer.current) clearTimeout(hoverTimer.current);
                hoverTimer.current = setTimeout(() => openSubmenu(i, false), 90);
              }}
              onMouseLeave={() => {
                if (hoverTimer.current) clearTimeout(hoverTimer.current);
                hoverTimer.current = setTimeout(
                  () => setOpenIndex((current) => (current === i ? null : current)),
                  160,
                );
              }}
            >
              <button
                role="menuitem"
                tabIndex={-1}
                data-index={i}
                aria-haspopup="menu"
                aria-expanded={open}
                className={`${itemClass(open)} justify-between`}
                style={FONT}
                onClick={() => openSubmenu(i, true)}
              >
                <span className="flex items-center gap-2">
                  <Dot color={item.color} />
                  {item.label}
                </span>
                <ChevronRight size={12} aria-hidden="true" />
              </button>
              {open && (
                <SubMenu
                  items={item.items}
                  onClose={onClose}
                  autoFocus={focusSubmenu}
                  onBack={() => {
                    setOpenIndex(null);
                    ownItems()
                      .find((el) => el.dataset.index === String(i))
                      ?.focus();
                  }}
                />
              )}
            </div>
          );
        }
        return (
          <div key={`${item.label}-${i}`} data-menu-row>
            <button
              role="menuitem"
              tabIndex={-1}
              data-index={i}
              className={itemClass(item.active, item.danger)}
              style={FONT}
              onMouseEnter={() => setOpenIndex(null)}
              onClick={() => {
                item.onClick();
                onClose();
              }}
            >
              <Dot color={item.color} />
              <span className="flex-1">{item.label}</span>
              {item.hint && (
                <span className="text-[10px] text-[var(--text-faint)]">{item.hint}</span>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}

/** A nested menu beside its parent item; flips left near the screen edge. */
function SubMenu({
  items,
  onClose,
  onBack,
  autoFocus,
}: {
  items: MenuItem[];
  onClose: () => void;
  onBack: () => void;
  autoFocus: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<{ side: "right" | "left"; shiftY: number }>({
    side: "right",
    shiftY: 0,
  });

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const side =
      rect.right + VIEWPORT_MARGIN > window.innerWidth ? "left" : "right";
    const overflowY = rect.bottom + VIEWPORT_MARGIN - window.innerHeight;
    setPlacement({ side, shiftY: overflowY > 0 ? -overflowY : 0 });
  }, []);

  return (
    <div
      ref={ref}
      role="menu"
      className={`absolute z-[101] ${MENU_CLASS}`}
      style={{
        top: -5 + placement.shiftY,
        ...(placement.side === "right"
          ? { left: "calc(100% + 2px)" }
          : { right: "calc(100% + 2px)" }),
      }}
    >
      <MenuList items={items} onClose={onClose} onBack={onBack} autoFocus={autoFocus} />
    </div>
  );
}

export function ContextMenu({ x, y, items, onClose }: Props) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number }>({ x, y });

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let nx = x;
    let ny = y;
    if (nx + rect.width + VIEWPORT_MARGIN > vw) {
      nx = Math.max(VIEWPORT_MARGIN, vw - rect.width - VIEWPORT_MARGIN);
    }
    if (ny + rect.height + VIEWPORT_MARGIN > vh) {
      ny = Math.max(VIEWPORT_MARGIN, vh - rect.height - VIEWPORT_MARGIN);
    }
    setPos({ x: nx, y: ny });
  }, [x, y, items]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Use capture so the listener fires before React Flow's pane handlers
    // call stopPropagation, which would otherwise leave the menu stuck open.
    window.addEventListener("mousedown", handler, true);
    return () => window.removeEventListener("mousedown", handler, true);
  }, [onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="menu"
      aria-label={t.context_menu_aria_label}
      className={`fixed z-[100] ${MENU_CLASS}`}
      style={{ left: pos.x, top: pos.y }}
    >
      <MenuList items={items} onClose={onClose} autoFocus />
    </div>
  );
}
