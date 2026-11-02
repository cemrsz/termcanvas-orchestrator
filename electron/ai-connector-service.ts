/**
 * AI connector service (main process).
 *
 * Keeps the user's API keys — encrypted with the OS keyring when it is
 * available — plus per-connector defaults (model, base URL) in
 * ~/.termcanvas/ai-connectors.json, and answers what each connector can do
 * right now. Keys never leave this process: the renderer only ever gets an
 * AiConnectorStatus, the agents only get replies.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  AI_CONNECTORS,
  getAiConnector,
  type AiCliStatus,
  type AiConnectorId,
  type AiConnectorPlugin,
  type AiConnectorStatus,
} from "../shared/ai-connectors";
import {
  AiConnectorError,
  buildModelListCall,
  describeHttpError,
  parseModelList,
  trimSlash,
  type ApiCall,
} from "./ai-connector-http";
import { cleanCliOutput, type CliRunResult } from "./ai-connector-cli";

export const DEFAULT_AI_TIMEOUT_MS = 180_000;
export const MAX_AI_TIMEOUT_MS = 600_000;

export function maskKey(key: string): string {
  const trimmed = key.trim();
  if (trimmed.length <= 8) return "…";
  return `…${trimmed.slice(-4)}`;
}

export function clampTimeout(timeoutMs: number | undefined): number {
  if (!timeoutMs || !Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return DEFAULT_AI_TIMEOUT_MS;
  }
  return Math.min(Math.max(timeoutMs, 5_000), MAX_AI_TIMEOUT_MS);
}

/** Model a call uses: the request's, then the connector override, then default. */
export function resolveModel(
  plugin: AiConnectorPlugin,
  requested: string | undefined,
  override: string | null | undefined,
): string {
  return (requested?.trim() || override?.trim() || plugin.defaultModel).trim();
}

interface StoredKey {
  /** safeStorage ciphertext, base64. */
  enc?: string;
  /** Only when the OS has no keyring; the file is still 0600. */
  plain?: string;
}

interface StoredConnector {
  key?: StoredKey;
  model?: string;
  baseURL?: string;
}

interface StoredConfig {
  version: 1;
  connectors: Partial<Record<AiConnectorId, StoredConnector>>;
}

export interface AiConnectorServiceDeps {
  configPath: string;
  encryptionAvailable: () => boolean;
  encrypt: (plaintext: string) => string;
  decrypt: (ciphertext: string) => string;
  /** The user's login-shell environment, for *_API_KEY variables. */
  getEnv: () => Promise<Record<string, string | undefined>>;
  fetch: typeof fetch;
  /** Absolute path of a CLI on the login-shell PATH, or null. */
  resolveCli: (command: string) => Promise<string | null>;
  runCli: (
    command: string,
    args: string[],
    options: { cwd: string; stdin: string; timeoutMs: number },
  ) => Promise<CliRunResult>;
  now: () => number;
  tmpDir: () => string;
}

export class AiConnectorService {
  protected deps: AiConnectorServiceDeps;
  private config: StoredConfig;
  private keyCache = new Map<AiConnectorId, string>();
  private cliCache = new Map<AiConnectorId, AiCliStatus>();

  constructor(deps: AiConnectorServiceDeps) {
    this.deps = deps;
    this.config = this.load();
  }

  private load(): StoredConfig {
    try {
      const raw = JSON.parse(fs.readFileSync(this.deps.configPath, "utf-8"));
      if (raw && typeof raw.connectors === "object" && raw.connectors) {
        return { version: 1, connectors: raw.connectors };
      }
    } catch {
      // Missing or unreadable: start empty.
    }
    return { version: 1, connectors: {} };
  }

  private save() {
    fs.mkdirSync(path.dirname(this.deps.configPath), { recursive: true });
    const tmp = `${this.deps.configPath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.config, null, 2), {
      encoding: "utf-8",
      mode: 0o600,
    });
    fs.renameSync(tmp, this.deps.configPath);
  }

  protected plugin(id: string): AiConnectorPlugin {
    const plugin = getAiConnector(id);
    if (!plugin) {
      throw new AiConnectorError("unknown", `Unknown AI connector: ${id}`);
    }
    return plugin;
  }

  protected entry(id: AiConnectorId): StoredConnector {
    return this.config.connectors[id] ?? {};
  }

  private storedKey(id: AiConnectorId): string | null {
    const cached = this.keyCache.get(id);
    if (cached) return cached;
    const stored = this.entry(id).key;
    if (!stored) return null;
    let key: string | null = null;
    if (stored.enc) {
      try {
        key = this.deps.decrypt(stored.enc);
      } catch {
        key = null;
      }
    } else if (typeof stored.plain === "string") {
      key = stored.plain;
    }
    if (key) this.keyCache.set(id, key);
    return key;
  }

  private async envKey(
    plugin: AiConnectorPlugin,
  ): Promise<{ name: string; value: string } | null> {
    if (plugin.keyEnv.length === 0) return null;
    let env: Record<string, string | undefined> = {};
    try {
      env = await this.deps.getEnv();
    } catch {
      env = {};
    }
    for (const name of plugin.keyEnv) {
      const value = env[name]?.trim() || process.env[name]?.trim();
      if (value) return { name, value };
    }
    return null;
  }

  protected async resolveKey(plugin: AiConnectorPlugin): Promise<string | null> {
    return this.storedKey(plugin.id) ?? (await this.envKey(plugin))?.value ?? null;
  }

  protected baseURLFor(plugin: AiConnectorPlugin, override?: string): string {
    return (
      override?.trim() ||
      this.entry(plugin.id).baseURL?.trim() ||
      plugin.baseURL
    );
  }

  async status(): Promise<AiConnectorStatus[]> {
    return Promise.all(AI_CONNECTORS.map((plugin) => this.statusOf(plugin.id)));
  }

  async statusOf(id: AiConnectorId): Promise<AiConnectorStatus> {
    const plugin = this.plugin(id);
    const entry = this.entry(plugin.id);
    const stored = this.storedKey(plugin.id);
    const env = stored ? null : await this.envKey(plugin);
    const baseURL = this.baseURLFor(plugin);
    return {
      id: plugin.id,
      hasStoredKey: !!stored,
      keyHint: stored ? maskKey(stored) : null,
      envKey: env?.name ?? null,
      insecureStorage: !!entry.key?.plain,
      model: resolveModel(plugin, undefined, entry.model),
      modelOverride: entry.model?.trim() || null,
      baseURL,
      baseURLOverride: entry.baseURL?.trim() || null,
      apiReady: !!baseURL && (!plugin.keyRequired || !!stored || !!env),
      cli: plugin.cli ? (this.cliCache.get(plugin.id) ?? null) : null,
    };
  }

  setKey(id: AiConnectorId, key: string) {
    const plugin = this.plugin(id);
    const trimmed = key.trim();
    if (!trimmed) {
      this.clearKey(id);
      return;
    }
    const stored: StoredKey = this.deps.encryptionAvailable()
      ? { enc: this.deps.encrypt(trimmed) }
      : { plain: trimmed };
    this.config.connectors[plugin.id] = { ...this.entry(plugin.id), key: stored };
    this.keyCache.set(plugin.id, trimmed);
    this.save();
  }

  clearKey(id: AiConnectorId) {
    const plugin = this.plugin(id);
    const { key: _removed, ...rest } = this.entry(plugin.id);
    this.config.connectors[plugin.id] = rest;
    this.keyCache.delete(plugin.id);
    this.save();
  }

  setConfig(
    id: AiConnectorId,
    patch: { model?: string | null; baseURL?: string | null },
  ) {
    const plugin = this.plugin(id);
    const next: StoredConnector = { ...this.entry(plugin.id) };
    if (patch.model !== undefined) {
      if (patch.model?.trim()) next.model = patch.model.trim();
      else delete next.model;
    }
    if (patch.baseURL !== undefined) {
      if (patch.baseURL?.trim()) next.baseURL = trimSlash(patch.baseURL);
      else delete next.baseURL;
    }
    this.config.connectors[plugin.id] = next;
    this.save();
  }

  /** Is the provider's CLI installed (and which version)? Cached per session. */
  async checkCli(id: AiConnectorId): Promise<AiCliStatus> {
    const plugin = this.plugin(id);
    if (!plugin.cli) {
      return { installed: false, path: null, version: null, error: "no CLI" };
    }
    let status: AiCliStatus;
    try {
      const resolved = await this.deps.resolveCli(plugin.cli.command);
      if (!resolved) {
        status = { installed: false, path: null, version: null };
      } else {
        const result = await this.deps.runCli(plugin.cli.command, ["--version"], {
          cwd: os.homedir(),
          stdin: "",
          timeoutMs: 15_000,
        });
        status = {
          installed: true,
          path: resolved,
          version: cleanCliOutput(result.stdout).split("\n")[0] || null,
        };
      }
    } catch (error) {
      status = {
        installed: false,
        path: null,
        version: null,
        error: error instanceof Error ? error.message : String(error),
      };
    }
    this.cliCache.set(plugin.id, status);
    return status;
  }

  protected noKeyMessage(plugin: AiConnectorPlugin): string {
    const env = plugin.keyEnv.length > 0 ? `, or set ${plugin.keyEnv[0]}` : "";
    const cli = plugin.cli
      ? ` Or switch to the CLI transport (${plugin.cli.label}) to use your ${plugin.vendor} login.`
      : "";
    return `${plugin.name} has no API key. Open the AI Hub and paste one${env}.${cli}`;
  }

  protected async fetchWithTimeout(
    call: ApiCall,
    timeoutMs: number,
    plugin: AiConnectorPlugin,
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await this.deps.fetch(call.url, {
        method: call.init.method,
        headers: call.init.headers,
        body: call.init.body,
        signal: controller.signal,
      });
    } catch (error) {
      if (controller.signal.aborted) {
        throw new AiConnectorError(
          "timeout",
          `${plugin.name} did not answer within ${Math.round(timeoutMs / 1000)}s.`,
        );
      }
      const cause =
        error instanceof Error
          ? ((error.cause as Error | undefined)?.message ?? error.message)
          : String(error);
      throw new AiConnectorError(
        "http",
        `Could not reach ${plugin.name} at ${new URL(call.url).origin}: ${cause}`,
      );
    } finally {
      clearTimeout(timer);
    }
  }

  /** Models the provider offers to this key (for the model picker). */
  async listModels(id: AiConnectorId, baseURLOverride?: string): Promise<string[]> {
    const plugin = this.plugin(id);
    const baseURL = this.baseURLFor(plugin, baseURLOverride);
    if (!baseURL) {
      throw new AiConnectorError(
        "no-base-url",
        `${plugin.name}: set a server URL first.`,
      );
    }
    const apiKey = await this.resolveKey(plugin);
    if (plugin.keyRequired && !apiKey) {
      throw new AiConnectorError("no-key", this.noKeyMessage(plugin));
    }
    const call = buildModelListCall(plugin, { baseURL, apiKey });
    const response = await this.fetchWithTimeout(call, 20_000, plugin);
    const body = await response.text();
    if (!response.ok) {
      throw new AiConnectorError(
        "http",
        describeHttpError(plugin, response.status, body),
        response.status,
      );
    }
    let json: unknown;
    try {
      json = JSON.parse(body);
    } catch {
      throw new AiConnectorError(
        "bad-response",
        `${plugin.name}: the model list is not JSON.`,
      );
    }
    return [...new Set(parseModelList(plugin.protocol, json))].sort();
  }
}
