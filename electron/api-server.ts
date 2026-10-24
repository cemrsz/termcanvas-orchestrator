import { execFileSync } from "node:child_process";
import http from "http";
import path from "node:path";
import type { BrowserWindow } from "electron";
import type { PtyManager } from "./pty-manager";
import type { ProjectScanner } from "./project-scanner";
import { getApiDiff } from "./git-diff";
import type { TelemetryService } from "./telemetry-service";
import { buildGitWorktreeRemoveArgs } from "../hydra/src/cleanup";
import {
  buildGitWorktreeAddArgs,
  validateWorktreePath,
} from "../hydra/src/spawn";
import { PinStore, PinStoreError } from "./pin-store";
import { resolveCanvasProjectRoot } from "./pin-project-resolver";
import { renderPinToPng } from "./pin-render";
import { cleanupPinRenderCache } from "./pin-render-utils";
import {
  createDefaultComposerSubmitDeps,
  submitComposerRequest,
} from "./composer-submit";
import { extractLastAssistantReply, stripAnsi } from "./orchestrator-bridge";
import type { OrchestratorManifest } from "../src/types/orchestration";
import type { TerminalType } from "../src/types";
import type { TeamHub } from "./team-hub";
import { TeamApi, matchTeamRoute } from "./team-api";

interface ApiServerDeps {
  getWindow: () => BrowserWindow | null;
  ptyManager: PtyManager;
  projectScanner: ProjectScanner;
  telemetryService: TelemetryService;
  taskStore: PinStore;
  teamHub?: TeamHub;
}

export class ApiServer {
  private server: http.Server | null = null;
  private deps: ApiServerDeps;
  private teamApi: TeamApi | null;

  constructor(deps: ApiServerDeps) {
    this.deps = deps;
    this.teamApi = deps.teamHub
      ? new TeamApi({
          hub: deps.teamHub,
          ptyManager: deps.ptyManager,
          telemetryService: deps.telemetryService,
        })
      : null;
  }

  start(): Promise<number> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) =>
        this.handleRequest(req, res),
      );
      this.server.timeout = 30_000;
      this.server.listen(0, "127.0.0.1", () => {
        const addr = this.server!.address();
        const port = typeof addr === "object" && addr ? addr.port : 0;
        resolve(port);
      });
      this.server.on("error", reject);
    });
  }

  stop() {
    this.server?.close();
  }

  private async handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ) {
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
    const method = req.method ?? "GET";
    const pathname = url.pathname;

    res.setHeader("Content-Type", "application/json");

    try {
      const body =
        method === "POST" || method === "PUT" || method === "DELETE"
          ? await this.readBody(req)
          : null;
      const result = await this.route(method, pathname, url, body);
      res.writeHead(200);
      res.end(JSON.stringify(result));
    } catch (err: any) {
      const status = err.status ?? 500;
      res.writeHead(status);
      res.end(JSON.stringify({ error: err.message ?? "Internal error" }));
    }
  }

  private async route(
    method: string,
    pathname: string,
    url: URL,
    body: any,
  ): Promise<any> {
    if (method === "POST" && pathname === "/project/add") {
      return this.projectAdd(body);
    }
    if (method === "GET" && pathname === "/project/list") {
      return this.projectList();
    }
    if (method === "DELETE" && pathname.match(/^\/project\/[^/]+$/)) {
      const id = pathname.split("/")[2];
      return this.projectRemove(id);
    }
    if (method === "POST" && pathname.match(/^\/project\/[^/]+\/rescan$/)) {
      const id = pathname.split("/")[2];
      return this.projectRescan(id);
    }

    if (method === "GET" && pathname === "/worktree/list") {
      const repoPath = url.searchParams.get("repo");
      return this.worktreeList(repoPath);
    }
    if (method === "POST" && pathname === "/worktree/create") {
      return this.worktreeCreate(body);
    }
    if (method === "DELETE" && pathname === "/worktree") {
      return this.worktreeRemove(url);
    }

    if (method === "POST" && pathname === "/terminal/create") {
      return this.terminalCreate(body);
    }
    if (method === "GET" && pathname === "/terminal/list") {
      const worktree = url.searchParams.get("worktree");
      return this.terminalList(worktree);
    }
    if (method === "GET" && pathname.match(/^\/terminal\/[^/]+\/status$/)) {
      const id = pathname.split("/")[2];
      return this.terminalStatus(id);
    }
    if (method === "GET" && pathname.match(/^\/terminal\/[^/]+\/output$/)) {
      const id = pathname.split("/")[2];
      const lines = parseInt(url.searchParams.get("lines") ?? "50", 10);
      return this.terminalOutput(id, lines);
    }
    if (method === "DELETE" && pathname.match(/^\/terminal\/[^/]+$/)) {
      const id = pathname.split("/")[2];
      return this.terminalDestroy(id);
    }
    if (
      method === "PUT" &&
      pathname.match(/^\/terminal\/[^/]+\/custom-title$/)
    ) {
      const id = pathname.split("/")[2];
      return this.terminalSetCustomTitle(id, body);
    }

    if (method === "GET" && pathname.match(/^\/telemetry\/terminal\/[^/]+$/)) {
      const id = pathname.split("/")[3];
      return this.terminalTelemetry(id);
    }
    if (
      method === "GET" &&
      pathname.match(/^\/telemetry\/terminal\/[^/]+\/events$/)
    ) {
      const id = pathname.split("/")[3];
      const limit = parseInt(url.searchParams.get("limit") ?? "50", 10);
      const cursor = url.searchParams.get("cursor") ?? undefined;
      return this.terminalTelemetryEvents(id, limit, cursor);
    }
    if (method === "GET" && pathname.match(/^\/telemetry\/workflow\/[^/]+$/)) {
      const id = pathname.split("/")[3];
      const repoPath = url.searchParams.get("repo");
      return this.workflowTelemetry(id, repoPath);
    }

    if (method === "GET" && pathname.startsWith("/diff/")) {
      const worktreePath = decodeURIComponent(pathname.slice("/diff/".length));
      const summary = url.searchParams.has("summary");
      return this.getDiff(worktreePath, summary);
    }

    if (method === "GET" && pathname === "/api/memory/index") {
      const worktree = url.searchParams.get("worktree");
      return this.memoryIndex(worktree);
    }

    if (method === "GET" && pathname === "/state") {
      return this.getState();
    }

    if (method === "GET" && pathname === "/pin/list") {
      return this.pinList(url);
    }
    if (method === "POST" && pathname === "/pin/create") {
      return this.pinCreate(body);
    }
    if (method === "POST" && pathname.match(/^\/pin\/[^/]+\/render$/)) {
      const id = pathname.split("/")[2];
      return this.pinRender(id, body);
    }
    if (method === "GET" && pathname.match(/^\/pin\/[^/]+$/)) {
      const id = pathname.split("/")[2];
      return this.pinGet(url, id);
    }
    if (method === "PUT" && pathname.match(/^\/pin\/[^/]+$/)) {
      const id = pathname.split("/")[2];
      return this.pinUpdate(id, body);
    }
    if (method === "DELETE" && pathname.match(/^\/pin\/[^/]+$/)) {
      const id = pathname.split("/")[2];
      return this.pinRemove(url, id);
    }

    if (method === "GET" && pathname === "/orchestrator/list") {
      return this.execRenderer(`window.__tcApi.listOrchestrators()`);
    }
    if (method === "GET" && pathname.match(/^\/orchestrator\/[^/]+$/)) {
      const id = decodeURIComponent(pathname.split("/")[2]);
      return this.orchestratorManifest(id);
    }
    if (method === "GET" && pathname.match(/^\/orchestrator\/[^/]+\/agent$/)) {
      const id = decodeURIComponent(pathname.split("/")[2]);
      return this.orchestratorAgent(id, url.searchParams.get("agent"));
    }
    if (method === "POST" && pathname.match(/^\/orchestrator\/[^/]+\/send$/)) {
      const id = decodeURIComponent(pathname.split("/")[2]);
      return this.orchestratorSend(id, body);
    }
    if (method === "GET" && pathname.match(/^\/orchestrator\/[^/]+\/reply$/)) {
      const id = decodeURIComponent(pathname.split("/")[2]);
      return this.orchestratorReply(id, url.searchParams.get("agent"));
    }

    const teamRoute = matchTeamRoute(pathname);
    if (teamRoute) {
      if (!this.teamApi) {
        throw Object.assign(new Error("Teams are not available"), {
          status: 503,
        });
      }
      return this.teamApi.handle(
        method,
        teamRoute.agentId,
        teamRoute.action,
        url,
        body,
      );
    }

    throw Object.assign(new Error("Not found"), { status: 404 });
  }


  private async execRenderer(code: string): Promise<any> {
    const win = this.deps.getWindow();
    if (!win)
      throw Object.assign(new Error("No active window"), { status: 503 });

    // Wrap in renderer-side try-catch so the actual error message survives
    // instead of Electron's generic "Script failed to execute" wrapper.
    const wrapped = `(async()=>{try{return await(${code})}catch(e){return{__tcErr:true,message:e.message,stack:e.stack}}})()`;
    const result = await win.webContents.executeJavaScript(wrapped);
    if (result && result.__tcErr) {
      throw Object.assign(new Error(result.message), { status: 500 });
    }
    return result;
  }

  private readBody(req: http.IncomingMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      let data = "";
      req.on("data", (chunk: string) => {
        data += chunk;
        if (Buffer.byteLength(data, "utf8") > 1024 * 1024) {
          reject(
            Object.assign(new Error("Request body too large"), { status: 413 }),
          );
        }
      });
      req.on("end", () => {
        try {
          resolve(data ? JSON.parse(data) : {});
        } catch {
          reject(Object.assign(new Error("Invalid JSON"), { status: 400 }));
        }
      });
      req.on("error", reject);
    });
  }

  private async projectAdd(body: any) {
    const dirPath = body?.path;
    if (!dirPath)
      throw Object.assign(new Error("path is required"), { status: 400 });

    const scanned = this.deps.projectScanner.scan(dirPath);
    if (!scanned)
      throw Object.assign(new Error("Not a git repository"), { status: 400 });

    const projectData = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: scanned.name,
      path: scanned.path,
      position: { x: 0, y: 0 },
      collapsed: false,
      zIndex: 0,
      worktrees: scanned.worktrees.map((wt: any, i: number) => ({
        id: `${Date.now()}-wt-${i}`,
        name: wt.branch,
        path: wt.path,
        position: { x: 0, y: i * 400 },
        collapsed: false,
        terminals: [],
      })),
    };

    await this.execRenderer(
      `window.__tcApi.addProject(${JSON.stringify(projectData)})`,
    );
    return {
      id: projectData.id,
      name: projectData.name,
      worktrees: projectData.worktrees.length,
    };
  }

  private async projectList() {
    return this.execRenderer(`window.__tcApi.getProjects()`);
  }

  private async projectRemove(id: string) {
    await this.execRenderer(
      `window.__tcApi.removeProject(${JSON.stringify(id)})`,
    );
    return { ok: true };
  }

  private async projectRescan(projectId: string) {
    const projects = await this.execRenderer(`window.__tcApi.getProjects()`);
    const project = projects.find((p: any) => p.id === projectId);
    if (!project)
      throw Object.assign(new Error("Project not found"), { status: 404 });

    const worktrees = this.deps.projectScanner.listWorktrees(project.path);
    await this.execRenderer(
      `window.__tcApi.syncWorktrees(${JSON.stringify(project.path)}, ${JSON.stringify(worktrees)})`,
    );
    return { ok: true, worktrees: worktrees.length };
  }

  private worktreeList(repoPath: string | null) {
    if (!repoPath) {
      throw Object.assign(new Error("repo query parameter is required"), {
        status: 400,
      });
    }
    const repo = path.resolve(repoPath);
    return this.deps.projectScanner.listWorktrees(repo);
  }

  private async worktreeCreate(body: any) {
    const repoInput = body?.repo ?? body?.repoPath;
    const branch = body?.branch as string | undefined;
    const requestedPath = body?.path ?? body?.worktreePath;
    const baseBranch = body?.baseBranch as string | undefined;
    if (!repoInput) {
      throw Object.assign(new Error("repo is required"), { status: 400 });
    }
    if (!branch) {
      throw Object.assign(new Error("branch is required"), { status: 400 });
    }

    const repo = path.resolve(repoInput);
    const resolvedWorktree = validateWorktreePath(
      repo,
      requestedPath
        ? path.resolve(requestedPath)
        : path.join(repo, ".worktrees", branch.replace(/[\\/]/g, "-")),
    );
    const base = baseBranch?.trim() || this.getCurrentBranch(repo);

    execFileSync(
      "git",
      buildGitWorktreeAddArgs(branch, resolvedWorktree, base),
      { cwd: repo, encoding: "utf-8" },
    );

    const worktrees = await this.syncRepoWorktrees(repo);
    return {
      path: resolvedWorktree,
      branch,
      base_branch: base,
      worktrees,
    };
  }

  private async worktreeRemove(url: URL) {
    const repoInput = url.searchParams.get("repo");
    const worktreeInput = url.searchParams.get("path");
    if (!repoInput) {
      throw Object.assign(new Error("repo query parameter is required"), {
        status: 400,
      });
    }
    if (!worktreeInput) {
      throw Object.assign(new Error("path query parameter is required"), {
        status: 400,
      });
    }
    const forceParam = url.searchParams.get("force");
    const force = forceParam === "1" || forceParam === "true";

    const repo = path.resolve(repoInput);
    const resolvedWorktree = validateWorktreePath(repo, worktreeInput);
    const args = force
      ? buildGitWorktreeRemoveArgs(resolvedWorktree)
      : ["worktree", "remove", resolvedWorktree];
    execFileSync("git", args, { cwd: repo, encoding: "utf-8" });

    const worktrees = await this.syncRepoWorktrees(repo);
    return { ok: true, path: resolvedWorktree, worktrees };
  }

  private getCurrentBranch(repoPath: string): string {
    try {
      return execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
        cwd: repoPath,
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
    } catch {
      return "main";
    }
  }

  private async syncRepoWorktrees(repo: string) {
    const worktrees = this.deps.projectScanner.listWorktrees(repo);
    try {
      await this.execRenderer(
        `window.__tcApi.syncWorktrees(${JSON.stringify(repo)}, ${JSON.stringify(worktrees)})`,
      );
    } catch {
      // Renderer may not be ready or project may not be tracked in UI; the
      // git operation already succeeded and the scan reflects on-disk state.
    }
    return worktrees;
  }

  private async terminalCreate(body: any) {
    const worktree = body?.worktree;
    const type = body?.type ?? "shell";
    const prompt = body?.prompt as string | undefined;
    const autoApprove = body?.autoApprove as boolean | undefined;
    const parentTerminalId = body?.parentTerminalId as string | undefined;
    const workflowId = body?.workflowId as string | undefined;
    const assignmentId = body?.assignmentId as string | undefined;
    const repoPath = body?.repoPath as string | undefined;
    if (!worktree)
      throw Object.assign(new Error("worktree path is required"), {
        status: 400,
      });

    const projects = await this.execRenderer(`window.__tcApi.getProjects()`);
    let projectId: string | null = null;
    let worktreeId: string | null = null;

    for (const p of projects) {
      for (const w of p.worktrees) {
        if (w.path === worktree) {
          projectId = p.id;
          worktreeId = w.id;
          break;
        }
      }
      if (projectId) break;
    }

    if (!projectId || !worktreeId) {
      throw Object.assign(new Error("Worktree not found on canvas"), {
        status: 404,
      });
    }

    const terminal = await this.execRenderer(
      `window.__tcApi.addTerminal(${JSON.stringify(projectId)}, ${JSON.stringify(worktreeId)}, ${JSON.stringify(type)}, ${JSON.stringify(prompt)}, ${JSON.stringify(!!autoApprove)}, ${JSON.stringify(parentTerminalId ?? null)})`,
    );
    this.deps.telemetryService.registerTerminal({
      terminalId: terminal.id,
      worktreePath: worktree,
      provider: type === "claude" || type === "codex" ? type : "unknown",
      workflowId,
      assignmentId,
      repoPath,
    });
    return { id: terminal.id, type: terminal.type, title: terminal.title };
  }

  private async terminalList(worktreePath: string | null) {
    const projects = await this.execRenderer(`window.__tcApi.getProjects()`);
    const terminals: any[] = [];

    for (const p of projects) {
      for (const w of p.worktrees) {
        if (worktreePath && w.path !== worktreePath) continue;
        for (const t of w.terminals) {
          terminals.push({
            id: t.id,
            title: t.title,
            type: t.type,
            status: t.status,
            ptyId: t.ptyId,
            worktree: w.path,
            project: p.name,
          });
        }
      }
    }
    return terminals;
  }

  private async terminalStatus(terminalId: string) {
    const terminal = await this.execRenderer(
      `window.__tcApi.getTerminal(${JSON.stringify(terminalId)})`,
    );
    if (!terminal)
      throw Object.assign(new Error("Terminal not found"), { status: 404 });
    return { id: terminal.id, status: terminal.status, ptyId: terminal.ptyId };
  }

  private async terminalOutput(terminalId: string, lines: number) {
    const terminal = await this.execRenderer(
      `window.__tcApi.getTerminal(${JSON.stringify(terminalId)})`,
    );
    if (!terminal)
      throw Object.assign(new Error("Terminal not found"), { status: 404 });
    if (!terminal.ptyId) return { id: terminalId, lines: [] };
    const output = this.deps.ptyManager.getOutput(terminal.ptyId, lines);
    return { id: terminalId, lines: output };
  }

  private async terminalDestroy(terminalId: string) {
    const terminal = await this.execRenderer(
      `window.__tcApi.getTerminal(${JSON.stringify(terminalId)})`,
    );
    if (!terminal)
      throw Object.assign(new Error("Terminal not found"), { status: 404 });
    if (terminal.ptyId) {
      this.deps.ptyManager.destroy(terminal.ptyId);
    }
    await this.execRenderer(
      `window.__tcApi.removeTerminal(${JSON.stringify(terminal.projectId)}, ${JSON.stringify(terminal.worktreeId)}, ${JSON.stringify(terminalId)})`,
    );
    return { ok: true };
  }

  private async terminalSetCustomTitle(terminalId: string, body: any) {
    const customTitle = body?.customTitle;
    if (typeof customTitle !== "string")
      throw Object.assign(new Error("customTitle is required"), {
        status: 400,
      });

    await this.execRenderer(
      `window.__tcApi.setCustomTitle(${JSON.stringify(terminalId)}, ${JSON.stringify(customTitle)})`,
    );
    return { ok: true };
  }

  private async terminalTelemetry(terminalId: string) {
    const snapshot = this.deps.telemetryService.getTerminalSnapshot(terminalId);
    if (!snapshot) {
      throw Object.assign(new Error("Telemetry terminal not found"), {
        status: 404,
      });
    }
    return snapshot;
  }

  private async terminalTelemetryEvents(
    terminalId: string,
    limit: number,
    cursor?: string,
  ) {
    return this.deps.telemetryService.listTerminalEvents({
      terminalId,
      limit,
      cursor,
    });
  }

  private async workflowTelemetry(workflowId: string, repoPath: string | null) {
    if (!repoPath) {
      throw Object.assign(new Error("repo query parameter is required"), {
        status: 400,
      });
    }
    const snapshot = this.deps.telemetryService.getWorkflowSnapshot(
      repoPath,
      workflowId,
    );
    if (!snapshot) {
      throw Object.assign(new Error("Workflow telemetry not found"), {
        status: 404,
      });
    }
    return snapshot;
  }

  private async memoryIndex(worktree: string | null) {
    if (!worktree) {
      throw Object.assign(new Error("worktree query parameter is required"), {
        status: 400,
      });
    }

    const { getMemoryDirForWorktree, scanMemoryDir } =
      await import("./memory-service.js");
    const { generateEnhancedIndex } =
      await import("./memory-index-generator.js");

    const memDir = getMemoryDirForWorktree(worktree);
    const graph = scanMemoryDir(memDir);
    const index = generateEnhancedIndex(graph.nodes);
    return { index };
  }

  private async getDiff(worktreePath: string, summary: boolean) {
    try {
      return await getApiDiff(worktreePath, summary);
    } catch (err: any) {
      throw Object.assign(new Error(`Failed to get diff: ${err.message}`), {
        status: 400,
      });
    }
  }

  private async getState() {
    return this.execRenderer(`window.__tcApi.getProjects()`);
  }

  private async loadOrchestratorManifest(
    orchestratorId: string,
  ): Promise<OrchestratorManifest> {
    const manifest = (await this.execRenderer(
      `window.__tcApi.getOrchestratorManifest(${JSON.stringify(orchestratorId)})`,
    )) as OrchestratorManifest | null;
    if (!manifest) {
      throw Object.assign(new Error("Orchestrator not found on canvas"), {
        status: 404,
      });
    }
    return manifest;
  }

  private withTelemetry(agent: OrchestratorManifest["agents"][number]) {
    const snapshot = this.deps.telemetryService.getTerminalSnapshot(agent.id);
    return {
      ...agent,
      turnState: snapshot?.turn_state ?? null,
      turnStartedAt: snapshot?.turn_started_at ?? null,
      lastOutputAt: snapshot?.last_output_at ?? null,
      derivedStatus: snapshot?.derived_status ?? null,
    };
  }

  /**
   * Resolve an agent reference (1-based number, id, or name) against the
   * agents wired to this orchestrator. Unwired terminals never resolve.
   */
  private resolveOrchestratorAgent(
    manifest: OrchestratorManifest,
    ref: string | null | undefined,
  ) {
    const agents = manifest.agents;
    const value = (ref ?? "").trim();
    if (!value) {
      throw Object.assign(new Error("agent is required"), { status: 400 });
    }
    if (/^\d+$/.test(value)) {
      const byIndex = agents[parseInt(value, 10) - 1];
      if (byIndex) return byIndex;
    }
    const lower = value.toLowerCase();
    const exact = agents.filter(
      (agent) => agent.id === value || agent.name.toLowerCase() === lower,
    );
    if (exact.length === 1) return exact[0];
    const partial = agents.filter((agent) =>
      agent.name.toLowerCase().includes(lower),
    );
    if (exact.length === 0 && partial.length === 1) return partial[0];
    const wired =
      agents.map((agent, i) => `${i + 1}. ${agent.name}`).join(", ") || "none";
    throw Object.assign(
      new Error(
        `No single wired agent matches '${value}'. Wired agents: ${wired}`,
      ),
      { status: 404 },
    );
  }

  private async orchestratorManifest(orchestratorId: string) {
    const manifest = await this.loadOrchestratorManifest(orchestratorId);
    return {
      ...manifest,
      agents: manifest.agents.map((agent) => this.withTelemetry(agent)),
    };
  }

  private async orchestratorAgent(orchestratorId: string, ref: string | null) {
    const manifest = await this.loadOrchestratorManifest(orchestratorId);
    const agent = this.resolveOrchestratorAgent(manifest, ref);
    return { agent: this.withTelemetry(agent) };
  }

  private async orchestratorSend(orchestratorId: string, body: any) {
    const text = body?.text;
    if (typeof text !== "string" || text.trim().length === 0) {
      throw Object.assign(new Error("text is required"), { status: 400 });
    }
    const manifest = await this.loadOrchestratorManifest(orchestratorId);
    const agent = this.resolveOrchestratorAgent(manifest, body?.agent);
    if (!agent.ptyId || !this.deps.ptyManager.getPid(agent.ptyId)) {
      throw Object.assign(
        new Error(`${agent.name} is not running on the canvas`),
        { status: 409 },
      );
    }

    const result = await submitComposerRequest(
      {
        terminalId: agent.id,
        ptyId: agent.ptyId,
        terminalType: agent.type as TerminalType,
        worktreePath: agent.worktreePath,
        text,
        images: [],
      },
      createDefaultComposerSubmitDeps(
        process.platform as "darwin" | "win32" | "linux",
        () => {
          throw new Error("Images are not supported over the orchestrator API");
        },
        (ptyId, data) => this.deps.ptyManager.write(ptyId, data),
      ),
    );
    if (!result.ok) {
      throw Object.assign(
        new Error(result.detail ?? result.error ?? "Send failed"),
        { status: 500 },
      );
    }
    return { ok: true, agent: { id: agent.id, name: agent.name } };
  }

  private async orchestratorReply(orchestratorId: string, ref: string | null) {
    const manifest = await this.loadOrchestratorManifest(orchestratorId);
    const agent = this.withTelemetry(
      this.resolveOrchestratorAgent(manifest, ref),
    );
    const sessionFile =
      this.deps.telemetryService.getTerminalSnapshot(agent.id)?.session_file;
    const sessionReply = sessionFile
      ? extractLastAssistantReply(sessionFile)
      : null;
    if (sessionReply) {
      return { agent, source: "session", reply: sessionReply };
    }
    // No transcript (e.g. a shell worker): fall back to the screen buffer.
    const lines = agent.ptyId
      ? this.deps.ptyManager.getOutput(agent.ptyId, 80)
      : [];
    return {
      agent,
      source: "terminal",
      reply: stripAnsi(lines.join("\n")).trim(),
    };
  }

  private async pinList(url: URL) {
    const inputRepo = requireRepoQuery(url);
    const projects = await this.execRenderer(`window.__tcApi.getProjects()`);
    const canonicalRepo = resolveCanvasProjectRoot(inputRepo, projects);
    return { pins: this.deps.taskStore.list(canonicalRepo) };
  }

  private async pinCreate(body: any) {
    const inputRepo = body?.repo;
    if (!inputRepo) {
      throw Object.assign(new Error("repo is required"), { status: 400 });
    }
    const projects = await this.execRenderer(`window.__tcApi.getProjects()`);
    const canonicalRepo = resolveCanvasProjectRoot(inputRepo, projects);
    try {
      const pin = this.deps.taskStore.create({
        title: body?.title,
        repo: canonicalRepo,
        body: body?.body,
        status: body?.status,
        links: body?.links,
      });
      return { pin };
    } catch (err) {
      throw rethrowPinStoreError(err);
    }
  }

  private async pinGet(url: URL, id: string) {
    const inputRepo = requireRepoQuery(url);
    const projects = await this.execRenderer(`window.__tcApi.getProjects()`);
    const canonicalRepo = resolveCanvasProjectRoot(inputRepo, projects);
    try {
      const pins = this.deps.taskStore.list(canonicalRepo);
      cleanupPinRenderCache(canonicalRepo, pins.map((pin) => pin.id));
      const pin = this.deps.taskStore.get(canonicalRepo, id);
      if (!pin) {
        throw Object.assign(new Error(`Pin not found: ${id}`), { status: 404 });
      }
      return { pin };
    } catch (err) {
      throw rethrowPinStoreError(err);
    }
  }

  private async pinRender(id: string, body: any) {
    const inputRepo = body?.repo;
    if (!inputRepo) {
      throw Object.assign(new Error("repo is required"), { status: 400 });
    }
    const projects = await this.execRenderer(`window.__tcApi.getProjects()`);
    const canonicalRepo = resolveCanvasProjectRoot(inputRepo, projects);
    try {
      const pin = this.deps.taskStore.get(canonicalRepo, id);
      if (!pin) {
        throw Object.assign(new Error(`Pin not found: ${id}`), { status: 404 });
      }
      return await renderPinToPng(pin, {
        outputPath: body?.outputPath,
        width: body?.width,
        height: body?.height,
        waitMs: body?.waitMs,
        fullPage: body?.fullPage,
      });
    } catch (err) {
      throw rethrowPinStoreError(err);
    }
  }

  private async pinUpdate(id: string, body: any) {
    const inputRepo = body?.repo;
    if (!inputRepo) {
      throw Object.assign(new Error("repo is required"), { status: 400 });
    }
    const projects = await this.execRenderer(`window.__tcApi.getProjects()`);
    const canonicalRepo = resolveCanvasProjectRoot(inputRepo, projects);
    try {
      const pin = this.deps.taskStore.update(canonicalRepo, id, {
        title: body?.title,
        status: body?.status,
        body: body?.body,
        links: body?.links,
      });
      return { pin };
    } catch (err) {
      throw rethrowPinStoreError(err);
    }
  }

  private async pinRemove(url: URL, id: string) {
    const inputRepo = requireRepoQuery(url);
    const projects = await this.execRenderer(`window.__tcApi.getProjects()`);
    const canonicalRepo = resolveCanvasProjectRoot(inputRepo, projects);
    try {
      this.deps.taskStore.remove(canonicalRepo, id);
      return { ok: true };
    } catch (err) {
      throw rethrowPinStoreError(err);
    }
  }
}

function requireRepoQuery(url: URL): string {
  const repo = url.searchParams.get("repo");
  if (!repo) {
    throw Object.assign(new Error("repo query parameter is required"), {
      status: 400,
    });
  }
  return repo;
}

function rethrowPinStoreError(err: unknown): Error {
  if (err instanceof PinStoreError) {
    return Object.assign(new Error(err.message), { status: err.status });
  }
  return err instanceof Error ? err : new Error(String(err));
}
