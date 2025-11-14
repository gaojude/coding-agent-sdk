/**
 * Codex SDK → Unified Event Mapper
 */

import type { UnifiedEvent, EventStatus } from '../events.js';

// Import types from Codex SDK (will be peer dependency)
type ThreadEvent = any;
type ThreadItem = any;

/**
 * Map Codex ThreadEvent to unified event(s).
 */
export function mapCodexEvent(event: ThreadEvent): UnifiedEvent[] {
  const events: UnifiedEvent[] = [];

  switch (event.type) {
    case 'thread.started':
      // Session initialization
      events.push({
        type: 'session',
        subtype: 'init',
        session_id: event.thread_id,
        backend: 'codex',
      });
      break;

    case 'turn.started':
      // Turn started
      events.push({
        type: 'turn',
        subtype: 'started',
      });
      break;

    case 'turn.completed':
      // Turn completed with usage
      events.push({
        type: 'turn',
        subtype: 'completed',
        usage: {
          input_tokens: event.usage.input_tokens,
          output_tokens: event.usage.output_tokens,
          cached_tokens: event.usage.cached_input_tokens,
        },
      });
      break;

    case 'turn.failed':
      // Turn failed
      events.push({
        type: 'turn',
        subtype: 'failed',
        error: event.error.message,
      });
      break;

    case 'item.started':
    case 'item.updated':
    case 'item.completed':
      // Map item to unified events
      events.push(...mapCodexItem(event.item, event.type));
      break;

    case 'error':
      // Fatal error
      events.push({
        type: 'error',
        severity: 'fatal',
        message: event.message,
      });
      break;

    default:
      console.warn(`Unknown Codex event type: ${event.type}`);
  }

  return events;
}

/**
 * Map Codex ThreadItem to unified event(s).
 */
function mapCodexItem(item: ThreadItem, eventType: string): UnifiedEvent[] {
  const events: UnifiedEvent[] = [];
  const status = mapItemStatus(item, eventType);

  switch (item.type) {
    case 'agent_message':
      // Agent text response
      events.push({
        type: 'message',
        role: 'assistant',
        content: item.text,
      });
      break;

    case 'reasoning':
      // Reasoning/thinking
      events.push({
        type: 'action',
        subtype: 'reasoning',
        action_id: item.id,
        status: 'completed',
        reasoning_text: item.text,
      });
      break;

    case 'command_execution':
      // Shell command execution
      events.push({
        type: 'action',
        subtype: 'command',
        action_id: item.id,
        status: mapCommandStatus(item.status),
        command: item.command,
        command_output: item.aggregated_output,
        exit_code: item.exit_code,
      });
      break;

    case 'file_change':
      // File changes (patch)
      item.changes.forEach((change: any) => {
        events.push({
          type: 'action',
          subtype: 'file_change',
          action_id: item.id,
          status: item.status === 'completed' ? 'completed' : 'failed',
          file_path: change.path,
          change_type: change.kind,
        });
      });
      break;

    case 'mcp_tool_call':
      // MCP tool call
      events.push({
        type: 'action',
        subtype: 'mcp_tool',
        action_id: item.id,
        status: mapMcpStatus(item.status),
        tool_name: item.tool,
        tool_input: item.arguments,
        tool_output: item.result?.content,
        tool_error: item.error?.message,
        metadata: {
          mcp_server: item.server,
          structured_result: item.result?.structured_content,
        },
      });
      break;

    case 'web_search':
      // Web search
      events.push({
        type: 'action',
        subtype: 'web_search',
        action_id: item.id,
        status,
        search_query: item.query,
      });
      break;

    case 'todo_list':
      // Todo list update
      events.push({
        type: 'progress',
        subtype: 'todo_update',
        todo_items: item.items.map((todo: any) => ({
          title: todo.text,
          status: todo.completed ? 'completed' : 'pending',
        })),
      });
      break;

    case 'error':
      // Non-fatal error item
      events.push({
        type: 'error',
        severity: 'error',
        message: item.message,
        related_action_id: item.id,
      });
      break;

    default:
      console.warn(`Unknown Codex item type: ${item.type}`);
  }

  return events;
}

/**
 * Map Codex item status to unified status based on event type.
 */
function mapItemStatus(item: ThreadItem, eventType: string): EventStatus {
  if (eventType === 'item.started') return 'started';
  if (eventType === 'item.updated') return 'in_progress';
  if (eventType === 'item.completed') {
    // Check item-specific status
    if (item.status === 'failed') return 'failed';
    return 'completed';
  }
  return 'in_progress';
}

/**
 * Map Codex command execution status to unified status.
 */
function mapCommandStatus(status: string): EventStatus {
  switch (status) {
    case 'in_progress':
      return 'in_progress';
    case 'completed':
      return 'completed';
    case 'failed':
      return 'failed';
    default:
      return 'in_progress';
  }
}

/**
 * Map Codex MCP tool call status to unified status.
 */
function mapMcpStatus(status: string): EventStatus {
  switch (status) {
    case 'in_progress':
      return 'in_progress';
    case 'completed':
      return 'completed';
    case 'failed':
      return 'failed';
    default:
      return 'in_progress';
  }
}
