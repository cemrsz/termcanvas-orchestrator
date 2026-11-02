import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";

import { buildBridgeScript } from "../electron/bridge-script.ts";

/**
 * Runs the generated tc.mjs against a fake TermCanvas API, the way an agent
 * would from its shell.
 */

interface FakeAgent {
  id: string;
  name: string;
  type: string;
  ptyId: number | null;
  via: "pipeline" | "orchestrator";
  turnState: string | null;
  turnStartedAt: string | null;
  lastOutputAt: string | null;
  awaitingApproval?: boolean;
  reply: string;
}

interface FakeModel {
  id: string;
  name: string;
  connector: string;
  connectorName: string;
  model: string;
  transport: "api" | "cli";
  persona: string;
  baseURL: string;
}

function makeFake() {
  const agents: FakeAgent[] = [
    {
      id: "g1",
      name: "Gemini",
      type: "gemini",
      ptyId: 11,
      via: "pipeline",
      turnState: null,
      turnStartedAt: null,
      lastOutputAt: null,
      reply: "Gemini says: use timingSafeEqual.",
    },
    {
      id: "c1",
      name: "Codex",
      type: "codex",
      ptyId: 12,
      via: "pipeline",
      turnState: "turn_complete",
      turnStartedAt: null,
      lastOutputAt: null,
      reply: "Codex says: tests added.",
    },
  ];
  const models: FakeModel[] = [
    {
      id: "m1",
      name: "ChatGPT",
      connector: "chatgpt",
      connectorName: "ChatGPT",
      model: "",
      transport: "api",
      persona: "Critic",
      baseURL: "",
    },
  ];
  const sends: { agent: string; text: string }[] = [];
  const asks: { model: string; prompt: string; label?: string }[] = [];

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      const json = body ? JSON.parse(body) : {};
      const send = (status: number, payload: unknown) => {
        res.writeHead(status, { "Content-Type": "application/json" });
        res.end(JSON.stringify(payload));
      };
      const find = (ref: string | null) =>
        agents.find((a) => a.id === ref || a.name.toLowerCase() === ref?.toLowerCase() || a.type === ref);
      if (url.pathname === "/bridge/self" && req.method === "GET") {
        return send(200, {
          self: { id: "self", title: "Claude", type: "claude", worktreePath: "/repo", role: "agent" },
          agents,
          models,
          sources: [],
        });
      }
      if (url.pathname === "/bridge/self/send") {
        const agent = find(json.agent);
        if (!agent) return send(404, { error: "no agent" });
        sends.push({ agent: agent.id, text: json.text });
        if (agent.type === "gemini") {
          // Gemini prints its answer a moment after the message arrives.
          agent.lastOutputAt = new Date(Date.now() + 1300).toISOString();
        } else {
          agent.turnStartedAt = new Date(Date.now() + 50).toISOString();
          agent.turnState = "turn_complete";
        }
        return send(200, { ok: true, agent: { id: agent.id, name: agent.name } });
      }
      if (url.pathname === "/bridge/self/agent") {
        const agent = find(url.searchParams.get("agent"));
        if (!agent) return send(404, { error: "no agent" });
        return send(200, { agent: { ...agent, awaitingApproval: !!agent.awaitingApproval } });
      }
      if (url.pathname === "/bridge/self/reply") {
        const agent = find(url.searchParams.get("agent"));
        if (!agent) return send(404, { error: "no agent" });
        return send(200, { agent, source: "screen", reply: agent.reply });
      }
      if (url.pathname === "/bridge/self/model") {
        const model = models.find((m) => m.id === json.model);
        if (!model) return send(404, { error: "no model" });
        asks.push({ model: model.id, prompt: json.prompt, label: json.label });
        return send(200, {
          ok: true,
          model: { id: model.id, name: model.name, connector: model.connector, model: "gpt-5", transport: "api" },
          text: `${model.name} answer #${asks.length}`,
          latencyMs: 1234,
          usage: { inputTokens: 10, outputTokens: 42 },
        });
      }
      if (url.pathname === "/bridge/self/event") return send(200, { ok: true });
      send(404, { error: "Not found" });
    });
  });
  return { server, agents, models, sends, asks };
}

async function withBridge(
  fn: (run: (...args: string[]) => Promise<{ code: number; stdout: string; stderr: string }>, fake: ReturnType<typeof makeFake>) => Promise<void>,
) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tc-bridge-"));
  const fake = makeFake();
  await new Promise<void>((resolve) => fake.server.listen(0, "127.0.0.1", resolve));
  const port = (fake.server.address() as { port: number }).port;
  const portFile = path.join(dir, "port");
  fs.writeFileSync(portFile, `${port}\n1`);
  const script = path.join(dir, "tc.mjs");
  fs.writeFileSync(script, buildBridgeScript({ terminalId: "self", portFile, role: "agent" }));
  const run = (...args: string[]) =>
    new Promise<{ code: number; stdout: string; stderr: string }>((resolve) => {
      execFile(
        process.execPath,
        [script, ...args],
        {
          cwd: dir,
          env: {
            ...process.env,
            TC_BRIDGE_QUIET_MS: "300",
            TC_BRIDGE_MIN_TURN_MS: "0",
            TC_BRIDGE_POLL_MS: "100",
          },
        },
        (error, stdout, stderr) => {
          resolve({ code: error ? ((error as { code?: number }).code ?? 1) : 0, stdout, stderr });
        },
      );
    });
  try {
    await fn(run, fake);
  } finally {
    fake.server.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test("peers lists agents with their numbers and models with M-numbers", async () => {
  await withBridge(async (run) => {
    const { stdout, code } = await run("peers");
    assert.equal(code, 0);
    assert.match(stdout, /You: Claude \[claude\]/);
    assert.match(stdout, /1\. Gemini {2}\[gemini\]/);
    assert.match(stdout, /2\. Codex {2}\[codex\]/);
    assert.match(stdout, /M1\. ChatGPT {2}\[ChatGPT · default model · api\]/);
    assert.match(stdout, /Critic/);
  });
});

test("ask picks the model when the name only fits a model", async () => {
  await withBridge(async (run, fake) => {
    const { stdout, code } = await run("ask", "chatgpt", "Is", "this", "safe?");
    assert.equal(code, 0);
    assert.match(stdout, /\[ChatGPT · gpt-5 · api · 1\.2s, 42 tokens\]/);
    assert.match(stdout, /ChatGPT answer #1/);
    assert.deepEqual(fake.asks.map((a) => a.prompt), ["Is this safe?"]);
    assert.equal(fake.sends.length, 0);
  });
});

test("ask a Gemini CLI agent waits for its screen to go quiet", async () => {
  await withBridge(async (run, fake) => {
    const started = Date.now();
    const { stdout, code } = await run("ask", "gemini", "Review", "auth.ts");
    assert.equal(code, 0, stdout);
    assert.deepEqual(fake.sends, [{ agent: "g1", text: "Review auth.ts" }]);
    assert.match(stdout, /\[Gemini finished\]\nGemini says: use timingSafeEqual\./);
    assert.ok(Date.now() - started >= 1300, "did not return before the answer was printed");
  });
});

test("ask a tracked agent (Codex) returns on turn_complete", async () => {
  await withBridge(async (run) => {
    const { stdout, code } = await run("ask", "2", "Add tests");
    assert.equal(code, 0);
    assert.match(stdout, /\[Codex finished: turn_complete\]\nCodex says: tests added\./);
  });
});

test("wait exits with 3 while the agent waits for the user's approval", async () => {
  await withBridge(async (run, fake) => {
    fake.agents[0].awaitingApproval = true;
    fake.agents[0].lastOutputAt = new Date(Date.now() - 60_000).toISOString();
    const { stdout, code } = await run("wait", "gemini", "--timeout", "5");
    assert.equal(code, 3);
    assert.match(stdout, /WAITING_FOR_APPROVAL: Gemini/);
  });
});

test("council asks every model and, with --agents, every agent", async () => {
  await withBridge(async (run, fake) => {
    const { stdout, code } = await run("council", "Which", "database?", "--agents");
    assert.equal(code, 0, stdout);
    assert.match(stdout, /Council of ChatGPT, Gemini, Codex/);
    assert.match(stdout, /ChatGPT answer #1/);
    assert.match(stdout, /\[Gemini\]\nGemini says/);
    assert.match(stdout, /\[Codex\]\nCodex says/);
    assert.equal(fake.asks[0].label, "council");
    assert.deepEqual(fake.sends.map((s) => s.agent).sort(), ["c1", "g1"]);
  });
});

test("discuss lets each participant see what the others said", async () => {
  await withBridge(async (run, fake) => {
    const { stdout, code } = await run("discuss", "M1,codex", "REST or GraphQL?", "--rounds", "2");
    assert.equal(code, 0, stdout);
    assert.match(stdout, /Discussion: ChatGPT ↔ Codex · 2 round\(s\)/);
    assert.equal(fake.asks.length, 2, "the model spoke in both rounds");
    assert.equal(fake.sends.length, 2, "the agent spoke in both rounds");
    assert.match(fake.asks[0].prompt, /You speak first\./);
    assert.match(fake.sends[0].text, /\[ChatGPT, round 1\]: ChatGPT answer #1/);
    assert.match(fake.asks[1].prompt, /\[Codex, round 1\]: Codex says: tests added\./);
    assert.equal(fake.asks[1].label, "discuss · round 2");
    assert.match(stdout, /### Codex · round 2/);
  });
});

test("ambiguous and unknown peers are explained", async () => {
  await withBridge(async (run, fake) => {
    fake.models.push({
      id: "m2",
      name: "Gemini Pro",
      connector: "gemini",
      connectorName: "Gemini",
      model: "gemini-2.5-pro",
      transport: "api",
      persona: "",
      baseURL: "",
    });
    let result = await run("ask", "gemini", "hi");
    assert.equal(result.code, 1);
    assert.match(result.stderr, /'gemini' is ambiguous/);
    result = await run("ask", "M2", "hi");
    assert.equal(result.code, 0);
    assert.match(result.stdout, /Gemini Pro answer/);
    result = await run("ask", "llama", "hi");
    assert.match(result.stderr, /Nothing wired to you matches 'llama'/);
  });
});
