/**
 * Gemini CLI ACP provider
 */

import { BaseACPProvider } from "./base-provider.js";
import type { GeminiProviderOptions } from "../types.js";

/**
 * ACP provider for Gemini CLI
 *
 * Spawns Gemini CLI with experimental ACP mode enabled.
 */
export class GeminiACPProvider extends BaseACPProvider {
  readonly type = "gemini" as const;
  protected readonly defaultBinary = "gemini";
  protected readonly defaultArgs = ["--experimental-acp"];

  private sandbox?: boolean;

  constructor(options: GeminiProviderOptions = {}) {
    super(options);
    this.sandbox = options.sandbox;
  }

  getCommand(): { binary: string; args: string[] } {
    const args = ["--experimental-acp"];

    if (this.sandbox) {
      args.push("--sandbox");
    }

    args.push(...(this.options.extraArgs ?? []));

    return {
      binary: this.options.binaryPath ?? this.defaultBinary,
      args,
    };
  }
}
