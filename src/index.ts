/**
 * Unified Coding Agent SDK
 * Provides a consistent interface across Claude Code, Codex CLI, and Gemini CLI
 */

import type { Backend, UnifiedEvent } from './events.js';
import type { QueryOptions, QueryResult } from './types.js';
import { NoBackendFoundError } from './types.js';
import { detectBackend, getApiKey } from './utils/auto-detect.js';
import { createClaudeBackend } from './backends/claude.js';
import { createCodexBackend } from './backends/codex.js';
import { createGeminiBackend } from './backends/gemini.js';

// Re-export types for convenience
export type { Backend, UnifiedEvent } from './events.js';
export type {
  QueryOptions,
  QueryResult,
  ClaudeBackendOptions,
  CodexBackendOptions,
  GeminiBackendOptions,
} from './types.js';
export {
  CodingAgentError,
  BackendNotAvailableError,
  NoBackendFoundError,
  MultipleBackendsFoundError,
} from './types.js';

/**
 * Main query function - unified interface for all backends.
 *
 * @param prompt - The prompt to send to the AI agent
 * @param options - Optional configuration
 * @returns QueryResult with session ID and event stream
 *
 * @example
 * ```typescript
 * import { query } from 'coding-agent-sdk';
 *
 * // Auto-detect backend from environment variables
 * const result = await query("Fix the failing tests");
 *
 * // Stream events
 * for await (const event of result.events) {
 *   if (event.type === 'message') {
 *     console.log(event.content);
 *   }
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Explicit backend selection
 * const result = await query("Deploy the app", {
 *   backend: 'claude',
 *   workingDir: '/path/to/project'
 * });
 * ```
 *
 * @example
 * ```typescript
 * // Resume previous session
 * const result = await query("Continue from where we left off", {
 *   resume: previousSessionId
 * });
 * ```
 */
export async function query(
  prompt: string,
  options: QueryOptions = {}
): Promise<QueryResult> {
  // Determine backend
  let backend: Backend;
  if (options.backend) {
    backend = options.backend;
    // Verify API key is set for selected backend
    getApiKey(backend);
  } else {
    // Auto-detect from environment variables AND binary availability
    const detection = await detectBackend();
    backend = detection.backend;
  }

  // Set defaults
  const finalOptions: QueryOptions = {
    workingDir: process.cwd(),
    autoApprove: true, // YOLO mode by default
    ...options,
  };

  // Create async generator for events
  let sessionId: string | undefined;
  const eventsBuffer: UnifiedEvent[] = [];

  async function* eventStream(): AsyncGenerator<UnifiedEvent, void, unknown> {
    let generator: AsyncGenerator<UnifiedEvent, void, unknown>;

    // Select backend
    switch (backend) {
      case 'claude':
        generator = createClaudeBackend(prompt, finalOptions);
        break;
      case 'codex':
        generator = createCodexBackend(prompt, finalOptions);
        break;
      case 'gemini':
        generator = createGeminiBackend(prompt, finalOptions);
        break;
      default:
        throw new NoBackendFoundError();
    }

    // Stream events and extract session ID
    for await (const event of generator) {
      // Extract session ID from init event
      if (event.type === 'session' && event.subtype === 'init') {
        sessionId = event.session_id;
      }

      // Buffer events for session ID extraction
      eventsBuffer.push(event);

      yield event;
    }
  }

  // Create result
  const events = eventStream();

  // Return immediately with promise that resolves to session ID
  const result: QueryResult = {
    get sessionId(): string {
      if (sessionId) return sessionId;

      // Extract from buffer if available
      for (const event of eventsBuffer) {
        if (event.type === 'session' && event.session_id) {
          sessionId = event.session_id;
          return sessionId;
        }
      }

      // Fallback
      return 'unknown';
    },
    events,
    backend,
  };

  return result;
}

/**
 * Check if a specific backend is available (has required dependencies).
 *
 * @param backend - The backend to check
 * @returns True if the backend is available
 *
 * @example
 * ```typescript
 * import { isBackendAvailable } from 'coding-agent-sdk';
 *
 * if (isBackendAvailable('claude')) {
 *   console.log('Claude is available!');
 * }
 * ```
 */
export { isBackendAvailable, detectBackend } from './utils/auto-detect.js';

// Default export
export default query;
