import test from "node:test";
import assert from "node:assert/strict";

import { getAiConnector, type AiConnectorPlugin } from "../shared/ai-connectors.ts";
import {
  buildCliCall,
  cleanCliOutput,
  composeCliPrompt,
  runResolvedProcess,
  tailLines,
} from "../electron/ai-connector-cli.ts";
import { AiConnectorError } from "../electron/ai-connector-http.ts";

function plugin(id: string): AiConnectorPlugin {
  const found = getAiConnector(id);
  assert.ok(found);
  return found;
}

test("claude runs in print mode with the prompt on stdin", () => {
  const call = buildCliCall(plugin("claude"), {
    model: "claude-sonnet-5-5",
    prompt: "Review this diff",
    system: "You are a reviewer.",
  });
  assert.equal(call.command, "claude");
  assert.deepEqual(call.args, [
    "-p",
    "--output-format",
    "text",
    "--model",
    "claude-sonnet-5-5",
  ]);
  assert.equal(call.stdin, "You are a reviewer.\n\n---\n\nReview this diff");
  assert.ok(!call.args.some((arg) => arg.includes("Review")), "prompt stays off argv");
});

test("gemini runs headless from stdin and only passes a chosen model", () => {
  assert.deepEqual(
    buildCliCall(plugin("gemini"), { model: "", prompt: "Hi" }),
    { command: "gemini", args: [], stdin: "Hi" },
  );
  assert.deepEqual(
    buildCliCall(plugin("gemini"), { model: "gemini-2.5-pro", prompt: "Hi" }).args,
    ["--model", "gemini-2.5-pro"],
  );
});

test("chatgpt goes through codex exec and writes its last message to a file", () => {
  const call = buildCliCall(plugin("chatgpt"), {
    model: "",
    prompt: "Explain",
    outputFile: "/tmp/out.txt",
  });
  assert.equal(call.command, "codex");
  assert.deepEqual(call.args, [
    "exec",
    "--skip-git-repo-check",
    "--color",
    "never",
    "--output-last-message",
    "/tmp/out.txt",
    "-",
  ]);
  assert.equal(call.outputFile, "/tmp/out.txt");
  assert.equal(call.stdin, "Explain");
});

test("connectors without a CLI refuse the CLI transport", () => {
  assert.throws(
    () => buildCliCall(plugin("deepseek"), { model: "", prompt: "x" }),
    (error: unknown) => error instanceof AiConnectorError && error.code === "no-cli",
  );
});

test("CLI output helpers strip colors and keep the tail", () => {
  assert.equal(composeCliPrompt("p", "  "), "p");
  assert.equal(cleanCliOutput("\x1b[32mOK\x1b[0m\r\n"), "OK");
  assert.equal(tailLines("a\nb\nc\nd", 2), "c\nd");
});

test("runResolvedProcess pipes stdin and collects stdout", async () => {
  const result = await runResolvedProcess(
    process.execPath,
    ["-e", "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>process.stdout.write(s.toUpperCase()))"],
    { cwd: process.cwd(), env: process.env as Record<string, string>, stdin: "merhaba", timeoutMs: 10_000 },
  );
  assert.equal(result.code, 0);
  assert.equal(result.timedOut, false);
  assert.equal(result.stdout, "MERHABA");
});

test("runResolvedProcess kills a CLI that runs past its timeout", async () => {
  const started = Date.now();
  const result = await runResolvedProcess(
    process.execPath,
    ["-e", "setTimeout(()=>{}, 60000)"],
    { cwd: process.cwd(), env: process.env as Record<string, string>, stdin: "", timeoutMs: 300 },
  );
  assert.equal(result.timedOut, true);
  assert.ok(Date.now() - started < 10_000);
});
