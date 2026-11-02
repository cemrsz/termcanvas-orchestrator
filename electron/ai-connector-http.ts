/**
 * HTTP side of the AI connectors: build the request for one provider and
 * read its answer. Pure functions, no I/O, so every protocol is testable.
 *
 * Protocols:
 *   anthropic  POST {base}/v1/messages
 *   gemini     POST {base}/models/{model}:generateContent
 *   openai     POST {base}/chat/completions   (OpenAI and compatible APIs)
 */

import type {
  AiConnectorPlugin,
  AiErrorCode,
  AiProtocol,
  AiUsage,
} from "../shared/ai-connectors";

export const DEFAULT_MAX_TOKENS = 8192;
const ANTHROPIC_VERSION = "2023-06-01";

export class AiConnectorError extends Error {
  readonly code: AiErrorCode;
  readonly status?: number;

  constructor(code: AiErrorCode, message: string, status?: number) {
    super(message);
    this.name = "AiConnectorError";
    this.code = code;
    this.status = status;
  }
}

export interface ApiCall {
  url: string;
  init: {
    method: "POST" | "GET";
    headers: Record<string, string>;
    body?: string;
  };
}

export function trimSlash(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

function providerHeaders(
  plugin: AiConnectorPlugin,
  apiKey: string | null,
): Record<string, string> {
  const headers: Record<string, string> = {};
  if (plugin.protocol === "anthropic") {
    headers["anthropic-version"] = ANTHROPIC_VERSION;
    if (apiKey) headers["x-api-key"] = apiKey;
  } else if (plugin.protocol === "gemini") {
    if (apiKey) headers["x-goog-api-key"] = apiKey;
  } else if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  if (plugin.id === "openrouter") headers["X-Title"] = "TermCanvas";
  return headers;
}

/** Gemini lists models as "models/<id>" but calls them by bare id. */
export function geminiModelPath(model: string): string {
  return model.trim().replace(/^models\//, "");
}

export function buildApiCall(
  plugin: AiConnectorPlugin,
  options: {
    baseURL: string;
    apiKey: string | null;
    model: string;
    system?: string;
    prompt: string;
    maxTokens?: number;
  },
): ApiCall {
  const base = trimSlash(options.baseURL);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...providerHeaders(plugin, options.apiKey),
  };
  const system = options.system?.trim();

  if (plugin.protocol === "anthropic") {
    return {
      url: `${base}/v1/messages`,
      init: {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: options.model,
          max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
          ...(system ? { system } : {}),
          messages: [{ role: "user", content: options.prompt }],
        }),
      },
    };
  }

  if (plugin.protocol === "gemini") {
    const model = encodeURIComponent(geminiModelPath(options.model));
    return {
      url: `${base}/models/${model}:generateContent`,
      init: {
        method: "POST",
        headers,
        body: JSON.stringify({
          ...(system
            ? { systemInstruction: { parts: [{ text: system }] } }
            : {}),
          contents: [{ role: "user", parts: [{ text: options.prompt }] }],
        }),
      },
    };
  }

  return {
    url: `${base}/chat/completions`,
    init: {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: options.model,
        messages: [
          ...(system ? [{ role: "system", content: system }] : []),
          { role: "user", content: options.prompt },
        ],
      }),
    },
  };
}

type Json = Record<string, any>;

function asRecord(value: unknown): Json | null {
  return value && typeof value === "object" ? (value as Json) : null;
}

/** Text of a content array; Gemini "thought" parts are left out. */
function joinText(parts: unknown): string {
  if (typeof parts === "string") return parts;
  if (!Array.isArray(parts)) return "";
  return parts
    .map((part) => {
      const record = asRecord(part);
      if (!record || record.thought === true) return "";
      return typeof record.text === "string" ? record.text : "";
    })
    .join("");
}

export interface ParsedReply {
  text: string;
  model?: string;
  usage?: AiUsage;
}

export function parseApiReply(protocol: AiProtocol, json: unknown): ParsedReply {
  const root = asRecord(json);
  if (!root) {
    throw new AiConnectorError("bad-response", "The model returned no JSON.");
  }

  if (protocol === "anthropic") {
    const text = Array.isArray(root.content)
      ? root.content
          .filter(
            (block: Json) =>
              block?.type === "text" && typeof block.text === "string",
          )
          .map((block: Json) => block.text as string)
          .join("\n")
      : "";
    if (!text.trim()) {
      throw new AiConnectorError(
        "bad-response",
        `Claude returned no text (stop_reason: ${root.stop_reason ?? "unknown"}).`,
      );
    }
    return {
      text,
      model: typeof root.model === "string" ? root.model : undefined,
      usage: {
        inputTokens: root.usage?.input_tokens,
        outputTokens: root.usage?.output_tokens,
      },
    };
  }

  if (protocol === "gemini") {
    const candidate = Array.isArray(root.candidates) ? root.candidates[0] : null;
    const text = joinText(candidate?.content?.parts);
    if (!text.trim()) {
      const reason =
        root.promptFeedback?.blockReason ??
        candidate?.finishReason ??
        "no candidates";
      throw new AiConnectorError(
        "bad-response",
        `Gemini returned no text (${reason}).`,
      );
    }
    return {
      text,
      model:
        typeof root.modelVersion === "string" ? root.modelVersion : undefined,
      usage: {
        inputTokens: root.usageMetadata?.promptTokenCount,
        outputTokens: root.usageMetadata?.candidatesTokenCount,
      },
    };
  }

  const choice = Array.isArray(root.choices) ? root.choices[0] : null;
  let text = joinText(choice?.message?.content);
  if (!text.trim()) {
    const refusal = choice?.message?.refusal;
    throw new AiConnectorError(
      "bad-response",
      typeof refusal === "string" && refusal
        ? `The model refused: ${refusal}`
        : `The model returned no text (finish_reason: ${choice?.finish_reason ?? "unknown"}).`,
    );
  }
  // Search-backed answers (e.g. Perplexity) carry their sources beside the text.
  if (Array.isArray(root.citations)) {
    const sources = root.citations
      .filter((url: unknown): url is string => typeof url === "string")
      .map((url: string, i: number) => `[${i + 1}] ${url}`);
    if (sources.length > 0) text += `\n\nSources:\n${sources.join("\n")}`;
  }
  return {
    text,
    model: typeof root.model === "string" ? root.model : undefined,
    usage: {
      inputTokens: root.usage?.prompt_tokens,
      outputTokens: root.usage?.completion_tokens,
    },
  };
}

/** Readable error for a failed call; each provider nests it differently. */
export function describeHttpError(
  plugin: AiConnectorPlugin,
  status: number,
  body: string,
): string {
  let detail: unknown = "";
  try {
    const json = JSON.parse(body);
    const error = Array.isArray(json) ? json[0]?.error : json?.error;
    detail =
      (typeof error === "string" ? error : error?.message) ??
      json?.message ??
      json?.detail ??
      "";
  } catch {
    detail = body;
  }
  const text = (typeof detail === "string" ? detail : JSON.stringify(detail))
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 400);
  const hint =
    status === 401 || status === 403
      ? " Check the API key in the AI Hub."
      : status === 404
        ? " Check the model name (AI Hub → fetch models)."
        : status === 429
          ? " Rate limit or quota reached."
          : "";
  return `${plugin.name} API error ${status}${text ? `: ${text}` : ""}.${hint}`;
}

export function buildModelListCall(
  plugin: AiConnectorPlugin,
  options: { baseURL: string; apiKey: string | null },
): ApiCall {
  const base = trimSlash(options.baseURL);
  const headers = providerHeaders(plugin, options.apiKey);
  if (plugin.protocol === "anthropic") {
    return { url: `${base}/v1/models?limit=100`, init: { method: "GET", headers } };
  }
  if (plugin.protocol === "gemini") {
    return { url: `${base}/models?pageSize=200`, init: { method: "GET", headers } };
  }
  return { url: `${base}/models`, init: { method: "GET", headers } };
}

export function parseModelList(protocol: AiProtocol, json: unknown): string[] {
  const root = asRecord(json);
  if (!root) return [];
  if (protocol === "gemini") {
    const models: unknown[] = Array.isArray(root.models) ? root.models : [];
    return models
      .map(asRecord)
      .filter((model): model is Json => {
        if (!model || typeof model.name !== "string") return false;
        const methods = model.supportedGenerationMethods;
        return !Array.isArray(methods) || methods.includes("generateContent");
      })
      .map((model) => geminiModelPath(model.name));
  }
  const data: unknown[] = Array.isArray(root.data) ? root.data : [];
  return data
    .map(asRecord)
    .map((model) => (typeof model?.id === "string" ? model.id : ""))
    .filter(Boolean);
}
