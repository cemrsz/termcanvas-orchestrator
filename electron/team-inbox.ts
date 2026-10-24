/**
 * Team inbox — a small HTTP endpoint on a fixed port that n8n workflows
 * (or any other HTTP client) call to push their output to the agents wired
 * to a source.
 *
 * The regular TermCanvas API binds a random port per launch, which n8n
 * cannot be configured with, so the inbox has its own stable port and a
 * secret token, both kept in `<data dir>/team-inbox.json`.
 *
 *   POST /inbox/<token>/<source id or name>     body: any JSON
 */

import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

export interface TeamInboxConfig {
  /** 127.0.0.1 by default; 0.0.0.0 lets n8n in Docker (Linux) reach it. */
  host: string;
  port: number;
  token: string;
}

export const DEFAULT_INBOX_PORT = 17890;
const MAX_BODY_BYTES = 1024 * 1024;

export function loadInboxConfig(dataDir: string): TeamInboxConfig {
  const file = path.join(dataDir, "team-inbox.json");
  let stored: Partial<TeamInboxConfig> = {};
  try {
    stored = JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    // First run.
  }
  const config: TeamInboxConfig = {
    host: typeof stored.host === "string" && stored.host ? stored.host : "127.0.0.1",
    port:
      typeof stored.port === "number" && stored.port > 0
        ? stored.port
        : DEFAULT_INBOX_PORT,
    token:
      typeof stored.token === "string" && stored.token.length >= 16
        ? stored.token
        : crypto.randomBytes(18).toString("hex"),
  };
  saveInboxConfig(dataDir, config);
  return config;
}

export function saveInboxConfig(dataDir: string, config: TeamInboxConfig) {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(
    path.join(dataDir, "team-inbox.json"),
    JSON.stringify(config, null, 2),
    { encoding: "utf-8", mode: 0o600 },
  );
}

function tokensMatch(given: string, expected: string) {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export type InboxHandler = (
  sourceRef: string,
  payload: unknown,
) => { source: string; deliveredTo: string[] };

export class TeamInboxServer {
  private server: http.Server | null = null;
  private boundPort: number | null = null;

  constructor(
    private config: TeamInboxConfig,
    private readonly handler: InboxHandler,
    /** Called when the configured port was taken and another one is used. */
    private readonly onPortMoved?: (config: TeamInboxConfig) => void,
  ) {}

  get port(): number | null {
    return this.boundPort;
  }

  getConfig(): TeamInboxConfig {
    return this.config;
  }

  /** Listen on the configured port, or the next free one of ten. */
  async start(): Promise<number> {
    let lastError: unknown = null;
    for (let offset = 0; offset < 10; offset++) {
      const port = this.config.port + offset;
      try {
        await this.listen(port);
        this.boundPort = port;
        if (port !== this.config.port) {
          // Keep the new port from now on: n8n workflows hold the URL.
          this.config = { ...this.config, port };
          this.onPortMoved?.(this.config);
        }
        return port;
      } catch (err) {
        lastError = err;
        if ((err as NodeJS.ErrnoException)?.code !== "EADDRINUSE") break;
      }
    }
    throw lastError ?? new Error("Could not start the team inbox");
  }

  private listen(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const server = http.createServer((req, res) => {
        void this.handle(req, res);
      });
      server.once("error", reject);
      server.listen(port, this.config.host, () => {
        server.off("error", reject);
        this.server = server;
        resolve();
      });
    });
  }

  stop() {
    this.server?.close();
    this.server = null;
    this.boundPort = null;
  }

  private send(res: http.ServerResponse, status: number, body: unknown) {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  }

  private readBody(req: http.IncomingMessage): Promise<unknown> {
    return new Promise((resolve, reject) => {
      let size = 0;
      const chunks: Buffer[] = [];
      req.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_BODY_BYTES) {
          reject(Object.assign(new Error("Body too large"), { status: 413 }));
          req.destroy();
          return;
        }
        chunks.push(chunk);
      });
      req.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf-8");
        if (!raw.trim()) {
          resolve(null);
          return;
        }
        try {
          resolve(JSON.parse(raw));
        } catch {
          // Plain text is fine too.
          resolve({ text: raw });
        }
      });
      req.on("error", reject);
    });
  }

  private async handle(req: http.IncomingMessage, res: http.ServerResponse) {
    try {
      const url = new URL(req.url ?? "/", "http://inbox");
      if (req.method === "GET" && url.pathname === "/health") {
        this.send(res, 200, { ok: true });
        return;
      }
      const parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
      if (parts[0] !== "inbox") {
        this.send(res, 404, { error: "Not found" });
        return;
      }
      // Token in the path (easiest to paste into n8n) or in a header.
      const headerToken = req.headers["x-termcanvas-token"];
      let token: string;
      let sourceRef: string;
      if (parts.length >= 3) {
        token = parts[1];
        sourceRef = parts.slice(2).join("/");
      } else {
        token = typeof headerToken === "string" ? headerToken : "";
        sourceRef = parts[1] ?? "";
      }
      if (!token || !tokensMatch(token, this.config.token)) {
        this.send(res, 401, { error: "Invalid token" });
        return;
      }
      if (req.method !== "POST") {
        this.send(res, 405, { error: "Use POST" });
        return;
      }
      if (!sourceRef) {
        this.send(res, 400, { error: "Missing source id or name in the path" });
        return;
      }
      const payload = await this.readBody(req);
      const result = this.handler(sourceRef, payload);
      this.send(res, 202, { ok: true, ...result });
    } catch (err) {
      const status = (err as { status?: number })?.status ?? 500;
      this.send(res, status, {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
