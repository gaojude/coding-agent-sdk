/**
 * Claude Code ACP provider
 *
 * Uses @zed-industries/claude-code-acp package which wraps Claude Code
 * with the Agent Client Protocol.
 */

import { BaseACPProvider } from "./base-provider.js";
import type { ClaudeProviderOptions } from "../types.js";

/**
 * ACP provider for Claude Code
 *
 * Spawns the claude-code-acp package which provides ACP support.
 * Requires: npx @zed-industries/claude-code-acp
 */
export class ClaudeACPProvider extends BaseACPProvider {
  readonly type = "claude" as const;
  protected readonly defaultBinary = "npx";
  protected readonly defaultArgs = ["@zed-industries/claude-code-acp"];

  constructor(options: ClaudeProviderOptions = {}) {
    super(options);
  }

  getCommand(): { binary: string; args: string[] } {
    if (this.options.binaryPath) {
      return {
        binary: this.options.binaryPath,
        args: [...(this.options.extraArgs ?? [])],
      };
    }

    return {
      binary: "npx",
      args: [
        "@zed-industries/claude-code-acp",
        ...(this.options.extraArgs ?? []),
      ],
    };
  }

  async isAvailable(): Promise<boolean> {
    // Check if npx is available
    try {
      const { exec } = await import("node:child_process");
      const { promisify } = await import("node:util");
      const execAsync = promisify(exec);
      await execAsync("npx --version");
      return true;
    } catch {
      return false;
    }
  }
}
