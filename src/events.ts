/**
 * Unified event types for coding-agent-sdk
 * Provides a consistent interface across Claude, Codex, and Gemini backends
 */

// ============================================================================
// Base Types
// ============================================================================

export type Backend = 'claude' | 'codex' | 'gemini';

export type EventStatus = 'started' | 'in_progress' | 'completed' | 'failed';

export type Role = 'user' | 'assistant';

export type ErrorSeverity = 'warning' | 'error' | 'fatal';

export type ActionSubtype =
  | 'tool'           // Tool execution (read, write, edit, bash, etc.)
  | 'command'        // Shell command
  | 'file_change'    // File modification (add/update/delete)
  | 'web_search'     // Web search query
  | 'reasoning'      // AI reasoning/thinking
  | 'mcp_tool';      // MCP tool call

export type ProgressSubtype =
  | 'todo_update'    // Todo list update
  | 'status_update'  // General status message
  | 'elapsed_time';  // Long-running operation time update

// ============================================================================
// 1. SessionEvent - Session lifecycle
// ============================================================================

export type SessionEvent = {
  type: 'session';
  subtype: 'init' | 'end';
  session_id: string;
  backend: Backend;
  timestamp?: string;
  metadata?: {
    model?: string;
    tools?: string[];
    mcp_servers?: string[];
    working_dir?: string;
  };
};

// ============================================================================
// 2. TurnEvent - Conversation turn boundaries
// ============================================================================

export type TurnEvent = {
  type: 'turn';
  subtype: 'started' | 'completed' | 'failed';
  turn_index?: number;
  timestamp?: string;
  // Usage data (on completed)
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cached_tokens?: number;
    thinking_tokens?: number;
  };
  // Error (on failed)
  error?: string;
};

// ============================================================================
// 3. MessageEvent - User/assistant text messages
// ============================================================================

export type MessageEvent = {
  type: 'message';
  role: Role;
  content: string;
  timestamp?: string;
  // Streaming support
  is_delta?: boolean;       // True if this is a partial chunk
  content_index?: number;   // For multi-block messages
  // Hierarchy support
  parent_id?: string;       // For subagent messages
};

// ============================================================================
// 4. ActionEvent - Tool execution, commands, file changes, etc.
// ============================================================================

export type ActionEvent = {
  type: 'action';
  subtype: ActionSubtype;
  action_id?: string;
  status: EventStatus;
  timestamp?: string;
  duration_ms?: number;

  // Tool-specific fields
  tool_name?: string;
  tool_input?: unknown;
  tool_output?: unknown;
  tool_error?: string;

  // Command-specific fields
  command?: string;
  command_output?: string;
  exit_code?: number;

  // File change-specific fields
  file_path?: string;
  change_type?: 'add' | 'update' | 'delete';
  lines_added?: number;
  lines_removed?: number;

  // Web search-specific fields
  search_query?: string;
  search_results?: unknown;

  // Reasoning-specific fields
  reasoning_text?: string;

  // Backend-specific metadata (preserved as-is)
  metadata?: {
    // Claude
    parent_tool_use_id?: string;
    permission_denied?: boolean;

    // Codex
    mcp_server?: string;
    structured_result?: unknown;

    // Gemini
    tool_decision?: 'accept' | 'reject' | 'modify' | 'auto_accept';

    // Any other backend-specific data
    [key: string]: unknown;
  };
};

// ============================================================================
// 5. ProgressEvent - Long-running operations, todos, status updates
// ============================================================================

export type ProgressEvent = {
  type: 'progress';
  subtype: ProgressSubtype;
  timestamp?: string;

  // For todo updates
  todo_items?: Array<{
    title: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
  }>;

  // For status updates
  status_message?: string;

  // For elapsed time updates
  action_id?: string;
  elapsed_ms?: number;
};

// ============================================================================
// 6. ErrorEvent - Errors and warnings
// ============================================================================

export type ErrorEvent = {
  type: 'error';
  severity: ErrorSeverity;
  message: string;
  timestamp?: string;

  // Context linking
  related_action_id?: string;
  related_turn_index?: number;

  // Error details
  error_code?: string;
  stack_trace?: string;
};

// ============================================================================
// 7. MetricsEvent - Usage statistics and telemetry
// ============================================================================

export type MetricsEvent = {
  type: 'metrics';
  subtype: 'usage_update' | 'session_summary';
  timestamp?: string;

  // Per-model usage
  per_model?: Record<string, {
    requests?: number;
    errors?: number;
    latency_ms?: number;
    tokens?: {
      input?: number;
      output?: number;
      cached?: number;
      thinking?: number;
    };
    cost_usd?: number;
  }>;

  // Per-tool usage
  per_tool?: Record<string, {
    calls?: number;
    success?: number;
    failed?: number;
    avg_duration_ms?: number;
    decisions?: {
      accept?: number;
      reject?: number;
      modify?: number;
      auto_accept?: number;
    };
  }>;

  // File changes
  files?: {
    total_lines_added?: number;
    total_lines_removed?: number;
    files_modified?: number;
  };

  // Web search
  web_search?: {
    total_requests?: number;
  };
};

// ============================================================================
// Unified Event Union
// ============================================================================

export type UnifiedEvent =
  | SessionEvent
  | TurnEvent
  | MessageEvent
  | ActionEvent
  | ProgressEvent
  | ErrorEvent
  | MetricsEvent;
