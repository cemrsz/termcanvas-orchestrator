/**
 * CLI side of the AI connectors: run a provider's own CLI once, without a
 * terminal, so a subscription login (Claude, Google, ChatGPT) works without
 * an API key.
 *
 *   Claude   claude -p --output-format text [--model m]       prompt on stdin
 *   Gemini   gemini [--model m]                               prompt on stdin (headless)
 *   ChatGPT  codex exec --output-last-message <f> [...] -     prompt on stdin
 *
 * The prompt always travels on stdin, never in argv: no quoting problems and
 * no command-line length limit on Windows.
 */

import { spawn } from "child_process";
import type { AiConnectorPlugin } from "../shared/ai-connectors";
import { AiConnectorError } from "./ai-connector-http";

const MAX_CLI_OUTPUT_BYTES = 2 * 1024 * 1024;
const MAX_CLI_STDERR_CHARS = 64 * 1024;

export interface CliCall {
  command: string;
  args: string[];
  stdin: string;
  /** Codex writes its final message here; read it instead of stdout. */
  outputFile?: string;
}

/** A CLI has no system-prompt flag we can rely on: put it in the prompt. */
export function composeCliPrompt(prompt: string, system?: string): string {
  const instructions = system?.trim();
  if (!instructions) return prompt;
  return `${instructions}\n\n---\n\n${prompt}`;
}

export function buildCliCall(
  plugin: AiConnectorPlugin,
  options: {
    model: string;
    prompt: string;
    system?: string;
    outputFile?: string;
  },
): CliCall {
  if (!plugin.cli) {
    throw new AiConnectorError(
      "no-cli",
      `${plugin.name} has no CLI transport. Use the API instead.`,
    );
  }
  const stdin = composeCliPrompt(options.prompt, options.system);
  const model = options.model.trim();
  const command = plugin.cli.command;

  if (plugin.id === "chatgpt") {
    return {
      command,
      args: [
        "exec",
        "--skip-git-repo-check",
        "--color",
        "never",
        ...(options.outputFile
          ? ["--output-last-message", options.outputFile]
          : []),
        ...(model ? ["--model", model] : []),
        "-",
      ],
      stdin,
      outputFile: options.outputFile,
    };
  }

  if (plugin.id === "gemini") {
    // Gemini CLI runs headless when stdin is not a TTY.
    return { command, args: model ? ["--model", model] : [], stdin };
  }

  return {
    command,
    args: ["-p", "--output-format", "text", ...(model ? ["--model", model] : [])],
    stdin,
  };
}

const ANSI_PATTERN =
  // eslint-disable-next-line no-control-regex
  /\x1b\[[0-?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[@-Z\\-_]/g;

export function cleanCliOutput(text: string): string {
  return text.replace(ANSI_PATTERN, "").replace(/\r\n?/g, "\n").trim();
}

/** Last few stderr lines, which is where CLIs explain a failure. */
export function tailLines(text: string, count: number): string {
  return cleanCliOutput(text).split("\n").slice(-count).join("\n").trim();
}

export interface CliRunResult {
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

/**
 * Spawn a resolved executable with `stdin` piped in. On timeout the whole
 * process group is killed, so CLIs do not leave MCP servers behind.
 */
export function runResolvedProcess(
  file: string,
  args: string[],
  options: {
    cwd: string;
    env: Record<string, string>;
    stdin: string;
    timeoutMs: number;
  },
): Promise<CliRunResult> {
  return new Promise((resolve, reject) => {
    const detached = process.platform !== "win32";
    const child = spawn(file, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
      detached,
    });
    let stdout = "";
    let stderr = "";
    let stdoutBytes = 0;
    let timedOut = false;
    let settled = false;

    const killTree = (signal: NodeJS.Signals) => {
      if (!child.pid) return;
      try {
        if (detached) process.kill(-child.pid, signal);
        else child.kill(signal);
      } catch {
        // Already gone.
      }
    };

    const timer = setTimeout(() => {
      timedOut = true;
      killTree("SIGTERM");
      setTimeout(() => killTree("SIGKILL"), 3_000).unref();
    }, options.timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdoutBytes += Buffer.byteLength(chunk);
      if (stdoutBytes <= MAX_CLI_OUTPUT_BYTES) stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      if (stderr.length < MAX_CLI_STDERR_CHARS) stderr += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;
      resolve({ code, stdout, stderr, timedOut });
    });
    child.stdin.on("error", () => {
      // The CLI may exit before it reads all of stdin.
    });
    child.stdin.end(options.stdin);
  });
}
