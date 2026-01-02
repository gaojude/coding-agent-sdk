/**
 * Client for connecting to coding agents
 */

import type { ChildProcess } from "node:child_process";
import { Readable, Writable } from "node:stream";
import {
  ClientSideConnection,
  ndJsonStream,
  type Client as ACPClientInterface,
  type SessionId,
  type RequestPermissionRequest,
  type RequestPermissionResponse,
  type SessionNotification,
  type ReadTextFileRequest,
  type ReadTextFileResponse,
  type WriteTextFileRequest,
  type WriteTextFileResponse,
  type CreateTerminalRequest,
  type CreateTerminalResponse,
  type McpServer,
} from "@agentclientprotocol/sdk";

import type {
  ClientOptions,
  ProviderType,
  MCPServerConfig,
  NewSessionOptions,
  LoadSessionOptions,
} from "../types.js";
import {
  createProvider,
  detectProvider,
  type ACPProvider,
} from "../providers/index.js";
import { NotConnectedError, InitializationError } from "../errors.js";
import { Session } from "./session.js";

/**
 * Client for connecting to coding agents
 *
 * Manages the lifecycle of agent connections.
 *
 * @example
 * ```typescript
 * const client = createClient({ provider: 'claude' });
 * await client.connect();
 *
 * const session = await client.newSession();
 * for await (const update of session.prompt('Fix the bug in auth.ts')) {
 *   console.log(update);
 * }
 *
 * await client.disconnect();
 * ```
 */
export class CodingAgentClient {
  private connection: ClientSideConnection | null = null;
  private process: ChildProcess | null = null;
  private provider: ACPProvider | null = null;
  private options: ClientOptions;
  private sessionUpdateHandler: ((notification: SessionNotification) => void) | null = null;

  constructor(options: ClientOptions = {}) {
    this.options = options;
  }

  /**
   * Connect to the coding agent.
   * Spawns the agent process and establishes the connection.
   */
  async connect(): Promise<void> {
    // Resolve provider
    const providerType = this.options.provider ?? (await detectProvider());
    const providerOptions = this.options.providerOptions?.[providerType];
    this.provider = createProvider(providerType, providerOptions);

    // Spawn provider process
    this.process = await this.provider.spawn();

    if (!this.process.stdout || !this.process.stdin) {
      throw new InitializationError("Agent process has no stdio");
    }

    // Convert Node.js streams to Web Streams
    const writableStream = Writable.toWeb(
      this.process.stdin
    ) as WritableStream<Uint8Array>;
    const readableStream = Readable.toWeb(
      this.process.stdout
    ) as ReadableStream<Uint8Array>;

    // Create stream connection
    const stream = ndJsonStream(writableStream, readableStream);

    // Create connection
    this.connection = new ClientSideConnection(
      () => this.createClientHandler(),
      stream
    );

    // Initialize connection
    const response = await this.connection.initialize({
      protocolVersion: 1,
      clientCapabilities: this.options.clientCapabilities ?? {
        fs: {
          readTextFile: true,
          writeTextFile: true,
        },
        terminal: true,
      },
      clientInfo: this.options.clientInfo ?? {
        name: "coding-agent-sdk",
        version: "1.0.0",
      },
    });

    if (!response) {
      throw new InitializationError("Failed to initialize connection");
    }
  }

  /**
   * Create a new session with the agent.
   */
  async newSession(options?: NewSessionOptions): Promise<Session> {
    if (!this.connection) {
      throw new NotConnectedError();
    }

    const mcpServers = this.convertMCPServers(
      options?.mcpServers ?? this.options.mcpServers ?? []
    );

    const response = await this.connection.newSession({
      cwd: options?.cwd ?? this.options.cwd ?? process.cwd(),
      mcpServers,
    });

    return new Session(
      this.connection,
      response.sessionId,
      this.options,
      (handler) => {
        this.sessionUpdateHandler = handler;
      }
    );
  }

  /**
   * Load an existing session by ID.
   */
  async loadSession(options: LoadSessionOptions): Promise<Session> {
    if (!this.connection) {
      throw new NotConnectedError();
    }

    const mcpServers = this.convertMCPServers(
      options.mcpServers ?? this.options.mcpServers ?? []
    );

    await this.connection.loadSession({
      sessionId: options.sessionId,
      cwd: options.cwd ?? this.options.cwd ?? process.cwd(),
      mcpServers,
    });

    return new Session(
      this.connection,
      options.sessionId,
      this.options,
      (handler) => {
        this.sessionUpdateHandler = handler;
      }
    );
  }

  /**
   * Disconnect and clean up resources.
   */
  async disconnect(): Promise<void> {
    if (this.process && !this.process.killed) {
      this.process.kill();
    }
    this.connection = null;
    this.process = null;
    this.provider = null;
    this.sessionUpdateHandler = null;
  }

  /**
   * Check if the client is connected.
   */
  get isConnected(): boolean {
    return this.connection !== null;
  }

  /**
   * Get the provider type being used.
   */
  get providerType(): ProviderType | null {
    return this.provider?.type ?? null;
  }

  /**
   * Convert SDK MCP config to protocol format
   */
  private convertMCPServers(configs: MCPServerConfig[]): McpServer[] {
    return configs.map((config) => ({
      name: config.name,
      command: config.command,
      args: config.args ?? [],
      env: Object.entries(config.env ?? {}).map(([name, value]) => ({
        name,
        value,
      })),
    }));
  }

  /**
   * Create the client handler for agent requests
   */
  private createClientHandler(): ACPClientInterface {
    return {
      requestPermission: async (
        params: RequestPermissionRequest
      ): Promise<RequestPermissionResponse> => {
        // Auto-approve if enabled
        if (this.options.autoApprove) {
          const allowOption = params.options.find(
            (opt) => opt.kind === "allow_once" || opt.kind === "allow_always"
          );
          return {
            outcome: {
              outcome: "selected",
              optionId: allowOption?.optionId ?? params.options[0].optionId,
            },
          };
        }

        // Use custom handler if provided
        if (this.options.onPermissionRequest) {
          const response = await this.options.onPermissionRequest(params);
          return {
            outcome: {
              outcome: "selected",
              optionId: response.optionId,
            },
          };
        }

        // Default: reject
        const rejectOption = params.options.find(
          (opt) => opt.kind === "reject_once" || opt.kind === "reject_always"
        );
        return {
          outcome: {
            outcome: "selected",
            optionId: rejectOption?.optionId ?? params.options[0].optionId,
          },
        };
      },

      sessionUpdate: async (params: SessionNotification): Promise<void> => {
        // Forward to session handler
        if (this.sessionUpdateHandler) {
          this.sessionUpdateHandler(params);
        }
      },

      readTextFile: async (
        params: ReadTextFileRequest
      ): Promise<ReadTextFileResponse> => {
        // Read file from filesystem
        const fs = await import("node:fs/promises");
        const content = await fs.readFile(params.path, "utf-8");

        // Handle line range if specified
        if (params.line !== undefined && params.line !== null) {
          const lines = content.split("\n");
          const start = params.line - 1; // 1-based to 0-based
          const end =
            params.limit !== undefined && params.limit !== null
              ? start + params.limit
              : lines.length;
          return { content: lines.slice(start, end).join("\n") };
        }

        return { content };
      },

      writeTextFile: async (
        params: WriteTextFileRequest
      ): Promise<WriteTextFileResponse> => {
        const fs = await import("node:fs/promises");
        await fs.writeFile(params.path, params.content, "utf-8");
        return {};
      },

      createTerminal: async (
        params: CreateTerminalRequest
      ): Promise<CreateTerminalResponse> => {
        // Basic terminal creation - spawn a process
        const { spawn } = await import("node:child_process");
        const terminalId = `terminal-${Date.now()}`;

        spawn(params.command, params.args ?? [], {
          cwd: params.cwd ?? undefined,
          env: {
            ...process.env,
            ...Object.fromEntries(
              (params.env ?? []).map((e) => [e.name, e.value])
            ),
          },
          shell: true,
        });

        return { terminalId };
      },
    };
  }
}
