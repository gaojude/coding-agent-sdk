/**
 * Claude Agent SDK → Unified Event Mapper
 */

import type { UnifiedEvent } from '../events.js';

// Import types from Claude Agent SDK (will be peer dependency)
type SDKMessage = any; // Will be properly typed when SDK is installed

/**
 * Map Claude SDK message to unified event(s).
 * Some Claude messages may produce multiple unified events.
 */
export function mapClaudeEvent(message: SDKMessage): UnifiedEvent[] {
  const events: UnifiedEvent[] = [];

  switch (message.type) {
    case 'system':
      // Session initialization
      events.push({
        type: 'session',
        subtype: 'init',
        session_id: message.sessionId || 'unknown',
        backend: 'claude',
        metadata: {
          tools: message.tools?.map((t: any) => t.name),
          mcp_servers: Object.keys(message.mcpServers || {}),
          working_dir: message.cwd,
        },
      });
      break;

    case 'assistant':
      // Assistant message with content blocks
      const msg = message.message;

      // Process each content block
      msg.content?.forEach((block: any, index: number) => {
        if (block.type === 'text') {
          // Text message
          events.push({
            type: 'message',
            role: 'assistant',
            content: block.text,
            content_index: index,
          });
        } else if (block.type === 'tool_use') {
          // Tool execution started
          events.push({
            type: 'action',
            subtype: 'tool',
            action_id: block.id,
            status: 'started',
            tool_name: block.name,
            tool_input: block.input,
          });
        } else if (block.type === 'thinking') {
          // Extended thinking
          events.push({
            type: 'action',
            subtype: 'reasoning',
            status: 'completed',
            reasoning_text: block.thinking,
          });
        }
      });
      break;

    case 'user':
      // User message or tool result
      const userMsg = message.message;

      userMsg.content?.forEach((block: any) => {
        if (block.type === 'text') {
          // User text message
          events.push({
            type: 'message',
            role: 'user',
            content: block.text,
            parent_id: block.parent_tool_use_id,
          });
        } else if (block.type === 'tool_result') {
          // Tool execution completed
          const isError = block.is_error || false;
          events.push({
            type: 'action',
            subtype: 'tool',
            action_id: block.tool_use_id,
            status: isError ? 'failed' : 'completed',
            tool_output: block.content,
            tool_error: isError ? block.content : undefined,
          });
        }
      });
      break;

    case 'message_start':
    case 'content_block_start':
    case 'content_block_delta':
    case 'content_block_stop':
    case 'message_delta':
    case 'message_stop':
      // Streaming events - handle deltas
      if (message.type === 'content_block_delta') {
        const delta = message.delta;
        if (delta.type === 'text_delta') {
          events.push({
            type: 'message',
            role: 'assistant',
            content: delta.text,
            is_delta: true,
            content_index: message.index,
          });
        }
      }
      break;

    case 'result':
      // Final result with usage and metrics
      const result = message.result;

      // Turn completion
      events.push({
        type: 'turn',
        subtype: 'completed',
        usage: {
          input_tokens: result.usage?.input_tokens,
          output_tokens: result.usage?.output_tokens,
          cached_tokens: result.usage?.cache_read_input_tokens,
        },
      });

      // Session end
      events.push({
        type: 'session',
        subtype: 'end',
        session_id: result.sessionId || 'unknown',
        backend: 'claude',
      });

      // Metrics
      if (result.modelUsage) {
        const perModel: Record<string, any> = {};
        Object.entries(result.modelUsage).forEach(([model, usage]: [string, any]) => {
          perModel[model] = {
            requests: 1,
            tokens: {
              input: usage.inputTokens,
              output: usage.outputTokens,
              cached: usage.cacheReadInputTokens,
            },
            cost_usd: usage.costUSD,
          };
        });

        events.push({
          type: 'metrics',
          subtype: 'session_summary',
          per_model: perModel,
          web_search: {
            total_requests: result.webSearchRequests || 0,
          },
        });
      }

      // Permission denials
      if (result.permissionDenials?.length > 0) {
        result.permissionDenials.forEach((denial: any) => {
          events.push({
            type: 'error',
            severity: 'warning',
            message: `Permission denied for tool: ${denial.toolName}`,
            related_action_id: denial.toolUseId,
          });
        });
      }
      break;

    case 'tool_progress':
      // Long-running tool progress
      events.push({
        type: 'progress',
        subtype: 'elapsed_time',
        action_id: message.toolUseId,
        elapsed_ms: message.elapsedMs,
      });
      break;

    case 'status':
      // Status updates (e.g., compacting)
      events.push({
        type: 'progress',
        subtype: 'status_update',
        status_message: message.status,
      });
      break;

    case 'compact_boundary':
      // Context compaction marker - informational only
      events.push({
        type: 'progress',
        subtype: 'status_update',
        status_message: 'Context compaction in progress',
      });
      break;

    default:
      // Unknown message type - log as warning
      console.warn(`Unknown Claude message type: ${message.type}`);
  }

  return events;
}
