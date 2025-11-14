/**
 * Codex CLI Backend Adapter
 */

import { spawn } from "node:child_process";
import * as readline from "node:readline";
import type { UnifiedEvent } from "../events.js";
import type { QueryOptions } from "../types.js";
import { BackendNotAvailableError } from "../types.js";
import { mapCodexEvent } from "../mappers/codex-mapper.js";
import { resolveBinaryPath } from "../utils/auto-detect.js";

/**
 * Check if Codex CLI is available in PATH.
 */
async function checkCodexCLI(cliPath: string = "codex"): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cliPath, ["--version"], { stdio: "pipe" });

    child.on("error", (error: any) => {
      if (error.code === "ENOENT") {
        reject(
          new BackendNotAvailableError(
            "codex",
            `Codex CLI not found at '${cliPath}'. Install with: npm install -g @openai/codex`
          )
        );
      } else {
        reject(new BackendNotAvailableError("codex", error.message));
      }
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new BackendNotAvailableError(
            "codex",
            `Codex CLI check failed with exit code ${code}`
          )
        );
      }
    });
  });
}

export async function* createCodexBackend(
  prompt: string,
  options: QueryOptions
): AsyncGenerator<UnifiedEvent, void, unknown> {
  // Determine CLI path (resolve from known paths if not explicitly provided)
  const cliPath =
    options.backendOptions?.codex?.cliPath || await resolveBinaryPath("codex");

  // Check CLI availability
  await checkCodexCLI(cliPath);

  // Build CLI arguments
  const args: string[] = ["exec", "--experimental-json"];

  // Working directory
  if (options.workingDir) {
    args.push("--cd", options.workingDir);
  }

  // Auto-approve mode (YOLO)
  if (options.autoApprove !== false) {
    args.push("--config", 'approval_policy="auto_approve"');
  }

  // Resume session (thread ID)
  if (options.resume) {
    args.push("resume", options.resume);
  }

  // Backend-specific options
  if (options.backendOptions?.codex) {
    const codexOpts = options.backendOptions.codex;

    if (codexOpts.sandbox) {
      args.push("--sandbox", codexOpts.sandbox);
    }

    if (codexOpts.structuredOutput && codexOpts.outputSchemaFile) {
      args.push("--output-schema", codexOpts.outputSchemaFile);
    }
  }

  // Spawn Codex CLI
  const child = spawn(cliPath, args, {
    stdio: ["pipe", "pipe", "pipe"],
    cwd: options.workingDir || process.cwd(),
    env: {
      ...process.env,
      // Ensure API key is passed
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    },
  });

  // Write prompt to stdin and close
  child.stdin.write(prompt);
  child.stdin.end();

  // Track session ID (thread ID)
  let sessionId: string | undefined;

  // Stream stdout events
  const rl = readline.createInterface({
    input: child.stdout,
    crlfDelay: Infinity,
  });

  try {
    for await (const line of rl) {
      // Parse JSONL
      let event: any;
      try {
        event = JSON.parse(line);
      } catch (parseError) {
        console.warn("Failed to parse Codex event:", line);
        continue;
      }

      // Extract session ID from thread.started event
      if (event.type === "thread.started") {
        sessionId = event.thread_id;
      }

      // Map to unified events
      const unifiedEvents = mapCodexEvent(event);
      for (const unifiedEvent of unifiedEvents) {
        yield unifiedEvent;
      }
    }
  } catch (error: any) {
    // Emit error event
    yield {
      type: "error",
      severity: "fatal",
      message: error.message || "Codex backend error",
      stack_trace: error.stack,
    };
  } finally {
    // Ensure child process is cleaned up
    if (!child.killed) {
      child.kill();
    }
  }

  // Wait for process to exit
  await new Promise<void>((resolve) => {
    child.on("exit", () => resolve());
  });
}

/**
 * Extract session ID from Codex events.
 * Codex provides thread_id in thread.started event.
 */
export function extractCodexSessionId(
  events: UnifiedEvent[]
): string | undefined {
  for (const event of events) {
    if (event.type === "session" && event.session_id) {
      return event.session_id;
    }
  }
  return undefined;
}
