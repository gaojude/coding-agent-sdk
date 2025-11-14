/**
 * Tests for error classes and types
 */

import { describe, it, expect } from 'vitest';
import {
  CodingAgentError,
  BackendNotAvailableError,
  NoBackendFoundError,
  MultipleBackendsFoundError,
} from './types.js';

describe('CodingAgentError', () => {
  it('should create error with message and code', () => {
    const error = new CodingAgentError('Test error', 'TEST_CODE');
    expect(error.message).toBe('Test error');
    expect(error.code).toBe('TEST_CODE');
    expect(error.name).toBe('CodingAgentError');
    expect(error.backend).toBeUndefined();
  });

  it('should create error with backend', () => {
    const error = new CodingAgentError('Test error', 'TEST_CODE', 'claude');
    expect(error.backend).toBe('claude');
  });

  it('should be instance of Error', () => {
    const error = new CodingAgentError('Test error', 'TEST_CODE');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(CodingAgentError);
  });
});

describe('BackendNotAvailableError', () => {
  it('should create error for claude backend', () => {
    const error = new BackendNotAvailableError('claude', 'CLI not found');
    expect(error.message).toBe("Backend 'claude' is not available: CLI not found");
    expect(error.code).toBe('BACKEND_NOT_AVAILABLE');
    expect(error.backend).toBe('claude');
    expect(error.name).toBe('BackendNotAvailableError');
  });

  it('should create error for codex backend', () => {
    const error = new BackendNotAvailableError('codex', 'No API key');
    expect(error.message).toBe("Backend 'codex' is not available: No API key");
    expect(error.backend).toBe('codex');
  });

  it('should create error for gemini backend', () => {
    const error = new BackendNotAvailableError('gemini', 'Binary missing');
    expect(error.message).toBe("Backend 'gemini' is not available: Binary missing");
    expect(error.backend).toBe('gemini');
  });
});

describe('NoBackendFoundError', () => {
  it('should create error with default message', () => {
    const error = new NoBackendFoundError();
    expect(error.message).toContain('No backend could be auto-detected');
    expect(error.message).toContain('agent CLI');
    expect(error.code).toBe('NO_BACKEND_FOUND');
    expect(error.name).toBe('NoBackendFoundError');
  });

  it('should create error with custom message', () => {
    const error = new NoBackendFoundError('Custom error message');
    expect(error.message).toBe('Custom error message');
    expect(error.code).toBe('NO_BACKEND_FOUND');
  });
});

describe('MultipleBackendsFoundError', () => {
  it('should create error with single backend', () => {
    const error = new MultipleBackendsFoundError(['claude']);
    expect(error.message).toBe('Multiple backends detected: claude. Please specify options.backend explicitly.');
    expect(error.code).toBe('MULTIPLE_BACKENDS_FOUND');
    expect(error.name).toBe('MultipleBackendsFoundError');
  });

  it('should create error with multiple backends', () => {
    const error = new MultipleBackendsFoundError(['claude', 'codex', 'gemini']);
    expect(error.message).toBe('Multiple backends detected: claude, codex, gemini. Please specify options.backend explicitly.');
    expect(error.code).toBe('MULTIPLE_BACKENDS_FOUND');
  });

  it('should create error with two backends', () => {
    const error = new MultipleBackendsFoundError(['claude', 'codex']);
    expect(error.message).toContain('claude, codex');
  });
});
