/**
 * AI connectors ("plugins"): the catalog of model providers TermCanvas can
 * talk to from the canvas. One entry per provider; the main process turns
 * an entry plus the user's key/config into a request (see
 * electron/ai-connectors.ts), the renderer uses the same entries to draw
 * nodes and the AI Hub.
 *
 * Two transports:
 *   - api: HTTPS call with an API key (or none for local servers).
 *   - cli: run the provider's own CLI non-interactively (`claude -p`,
 *     `gemini`, `codex exec`), so a subscription login works without a key.
 *
 * This file is shared by the main process and the renderer: keep it free of
 * Node and DOM imports.
 */

export type AiConnectorId =
  | "claude"
  | "gemini"
  | "chatgpt"
  | "deepseek"
  | "grok"
  | "mistral"
  | "perplexity"
  | "openrouter"
  | "groq"
  | "ollama"
  | "lmstudio"
  | "custom";

/** Wire format of the provider's HTTP API. */
export type AiProtocol = "anthropic" | "gemini" | "openai";

export type AiTransport = "api" | "cli";

export interface AiCliSpec {
  /** Executable looked up on the user's login-shell PATH. */
  command: string;
  /** How the CLI is run, shown in the UI. */
  label: string;
  /** Install hint shown when the CLI is missing. */
  install: string;
}

export interface AiConnectorPlugin {
  id: AiConnectorId;
  name: string;
  vendor: string;
  color: string;
  protocol: AiProtocol;
  baseURL: string;
  /** Environment variables checked (in order) when no key is saved. */
  keyEnv: string[];
  keyRequired: boolean;
  keyUrl?: string;
  keyPlaceholder: string;
  /** Model used when neither the node nor the connector config names one. */
  defaultModel: string;
  /** Suggestions for the model field; the live list comes from the API. */
  models: string[];
  cli?: AiCliSpec;
  /** Shown first in menus and the hub. */
  featured?: boolean;
  /** Runs on the user's machine (no key, no cost). */
  local?: boolean;
}

export const AI_CONNECTORS: AiConnectorPlugin[] = [
  {
    id: "claude",
    name: "Claude",
    vendor: "Anthropic",
    color: "#f5a623",
    protocol: "anthropic",
    baseURL: "https://api.anthropic.com",
    keyEnv: ["ANTHROPIC_API_KEY"],
    keyRequired: true,
    keyUrl: "https://console.anthropic.com/settings/keys",
    keyPlaceholder: "sk-ant-…",
    defaultModel: "claude-opus-5-5",
    models: ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"],
    cli: {
      command: "claude",
      label: "claude -p",
      install: "npm install -g @anthropic-ai/claude-code",
    },
    featured: true,
  },
  {
    id: "gemini",
    name: "Gemini",
    vendor: "Google",
    color: "#4285f4",
    protocol: "gemini",
    baseURL: "https://generativelanguage.googleapis.com/v1beta",
    keyEnv: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
    keyRequired: true,
    keyUrl: "https://aistudio.google.com/apikey",
    keyPlaceholder: "AIza…",
    defaultModel: "gemini-flash-latest",
    models: [
      "gemini-flash-latest",
      "gemini-flash-lite-latest",
      "gemini-3-pro-preview",
      "gemini-2.5-pro",
      "gemini-2.5-flash",
    ],
    cli: {
      command: "gemini",
      label: "gemini (headless)",
      install: "npm install -g @google/gemini-cli",
    },
    featured: true,
  },
  {
    id: "chatgpt",
    name: "ChatGPT",
    vendor: "OpenAI",
    color: "#10a37f",
    protocol: "openai",
    baseURL: "https://api.openai.com/v1",
    keyEnv: ["OPENAI_API_KEY"],
    keyRequired: true,
    keyUrl: "https://platform.openai.com/api-keys",
    keyPlaceholder: "sk-…",
    defaultModel: "gpt-5",
    models: ["gpt-5", "gpt-5-mini", "gpt-6-astra"],
    cli: {
      command: "codex",
      label: "codex exec",
      install: "npm install -g @openai/codex",
    },
    featured: true,
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    vendor: "DeepSeek",
    color: "#4d6bfe",
    protocol: "openai",
    baseURL: "https://api.deepseek.com",
    keyEnv: ["DEEPSEEK_API_KEY"],
    keyRequired: true,
    keyUrl: "https://platform.deepseek.com/api_keys",
    keyPlaceholder: "sk-…",
    defaultModel: "deepseek-chat",
    models: ["deepseek-chat", "deepseek-reasoner"],
  },
  {
    id: "grok",
    name: "Grok",
    vendor: "xAI",
    color: "#64748b",
    protocol: "openai",
    baseURL: "https://api.x.ai/v1",
    keyEnv: ["XAI_API_KEY"],
    keyRequired: true,
    keyUrl: "https://console.x.ai",
    keyPlaceholder: "xai-…",
    defaultModel: "grok-4",
    models: ["grok-4", "grok-4-fast", "grok-3-mini"],
  },
  {
    id: "mistral",
    name: "Mistral",
    vendor: "Mistral AI",
    color: "#fa520f",
    protocol: "openai",
    baseURL: "https://api.mistral.ai/v1",
    keyEnv: ["MISTRAL_API_KEY"],
    keyRequired: true,
    keyUrl: "https://console.mistral.ai/api-keys",
    keyPlaceholder: "…",
    defaultModel: "mistral-large-latest",
    models: ["mistral-large-latest", "mistral-medium-latest", "codestral-latest"],
  },
  {
    id: "perplexity",
    name: "Perplexity",
    vendor: "Perplexity",
    color: "#20808d",
    protocol: "openai",
    baseURL: "https://api.perplexity.ai",
    keyEnv: ["PERPLEXITY_API_KEY"],
    keyRequired: true,
    keyUrl: "https://www.perplexity.ai/settings/api",
    keyPlaceholder: "pplx-…",
    defaultModel: "sonar",
    models: ["sonar", "sonar-pro", "sonar-reasoning"],
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    vendor: "OpenRouter",
    color: "#6467f2",
    protocol: "openai",
    baseURL: "https://openrouter.ai/api/v1",
    keyEnv: ["OPENROUTER_API_KEY"],
    keyRequired: true,
    keyUrl: "https://openrouter.ai/keys",
    keyPlaceholder: "sk-or-…",
    defaultModel: "openrouter/auto",
    models: [
      "openrouter/auto",
      "google/gemini-2.5-pro",
      "openai/gpt-5",
      "deepseek/deepseek-chat",
    ],
  },
  {
    id: "groq",
    name: "Groq",
    vendor: "Groq",
    color: "#e11d48",
    protocol: "openai",
    baseURL: "https://api.groq.com/openai/v1",
    keyEnv: ["GROQ_API_KEY"],
    keyRequired: true,
    keyUrl: "https://console.groq.com/keys",
    keyPlaceholder: "gsk_…",
    defaultModel: "llama-3.3-70b-versatile",
    models: ["llama-3.3-70b-versatile", "openai/gpt-oss-120b"],
  },
  {
    id: "ollama",
    name: "Ollama",
    vendor: "Local",
    color: "#0891b2",
    protocol: "openai",
    baseURL: "http://localhost:11434/v1",
    keyEnv: ["OLLAMA_API_KEY"],
    keyRequired: false,
    keyPlaceholder: "(not needed)",
    defaultModel: "",
    models: ["llama3.2", "qwen2.5-coder", "gpt-oss:20b"],
    local: true,
  },
  {
    id: "lmstudio",
    name: "LM Studio",
    vendor: "Local",
    color: "#a16207",
    protocol: "openai",
    baseURL: "http://localhost:1234/v1",
    keyEnv: [],
    keyRequired: false,
    keyPlaceholder: "(not needed)",
    defaultModel: "",
    models: [],
    local: true,
  },
  {
    id: "custom",
    name: "Custom",
    vendor: "OpenAI-compatible",
    color: "#71717a",
    protocol: "openai",
    baseURL: "",
    keyEnv: [],
    keyRequired: false,
    keyPlaceholder: "…",
    defaultModel: "",
    models: [],
  },
];

const BY_ID = new Map<string, AiConnectorPlugin>(
  AI_CONNECTORS.map((plugin) => [plugin.id, plugin]),
);

export function getAiConnector(id: string): AiConnectorPlugin | undefined {
  return BY_ID.get(id);
}

export function isAiConnectorId(id: unknown): id is AiConnectorId {
  return typeof id === "string" && BY_ID.has(id);
}

export function isAiTransport(value: unknown): value is AiTransport {
  return value === "api" || value === "cli";
}

/** Featured connectors first, then the rest in catalog order. */
export function sortedAiConnectors(): AiConnectorPlugin[] {
  return [
    ...AI_CONNECTORS.filter((plugin) => plugin.featured),
    ...AI_CONNECTORS.filter((plugin) => !plugin.featured),
  ];
}

/**
 * Transport a new node starts with: the API when it can be called, the CLI
 * when only the CLI is set up (e.g. Gemini with a Google login), else API so
 * the node asks for a key.
 */
export function pickTransport(
  plugin: AiConnectorPlugin,
  status: Pick<AiConnectorStatus, "apiReady" | "cli"> | undefined,
): AiTransport {
  if (!status || status.apiReady || !plugin.cli) return "api";
  return status.cli?.installed ? "cli" : "api";
}

/** What the main process reports about one connector (never the key). */
export interface AiConnectorStatus {
  id: AiConnectorId;
  hasStoredKey: boolean;
  /** Last characters of the saved key, e.g. "…9fQe". */
  keyHint: string | null;
  /** Environment variable that supplies the key when none is saved. */
  envKey: string | null;
  /** The key could not be encrypted on this machine (no OS keyring). */
  insecureStorage: boolean;
  /** Effective default model (config override or catalog default). */
  model: string;
  modelOverride: string | null;
  baseURL: string;
  baseURLOverride: string | null;
  /** True when an API call can be attempted (key present or not needed). */
  apiReady: boolean;
  /** Last known CLI check; null until checked. */
  cli: AiCliStatus | null;
}

export interface AiCliStatus {
  installed: boolean;
  path: string | null;
  version: string | null;
  error?: string;
}

export interface AiInvokeRequest {
  connector: AiConnectorId;
  transport: AiTransport;
  /** Empty: node/connector default. */
  model?: string;
  system?: string;
  prompt: string;
  /** Working directory for the CLI transport. */
  cwd?: string;
  /** Base URL override (e.g. from a node), API transport only. */
  baseURL?: string;
  timeoutMs?: number;
  maxTokens?: number;
}

export interface AiUsage {
  inputTokens?: number;
  outputTokens?: number;
}

export interface AiInvokeResult {
  text: string;
  model: string;
  transport: AiTransport;
  latencyMs: number;
  usage?: AiUsage;
}

export type AiErrorCode =
  | "no-key"
  | "no-model"
  | "no-base-url"
  | "no-cli"
  | "cli-missing"
  | "cli-failed"
  | "http"
  | "timeout"
  | "bad-response"
  | "unknown";

/** IPC-safe outcome of an invoke from the renderer. */
export type AiInvokeOutcome =
  | ({ ok: true } & AiInvokeResult)
  | { ok: false; code: AiErrorCode; error: string };
