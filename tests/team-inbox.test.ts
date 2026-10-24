import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";

import { TeamInboxServer, loadInboxConfig } from "../electron/team-inbox.ts";

test("inbox config is created once with a secret token", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tc-inbox-"));
  const first = loadInboxConfig(dir);
  assert.equal(first.host, "127.0.0.1");
  assert.ok(first.token.length >= 32);
  assert.deepEqual(loadInboxConfig(dir), first);
});

test("inbox checks the token, hands the payload over and keeps a moved port", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tc-inbox-"));
  // Occupy a port so the inbox has to move to the next one.
  const blocker = http.createServer();
  await new Promise<void>((resolve) => blocker.listen(0, "127.0.0.1", resolve));
  const takenPort = (blocker.address() as { port: number }).port;
  t.after(() => blocker.close());

  const received: { source: string; payload: unknown }[] = [];
  let moved: number | null = null;
  const inbox = new TeamInboxServer(
    { ...loadInboxConfig(dir), port: takenPort },
    (source, payload) => {
      if (source === "missing") throw Object.assign(new Error("No source"), { status: 404 });
      received.push({ source, payload });
      return { source, deliveredTo: ["Lead"] };
    },
    (config) => {
      moved = config.port;
    },
  );
  const port = await inbox.start();
  t.after(() => inbox.stop());
  assert.notEqual(port, takenPort);
  assert.equal(moved, port);

  const token = inbox.getConfig().token;
  const post = (urlPath: string, body: string, headers: Record<string, string> = {}) =>
    fetch(`http://127.0.0.1:${port}${urlPath}`, { method: "POST", body, headers });

  const ok = await post(`/inbox/${token}/New%20Leads`, JSON.stringify({ count: 2 }));
  assert.equal(ok.status, 202);
  assert.deepEqual(await ok.json(), { ok: true, source: "New Leads", deliveredTo: ["Lead"] });
  assert.deepEqual(received.at(-1), { source: "New Leads", payload: { count: 2 } });

  const viaHeader = await post("/inbox/src-1", "plain text", { "X-TermCanvas-Token": token });
  assert.equal(viaHeader.status, 202);
  assert.deepEqual(received.at(-1), { source: "src-1", payload: { text: "plain text" } });

  assert.equal((await post("/inbox/wrong/New%20Leads", "{}")).status, 401);
  assert.equal((await post(`/inbox/${token}/missing`, "{}")).status, 404);
  assert.equal((await fetch(`http://127.0.0.1:${port}/health`)).status, 200);
});
