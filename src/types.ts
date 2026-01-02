/**
 * Types for coding-agent-sdk
 *
 * Re-exports ACP types directly and adds SDK-specific extensions.
 */

// Re-export all ACP types
export type {
  // Core content types
  ContentBlock,
  TextContent,
  ImageContent,
  AudioContent,
  ResourceLink,
  EmbeddedResource,
  Annotations,

  // Session types
  SessionId,
  SessionUpdate,
  SessionNotification,
  SessionInfo,
  SessionMode,
  SessionModeId,
  SessionModeState,

  // Tool call types
  ToolCall,
  ToolCallUpdate,
  ToolCallContent,
  ToolCallId,
  ToolCallStatus,
  ToolCallLocation,
  ToolKind,
  Diff,
  Terminal,

  // Plan types
  Plan,
  PlanEntry,
  PlanEntryStatus,
  PlanEntryPriority,

  // Permission types
  PermissionOption,
  PermissionOptionId,
  PermissionOptionKind,
  RequestPermissionRequest,
  RequestPermissionResponse,
  RequestPermissionOutcome,

  // Request/Response types
  InitializeRequest,
  InitializeResponse,
  NewSessionRequest,
  NewSessionResponse,
  LoadSessionRequest,
  LoadSessionResponse,
  PromptRequest,
  PromptResponse,
  CancelNotification,

  // Capability types
  ClientCapabilities,
  AgentCapabilities,
  PromptCapabilities,
  McpCapabilities,
  FileSystemCapability,

  // MCP types
  McpServer,
  McpServerStdio,
  McpServerHttp,
  McpServerSse,
  EnvVariable,

  // Protocol types
  StopReason,
  ProtocolVersion,
  Implementation,
  Role,

  // Terminal types
  CreateTerminalRequest,
  CreateTerminalResponse,
  TerminalOutputRequest,
  TerminalOutputResponse,
  TerminalExitStatus,

  // File operation types
  ReadTextFileRequest,
  ReadTextFileResponse,
  WriteTextFileRequest,
  WriteTextFileResponse,

  // Command types
  AvailableCommand,
  AvailableCommandsUpdate,
} from "@agentclientprotocol/sdk";

// Re-export classes and functions
export {
  ClientSideConnection,
  AgentSideConnection,
  TerminalHandle,
  RequestError,
  ndJsonStream,
} from "@agentclientprotocol/sdk";

// Re-export interfaces
export type { Client, Agent, AnyMessage } from "@agentclientprotocol/sdk";

// SDK-specific types

/**
 * Supported ACP provider types
 */
export type ProviderType = "claude" | "codex" | "gemini";

/**
 * Options for spawning provider processes
 */
export interface ProviderOptions {
  /** Path to provider binary (overrides auto-detection) */
  binaryPath?: string;

  /** Additional arguments to pass to provider */
  extraArgs?: string[];

  /** Environment variables to add */
  env?: Record<string, string>;

  /** Timeout for provider startup in ms (default: 10000) */
  startupTimeout?: number;
}

/**
 * Claude-specific provider options
 */
export interface ClaudeProviderOptions extends ProviderOptions {
  /** Use npx to run the provider (default: true) */
  useNpx?: boolean;
}

/**
 * Codex-specific provider options
 */
export interface CodexProviderOptions extends ProviderOptions {
  /** Model to use */
  model?: string;
}

/**
 * Gemini-specific provider options
 */
export interface GeminiProviderOptions extends ProviderOptions {
  /** Enable sandbox mode */
  sandbox?: boolean;
}

/**
 * MCP server configuration for SDK usage
 */
export interface MCPServerConfig {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

/**
 * Permission handler callback type
 */
export type PermissionHandler = (
  request: import("@agentclientprotocol/sdk").RequestPermissionRequest
) => Promise<PermissionResponse>;

/**
 * Permission response from handler
 */
export interface PermissionResponse {
  optionId: string;
}

/**
 * Options for creating a coding agent client
 */
export interface ClientOptions {
  /**
   * Provider to use. If not specified, auto-detects from available providers.
   * Priority order: claude > codex > gemini
   */
  provider?: ProviderType;

  /**
   * Working directory for the agent.
   * Defaults to process.cwd()
   */
  cwd?: string;

  /**
   * MCP servers to connect when creating sessions.
   */
  mcpServers?: MCPServerConfig[];

  /**
   * Provider-specific options for spawning.
   */
  providerOptions?: {
    claude?: ClaudeProviderOptions;
    codex?: CodexProviderOptions;
    gemini?: GeminiProviderOptions;
  };

  /**
   * Auto-approve all permission requests.
   * Enables "YOLO mode" for fully automated workflows.
   * Default: false
   */
  autoApprove?: boolean;

  /**
   * Custom permission handler for interactive approval.
   * Called when autoApprove is false and a tool requires authorization.
   */
  onPermissionRequest?: PermissionHandler;

  /**
   * Client capabilities to advertise during initialization.
   */
  clientCapabilities?: import("@agentclientprotocol/sdk").ClientCapabilities;

  /**
   * Client info to send during initialization.
   */
  clientInfo?: {
    name: string;
    version: string;
    title?: string;
  };
}

/**
 * Options for creating a new session
 */
export interface NewSessionOptions {
  /** Working directory override */
  cwd?: string;

  /** MCP servers to connect */
  mcpServers?: MCPServerConfig[];
}

/**
 * Options for loading an existing session
 */
export interface LoadSessionOptions extends NewSessionOptions {
  /** Session ID to load */
  sessionId: string;
}
