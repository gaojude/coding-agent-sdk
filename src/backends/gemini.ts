/**
 * Gemini CLI Backend Adapter
 */

import { spawn } from "node:child_process";
import * as readline from "node:readline";
import type { UnifiedEvent } from "../events.js";
import type { QueryOptions } from "../types.js";
import { BackendNotAvailableError } from "../types.js";
import { mapGeminiEvent } from "../mappers/gemini-mapper.js";
import { resolveBinaryPath } from "../utils/auto-detect.js";

/**
 * Check if Gemini CLI is available in PATH.
 */
async function checkGeminiCLI(cliPath: string = "gemini"): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cliPath, ["--version"], { stdio: "pipe" });

    child.on("error", (error: any) => {
      if (error.code === "ENOENT") {
        reject(
          new BackendNotAvailableError(
            "gemini",
            `Gemini CLI not found at '${cliPath}'. Install from: https://github.com/google-gemini/gemini-cli`
          )
        );
      } else {
        reject(new BackendNotAvailableError("gemini", error.message));
      }
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new BackendNotAvailableError(
            "gemini",
            `Gemini CLI check failed with exit code ${code}`
          )
        );
      }
    });
  });
}

export async function* createGeminiBackend(
  prompt: string,
  options: QueryOptions
): AsyncGenerator<UnifiedEvent, void, unknown> {
  // Determine CLI path (resolve from known paths if not explicitly provided)
  const cliPath =
    options.backendOptions?.gemini?.cliPath || await resolveBinaryPath("gemini");

  // Check CLI availability
  await checkGeminiCLI(cliPath);

  // Build CLI arguments
  const args: string[] = ["--output-format", "stream-json", "-p", prompt];

  // YOLO mode (auto-approve)
  if (options.autoApprove !== false) {
    args.push("--yolo");
  }

  // Working directory
  if (options.workingDir) {
    args.push("--cd", options.workingDir);
  }

  // Resume session
  if (options.resume) {
    args.push("--resume", options.resume);
  }

  // Additional CLI args
  if (options.backendOptions?.gemini?.cliArgs) {
    args.push(...options.backendOptions.gemini.cliArgs);
  }

  // Spawn Gemini CLI
  const child = spawn(cliPath, args, {
    stdio: ["ignore", "pipe", "pipe"],
    cwd: options.workingDir || process.cwd(),
  });

  // Track session ID
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
        console.warn("Failed to parse Gemini event:", line);
        continue;
      }

      // Extract session ID from init event
      if (event.type === "init") {
        sessionId = event.session_id;
      }

      // Map to unified events
      const unifiedEvents = mapGeminiEvent(event);
      for (const unifiedEvent of unifiedEvents) {
        yield unifiedEvent;
      }
    }
  } catch (error: any) {
    // Emit error event
    yield {
      type: "error",
      severity: "fatal",
      message: error.message || "Gemini backend error",
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
 * Extract session ID from Gemini events.
 * Gemini provides session_id in init event.
 */
export function extractGeminiSessionId(
  events: UnifiedEvent[]
): string | undefined {
  for (const event of events) {
    if (event.type === "session" && event.session_id) {
      return event.session_id;
    }
  }
  return undefined;
}
