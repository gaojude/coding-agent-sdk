/**
 * Tests for backend auto-detection
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { detectBackend, isBackendAvailable, getApiKey } from "./auto-detect.js";
import { NoBackendFoundError, MultipleBackendsFoundError } from "../types.js";
import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import { existsSync } from "node:fs";

// Mock child_process and fs
vi.mock("node:child_process");
vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
}));

describe("getApiKey", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should get Claude API key", () => {
    process.env.ANTHROPIC_API_KEY = "test-claude-key";
    expect(getApiKey("claude")).toBe("test-claude-key");
  });

  it("should get Codex API key", () => {
    process.env.CODEX_API_KEY = "test-codex-key";
    expect(getApiKey("codex")).toBe("test-codex-key");
  });

  it("should get Gemini API key", () => {
    process.env.GEMINI_API_KEY = "test-gemini-key";
    expect(getApiKey("gemini")).toBe("test-gemini-key");
  });

  it("should throw error if Claude API key not set", () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect(() => getApiKey("claude")).toThrow(
      "Backend 'claude' requires ANTHROPIC_API_KEY"
    );
  });

  it("should throw error if Codex API key not set", () => {
    delete process.env.CODEX_API_KEY;
    expect(() => getApiKey("codex")).toThrow(
      "Backend 'codex' requires CODEX_API_KEY"
    );
  });

  it("should throw error if Gemini API key not set", () => {
    delete process.env.GEMINI_API_KEY;
    expect(() => getApiKey("gemini")).toThrow(
      "Backend 'gemini' requires GEMINI_API_KEY"
    );
  });
});

describe("isBackendAvailable", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();
    // Mock existsSync to return false (no known paths exist in tests)
    vi.mocked(existsSync).mockReturnValue(false);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should return true if binary and API key both available", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";

    // Mock multiple detection strategies
    vi.mocked(spawn).mockImplementation((command: any, args: any) => {
      const mockChild = new EventEmitter() as any;
      mockChild.kill = vi.fn();
      mockChild.stdout = new EventEmitter();
      
      // Fail first two strategies (which, command -v)
      if (command === "which" || command === "sh") {
        setTimeout(() => mockChild.emit("exit", 1), 0);
      } else if (command === "claude") {
        // Direct execution succeeds
        setTimeout(() => mockChild.emit("exit", 0), 0);
      }
      
      return mockChild;
    });

    const result = await isBackendAvailable("claude");
    expect(result).toBe(true);
    // Should try multiple strategies
    expect(spawn).toHaveBeenCalled();
  });

  it("should return false if binary not available (even with API key)", async () => {
    process.env.CODEX_API_KEY = "test-key";

    // All detection strategies fail
    vi.mocked(spawn).mockImplementation(() => {
      const mockChild = new EventEmitter() as any;
      mockChild.kill = vi.fn();
      mockChild.stdout = new EventEmitter();
      setTimeout(() => mockChild.emit("error", new Error("ENOENT")), 0);
      return mockChild;
    });

    const result = await isBackendAvailable("codex");
    expect(result).toBe(false);
  });

  it("should return false if binary available but API key missing", async () => {
    delete process.env.ANTHROPIC_API_KEY;

    // Mock binary exists
    vi.mocked(spawn).mockImplementation((command: any) => {
      const mockChild = new EventEmitter() as any;
      mockChild.kill = vi.fn();
      mockChild.stdout = new EventEmitter();
      
      if (command === "claude") {
        setTimeout(() => mockChild.emit("exit", 0), 0);
      } else {
        setTimeout(() => mockChild.emit("exit", 1), 0);
      }
      
      return mockChild;
    });

    const result = await isBackendAvailable("claude");
    // Binary exists but API key missing
    expect(result).toBe(false);
  });

  it("should return false if binary exits with non-zero code", async () => {
    process.env.GEMINI_API_KEY = "test-key";

    // All strategies fail
    vi.mocked(spawn).mockImplementation(() => {
      const mockChild = new EventEmitter() as any;
      mockChild.kill = vi.fn();
      mockChild.stdout = new EventEmitter();
      setTimeout(() => mockChild.emit("exit", 1), 0);
      return mockChild;
    });

    const result = await isBackendAvailable("gemini");
    expect(result).toBe(false);
  });

  it("should handle timeout", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";

    // Never emit events to trigger timeout
    vi.mocked(spawn).mockImplementation(() => {
      const mockChild = new EventEmitter() as any;
      mockChild.kill = vi.fn();
      mockChild.stdout = new EventEmitter();
      // Don't emit any events to trigger timeout
      return mockChild;
    });

    const result = await isBackendAvailable("claude");
    expect(result).toBe(false);
  }, 10000); // Increase timeout for this specific test
});

describe("detectBackend", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();
    // Mock existsSync to return false (no known paths exist in tests)
    vi.mocked(existsSync).mockReturnValue(false);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should detect Claude backend when only claude binary found", async () => {
    process.env.ANTHROPIC_API_KEY = "test-claude-key";

    // Mock: claude binary exists, others don't
    vi.mocked(spawn).mockImplementation((command: any, args: any) => {
      const mockChild = new EventEmitter() as any;
      mockChild.kill = vi.fn();
      mockChild.stdout = new EventEmitter();

      setImmediate(() => {
        if (command === "claude" && args?.[0] === "--version") {
          // Claude binary succeeds
          mockChild.emit("exit", 0);
        } else {
          // Everything else fails (which, sh, other binaries)
          mockChild.emit("exit", 1);
        }
      });

      return mockChild;
    });

    const result = await detectBackend();
    expect(result.backend).toBe("claude");
    expect(result.apiKey).toBe("test-claude-key");
  }, 10000);

  it("should detect Codex backend when only codex binary found", async () => {
    process.env.CODEX_API_KEY = "test-codex-key";

    vi.mocked(spawn).mockImplementation((command: any, args: any) => {
      const mockChild = new EventEmitter() as any;
      mockChild.kill = vi.fn();
      mockChild.stdout = new EventEmitter();

      setImmediate(() => {
        if (command === "codex" && args?.[0] === "--version") {
          mockChild.emit("exit", 0);
        } else {
          mockChild.emit("exit", 1);
        }
      });

      return mockChild;
    });

    const result = await detectBackend();
    expect(result.backend).toBe("codex");
    expect(result.apiKey).toBe("test-codex-key");
  }, 10000);

  it("should detect Gemini backend when only gemini binary found", async () => {
    process.env.GEMINI_API_KEY = "test-gemini-key";

    vi.mocked(spawn).mockImplementation((command: any, args: any) => {
      const mockChild = new EventEmitter() as any;
      mockChild.kill = vi.fn();
      mockChild.stdout = new EventEmitter();

      setImmediate(() => {
        if (command === "gemini" && args?.[0] === "--version") {
          mockChild.emit("exit", 0);
        } else {
          mockChild.emit("exit", 1);
        }
      });

      return mockChild;
    });

    const result = await detectBackend();
    expect(result.backend).toBe("gemini");
    expect(result.apiKey).toBe("test-gemini-key");
  }, 10000);

  it("should throw NoBackendFoundError if no binaries found", async () => {
    // All binary checks fail
    vi.mocked(spawn).mockImplementation(() => {
      const mockChild = new EventEmitter() as any;
      mockChild.kill = vi.fn();
      mockChild.stdout = new EventEmitter();
      setImmediate(() => mockChild.emit("exit", 1));
      return mockChild;
    });

    await expect(detectBackend()).rejects.toThrow(NoBackendFoundError);
    await expect(detectBackend()).rejects.toThrow("No agent binaries found");
  }, 15000);

  it("should throw NoBackendFoundError if binary found but API key missing", async () => {
    delete process.env.ANTHROPIC_API_KEY;

    vi.mocked(spawn).mockImplementation((command: any, args: any) => {
      const mockChild = new EventEmitter() as any;
      mockChild.kill = vi.fn();
      mockChild.stdout = new EventEmitter();

      setImmediate(() => {
        if (command === "claude" && args?.[0] === "--version") {
          // Claude binary exists
          mockChild.emit("exit", 0);
        } else {
          // Others fail
          mockChild.emit("exit", 1);
        }
      });

      return mockChild;
    });

    await expect(detectBackend()).rejects.toThrow(NoBackendFoundError);
    await expect(detectBackend()).rejects.toThrow("API key not configured");
  }, 10000);

  it("should throw MultipleBackendsFoundError if multiple binaries available", async () => {
    process.env.ANTHROPIC_API_KEY = "test-claude-key";
    process.env.CODEX_API_KEY = "test-codex-key";

    // Make claude and codex binaries succeed
    vi.mocked(spawn).mockImplementation((command: any, args: any) => {
      const mockChild = new EventEmitter() as any;
      mockChild.kill = vi.fn();
      mockChild.stdout = new EventEmitter();

      setImmediate(() => {
        if ((command === "claude" || command === "codex") && args?.[0] === "--version") {
          mockChild.emit("exit", 0);
        } else {
          mockChild.emit("exit", 1);
        }
      });

      return mockChild;
    });

    await expect(detectBackend()).rejects.toThrow(MultipleBackendsFoundError);
  }, 15000);
});
