/**
 * coding-agent-sdk
 *
 * Build agentic workflows that work with Claude Code, Codex CLI, Gemini CLI,
 * and other coding agents.
 */

// Re-export types (hide ACP-specific types from public API)
export type {
  ProviderType,
  ClientOptions,
  ProviderOptions,
  ClaudeProviderOptions,
  CodexProviderOptions,
  GeminiProviderOptions,
  MCPServerConfig,
  PermissionHandler,
  PermissionResponse,
  NewSessionOptions,
  LoadSessionOptions,
} from "./types.js";

// Re-export update types from ACP (these are the event types users will handle)
export type {
  SessionUpdate,
  ContentBlock,
  TextContent,
  ImageContent,
  StopReason,
  ToolCall,
  ToolCallUpdate,
  Plan,
  PlanEntry,
  SessionId,
} from "./types.js";

// Re-export errors
export * from "./errors.js";

// Re-export client
export { CodingAgentClient } from "./client/client.js";
export {
  Session,
  textOnly,
  collectText,
  toolCallsOnly,
} from "./client/session.js";

// Import for convenience functions
import { CodingAgentClient } from "./client/client.js";
import { textOnly } from "./client/session.js";
import type {
  ClientOptions,
  SessionUpdate,
  StopReason,
} from "./types.js";

/**
 * Create a client for connecting to coding agents.
 *
 * @example
 * ```typescript
 * const client = createClient({ provider: 'claude' });
 * await client.connect();
 * ```
 */
export function createClient(options?: ClientOptions): CodingAgentClient {
  return new CodingAgentClient(options);
}

/**
 * One-shot prompt convenience function.
 * Creates client, session, sends prompt, disconnects.
 *
 * @example
 * ```typescript
 * const { updates, stopReason } = await prompt('Fix the bug', { provider: 'claude' });
 * ```
 */
export async function prompt(
  content: string,
  options?: ClientOptions
): Promise<{ updates: SessionUpdate[]; stopReason: StopReason }> {
  const client = new CodingAgentClient(options);

  try {
    await client.connect();
    const session = await client.newSession();
    return await session.promptAndCollect(content);
  } finally {
    await client.disconnect();
  }
}

/**
 * Stream a one-shot prompt.
 * Creates client, session, streams updates, disconnects.
 *
 * @example
 * ```typescript
 * for await (const update of streamPrompt('Fix the bug')) {
 *   console.log(update);
 * }
 * ```
 */
export async function* streamPrompt(
  content: string,
  options?: ClientOptions
): AsyncGenerator<SessionUpdate, StopReason, void> {
  const client = new CodingAgentClient(options);

  try {
    await client.connect();
    const session = await client.newSession();
    return yield* session.prompt(content);
  } finally {
    await client.disconnect();
  }
}

/**
 * Stream only text from a one-shot prompt.
 * Convenience function that combines streamPrompt with textOnly.
 *
 * @example
 * ```typescript
 * for await (const text of streamText('Explain this code')) {
 *   process.stdout.write(text);
 * }
 * ```
 */
export async function* streamText(
  content: string,
  options?: ClientOptions
): AsyncGenerator<string, void, void> {
  yield* textOnly(streamPrompt(content, options));
}
