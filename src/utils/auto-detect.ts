/**
 * Backend auto-detection from environment variables
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Backend } from "../events.js";
import { NoBackendFoundError, MultipleBackendsFoundError } from "../types.js";

export interface DetectionResult {
  backend: Backend;
  apiKey: string;
}

/**
 * Known installation paths for CLI tools.
 * These are checked before trying PATH lookup.
 * Covers common installation locations across different platforms and package managers.
 */
export const KNOWN_PATHS: Record<string, string[]> = {
  claude: [
    // Official installer locations
    join(homedir(), ".claude", "local", "claude"),
    join(homedir(), ".local", "bin", "claude"),
    
    // Homebrew (macOS/Linux)
    "/usr/local/bin/claude",
    "/opt/homebrew/bin/claude",
    
    // npm global
    join(homedir(), ".npm-global", "bin", "claude"),
    "/usr/local/lib/node_modules/.bin/claude",
    
    // System-wide
    "/usr/bin/claude",
    "/opt/claude/bin/claude",
  ],
  codex: [
    join(homedir(), ".local", "bin", "codex"),
    "/usr/local/bin/codex",
    "/opt/homebrew/bin/codex",
    join(homedir(), ".npm-global", "bin", "codex"),
    "/usr/bin/codex",
    "/opt/codex/bin/codex",
  ],
  gemini: [
    join(homedir(), ".local", "bin", "gemini"),
    "/usr/local/bin/gemini",
    "/opt/homebrew/bin/gemini",
    join(homedir(), ".npm-global", "bin", "gemini"),
    "/usr/bin/gemini",
    "/opt/gemini/bin/gemini",
  ],
};

/**
 * Resolve the actual path to a CLI binary.
 * Uses multiple strategies to find the binary:
 * 1. Known installation paths
 * 2. `which` command
 * 3. `command -v` shell built-in
 * 4. Returns binary name as fallback for PATH lookup
 *
 * @param binaryName - The name of the binary (e.g., 'claude', 'codex', 'gemini')
 * @returns A Promise that resolves to the binary path or the original binary name
 */
export async function resolveBinaryPath(binaryName: string): Promise<string> {
  // Strategy 1: Check known installation paths
  const knownPaths = KNOWN_PATHS[binaryName] || [];
  for (const path of knownPaths) {
    if (existsSync(path)) {
      return path;
    }
  }

  // Strategy 2: Try 'which' command
  const whichPath = await findWithWhich(binaryName);
  if (whichPath && existsSync(whichPath)) {
    return whichPath;
  }

  // Strategy 3: Try 'command -v'
  const commandPath = await findWithCommand(binaryName);
  if (commandPath && existsSync(commandPath)) {
    return commandPath;
  }

  // Fallback: return binary name for PATH lookup
  return binaryName;
}

/**
 * Try to find binary using 'which' command (Unix-like systems).
 */
async function findWithWhich(binaryName: string): Promise<string | null> {
  return new Promise((resolve) => {
    const child = spawn("which", [binaryName], {
      stdio: ["ignore", "pipe", "ignore"],
      shell: false,
    });

    let output = "";
    child.stdout?.on("data", (data) => {
      output += data.toString();
    });

    child.on("exit", (code) => {
      if (code === 0 && output.trim()) {
        resolve(output.trim());
      } else {
        resolve(null);
      }
    });

    child.on("error", () => resolve(null));

    setTimeout(() => {
      child.kill();
      resolve(null);
    }, 1000);
  });
}

/**
 * Try to find binary using 'command -v' (shell built-in, works with aliases).
 */
async function findWithCommand(binaryName: string): Promise<string | null> {
  return new Promise((resolve) => {
    const child = spawn("sh", ["-c", `command -v ${binaryName}`], {
      stdio: ["ignore", "pipe", "ignore"],
      shell: false,
    });

    let output = "";
    child.stdout?.on("data", (data) => {
      output += data.toString();
    });

    child.on("exit", (code) => {
      if (code === 0 && output.trim()) {
        resolve(output.trim());
      } else {
        resolve(null);
      }
    });

    child.on("error", () => resolve(null));

    setTimeout(() => {
      child.kill();
      resolve(null);
    }, 1000);
  });
}

/**
 * Verify that a binary path actually works by running --version.
 */
async function verifyBinary(binaryPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(binaryPath, ["--version"], {
      stdio: "ignore",
      shell: false,
    });

    child.on("error", () => resolve(false));
    child.on("exit", (code) => resolve(code === 0));

    setTimeout(() => {
      child.kill();
      resolve(false);
    }, 2000);
  });
}

/**
 * Check if a CLI binary is available using multiple detection strategies.
 * Tries in order:
 * 1. Known installation paths
 * 2. `which` command
 * 3. `command -v` (shell built-in, works with aliases)
 * 4. Direct execution with --version (PATH lookup)
 */
async function isBinaryAvailable(binaryName: string): Promise<boolean> {
  // Strategy 1: Check known installation paths
  const knownPaths = KNOWN_PATHS[binaryName] || [];
  for (const path of knownPaths) {
    if (existsSync(path)) {
      const works = await verifyBinary(path);
      if (works) {
        return true;
      }
    }
  }

  // Strategy 2: Try 'which' command
  const whichPath = await findWithWhich(binaryName);
  if (whichPath && existsSync(whichPath)) {
    const works = await verifyBinary(whichPath);
    if (works) {
      return true;
    }
  }

  // Strategy 3: Try 'command -v' (catches aliases and shell functions)
  const commandPath = await findWithCommand(binaryName);
  if (commandPath && existsSync(commandPath)) {
    const works = await verifyBinary(commandPath);
    if (works) {
      return true;
    }
  }

  // Strategy 4: Direct execution with shell (PATH lookup)
  return new Promise((resolve) => {
    const child = spawn(binaryName, ["--version"], {
      stdio: "ignore",
      shell: true,
    });

    child.on("error", () => resolve(false));
    child.on("exit", (code) => resolve(code === 0));

    setTimeout(() => {
      child.kill();
      resolve(false);
    }, 2000);
  });
}

/**
 * Auto-detect backend by finding available agent binaries.
 *
 * Detection strategy:
 * 1. Check which agent binaries are installed (claude, codex, gemini)
 * 2. If exactly one binary found, use it (assume API keys are configured)
 * 3. If multiple binaries found, use first one and log a warning
 * 4. If no binaries found, throw error
 *
 * Philosophy: If they have the binary installed, they have the setup done.
 * API keys are validated at runtime when actually needed.
 *
 * @throws {NoBackendFoundError} If no agent binary is found
 */
export async function detectBackend(): Promise<DetectionResult> {
  const backends: Backend[] = ["claude", "codex", "gemini"];
  const availableBackends: Backend[] = [];

  // Check which binaries are available
  for (const backend of backends) {
    const hasBinary = await isBinaryAvailable(backend);
    if (hasBinary) {
      availableBackends.push(backend);
    }
  }

  // No binaries found
  if (availableBackends.length === 0) {
    throw new NoBackendFoundError(
      "No agent binaries found. Please install one of: claude, codex, or gemini"
    );
  }

  // Multiple binaries found - pick first one
  if (availableBackends.length > 1) {
    const backend = availableBackends[0];
    console.warn(`⚠️  Multiple backends detected: ${availableBackends.join(', ')}. Using '${backend}'.`);
  }

  // Use first available backend
  const backend = availableBackends[0];
  
  // Get API key (will throw if not set, but that's expected at runtime)
  let apiKey: string;
  try {
    apiKey = getApiKey(backend);
  } catch (error) {
    // Binary exists but API key not set - inform user
    throw new NoBackendFoundError(
      `Found '${backend}' binary but API key not configured. ${error instanceof Error ? error.message : "Set the appropriate environment variable."}`
    );
  }

  return {
    backend,
    apiKey,
  };
}

/**
 * Check if a specific backend is available (binary exists + API key configured).
 * Prioritizes binary detection since if they have the binary, they likely have the setup.
 */
export async function isBackendAvailable(backend: Backend): Promise<boolean> {
  // Check binary first (primary indicator of availability)
  const binaryName = backend; // binary name matches backend name
  const hasBinary = await isBinaryAvailable(binaryName);
  
  if (!hasBinary) {
    return false;
  }

  // Check API key (secondary check for complete setup)
  const hasApiKey = (() => {
    switch (backend) {
      case "claude":
        return !!process.env.ANTHROPIC_API_KEY;
      case "codex":
        return !!process.env.OPENAI_API_KEY;
      case "gemini":
        return !!process.env.GEMINI_API_KEY;
    }
  })();

  return hasApiKey;
}

/**
 * Get API key for a specific backend.
 *
 * @throws {Error} If API key is not set
 */
export function getApiKey(backend: Backend): string {
  let key: string | undefined;
  let envVar: string;

  switch (backend) {
    case "claude":
      key = process.env.ANTHROPIC_API_KEY;
      envVar = "ANTHROPIC_API_KEY";
      break;
    case "codex":
      key = process.env.OPENAI_API_KEY;
      envVar = "OPENAI_API_KEY";
      break;
    case "gemini":
      key = process.env.GEMINI_API_KEY;
      envVar = "GEMINI_API_KEY";
      break;
  }

  if (!key) {
    throw new Error(
      `Backend '${backend}' requires ${envVar} environment variable to be set`
    );
  }

  return key;
}
