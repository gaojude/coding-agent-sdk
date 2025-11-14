/**
 * Tests for Claude event mapper
 */

import { describe, it, expect } from 'vitest';
import { mapClaudeEvent } from './claude-mapper.js';

describe('mapClaudeEvent', () => {
  describe('system message', () => {
    it('should map to session init event', () => {
      const message = {
        type: 'system',
        sessionId: 'test-session-123',
        tools: [{ name: 'read' }, { name: 'write' }],
        mcpServers: { 'server1': {} },
        cwd: '/test/dir',
      };

      const events = mapClaudeEvent(message);
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        type: 'session',
        subtype: 'init',
        session_id: 'test-session-123',
        backend: 'claude',
        metadata: {
          tools: ['read', 'write'],
          mcp_servers: ['server1'],
          working_dir: '/test/dir',
        },
      });
    });

    it('should handle missing optional fields', () => {
      const message = {
        type: 'system',
        sessionId: 'test-session',
      };

      const events = mapClaudeEvent(message);
      expect(events[0].metadata?.tools).toBeUndefined();
      expect(events[0].metadata?.mcp_servers).toEqual([]);
    });
  });

  describe('assistant message', () => {
    it('should map text content to message event', () => {
      const message = {
        type: 'assistant',
        message: {
          content: [
            { type: 'text', text: 'Hello world' },
          ],
        },
      };

      const events = mapClaudeEvent(message);
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        type: 'message',
        role: 'assistant',
        content: 'Hello world',
        content_index: 0,
      });
    });

    it('should map tool_use to action event', () => {
      const message = {
        type: 'assistant',
        message: {
          content: [
            {
              type: 'tool_use',
              id: 'tool-123',
              name: 'read',
              input: { file_path: '/test.txt' },
            },
          ],
        },
      };

      const events = mapClaudeEvent(message);
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        type: 'action',
        subtype: 'tool',
        action_id: 'tool-123',
        status: 'started',
        tool_name: 'read',
        tool_input: { file_path: '/test.txt' },
      });
    });

    it('should map thinking block to reasoning action', () => {
      const message = {
        type: 'assistant',
        message: {
          content: [
            { type: 'thinking', thinking: 'Let me analyze this...' },
          ],
        },
      };

      const events = mapClaudeEvent(message);
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        type: 'action',
        subtype: 'reasoning',
        status: 'completed',
        reasoning_text: 'Let me analyze this...',
      });
    });

    it('should handle multiple content blocks', () => {
      const message = {
        type: 'assistant',
        message: {
          content: [
            { type: 'text', text: 'First' },
            { type: 'text', text: 'Second' },
            { type: 'tool_use', id: 'tool-1', name: 'bash', input: {} },
          ],
        },
      };

      const events = mapClaudeEvent(message);
      expect(events).toHaveLength(3);
      expect(events[0].type).toBe('message');
      expect(events[1].type).toBe('message');
      expect(events[2].type).toBe('action');
    });
  });

  describe('user message', () => {
    it('should map text content to user message', () => {
      const message = {
        type: 'user',
        message: {
          content: [
            { type: 'text', text: 'User input' },
          ],
        },
      };

      const events = mapClaudeEvent(message);
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        type: 'message',
        role: 'user',
        content: 'User input',
        parent_id: undefined,
      });
    });

    it('should map tool_result to action completed', () => {
      const message = {
        type: 'user',
        message: {
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'tool-123',
              content: 'File contents here',
              is_error: false,
            },
          ],
        },
      };

      const events = mapClaudeEvent(message);
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        type: 'action',
        subtype: 'tool',
        action_id: 'tool-123',
        status: 'completed',
        tool_output: 'File contents here',
        tool_error: undefined,
      });
    });

    it('should map tool_result error to action failed', () => {
      const message = {
        type: 'user',
        message: {
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'tool-123',
              content: 'Error: File not found',
              is_error: true,
            },
          ],
        },
      };

      const events = mapClaudeEvent(message);
      expect(events[0]).toMatchObject({
        type: 'action',
        status: 'failed',
        tool_error: 'Error: File not found',
      });
    });
  });

  describe('streaming events', () => {
    it('should map content_block_delta with text', () => {
      const message = {
        type: 'content_block_delta',
        index: 0,
        delta: {
          type: 'text_delta',
          text: 'streaming ',
        },
      };

      const events = mapClaudeEvent(message);
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        type: 'message',
        role: 'assistant',
        content: 'streaming ',
        is_delta: true,
        content_index: 0,
      });
    });

    it('should ignore non-text deltas', () => {
      const message = {
        type: 'content_block_delta',
        index: 0,
        delta: {
          type: 'other_delta',
        },
      };

      const events = mapClaudeEvent(message);
      expect(events).toHaveLength(0);
    });

    it('should ignore streaming control messages', () => {
      const controlMessages = [
        { type: 'message_start' },
        { type: 'content_block_start' },
        { type: 'content_block_stop' },
        { type: 'message_delta' },
        { type: 'message_stop' },
      ];

      controlMessages.forEach((message) => {
        const events = mapClaudeEvent(message);
        expect(events).toHaveLength(0);
      });
    });
  });

  describe('result message', () => {
    it('should map result to turn completed and session end', () => {
      const message = {
        type: 'result',
        result: {
          sessionId: 'session-123',
          usage: {
            input_tokens: 100,
            output_tokens: 50,
            cache_read_input_tokens: 20,
          },
        },
      };

      const events = mapClaudeEvent(message);
      expect(events.length).toBeGreaterThanOrEqual(2);

      const turnEvent = events.find(e => e.type === 'turn');
      expect(turnEvent).toEqual({
        type: 'turn',
        subtype: 'completed',
        usage: {
          input_tokens: 100,
          output_tokens: 50,
          cached_tokens: 20,
        },
      });

      const sessionEvent = events.find(e => e.type === 'session');
      expect(sessionEvent).toMatchObject({
        type: 'session',
        subtype: 'end',
        session_id: 'session-123',
        backend: 'claude',
      });
    });

    it('should map model usage to metrics', () => {
      const message = {
        type: 'result',
        result: {
          sessionId: 'session-123',
          usage: {},
          modelUsage: {
            'claude-3-5-sonnet': {
              inputTokens: 1000,
              outputTokens: 500,
              cacheReadInputTokens: 200,
              costUSD: 0.05,
            },
          },
          webSearchRequests: 3,
        },
      };

      const events = mapClaudeEvent(message);
      const metricsEvent = events.find(e => e.type === 'metrics');

      expect(metricsEvent).toMatchObject({
        type: 'metrics',
        subtype: 'session_summary',
        per_model: {
          'claude-3-5-sonnet': {
            requests: 1,
            tokens: {
              input: 1000,
              output: 500,
              cached: 200,
            },
            cost_usd: 0.05,
          },
        },
        web_search: {
          total_requests: 3,
        },
      });
    });

    it('should map permission denials to error events', () => {
      const message = {
        type: 'result',
        result: {
          sessionId: 'session-123',
          usage: {},
          permissionDenials: [
            { toolName: 'bash', toolUseId: 'tool-1' },
            { toolName: 'write', toolUseId: 'tool-2' },
          ],
        },
      };

      const events = mapClaudeEvent(message);
      const errorEvents = events.filter(e => e.type === 'error');

      expect(errorEvents).toHaveLength(2);
      expect(errorEvents[0]).toMatchObject({
        type: 'error',
        severity: 'warning',
        message: 'Permission denied for tool: bash',
        related_action_id: 'tool-1',
      });
    });
  });

  describe('progress events', () => {
    it('should map tool_progress to progress event', () => {
      const message = {
        type: 'tool_progress',
        toolUseId: 'tool-123',
        elapsedMs: 5000,
      };

      const events = mapClaudeEvent(message);
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        type: 'progress',
        subtype: 'elapsed_time',
        action_id: 'tool-123',
        elapsed_ms: 5000,
      });
    });

    it('should map status message to status update', () => {
      const message = {
        type: 'status',
        status: 'Processing...',
      };

      const events = mapClaudeEvent(message);
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        type: 'progress',
        subtype: 'status_update',
        status_message: 'Processing...',
      });
    });

    it('should map compact_boundary to status update', () => {
      const message = {
        type: 'compact_boundary',
      };

      const events = mapClaudeEvent(message);
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: 'progress',
        subtype: 'status_update',
        status_message: 'Context compaction in progress',
      });
    });
  });

  describe('unknown message types', () => {
    it('should return empty array for unknown types', () => {
      const message = {
        type: 'unknown_type',
      };

      const events = mapClaudeEvent(message);
      expect(events).toHaveLength(0);
    });
  });
});
