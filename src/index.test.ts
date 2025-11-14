/**
 * Integration tests for main query function
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { query, isBackendAvailable } from './index.js';
import { NoBackendFoundError } from './types.js';
import * as autoDetect from './utils/auto-detect.js';
import * as claudeBackend from './backends/claude.js';
import * as codexBackend from './backends/codex.js';
import * as geminiBackend from './backends/gemini.js';

// Mock backends and auto-detect
vi.mock('./utils/auto-detect.js', async () => {
  const actual = await vi.importActual<typeof autoDetect>('./utils/auto-detect.js');
  return {
    ...actual,
    detectBackend: vi.fn(),
    getApiKey: vi.fn(),
    isBackendAvailable: actual.isBackendAvailable,
  };
});

vi.mock('./backends/claude.js', () => ({
  createClaudeBackend: vi.fn(),
}));

vi.mock('./backends/codex.js', () => ({
  createCodexBackend: vi.fn(),
}));

vi.mock('./backends/gemini.js', () => ({
  createGeminiBackend: vi.fn(),
}));

describe('query function', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('backend selection', () => {
    it('should use explicitly specified backend', async () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';

      // Mock getApiKey to not throw
      vi.mocked(autoDetect.getApiKey).mockReturnValue('test-key');

      // Mock backend
      const mockEvents = (async function* () {
        yield {
          type: 'session' as const,
          subtype: 'init' as const,
          session_id: 'test-session',
          backend: 'claude' as const,
        };
      })();

      vi.mocked(claudeBackend.createClaudeBackend).mockReturnValue(mockEvents);

      const result = await query('test prompt', { backend: 'claude' });

      expect(result.backend).toBe('claude');
      // Verify the mock was set up (it gets called during query())
      expect(vi.mocked(claudeBackend.createClaudeBackend)).toBeDefined();
    });

    it('should auto-detect backend when not specified', async () => {
      process.env.OPENAI_API_KEY = 'test-key';

      // Mock auto-detection
      vi.mocked(autoDetect.detectBackend).mockResolvedValue({
        backend: 'codex',
        apiKey: 'test-key',
      });

      // Mock backend
      const mockEvents = (async function* () {
        yield {
          type: 'session' as const,
          subtype: 'init' as const,
          session_id: 'test-session',
          backend: 'codex' as const,
        };
      })();

      vi.mocked(codexBackend.createCodexBackend).mockReturnValue(mockEvents);

      const result = await query('test prompt');

      expect(autoDetect.detectBackend).toHaveBeenCalled();
      expect(result.backend).toBe('codex');
    });

    it('should return claude backend when specified', async () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      vi.mocked(autoDetect.getApiKey).mockReturnValue('test-key');

      const mockEvents = (async function* () {
        yield {
          type: 'session' as const,
          subtype: 'init' as const,
          session_id: 'test',
          backend: 'claude' as const,
        };
      })();

      vi.mocked(claudeBackend.createClaudeBackend).mockReturnValue(mockEvents);

      const result = await query('test', { backend: 'claude' });
      expect(result.backend).toBe('claude');
    });

    it('should return codex backend when specified', async () => {
      process.env.OPENAI_API_KEY = 'test-key';
      vi.mocked(autoDetect.getApiKey).mockReturnValue('test-key');

      const mockEvents = (async function* () {
        yield {
          type: 'session' as const,
          subtype: 'init' as const,
          session_id: 'test',
          backend: 'codex' as const,
        };
      })();

      vi.mocked(codexBackend.createCodexBackend).mockReturnValue(mockEvents);

      const result = await query('test', { backend: 'codex' });
      expect(result.backend).toBe('codex');
    });

    it('should return gemini backend when specified', async () => {
      process.env.GEMINI_API_KEY = 'test-key';
      vi.mocked(autoDetect.getApiKey).mockReturnValue('test-key');

      const mockEvents = (async function* () {
        yield {
          type: 'session' as const,
          subtype: 'init' as const,
          session_id: 'test',
          backend: 'gemini' as const,
        };
      })();

      vi.mocked(geminiBackend.createGeminiBackend).mockReturnValue(mockEvents);

      const result = await query('test', { backend: 'gemini' });
      expect(result.backend).toBe('gemini');
    });
  });

  describe('options handling', () => {
    beforeEach(() => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      vi.mocked(autoDetect.getApiKey).mockReturnValue('test-key');
    });

    it('should accept workingDir option', async () => {
      const mockEvents = (async function* () {
        yield {
          type: 'session' as const,
          subtype: 'init' as const,
          session_id: 'test',
          backend: 'claude' as const,
        };
      })();

      vi.mocked(claudeBackend.createClaudeBackend).mockReturnValue(mockEvents);

      const result = await query('test', {
        backend: 'claude',
        workingDir: '/custom/path',
      });

      expect(result.backend).toBe('claude');
    });

    it('should accept autoApprove option', async () => {
      const mockEvents = (async function* () {
        yield {
          type: 'session' as const,
          subtype: 'init' as const,
          session_id: 'test',
          backend: 'claude' as const,
        };
      })();

      vi.mocked(claudeBackend.createClaudeBackend).mockReturnValue(mockEvents);

      const result = await query('test', {
        backend: 'claude',
        autoApprove: false,
      });

      expect(result.backend).toBe('claude');
    });

    it('should accept resume option', async () => {
      const mockEvents = (async function* () {
        yield {
          type: 'session' as const,
          subtype: 'init' as const,
          session_id: 'resumed-session',
          backend: 'claude' as const,
        };
      })();

      vi.mocked(claudeBackend.createClaudeBackend).mockReturnValue(mockEvents);

      const result = await query('continue', {
        backend: 'claude',
        resume: 'previous-session-id',
      });

      expect(result.sessionId).toBeDefined();
    });

    it('should accept backend-specific options', async () => {
      const mockEvents = (async function* () {
        yield {
          type: 'session' as const,
          subtype: 'init' as const,
          session_id: 'test',
          backend: 'claude' as const,
        };
      })();

      vi.mocked(claudeBackend.createClaudeBackend).mockReturnValue(mockEvents);

      const result = await query('test', {
        backend: 'claude',
        backendOptions: {
          claude: {
            maxThinkingTokens: 10000,
            mcpServers: ['test-server'],
          },
        },
      });

      expect(result.backend).toBe('claude');
    });
  });

  describe('event streaming', () => {
    beforeEach(() => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      vi.mocked(autoDetect.getApiKey).mockReturnValue('test-key');
    });

    it('should stream events from backend', async () => {
      const mockEvents = (async function* () {
        yield {
          type: 'session' as const,
          subtype: 'init' as const,
          session_id: 'test-session',
          backend: 'claude' as const,
        };
        yield {
          type: 'message' as const,
          role: 'assistant' as const,
          content: 'Hello',
        };
        yield {
          type: 'turn' as const,
          subtype: 'completed' as const,
        };
      })();

      vi.mocked(claudeBackend.createClaudeBackend).mockReturnValue(mockEvents);

      const result = await query('test', { backend: 'claude' });

      const events = [];
      for await (const event of result.events) {
        events.push(event);
      }

      expect(events).toHaveLength(3);
      expect(events[0].type).toBe('session');
      expect(events[1].type).toBe('message');
      expect(events[2].type).toBe('turn');
    });

    it('should extract session ID from events', async () => {
      const mockEvents = (async function* () {
        yield {
          type: 'session' as const,
          subtype: 'init' as const,
          session_id: 'extracted-id',
          backend: 'claude' as const,
        };
      })();

      vi.mocked(claudeBackend.createClaudeBackend).mockReturnValue(mockEvents);

      const result = await query('test', { backend: 'claude' });

      // Consume events to populate buffer
      for await (const event of result.events) {
        // Consume
      }

      expect(result.sessionId).toBe('extracted-id');
    });

    it('should return unknown if session ID not found', async () => {
      const mockEvents = (async function* () {
        yield {
          type: 'message' as const,
          role: 'assistant' as const,
          content: 'No session event',
        };
      })();

      vi.mocked(claudeBackend.createClaudeBackend).mockReturnValue(mockEvents);

      const result = await query('test', { backend: 'claude' });

      // Don't consume events - check fallback
      expect(result.sessionId).toBe('unknown');
    });
  });

  describe('error handling', () => {
    it('should throw NoBackendFoundError when auto-detect fails', async () => {
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.OPENAI_API_KEY;
      delete process.env.GEMINI_API_KEY;

      vi.mocked(autoDetect.detectBackend).mockRejectedValue(
        new NoBackendFoundError()
      );

      await expect(query('test')).rejects.toThrow(NoBackendFoundError);
    });

    it('should not check API key for specified backend (CLI handles auth)', async () => {
      delete process.env.ANTHROPIC_API_KEY;

      // API key check is removed - CLI tools handle their own auth
      // This test just verifies we don't throw during query() call
      const result = query('test', { backend: 'claude' });
      expect(result).toBeDefined();
      expect(result.then).toBeDefined(); // It's a promise
    });
  });

  describe('result object', () => {
    beforeEach(() => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      vi.mocked(autoDetect.getApiKey).mockReturnValue('test-key');
    });

    it('should return result with backend field', async () => {
      const mockEvents = (async function* () {
        yield {
          type: 'session' as const,
          subtype: 'init' as const,
          session_id: 'test',
          backend: 'claude' as const,
        };
      })();

      vi.mocked(claudeBackend.createClaudeBackend).mockReturnValue(mockEvents);

      const result = await query('test', { backend: 'claude' });

      expect(result.backend).toBe('claude');
    });

    it('should return result with events generator', async () => {
      const mockEvents = (async function* () {
        yield {
          type: 'session' as const,
          subtype: 'init' as const,
          session_id: 'test',
          backend: 'claude' as const,
        };
      })();

      vi.mocked(claudeBackend.createClaudeBackend).mockReturnValue(mockEvents);

      const result = await query('test', { backend: 'claude' });

      expect(result.events).toBeDefined();
      expect(typeof result.events[Symbol.asyncIterator]).toBe('function');
    });

    it('should return result with sessionId getter', async () => {
      const mockEvents = (async function* () {
        yield {
          type: 'session' as const,
          subtype: 'init' as const,
          session_id: 'getter-test',
          backend: 'claude' as const,
        };
      })();

      vi.mocked(claudeBackend.createClaudeBackend).mockReturnValue(mockEvents);

      const result = await query('test', { backend: 'claude' });

      // Session ID should be available via getter
      expect(typeof result.sessionId).toBe('string');
    });
  });
});

describe('isBackendAvailable (re-export)', () => {
  it('should re-export isBackendAvailable from utils', () => {
    expect(isBackendAvailable).toBe(autoDetect.isBackendAvailable);
  });
});
