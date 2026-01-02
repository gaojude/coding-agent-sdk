/**
 * Base provider abstraction for ACP providers
 */

import { spawn, type ChildProcess } from "node:child_process";
import { promisify } from "node:util";
import { exec } from "node:child_process";
import type { ProviderType, ProviderOptions } from "../types.js";
import {
  ProviderSpawnError,
  ProviderStartupTimeoutError,
} from "../errors.js";

const execAsync = promisify(exec);

/**
 * Interface for ACP providers
 */
export interface ACPProvider {
  readonly type: ProviderType;

  /**
   * Spawn the ACP provider process.
   * Returns the child process with stdio configured for ACP.
   */
  spawn(): Promise<ChildProcess>;

  /**
   * Check if this provider is available on the system.
   */
  isAvailable(): Promise<boolean>;

  /**
   * Get the command that will be executed.
   */
  getCommand(): { binary: string; args: string[] };
}

/**
 * Abstract base class for ACP providers
 */
export abstract class BaseACPProvider implements ACPProvider {
  abstract readonly type: ProviderType;
  protected abstract readonly defaultBinary: string;
  protected abstract readonly defaultArgs: string[];

  constructor(protected options: ProviderOptions = {}) {}

  async spawn(): Promise<ChildProcess> {
    const { binary, args } = this.getCommand();

    const child = spawn(binary, args, {
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        ...this.options.env,
      },
      // Use shell on Windows for proper PATH resolution
      shell: process.platform === "win32" ? true : false,
    });

    // Wait for process to be ready (with timeout)
    await this.waitForReady(child);

    return child;
  }

  getCommand(): { binary: string; args: string[] } {
    return {
      binary: this.options.binaryPath ?? this.defaultBinary,
      args: [...this.defaultArgs, ...(this.options.extraArgs ?? [])],
    };
  }

  async isAvailable(): Promise<boolean> {
    try {
      const { binary, args } = this.getCommand();
      // Try to check if binary exists
      return await checkBinaryExists(binary, args);
    } catch {
      return false;
    }
  }

  protected async waitForReady(child: ChildProcess): Promise<void> {
    const timeout = this.options.startupTimeout ?? 10000;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        child.kill();
        reject(new ProviderStartupTimeoutError(this.type, timeout));
      }, timeout);

      child.on("error", (err) => {
        clearTimeout(timer);
        reject(new ProviderSpawnError(this.type, err.message));
      });

      // Consider ready once stdout is available
      if (child.stdout) {
        clearTimeout(timer);
        resolve();
      } else {
        child.on("spawn", () => {
          clearTimeout(timer);
          resolve();
        });
      }
    });
  }
}

/**
 * Check if a binary exists and is executable
 */
async function checkBinaryExists(binary: string, args: string[]): Promise<boolean> {
  try {
    // On Windows, use 'where', on Unix use 'which'
    const command = process.platform === "win32" ? "where" : "which";

    // For npx commands, check if npx itself exists
    const binaryToCheck = binary === "npx" ? "npx" : binary;

    await execAsync(`${command} ${binaryToCheck}`);
    return true;
  } catch {
    // If 'which' fails, try running the command with --version or --help
    try {
      await execAsync(`${binary} ${args.includes("--help") ? "--help" : "--version"}`);
      return true;
    } catch {
      return false;
    }
  }
}
