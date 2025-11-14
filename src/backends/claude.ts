/**
 * Claude Code CLI Backend Adapter
 */

import { spawn } from "node:child_process";
import * as readline from "node:readline";
import type { UnifiedEvent } from "../events.js";
import type { QueryOptions } from "../types.js";
import { BackendNotAvailableError } from "../types.js";
import { mapClaudeEvent } from "../mappers/claude-mapper.js";
import { resolveBinaryPath } from "../utils/auto-detect.js";

/**
 * Check if Claude CLI is available in PATH.
 */
async function checkClaudeCLI(cliPath: string = "claude"): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cliPath, ["--version"], { stdio: "pipe" });

    child.on("error", (error: any) => {
      if (error.code === "ENOENT") {
        reject(
          new BackendNotAvailableError(
            "claude",
            `Claude CLI not found at '${cliPath}'. Install from: https://claude.com/code`
          )
        );
      } else {
        reject(new BackendNotAvailableError("claude", error.message));
      }
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new BackendNotAvailableError(
            "claude",
            `Claude CLI check failed with exit code ${code}`
          )
        );
      }
    });
  });
}

export async function* createClaudeBackend(
  prompt: string,
  options: QueryOptions
): AsyncGenerator<UnifiedEvent, void, unknown> {
  // Determine CLI path (resolve from known paths if not explicitly provided)
  const cliPath =
    options.backendOptions?.claude?.cliPath || await resolveBinaryPath("claude");

  // Check CLI availability
  await checkClaudeCLI(cliPath);

  // Build CLI arguments
  const args: string[] = [
    "--print",
    "--output-format",
    "stream-json",
    "--verbose", // Required when using --print with stream-json
    "-p",
    prompt,
  ];

  // Permission mode (YOLO by default)
  if (options.autoApprove !== false) {
    args.push("--dangerously-skip-permissions");
  }

  // Working directory
  if (options.workingDir) {
    args.push("--add-dir", options.workingDir);
  }

  // Resume session
  if (options.resume) {
    args.push("--resume", options.resume);
  }

  // Backend-specific options
  if (options.backendOptions?.claude) {
    const claudeOpts = options.backendOptions.claude;

    if (claudeOpts.maxThinkingTokens !== undefined) {
      // Note: Claude CLI doesn't expose --max-thinking-tokens in --print mode
      console.warn(
        "maxThinkingTokens is not supported in Claude CLI --print mode"
      );
    }

    if (claudeOpts.mcpServers && claudeOpts.mcpServers.length > 0) {
      // Build MCP config JSON
      const mcpConfig: Record<string, any> = {};
      claudeOpts.mcpServers.forEach((serverName) => {
        mcpConfig[serverName] = {
          type: "stdio",
          command: serverName,
        };
      });
      args.push("--mcp-config", JSON.stringify(mcpConfig));
    }

    if (claudeOpts.permissionMode && claudeOpts.permissionMode !== "yolo") {
      // Override permission mode
      args.push("--permission-mode", claudeOpts.permissionMode);
    }
  }

  // Spawn Claude CLI
  const child = spawn(cliPath, args, {
    stdio: ["ignore", "pipe", "pipe"],
    cwd: options.workingDir || process.cwd(),
    env: {
      ...process.env,
      // Ensure API key is passed
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    },
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
      let message: any;
      try {
        message = JSON.parse(line);
      } catch (parseError) {
        console.warn("Failed to parse Claude event:", line);
        continue;
      }

      // Extract session ID from system message
      if (message.type === "system") {
        sessionId = message.sessionId;
      }

      // Map to unified events
      const unifiedEvents = mapClaudeEvent(message);
      for (const unifiedEvent of unifiedEvents) {
        yield unifiedEvent;
      }
    }
  } catch (error: any) {
    // Emit error event
    yield {
      type: "error",
      severity: "fatal",
      message: error.message || "Claude backend error",
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
 * Extract session ID from Claude events.
 * Claude provides session ID in system and result messages.
 */
export function extractClaudeSessionId(
  events: UnifiedEvent[]
): string | undefined {
  for (const event of events) {
    if (event.type === "session" && event.session_id) {
      return event.session_id;
    }
  }
  return undefined;
}
