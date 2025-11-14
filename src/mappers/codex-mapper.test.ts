/**
 * Tests for Codex event mapper
 */

import { describe, it, expect } from 'vitest';
import { mapCodexEvent } from './codex-mapper.js';

describe('mapCodexEvent', () => {
  describe('thread events', () => {
    it('should map thread.started to session init', () => {
      const event = {
        type: 'thread.started',
        thread_id: 'thread-123',
      };

      const events = mapCodexEvent(event);
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        type: 'session',
        subtype: 'init',
        session_id: 'thread-123',
        backend: 'codex',
      });
    });
  });

  describe('turn events', () => {
    it('should map turn.started', () => {
      const event = {
        type: 'turn.started',
      };

      const events = mapCodexEvent(event);
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        type: 'turn',
        subtype: 'started',
      });
    });

    it('should map turn.completed with usage', () => {
      const event = {
        type: 'turn.completed',
        usage: {
          input_tokens: 150,
          output_tokens: 75,
          cached_input_tokens: 30,
        },
      };

      const events = mapCodexEvent(event);
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        type: 'turn',
        subtype: 'completed',
        usage: {
          input_tokens: 150,
          output_tokens: 75,
          cached_tokens: 30,
        },
      });
    });

    it('should map turn.failed', () => {
      const event = {
        type: 'turn.failed',
        error: {
          message: 'Something went wrong',
        },
      };

      const events = mapCodexEvent(event);
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        type: 'turn',
        subtype: 'failed',
        error: 'Something went wrong',
      });
    });
  });

  describe('item events - agent_message', () => {
    it('should map agent_message to assistant message', () => {
      const event = {
        type: 'item.completed',
        item: {
          type: 'agent_message',
          text: 'Here is my response',
        },
      };

      const events = mapCodexEvent(event);
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        type: 'message',
        role: 'assistant',
        content: 'Here is my response',
      });
    });
  });

  describe('item events - reasoning', () => {
    it('should map reasoning item to action event', () => {
      const event = {
        type: 'item.completed',
        item: {
          type: 'reasoning',
          id: 'reasoning-1',
          text: 'Thinking about the problem...',
        },
      };

      const events = mapCodexEvent(event);
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        type: 'action',
        subtype: 'reasoning',
        action_id: 'reasoning-1',
        status: 'completed',
        reasoning_text: 'Thinking about the problem...',
      });
    });
  });

  describe('item events - command_execution', () => {
    it('should map command execution in progress', () => {
      const event = {
        type: 'item.updated',
        item: {
          type: 'command_execution',
          id: 'cmd-1',
          command: 'ls -la',
          status: 'in_progress',
          aggregated_output: 'total 48\n',
        },
      };

      const events = mapCodexEvent(event);
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: 'action',
        subtype: 'command',
        action_id: 'cmd-1',
        status: 'in_progress',
        command: 'ls -la',
        command_output: 'total 48\n',
      });
    });

    it('should map completed command with exit code', () => {
      const event = {
        type: 'item.completed',
        item: {
          type: 'command_execution',
          id: 'cmd-1',
          command: 'npm test',
          status: 'completed',
          aggregated_output: 'All tests passed',
          exit_code: 0,
        },
      };

      const events = mapCodexEvent(event);
      expect(events[0]).toMatchObject({
        status: 'completed',
        exit_code: 0,
      });
    });

    it('should map failed command', () => {
      const event = {
        type: 'item.completed',
        item: {
          type: 'command_execution',
          id: 'cmd-1',
          command: 'invalid-command',
          status: 'failed',
          aggregated_output: 'Command not found',
          exit_code: 127,
        },
      };

      const events = mapCodexEvent(event);
      expect(events[0]).toMatchObject({
        status: 'failed',
        exit_code: 127,
      });
    });
  });

  describe('item events - file_change', () => {
    it('should map file changes', () => {
      const event = {
        type: 'item.completed',
        item: {
          type: 'file_change',
          id: 'change-1',
          status: 'completed',
          changes: [
            { path: '/test/file1.js', kind: 'update' },
            { path: '/test/file2.js', kind: 'add' },
          ],
        },
      };

      const events = mapCodexEvent(event);
      expect(events).toHaveLength(2);
      expect(events[0]).toMatchObject({
        type: 'action',
        subtype: 'file_change',
        file_path: '/test/file1.js',
        change_type: 'update',
        status: 'completed',
      });
      expect(events[1]).toMatchObject({
        file_path: '/test/file2.js',
        change_type: 'add',
      });
    });

    it('should handle failed file changes', () => {
      const event = {
        type: 'item.completed',
        item: {
          type: 'file_change',
          id: 'change-1',
          status: 'failed',
          changes: [
            { path: '/test/file.js', kind: 'delete' },
          ],
        },
      };

      const events = mapCodexEvent(event);
      expect(events[0]).toMatchObject({
        status: 'failed',
      });
    });
  });

  describe('item events - mcp_tool_call', () => {
    it('should map MCP tool call in progress', () => {
      const event = {
        type: 'item.updated',
        item: {
          type: 'mcp_tool_call',
          id: 'mcp-1',
          server: 'my-mcp-server',
          tool: 'get_data',
          arguments: { id: 123 },
          status: 'in_progress',
        },
      };

      const events = mapCodexEvent(event);
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: 'action',
        subtype: 'mcp_tool',
        action_id: 'mcp-1',
        status: 'in_progress',
        tool_name: 'get_data',
        tool_input: { id: 123 },
        metadata: {
          mcp_server: 'my-mcp-server',
        },
      });
    });

    it('should map completed MCP tool call', () => {
      const event = {
        type: 'item.completed',
        item: {
          type: 'mcp_tool_call',
          id: 'mcp-1',
          server: 'my-mcp-server',
          tool: 'get_data',
          arguments: { id: 123 },
          status: 'completed',
          result: {
            content: 'Data here',
            structured_content: { key: 'value' },
          },
        },
      };

      const events = mapCodexEvent(event);
      expect(events[0]).toMatchObject({
        status: 'completed',
        tool_output: 'Data here',
        metadata: {
          mcp_server: 'my-mcp-server',
          structured_result: { key: 'value' },
        },
      });
    });

    it('should map failed MCP tool call', () => {
      const event = {
        type: 'item.completed',
        item: {
          type: 'mcp_tool_call',
          id: 'mcp-1',
          server: 'my-mcp-server',
          tool: 'get_data',
          arguments: {},
          status: 'failed',
          error: {
            message: 'Connection failed',
          },
        },
      };

      const events = mapCodexEvent(event);
      expect(events[0]).toMatchObject({
        status: 'failed',
        tool_error: 'Connection failed',
      });
    });
  });

  describe('item events - web_search', () => {
    it('should map web search', () => {
      const event = {
        type: 'item.completed',
        item: {
          type: 'web_search',
          id: 'search-1',
          query: 'typescript best practices',
        },
      };

      const events = mapCodexEvent(event);
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: 'action',
        subtype: 'web_search',
        action_id: 'search-1',
        search_query: 'typescript best practices',
      });
    });
  });

  describe('item events - todo_list', () => {
    it('should map todo list updates', () => {
      const event = {
        type: 'item.updated',
        item: {
          type: 'todo_list',
          items: [
            { text: 'Fix bug', completed: false },
            { text: 'Write tests', completed: true },
            { text: 'Deploy', completed: false },
          ],
        },
      };

      const events = mapCodexEvent(event);
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        type: 'progress',
        subtype: 'todo_update',
        todo_items: [
          { title: 'Fix bug', status: 'pending' },
          { title: 'Write tests', status: 'completed' },
          { title: 'Deploy', status: 'pending' },
        ],
      });
    });
  });

  describe('item events - error', () => {
    it('should map error item to error event', () => {
      const event = {
        type: 'item.completed',
        item: {
          type: 'error',
          id: 'error-1',
          message: 'Failed to execute command',
        },
      };

      const events = mapCodexEvent(event);
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        type: 'error',
        severity: 'error',
        message: 'Failed to execute command',
        related_action_id: 'error-1',
      });
    });
  });

  describe('error events', () => {
    it('should map fatal error', () => {
      const event = {
        type: 'error',
        message: 'Fatal error occurred',
      };

      const events = mapCodexEvent(event);
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        type: 'error',
        severity: 'fatal',
        message: 'Fatal error occurred',
      });
    });
  });

  describe('status mapping', () => {
    it('should map command status from item.status field', () => {
      const event = {
        type: 'item.started',
        item: {
          type: 'command_execution',
          id: 'cmd-1',
          command: 'test',
          status: 'in_progress',
        },
      };

      const events = mapCodexEvent(event);
      // Command execution uses item.status directly, not event type
      expect(events[0].status).toBe('in_progress');
    });

    it('should map item.updated to in_progress status', () => {
      const event = {
        type: 'item.updated',
        item: {
          type: 'command_execution',
          id: 'cmd-1',
          command: 'test',
          status: 'in_progress',
        },
      };

      const events = mapCodexEvent(event);
      expect(events[0].status).toBe('in_progress');
    });

    it('should map item.completed with completed status', () => {
      const event = {
        type: 'item.completed',
        item: {
          type: 'command_execution',
          id: 'cmd-1',
          command: 'test',
          status: 'completed',
        },
      };

      const events = mapCodexEvent(event);
      expect(events[0].status).toBe('completed');
    });

    it('should map item.completed with failed status', () => {
      const event = {
        type: 'item.completed',
        item: {
          type: 'command_execution',
          id: 'cmd-1',
          command: 'test',
          status: 'failed',
        },
      };

      const events = mapCodexEvent(event);
      expect(events[0].status).toBe('failed');
    });
  });

  describe('unknown events', () => {
    it('should return empty array for unknown event types', () => {
      const event = {
        type: 'unknown_event',
      };

      const events = mapCodexEvent(event);
      expect(events).toHaveLength(0);
    });

    it('should return empty array for unknown item types', () => {
      const event = {
        type: 'item.completed',
        item: {
          type: 'unknown_item_type',
          id: 'item-1',
        },
      };

      const events = mapCodexEvent(event);
      expect(events).toHaveLength(0);
    });
  });
});
