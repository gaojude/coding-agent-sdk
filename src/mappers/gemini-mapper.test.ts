/**
 * Tests for Gemini event mapper
 */

import { describe, it, expect } from 'vitest';
import { mapGeminiEvent } from './gemini-mapper.js';

describe('mapGeminiEvent', () => {
  describe('init event', () => {
    it('should map to session init', () => {
      const event = {
        type: 'init',
        session_id: 'gemini-session-123',
        model: 'gemini-1.5-pro',
        timestamp: '2024-01-01T00:00:00Z',
      };

      const events = mapGeminiEvent(event);
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        type: 'session',
        subtype: 'init',
        session_id: 'gemini-session-123',
        backend: 'gemini',
        timestamp: '2024-01-01T00:00:00Z',
        metadata: {
          model: 'gemini-1.5-pro',
        },
      });
    });
  });

  describe('message events', () => {
    it('should map assistant message', () => {
      const event = {
        type: 'message',
        role: 'assistant',
        content: 'Here is my response',
        timestamp: '2024-01-01T00:00:00Z',
      };

      const events = mapGeminiEvent(event);
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        type: 'message',
        role: 'assistant',
        content: 'Here is my response',
        is_delta: false,
        timestamp: '2024-01-01T00:00:00Z',
      });
    });

    it('should map user message', () => {
      const event = {
        type: 'message',
        role: 'user',
        content: 'My query',
        timestamp: '2024-01-01T00:00:00Z',
      };

      const events = mapGeminiEvent(event);
      expect(events[0]).toMatchObject({
        type: 'message',
        role: 'user',
        content: 'My query',
      });
    });

    it('should map streaming delta', () => {
      const event = {
        type: 'message',
        role: 'assistant',
        content: 'chunk ',
        delta: true,
        timestamp: '2024-01-01T00:00:00Z',
      };

      const events = mapGeminiEvent(event);
      expect(events[0]).toMatchObject({
        type: 'message',
        role: 'assistant',
        content: 'chunk ',
        is_delta: true,
      });
    });
  });

  describe('tool events', () => {
    it('should map tool_use to action started', () => {
      const event = {
        type: 'tool_use',
        tool_id: 'tool-abc',
        tool_name: 'read_file',
        parameters: { path: '/test.txt' },
        timestamp: '2024-01-01T00:00:00Z',
      };

      const events = mapGeminiEvent(event);
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        type: 'action',
        subtype: 'tool',
        action_id: 'tool-abc',
        status: 'started',
        tool_name: 'read_file',
        tool_input: { path: '/test.txt' },
        timestamp: '2024-01-01T00:00:00Z',
      });
    });

    it('should map successful tool_result', () => {
      const event = {
        type: 'tool_result',
        tool_id: 'tool-abc',
        status: 'success',
        output: 'File contents',
        timestamp: '2024-01-01T00:00:00Z',
      };

      const events = mapGeminiEvent(event);
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        type: 'action',
        subtype: 'tool',
        action_id: 'tool-abc',
        status: 'completed',
        tool_output: 'File contents',
        tool_error: undefined,
        timestamp: '2024-01-01T00:00:00Z',
      });
    });

    it('should map failed tool_result', () => {
      const event = {
        type: 'tool_result',
        tool_id: 'tool-abc',
        status: 'failed',
        output: null,
        error: {
          message: 'File not found',
        },
        timestamp: '2024-01-01T00:00:00Z',
      };

      const events = mapGeminiEvent(event);
      expect(events[0]).toMatchObject({
        type: 'action',
        status: 'failed',
        tool_error: 'File not found',
      });
    });
  });

  describe('error events', () => {
    it('should map warning error', () => {
      const event = {
        type: 'error',
        severity: 'warning',
        message: 'This is a warning',
        timestamp: '2024-01-01T00:00:00Z',
      };

      const events = mapGeminiEvent(event);
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        type: 'error',
        severity: 'warning',
        message: 'This is a warning',
        timestamp: '2024-01-01T00:00:00Z',
      });
    });

    it('should map error severity to error', () => {
      const event = {
        type: 'error',
        severity: 'error',
        message: 'This is an error',
        timestamp: '2024-01-01T00:00:00Z',
      };

      const events = mapGeminiEvent(event);
      expect(events[0]).toMatchObject({
        severity: 'error',
      });
    });

    it('should default non-warning severity to error', () => {
      const event = {
        type: 'error',
        severity: 'fatal',
        message: 'Fatal error',
        timestamp: '2024-01-01T00:00:00Z',
      };

      const events = mapGeminiEvent(event);
      expect(events[0]).toMatchObject({
        severity: 'error',
      });
    });
  });

  describe('result events', () => {
    it('should map successful result with stats', () => {
      const event = {
        type: 'result',
        status: 'success',
        timestamp: '2024-01-01T00:00:00Z',
        stats: {
          input_tokens: 200,
          output_tokens: 100,
          tool_calls: 5,
        },
      };

      const events = mapGeminiEvent(event);
      expect(events.length).toBeGreaterThanOrEqual(2);

      const turnEvent = events.find(e => e.type === 'turn');
      expect(turnEvent).toMatchObject({
        type: 'turn',
        subtype: 'completed',
        usage: {
          input_tokens: 200,
          output_tokens: 100,
        },
      });

      const metricsEvent = events.find(e => e.type === 'metrics');
      expect(metricsEvent).toMatchObject({
        type: 'metrics',
        subtype: 'session_summary',
        per_tool: {
          all_tools: {
            calls: 5,
          },
        },
      });

      const sessionEvent = events.find(e => e.type === 'session' && e.subtype === 'end');
      expect(sessionEvent).toMatchObject({
        type: 'session',
        subtype: 'end',
        backend: 'gemini',
      });
    });

    it('should map result without stats', () => {
      const event = {
        type: 'result',
        status: 'success',
        timestamp: '2024-01-01T00:00:00Z',
      };

      const events = mapGeminiEvent(event);
      const sessionEvent = events.find(e => e.type === 'session');
      expect(sessionEvent).toBeDefined();
      expect(sessionEvent?.subtype).toBe('end');
    });

    it('should map failed result to turn failed', () => {
      const event = {
        type: 'result',
        status: 'error',
        error: {
          message: 'Request failed',
        },
        timestamp: '2024-01-01T00:00:00Z',
      };

      const events = mapGeminiEvent(event);
      const turnEvent = events.find(e => e.type === 'turn');
      expect(turnEvent).toMatchObject({
        type: 'turn',
        subtype: 'failed',
        error: 'Request failed',
      });
    });

    it('should handle missing error message in failed result', () => {
      const event = {
        type: 'result',
        status: 'error',
        timestamp: '2024-01-01T00:00:00Z',
      };

      const events = mapGeminiEvent(event);
      const turnEvent = events.find(e => e.type === 'turn');
      expect(turnEvent?.error).toBe('Unknown error');
    });

    it('should not create metrics event if no tool calls', () => {
      const event = {
        type: 'result',
        status: 'success',
        timestamp: '2024-01-01T00:00:00Z',
        stats: {
          input_tokens: 100,
          output_tokens: 50,
        },
      };

      const events = mapGeminiEvent(event);
      const metricsEvent = events.find(e => e.type === 'metrics');
      expect(metricsEvent?.per_tool).toBeUndefined();
    });
  });

  describe('unknown events', () => {
    it('should return empty array for unknown event type', () => {
      const event = {
        type: 'unknown_type',
      };

      const events = mapGeminiEvent(event);
      expect(events).toHaveLength(0);
    });
  });

  describe('session_id handling', () => {
    it('should use session_id from init event', () => {
      const event = {
        type: 'init',
        session_id: 'actual-id',
        timestamp: '2024-01-01T00:00:00Z',
      };

      const events = mapGeminiEvent(event);
      expect(events[0].session_id).toBe('actual-id');
    });

    it('should use unknown for session end when session_id not available', () => {
      const event = {
        type: 'result',
        status: 'success',
        timestamp: '2024-01-01T00:00:00Z',
      };

      const events = mapGeminiEvent(event);
      const sessionEvent = events.find(e => e.type === 'session');
      expect(sessionEvent?.session_id).toBe('unknown');
    });
  });
});
