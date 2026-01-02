/**
 * Codex CLI ACP provider
 */

import { BaseACPProvider } from "./base-provider.js";
import type { CodexProviderOptions } from "../types.js";

/**
 * ACP provider for Codex CLI
 *
 * Spawns the Codex ACP bridge.
 */
export class CodexACPProvider extends BaseACPProvider {
  readonly type = "codex" as const;
  protected readonly defaultBinary = "codex-acp";
  protected readonly defaultArgs: string[] = [];

  private model?: string;

  constructor(options: CodexProviderOptions = {}) {
    super(options);
    this.model = options.model;
  }

  getCommand(): { binary: string; args: string[] } {
    const args: string[] = [];

    if (this.model) {
      args.push("--model", this.model);
    }

    args.push(...(this.options.extraArgs ?? []));

    return {
      binary: this.options.binaryPath ?? this.defaultBinary,
      args,
    };
  }
}
