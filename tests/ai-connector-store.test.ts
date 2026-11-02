import test from "node:test";
import assert from "node:assert/strict";

import type { AiConnectorStatus } from "../shared/ai-connectors.ts";

const calls: string[] = [];
function status(id: string, extra: Partial<AiConnectorStatus> = {}): AiConnectorStatus {
  return {
    id: id as AiConnectorStatus["id"],
    hasStoredKey: false,
    keyHint: null,
    envKey: null,
    insecureStorage: false,
    model: "m",
    modelOverride: null,
    baseURL: "https://x",
    baseURLOverride: null,
    apiReady: false,
    cli: null,
    ...extra,
  };
}

Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: {
    termcanvas: {
      ai: {
        status: async () => {
          calls.push("status");
          return [status("gemini"), status("claude", { apiReady: true })];
        },
        setKey: async (id: string, key: string) => {
          calls.push(`setKey:${id}:${key.length}`);
          return status(id, { hasStoredKey: true, keyHint: "…abcd", apiReady: true });
        },
        clearKey: async (id: string) => status(id),
        setConfig: async (id: string) => status(id, { modelOverride: "x" }),
        checkCli: async () => ({ installed: true, path: "/bin/gemini", version: "1.0" }),
        listModels: async (id: string) =>
          id === "gemini" ? { ok: true, models: ["gemini-2.5-pro"] } : { ok: false, code: "no-key", error: "no key" },
        invoke: async (request: unknown, log: unknown) => {
          calls.push(`invoke:${JSON.stringify(log)}`);
          return { ok: true, text: "pong", model: "m", transport: "api", latencyMs: 5 };
        },
      },
    },
  },
});

const {
  invokeFromUi,
  modelSuggestions,
  transportReady,
  useAiConnectorStore,
} = await import("../src/stores/aiConnectorStore.ts");

test("refresh, key and CLI updates land in the store", async () => {
  const store = useAiConnectorStore;
  await store.getState().refresh();
  assert.equal(store.getState().loaded, true);
  assert.equal(store.getState().statuses.claude?.apiReady, true);

  await store.getState().setKey("gemini", "AIza-1234abcd");
  assert.equal(store.getState().statuses.gemini?.keyHint, "…abcd");
  assert.ok(calls.includes("setKey:gemini:13"));

  const cli = await store.getState().checkCli("gemini");
  assert.equal(cli?.installed, true);
  assert.equal(store.getState().statuses.gemini?.cli?.version, "1.0");
  assert.equal(await store.getState().checkCli("deepseek"), null, "no CLI to check");

  assert.deepEqual(await store.getState().fetchModels("gemini"), { ok: true, models: ["gemini-2.5-pro"] });
  assert.deepEqual(await store.getState().fetchModels("claude"), { ok: false, error: "no key" });
  assert.deepEqual(store.getState().models.gemini, ["gemini-2.5-pro"]);
});

test("suggestions merge fetched models with the catalog; readiness per transport", () => {
  const suggestions = modelSuggestions("gemini", ["gemini-x"]);
  assert.equal(suggestions[0], "gemini-x");
  assert.ok(suggestions.includes("gemini-flash-latest"));
  assert.equal(transportReady(undefined, "api"), null);
  assert.equal(transportReady(status("gemini", { apiReady: true }), "api"), true);
  assert.equal(transportReady(status("gemini"), "cli"), null, "unknown until checked");
  assert.equal(
    transportReady(status("gemini", { cli: { installed: false, path: null, version: null } }), "cli"),
    false,
  );
});

test("UI invocations can be logged in the feed", async () => {
  const outcome = await invokeFromUi({
    connector: "gemini",
    transport: "api",
    prompt: "ping",
    feedAs: { kind: "model", id: "ai-1", name: "Gemini", type: "gemini" },
    label: "test",
  });
  assert.equal(outcome.ok, true);
  assert.ok(calls.some((call) => call.startsWith("invoke:") && call.includes('"label":"test"')));
});
