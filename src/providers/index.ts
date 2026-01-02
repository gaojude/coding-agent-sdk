/**
 * Provider registry and auto-detection
 */

import type { ProviderType, ProviderOptions } from "../types.js";
import type { ACPProvider } from "./base-provider.js";
import { ClaudeACPProvider } from "./claude-provider.js";
import { CodexACPProvider } from "./codex-provider.js";
import { GeminiACPProvider } from "./gemini-provider.js";
import { NoProviderFoundError, UnknownProviderError } from "../errors.js";

export type { ACPProvider } from "./base-provider.js";
export { ClaudeACPProvider } from "./claude-provider.js";
export { CodexACPProvider } from "./codex-provider.js";
export { GeminiACPProvider } from "./gemini-provider.js";

/**
 * Registry of provider constructors by type
 */
export const providerRegistry: Record<
  ProviderType,
  new (options?: ProviderOptions) => ACPProvider
> = {
  claude: ClaudeACPProvider,
  codex: CodexACPProvider,
  gemini: GeminiACPProvider,
};

/**
 * Create a provider instance by type
 */
export function createProvider(
  type: ProviderType,
  options?: ProviderOptions
): ACPProvider {
  const ProviderClass = providerRegistry[type];
  if (!ProviderClass) {
    throw new UnknownProviderError(type);
  }
  return new ProviderClass(options);
}

/**
 * Auto-detect the first available provider
 *
 * Checks providers in priority order: claude > codex > gemini
 */
export async function detectProvider(): Promise<ProviderType> {
  const priorities: ProviderType[] = ["claude", "codex", "gemini"];

  for (const type of priorities) {
    const provider = createProvider(type);
    if (await provider.isAvailable()) {
      return type;
    }
  }

  throw new NoProviderFoundError();
}

/**
 * List all available providers on the system
 */
export async function listAvailableProviders(): Promise<ProviderType[]> {
  const available: ProviderType[] = [];

  for (const type of Object.keys(providerRegistry) as ProviderType[]) {
    const provider = createProvider(type);
    if (await provider.isAvailable()) {
      available.push(type);
    }
  }

  return available;
}

/**
 * Check if a specific provider is available
 */
export async function isProviderAvailable(type: ProviderType): Promise<boolean> {
  try {
    const provider = createProvider(type);
    return await provider.isAvailable();
  } catch {
    return false;
  }
}
