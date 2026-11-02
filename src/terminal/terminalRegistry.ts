import type { Terminal } from "@xterm/xterm";
import { SerializeAddon } from "@xterm/addon-serialize";

const registry = new Map<
  string,
  { xterm: Terminal; serialize: SerializeAddon }
>();

export function registerTerminal(
  id: string,
  xterm: Terminal,
  serialize: SerializeAddon,
) {
  registry.set(id, { xterm, serialize });
}

export function unregisterTerminal(id: string) {
  registry.delete(id);
}

function refreshViewport(xterm: Terminal) {
  const lastRow = Math.max(0, xterm.rows - 1);
  xterm.refresh(0, lastRow);
}

export function refreshRegisteredTerminalViewports(id?: string) {
  if (id) {
    const entry = registry.get(id);
    if (!entry) return;
    refreshViewport(entry.xterm);
    return;
  }

  for (const entry of registry.values()) {
    refreshViewport(entry.xterm);
  }
}

/**
 * Plain text of a terminal's last `maxLines` rendered lines (soft-wrapped
 * rows joined back together). Null when the terminal has no xterm.
 */
export function readTerminalText(id: string, maxLines = 200): string | null {
  const entry = registry.get(id);
  if (!entry) return null;
  const buffer = entry.xterm.buffer.active;
  const start = Math.max(0, buffer.length - Math.max(1, maxLines));
  const lines: string[] = [];
  for (let i = start; i < buffer.length; i++) {
    const line = buffer.getLine(i);
    if (!line) continue;
    const text = line.translateToString(true);
    if (line.isWrapped && lines.length > 0) lines[lines.length - 1] += text;
    else lines.push(text);
  }
  return lines.join("\n");
}

export function serializeTerminal(id: string): string | null {
  const entry = registry.get(id);
  if (!entry) return null;
  return entry.serialize.serialize();
}

export function serializeAllTerminals(): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [id, entry] of registry) {
    try {
      result[id] = entry.serialize.serialize();
    } catch {
    }
  }
  return result;
}
