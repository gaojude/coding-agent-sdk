/**
 * Core types for coding-agent-sdk
 */

import type { Backend, UnifiedEvent } from './events.js';

// ============================================================================
// Query Options
// ============================================================================

export interface QueryOptions {
  /**
   * Backend to use. If not specified, auto-detects from environment variables:
   * - ANTHROPIC_API_KEY → 'claude'
   * - OPENAI_API_KEY → 'codex'
   * - GEMINI_API_KEY → 'gemini'
   */
  backend?: Backend;

  /**
   * Session ID to resume from a previous session.
   * Each backend stores sessions differently:
   * - Claude: ~/.claude/sessions/{session_id}.jsonl
   * - Codex: thread_id from previous run
   * - Gemini: --resume {session_id}
   */
  resume?: string;

  /**
   * Working directory for the agent.
   * Defaults to current working directory (process.cwd())
   */
  workingDir?: string;

  /**
   * Whether to auto-approve all tool executions (YOLO mode).
   * Default: true (maximum permissions, no prompts)
   */
  autoApprove?: boolean;

  /**
   * Backend-specific options passed through as-is.
   * Use this for advanced configuration specific to each backend.
   */
  backendOptions?: {
    claude?: ClaudeBackendOptions;
    codex?: CodexBackendOptions;
    gemini?: GeminiBackendOptions;
  };
}

// ============================================================================
// Backend-Specific Options
// ============================================================================

export interface ClaudeBackendOptions {
  /**
   * Path to Claude CLI executable.
   * Default: 'claude' (searches in PATH)
   */
  cliPath?: string;

  /**
   * Maximum thinking tokens for extended thinking.
   * Note: Not supported in --print mode
   */
  maxThinkingTokens?: number;

  /**
   * MCP servers to enable.
   * Example: ['next-devtools-mcp']
   */
  mcpServers?: string[];

  /**
   * Custom permission mode.
   * Default: 'yolo' (auto-approve all)
   */
  permissionMode?: 'acceptEdits' | 'bypassPermissions' | 'default' | 'plan';
}

export interface CodexBackendOptions {
  /**
   * Path to Codex CLI executable.
   * Default: 'codex' (searches in PATH)
   */
  cliPath?: string;

  /**
   * Sandbox mode for Codex.
   * Default: undefined (uses Codex default)
   */
  sandbox?: 'vm' | 'container' | 'none';

  /**
   * Whether to enable structured output mode.
   * Default: false
   */
  structuredOutput?: boolean;

  /**
   * Path to JSON schema file for structured output.
   * Required if structuredOutput is true.
   */
  outputSchemaFile?: string;
}

export interface GeminiBackendOptions {
  /**
   * Path to Gemini CLI executable.
   * Default: 'gemini' (searches in PATH)
   */
  cliPath?: string;

  /**
   * Additional CLI arguments to pass to Gemini.
   * Example: ['--verbose', '--debug']
   */
  cliArgs?: string[];
}

// ============================================================================
// Query Result
// ============================================================================

export interface QueryResult {
  /**
   * Unique session ID for this query.
   * Can be used with options.resume to continue the conversation.
   */
  sessionId: string;

  /**
   * Async generator that yields unified events as they occur.
   * Iterate with `for await (const event of result.events)`
   */
  events: AsyncGenerator<UnifiedEvent, void, unknown>;

  /**
   * Backend that was used for this query.
   */
  backend: Backend;
}

// ============================================================================
// Error Types
// ============================================================================

export class CodingAgentError extends Error {
  constructor(
    message: string,
    public code: string,
    public backend?: Backend
  ) {
    super(message);
    this.name = 'CodingAgentError';
  }
}

export class BackendNotAvailableError extends CodingAgentError {
  constructor(backend: Backend, reason: string) {
    super(
      `Backend '${backend}' is not available: ${reason}`,
      'BACKEND_NOT_AVAILABLE',
      backend
    );
    this.name = 'BackendNotAvailableError';
  }
}

export class NoBackendFoundError extends CodingAgentError {
  constructor(message?: string) {
    super(
      message || 'No backend could be auto-detected. Please set one of: ANTHROPIC_API_KEY, OPENAI_API_KEY, or GEMINI_API_KEY and ensure the corresponding binary (claude, codex, gemini) is installed.',
      'NO_BACKEND_FOUND'
    );
    this.name = 'NoBackendFoundError';
  }
}

export class MultipleBackendsFoundError extends CodingAgentError {
  constructor(backends: Backend[]) {
    super(
      `Multiple backends detected: ${backends.join(', ')}. Please specify options.backend explicitly.`,
      'MULTIPLE_BACKENDS_FOUND'
    );
    this.name = 'MultipleBackendsFoundError';
  }
}
