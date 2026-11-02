import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  AiConnectorService,
  clampTimeout,
  maskKey,
  resolveModel,
  type AiConnectorServiceDeps,
} from "../electron/ai-connector-service.ts";
import { AiConnectorError } from "../electron/ai-connector-http.ts";
import type { CliRunResult } from "../electron/ai-connector-cli.ts";
import { getAiConnector } from "../shared/ai-connectors.ts";

interface FetchCall {
  url: string;
  init: RequestInit;
}

function makeService(overrides: Partial<AiConnectorServiceDeps> = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-connectors-"));
  const fetchCalls: FetchCall[] = [];
  const cliCalls: { command: string; args: string[]; stdin: string; cwd: string }[] = [];
  let clock = 1_000;
  const deps: AiConnectorServiceDeps = {
    configPath: path.join(dir, "ai-connectors.json"),
    encryptionAvailable: () => true,
    encrypt: (plain) => Buffer.from(`enc:${plain}`).toString("base64"),
    decrypt: (cipher) =>
      Buffer.from(cipher, "base64").toString("utf-8").replace(/^enc:/, ""),
    getEnv: async () => ({}),
    fetch: (async (url: string, init: RequestInit) => {
      fetchCalls.push({ url, init });
      return new Response(JSON.stringify({ error: { message: "no fake" } }), {
        status: 500,
      });
    }) as unknown as typeof fetch,
    resolveCli: async () => null,
    runCli: async (command, args, options) => {
      cliCalls.push({ command, args, stdin: options.stdin, cwd: options.cwd });
      return { code: 0, stdout: "", stderr: "", timedOut: false };
    },
    now: () => (clock += 250),
    tmpDir: () => dir,
    ...overrides,
  };
  const service = new AiConnectorService(deps);
  return {
    service,
    deps,
    dir,
    fetchCalls,
    cliCalls,
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

test("helpers: masked keys, timeouts and model resolution", () => {
  assert.equal(maskKey("sk-ant-abcdefgh1234"), "…1234");
  assert.equal(maskKey("short"), "…");
  assert.equal(clampTimeout(undefined), 180_000);
  assert.equal(clampTimeout(1), 5_000);
  assert.equal(clampTimeout(10_000_000), 600_000);
  const gemini = getAiConnector("gemini")!;
  assert.equal(resolveModel(gemini, " gemini-2.5-pro ", "x"), "gemini-2.5-pro");
  assert.equal(resolveModel(gemini, "", "gemini-3-pro-preview"), "gemini-3-pro-preview");
  assert.equal(resolveModel(gemini, undefined, null), gemini.defaultModel);
});

test("keys are stored encrypted and never reported back in full", async () => {
  const { service, deps, cleanup } = makeService();
  try {
    service.setKey("gemini", "  AIzaSyTESTKEY9fQe ");
    const raw = fs.readFileSync(deps.configPath, "utf-8");
    assert.ok(!raw.includes("AIzaSyTESTKEY9fQe"), "plaintext key not on disk");
    if (process.platform !== "win32") {
      assert.equal(fs.statSync(deps.configPath).mode & 0o777, 0o600);
    }
    const status = await service.statusOf("gemini");
    assert.equal(status.hasStoredKey, true);
    assert.equal(status.keyHint, "…9fQe");
    assert.equal(status.apiReady, true);
    assert.equal(status.insecureStorage, false);
    assert.ok(!JSON.stringify(await service.status()).includes("AIzaSyTESTKEY9fQe"));

    // A fresh service (next app start) decrypts the saved key.
    const reloaded = new AiConnectorService(deps);
    assert.equal((await reloaded.statusOf("gemini")).keyHint, "…9fQe");

    service.clearKey("gemini");
    assert.equal((await service.statusOf("gemini")).hasStoredKey, false);
  } finally {
    cleanup();
  }
});

test("without a keyring the key is kept 0600 and flagged as insecure", async () => {
  const { service, cleanup } = makeService({ encryptionAvailable: () => false });
  try {
    service.setKey("chatgpt", "sk-plain-key-1234");
    const status = await service.statusOf("chatgpt");
    assert.equal(status.insecureStorage, true);
    assert.equal(status.apiReady, true);
  } finally {
    cleanup();
  }
});

test("environment variables supply keys when none is saved", async () => {
  const { service, cleanup } = makeService({
    getEnv: async () => ({ GOOGLE_API_KEY: "AIza-env" }),
  });
  try {
    const status = await service.statusOf("gemini");
    assert.equal(status.envKey, "GOOGLE_API_KEY");
    assert.equal(status.hasStoredKey, false);
    assert.equal(status.apiReady, true);
    assert.equal((await service.statusOf("claude")).apiReady, false);
    assert.equal((await service.statusOf("ollama")).apiReady, true, "local needs no key");
  } finally {
    cleanup();
  }
});

test("connector config overrides the default model and base URL", async () => {
  const { service, cleanup } = makeService();
  try {
    service.setConfig("custom", { baseURL: "http://127.0.0.1:8080/v1/", model: "qwen" });
    let status = await service.statusOf("custom");
    assert.equal(status.baseURL, "http://127.0.0.1:8080/v1");
    assert.equal(status.model, "qwen");
    assert.equal(status.apiReady, true);
    service.setConfig("custom", { baseURL: null, model: "" });
    status = await service.statusOf("custom");
    assert.equal(status.baseURLOverride, null);
    assert.equal(status.modelOverride, null);
    assert.equal(status.apiReady, false, "custom without URL cannot be called");
  } finally {
    cleanup();
  }
});

test("invoke over the API sends the request and reports usage and latency", async () => {
  const calls: FetchCall[] = [];
  const { service, cleanup } = makeService({
    fetch: (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return jsonResponse({
        model: "claude-opus-5-5",
        content: [{ type: "text", text: " Selam! " }],
        usage: { input_tokens: 20, output_tokens: 4 },
      });
    }) as unknown as typeof fetch,
  });
  try {
    service.setKey("claude", "sk-ant-secret-0001");
    const result = await service.invoke({
      connector: "claude",
      transport: "api",
      prompt: "Merhaba",
      system: "Kısa cevap ver.",
    });
    assert.equal(result.text, "Selam!");
    assert.equal(result.transport, "api");
    assert.equal(result.model, "claude-opus-5-5");
    assert.deepEqual(result.usage, { inputTokens: 20, outputTokens: 4 });
    assert.ok(result.latencyMs > 0);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://api.anthropic.com/v1/messages");
    assert.equal(
      (calls[0].init.headers as Record<string, string>)["x-api-key"],
      "sk-ant-secret-0001",
    );
  } finally {
    cleanup();
  }
});

test("invoke without a key explains how to add one or use the CLI", async () => {
  const { service, fetchCalls, cleanup } = makeService();
  try {
    await assert.rejects(
      service.invoke({ connector: "gemini", transport: "api", prompt: "hi" }),
      (error: unknown) =>
        error instanceof AiConnectorError &&
        error.code === "no-key" &&
        error.message.includes("GEMINI_API_KEY") &&
        error.message.includes("CLI"),
    );
    assert.equal(fetchCalls.length, 0);
  } finally {
    cleanup();
  }
});

test("HTTP errors carry the provider message", async () => {
  const { service, cleanup } = makeService({
    fetch: (async () =>
      jsonResponse({ error: { message: "model not found" } }, 404)) as unknown as typeof fetch,
  });
  try {
    service.setKey("chatgpt", "sk-test-000000");
    await assert.rejects(
      service.invoke({ connector: "chatgpt", transport: "api", prompt: "hi", model: "gpt-x" }),
      /ChatGPT API error 404: model not found/,
    );
  } finally {
    cleanup();
  }
});

test("a local server without a model uses the first model it lists", async () => {
  const urls: string[] = [];
  const { service, cleanup } = makeService({
    fetch: (async (url: string) => {
      urls.push(url);
      if (url.endsWith("/models")) return jsonResponse({ data: [{ id: "phi4" }, { id: "llama3.2" }] });
      return jsonResponse({ choices: [{ message: { content: "ok" } }] });
    }) as unknown as typeof fetch,
  });
  try {
    const result = await service.invoke({ connector: "lmstudio", transport: "api", prompt: "hi" });
    assert.equal(result.text, "ok");
    assert.equal(result.model, "llama3.2");
    assert.deepEqual(urls, [
      "http://localhost:1234/v1/models",
      "http://localhost:1234/v1/chat/completions",
    ]);
  } finally {
    cleanup();
  }
});

test("invoke over the CLI runs codex exec and reads its last-message file", async () => {
  const runs: { command: string; args: string[]; stdin: string }[] = [];
  const { service, cleanup } = makeService({
    resolveCli: async (command) => `/usr/local/bin/${command}`,
    runCli: async (command, args, options): Promise<CliRunResult> => {
      runs.push({ command, args, stdin: options.stdin });
      const outputFile = args[args.indexOf("--output-last-message") + 1];
      fs.writeFileSync(outputFile, "Final answer from Codex\n");
      return { code: 0, stdout: "progress noise", stderr: "", timedOut: false };
    },
  });
  try {
    const result = await service.invoke({
      connector: "chatgpt",
      transport: "cli",
      prompt: "Explain closures",
      system: "Teach.",
    });
    assert.equal(result.text, "Final answer from Codex");
    assert.equal(result.transport, "cli");
    assert.equal(result.model, "codex default");
    assert.equal(runs[0].command, "codex");
    assert.equal(runs[0].stdin, "Teach.\n\n---\n\nExplain closures");
    const outputFile = runs[0].args[runs[0].args.indexOf("--output-last-message") + 1];
    assert.equal(fs.existsSync(outputFile), false, "temp file removed");
  } finally {
    cleanup();
  }
});

test("CLI failures and missing CLIs become clear errors", async () => {
  const missing = makeService();
  try {
    await assert.rejects(
      missing.service.invoke({ connector: "gemini", transport: "cli", prompt: "hi" }),
      /gemini is not installed\. Install it with: npm install -g @google\/gemini-cli/,
    );
  } finally {
    missing.cleanup();
  }

  const failing = makeService({
    resolveCli: async () => "/bin/gemini",
    runCli: async () => ({
      code: 1,
      stdout: "",
      stderr: "line1\nPlease set an Auth method\n",
      timedOut: false,
    }),
  });
  try {
    await assert.rejects(
      failing.service.invoke({ connector: "gemini", transport: "cli", prompt: "hi" }),
      (error: unknown) =>
        error instanceof AiConnectorError &&
        error.code === "cli-failed" &&
        error.message.includes("Please set an Auth method") &&
        error.message.includes("logged in"),
    );
  } finally {
    failing.cleanup();
  }

  const slow = makeService({
    resolveCli: async () => "/bin/claude",
    runCli: async () => ({ code: null, stdout: "partial", stderr: "", timedOut: true }),
  });
  try {
    await assert.rejects(
      slow.service.invoke({ connector: "claude", transport: "cli", prompt: "hi", timeoutMs: 6000 }),
      (error: unknown) => error instanceof AiConnectorError && error.code === "timeout",
    );
  } finally {
    slow.cleanup();
  }
});

test("checkCli reports the version and is cached in status", async () => {
  const { service, cleanup } = makeService({
    resolveCli: async (command) => (command === "gemini" ? "/opt/bin/gemini" : null),
    runCli: async () => ({ code: 0, stdout: "0.21.0\n", stderr: "", timedOut: false }),
  });
  try {
    assert.equal((await service.statusOf("gemini")).cli, null);
    assert.deepEqual(await service.checkCli("gemini"), {
      installed: true,
      path: "/opt/bin/gemini",
      version: "0.21.0",
    });
    assert.equal((await service.statusOf("gemini")).cli?.version, "0.21.0");
    assert.equal((await service.checkCli("claude")).installed, false);
    assert.equal((await service.statusOf("deepseek")).cli, null, "no CLI connector");
  } finally {
    cleanup();
  }
});
