/**
 * Error types for coding-agent-sdk
 */

import type { ProviderType } from "./types.js";

/**
 * Base error class for SDK errors
 */
export class ACPSDKError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "ACPSDKError";
  }
}

/**
 * Error thrown when client is not connected
 */
export class NotConnectedError extends ACPSDKError {
  constructor() {
    super("Client is not connected. Call connect() first.", "NOT_CONNECTED");
    this.name = "NotConnectedError";
  }
}

/**
 * Error thrown when no ACP provider is found on the system
 */
export class NoProviderFoundError extends ACPSDKError {
  constructor(message?: string) {
    super(
      message ??
        "No ACP provider found. Install Claude Code, Codex CLI, or Gemini CLI.",
      "NO_PROVIDER_FOUND"
    );
    this.name = "NoProviderFoundError";
  }
}

/**
 * Error thrown when an unknown provider type is specified
 */
export class UnknownProviderError extends ACPSDKError {
  constructor(public readonly providerType: string) {
    super(`Unknown provider type: ${providerType}`, "UNKNOWN_PROVIDER");
    this.name = "UnknownProviderError";
  }
}

/**
 * Error thrown when a provider process fails to spawn
 */
export class ProviderSpawnError extends ACPSDKError {
  constructor(
    public readonly provider: ProviderType,
    public readonly reason: string
  ) {
    super(`Failed to spawn ${provider} provider: ${reason}`, "PROVIDER_SPAWN_ERROR");
    this.name = "ProviderSpawnError";
  }
}

/**
 * Error thrown when a provider process times out during startup
 */
export class ProviderStartupTimeoutError extends ACPSDKError {
  constructor(
    public readonly provider: ProviderType,
    public readonly timeout: number
  ) {
    super(
      `${provider} provider startup timed out after ${timeout}ms`,
      "PROVIDER_STARTUP_TIMEOUT"
    );
    this.name = "ProviderStartupTimeoutError";
  }
}

/**
 * Error thrown when a session operation fails
 */
export class SessionError extends ACPSDKError {
  constructor(
    message: string,
    public readonly sessionId?: string
  ) {
    super(message, "SESSION_ERROR");
    this.name = "SessionError";
  }
}

/**
 * Error thrown when a permission is denied
 */
export class PermissionDeniedError extends ACPSDKError {
  constructor(
    public readonly toolCallId: string,
    reason?: string
  ) {
    super(
      `Permission denied for tool call ${toolCallId}${reason ? `: ${reason}` : ""}`,
      "PERMISSION_DENIED"
    );
    this.name = "PermissionDeniedError";
  }
}

/**
 * Error thrown when initialization fails
 */
export class InitializationError extends ACPSDKError {
  constructor(message: string) {
    super(message, "INITIALIZATION_ERROR");
    this.name = "InitializationError";
  }
}

/**
 * Error thrown when provider binary is not found
 */
export class ProviderNotFoundError extends ACPSDKError {
  constructor(
    public readonly provider: ProviderType,
    public readonly binaryPath: string
  ) {
    super(
      `Provider binary not found: ${binaryPath}. Is ${provider} installed?`,
      "PROVIDER_NOT_FOUND"
    );
    this.name = "ProviderNotFoundError";
  }
}
