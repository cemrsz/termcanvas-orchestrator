import test from "node:test";
import assert from "node:assert/strict";

import { getAiConnector, type AiConnectorPlugin } from "../shared/ai-connectors.ts";
import {
  AiConnectorError,
  buildApiCall,
  buildModelListCall,
  describeHttpError,
  geminiModelPath,
  parseApiReply,
  parseModelList,
} from "../electron/ai-connector-http.ts";

function plugin(id: string): AiConnectorPlugin {
  const found = getAiConnector(id);
  assert.ok(found, `connector ${id} exists`);
  return found;
}

test("anthropic call uses the messages API with key and version headers", () => {
  const call = buildApiCall(plugin("claude"), {
    baseURL: "https://api.anthropic.com/",
    apiKey: "sk-ant-test",
    model: "claude-opus-5-5",
    system: "Be brief.",
    prompt: "Hello",
  });
  assert.equal(call.url, "https://api.anthropic.com/v1/messages");
  assert.equal(call.init.method, "POST");
  assert.equal(call.init.headers["x-api-key"], "sk-ant-test");
  assert.equal(call.init.headers["anthropic-version"], "2023-06-01");
  const body = JSON.parse(call.init.body!);
  assert.equal(body.model, "claude-opus-5-5");
  assert.equal(body.system, "Be brief.");
  assert.equal(body.max_tokens, 8192);
  assert.deepEqual(body.messages, [{ role: "user", content: "Hello" }]);
});

test("gemini call targets generateContent and sends the key as a header", () => {
  const call = buildApiCall(plugin("gemini"), {
    baseURL: "https://generativelanguage.googleapis.com/v1beta",
    apiKey: "AIza-test",
    model: "models/gemini-flash-latest",
    prompt: "Hi",
  });
  assert.equal(
    call.url,
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent",
  );
  assert.equal(call.init.headers["x-goog-api-key"], "AIza-test");
  assert.ok(!call.url.includes("AIza-test"), "key never goes in the URL");
  const body = JSON.parse(call.init.body!);
  assert.equal(body.systemInstruction, undefined);
  assert.deepEqual(body.contents, [{ role: "user", parts: [{ text: "Hi" }] }]);
});

test("openai-compatible call puts the system prompt first", () => {
  const call = buildApiCall(plugin("chatgpt"), {
    baseURL: "https://api.openai.com/v1",
    apiKey: "sk-test",
    model: "gpt-5",
    system: "You review code.",
    prompt: "Review this",
  });
  assert.equal(call.url, "https://api.openai.com/v1/chat/completions");
  assert.equal(call.init.headers.Authorization, "Bearer sk-test");
  const body = JSON.parse(call.init.body!);
  assert.deepEqual(body.messages, [
    { role: "system", content: "You review code." },
    { role: "user", content: "Review this" },
  ]);
});

test("local servers are called without an Authorization header", () => {
  const call = buildApiCall(plugin("ollama"), {
    baseURL: "http://localhost:11434/v1",
    apiKey: null,
    model: "llama3.2",
    prompt: "Hi",
  });
  assert.equal(call.init.headers.Authorization, undefined);
});

test("parseApiReply reads each protocol", () => {
  assert.deepEqual(
    parseApiReply("anthropic", {
      model: "claude-opus-5-5",
      content: [
        { type: "thinking", thinking: "…" },
        { type: "text", text: "Merhaba" },
      ],
      usage: { input_tokens: 12, output_tokens: 3 },
    }),
    {
      text: "Merhaba",
      model: "claude-opus-5-5",
      usage: { inputTokens: 12, outputTokens: 3 },
    },
  );

  const gemini = parseApiReply("gemini", {
    candidates: [
      {
        content: {
          parts: [{ text: "plan…", thought: true }, { text: "Hello " }, { text: "there" }],
        },
      },
    ],
    usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 2 },
    modelVersion: "gemini-2.5-flash",
  });
  assert.equal(gemini.text, "Hello there");
  assert.equal(gemini.model, "gemini-2.5-flash");
  assert.deepEqual(gemini.usage, { inputTokens: 5, outputTokens: 2 });

  const openai = parseApiReply("openai", {
    model: "gpt-5",
    choices: [{ message: { content: "Yes." }, finish_reason: "stop" }],
    usage: { prompt_tokens: 9, completion_tokens: 1 },
  });
  assert.equal(openai.text, "Yes.");
  assert.deepEqual(openai.usage, { inputTokens: 9, outputTokens: 1 });
});

test("openai-compatible replies keep their citations", () => {
  const reply = parseApiReply("openai", {
    choices: [{ message: { content: "Answer" } }],
    citations: ["https://a.example", "https://b.example"],
  });
  assert.equal(
    reply.text,
    "Answer\n\nSources:\n[1] https://a.example\n[2] https://b.example",
  );
});

test("empty or blocked replies become bad-response errors", () => {
  assert.throws(
    () => parseApiReply("gemini", { promptFeedback: { blockReason: "SAFETY" } }),
    (error: unknown) =>
      error instanceof AiConnectorError &&
      error.code === "bad-response" &&
      error.message.includes("SAFETY"),
  );
  assert.throws(
    () =>
      parseApiReply("openai", {
        choices: [{ message: { content: null, refusal: "I can't help" } }],
      }),
    /refused: I can't help/,
  );
  assert.throws(() => parseApiReply("anthropic", { content: [] }), /no text/);
  assert.throws(() => parseApiReply("openai", null), /no JSON/);
});

test("describeHttpError surfaces the provider message and a hint", () => {
  assert.equal(
    describeHttpError(
      plugin("chatgpt"),
      401,
      JSON.stringify({ error: { message: "Incorrect API key provided" } }),
    ),
    "ChatGPT API error 401: Incorrect API key provided. Check the API key in the AI Hub.",
  );
  assert.equal(
    describeHttpError(
      plugin("gemini"),
      404,
      JSON.stringify([{ error: { message: "models/x is not found" } }]),
    ),
    "Gemini API error 404: models/x is not found. Check the model name (AI Hub → fetch models).",
  );
  assert.equal(
    describeHttpError(plugin("claude"), 500, "upstream\n  failed"),
    "Claude API error 500: upstream failed.",
  );
});

test("model lists are read per protocol", () => {
  assert.equal(geminiModelPath(" models/gemini-2.5-pro "), "gemini-2.5-pro");
  assert.deepEqual(
    parseModelList("gemini", {
      models: [
        { name: "models/gemini-2.5-pro", supportedGenerationMethods: ["generateContent"] },
        { name: "models/text-embedding-004", supportedGenerationMethods: ["embedContent"] },
      ],
    }),
    ["gemini-2.5-pro"],
  );
  assert.deepEqual(
    parseModelList("openai", { data: [{ id: "gpt-5" }, { id: "gpt-5-mini" }, {}] }),
    ["gpt-5", "gpt-5-mini"],
  );
  assert.deepEqual(parseModelList("anthropic", { data: [{ id: "claude-opus-5-5" }] }), [
    "claude-opus-5-5",
  ]);
  assert.equal(
    buildModelListCall(plugin("claude"), {
      baseURL: "https://api.anthropic.com",
      apiKey: "k",
    }).url,
    "https://api.anthropic.com/v1/models?limit=100",
  );
});
