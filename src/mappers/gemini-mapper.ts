/**
 * Gemini CLI → Unified Event Mapper
 */

import type { UnifiedEvent } from '../events.js';

// Gemini CLI event types (from stream-json output)
type JsonStreamEvent = any;

/**
 * Map Gemini JsonStreamEvent to unified event(s).
 */
export function mapGeminiEvent(event: JsonStreamEvent): UnifiedEvent[] {
  const events: UnifiedEvent[] = [];

  switch (event.type) {
    case 'init':
      // Session initialization
      events.push({
        type: 'session',
        subtype: 'init',
        session_id: event.session_id,
        backend: 'gemini',
        timestamp: event.timestamp,
        metadata: {
          model: event.model,
        },
      });
      break;

    case 'message':
      // User or assistant message
      events.push({
        type: 'message',
        role: event.role,
        content: event.content,
        is_delta: event.delta || false,
        timestamp: event.timestamp,
      });
      break;

    case 'tool_use':
      // Tool execution started
      events.push({
        type: 'action',
        subtype: 'tool',
        action_id: event.tool_id,
        status: 'started',
        tool_name: event.tool_name,
        tool_input: event.parameters,
        timestamp: event.timestamp,
      });
      break;

    case 'tool_result':
      // Tool execution completed
      events.push({
        type: 'action',
        subtype: 'tool',
        action_id: event.tool_id,
        status: event.status === 'success' ? 'completed' : 'failed',
        tool_output: event.output,
        tool_error: event.error?.message,
        timestamp: event.timestamp,
      });
      break;

    case 'error':
      // Error event
      const severity = event.severity === 'warning' ? 'warning' : 'error';
      events.push({
        type: 'error',
        severity,
        message: event.message,
        timestamp: event.timestamp,
      });
      break;

    case 'result':
      // Final result
      if (event.status === 'error') {
        // Turn failed
        events.push({
          type: 'turn',
          subtype: 'failed',
          error: event.error?.message || 'Unknown error',
          timestamp: event.timestamp,
        });
      } else {
        // Turn completed
        if (event.stats) {
          events.push({
            type: 'turn',
            subtype: 'completed',
            timestamp: event.timestamp,
            usage: {
              input_tokens: event.stats.input_tokens,
              output_tokens: event.stats.output_tokens,
            },
          });

          // Metrics
          events.push({
            type: 'metrics',
            subtype: 'session_summary',
            timestamp: event.timestamp,
            per_tool: event.stats.tool_calls
              ? {
                  all_tools: {
                    calls: event.stats.tool_calls,
                  },
                }
              : undefined,
          });
        }
      }

      // Session end
      events.push({
        type: 'session',
        subtype: 'end',
        session_id: 'unknown', // Gemini doesn't provide session_id in result
        backend: 'gemini',
        timestamp: event.timestamp,
      });
      break;

    default:
      console.warn(`Unknown Gemini event type: ${event.type}`);
  }

  return events;
}
