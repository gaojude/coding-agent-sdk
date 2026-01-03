/**
 * Session - Represents a conversation session with an agent
 */

import type {
  ClientSideConnection,
  SessionId,
  SessionUpdate,
  SessionNotification,
  ContentBlock,
  StopReason,
} from "@agentclientprotocol/sdk";

import type { ClientOptions } from "../types.js";
import { ConnectionClosedError } from "../errors.js";

/**
 * Represents a conversation session with a coding agent
 *
 * Sessions maintain conversation state and allow sending prompts
 * and receiving streaming updates.
 *
 * @example
 * ```typescript
 * const session = await client.newSession();
 *
 * // Stream updates
 * for await (const update of session.prompt('Fix the bug')) {
 *   if (update.sessionUpdate === 'agent_message_chunk') {
 *     process.stdout.write(update.content.text);
 *   }
 * }
 *
 * // Or collect all updates
 * const { updates, stopReason } = await session.promptAndCollect('Fix the bug');
 * ```
 */
export class Session {
  private pendingUpdates: SessionUpdate[] = [];
  private updateResolver: ((update: SessionUpdate | null) => void) | null =
    null;
  private promptComplete = false;
  private lastStopReason: StopReason = "end_turn";
  private connectionClosed = false;

  constructor(
    private connection: ClientSideConnection,
    public readonly sessionId: SessionId,
    private options: ClientOptions,
    private registerUpdateHandler: (
      handler: (notification: SessionNotification) => void
    ) => void
  ) {
    // Register to receive session updates
    this.registerUpdateHandler((notification) => {
      if (notification.sessionId === this.sessionId) {
        this.handleUpdate(notification.update);
      }
    });

    // Listen for connection closure to unblock pending operations
    this.connection.signal.addEventListener("abort", () => {
      this.connectionClosed = true;
      this.promptComplete = true;
      // Unblock any waiting promises
      if (this.updateResolver) {
        this.updateResolver(null);
        this.updateResolver = null;
      }
    });
  }

  /**
   * Send a prompt and stream updates.
   * Returns an async generator of SessionUpdate events.
   */
  async *prompt(
    content: ContentBlock[] | string
  ): AsyncGenerator<SessionUpdate, StopReason, void> {
    if (this.connectionClosed) {
      throw new ConnectionClosedError();
    }

    const blocks: ContentBlock[] =
      typeof content === "string"
        ? [{ type: "text", text: content }]
        : content;

    this.promptComplete = false;
    this.pendingUpdates = [];

    // Start the prompt (don't await - it completes when the turn ends)
    const promptPromise = this.connection
      .prompt({
        sessionId: this.sessionId,
        prompt: blocks,
      })
      .then((response) => {
        this.lastStopReason = response.stopReason;
        this.promptComplete = true;
        // Signal completion
        if (this.updateResolver) {
          this.updateResolver(null);
          this.updateResolver = null;
        }
      })
      .catch((error) => {
        // Connection closed or other error - mark as complete
        this.promptComplete = true;
        if (this.updateResolver) {
          this.updateResolver(null);
          this.updateResolver = null;
        }
        // Only throw if not a connection closure
        if (!this.connectionClosed) {
          throw error;
        }
      });

    // Yield updates as they arrive
    while (true) {
      const update = await this.waitForUpdate();

      if (update === null || this.promptComplete) {
        // Drain any remaining updates
        while (this.pendingUpdates.length > 0) {
          yield this.pendingUpdates.shift()!;
        }
        break;
      }

      yield update;
    }

    // Wait for prompt to fully complete (with connection closure handling)
    if (!this.connectionClosed) {
      try {
        await promptPromise;
      } catch {
        // Ignore errors if connection was closed
        if (!this.connectionClosed) {
          throw new ConnectionClosedError();
        }
      }
    }

    return this.lastStopReason;
  }

  /**
   * Send a prompt and collect all updates into an array.
   * Convenience method for non-streaming use cases.
   */
  async promptAndCollect(content: ContentBlock[] | string): Promise<{
    updates: SessionUpdate[];
    stopReason: StopReason;
  }> {
    const updates: SessionUpdate[] = [];
    let stopReason: StopReason = "end_turn";

    const generator = this.prompt(content);

    while (true) {
      const result = await generator.next();
      if (result.done) {
        stopReason = result.value;
        break;
      }
      updates.push(result.value);
    }

    return { updates, stopReason };
  }

  /**
   * Cancel the current prompt operation.
   */
  async cancel(): Promise<void> {
    if (this.connectionClosed) {
      return;
    }
    await this.connection.cancel({ sessionId: this.sessionId });
  }

  /**
   * Set the session mode (e.g., 'ask', 'architect', 'code').
   */
  async setMode(modeId: string): Promise<void> {
    if (this.connectionClosed) {
      throw new ConnectionClosedError();
    }
    await this.connection.setSessionMode({
      sessionId: this.sessionId,
      modeId,
    });
  }

  /**
   * Get the stop reason from the last prompt.
   */
  get stopReason(): StopReason {
    return this.lastStopReason;
  }

  /**
   * Check if the connection is closed.
   */
  get isClosed(): boolean {
    return this.connectionClosed;
  }

  /**
   * Handle an incoming session update
   */
  private handleUpdate(update: SessionUpdate): void {
    if (this.updateResolver) {
      this.updateResolver(update);
      this.updateResolver = null;
    } else {
      this.pendingUpdates.push(update);
    }
  }

  /**
   * Wait for the next update
   */
  private waitForUpdate(): Promise<SessionUpdate | null> {
    // Check if connection is closed
    if (this.connectionClosed) {
      return Promise.resolve(null);
    }

    // Check for pending updates first
    if (this.pendingUpdates.length > 0) {
      return Promise.resolve(this.pendingUpdates.shift()!);
    }

    // Check if prompt is already complete
    if (this.promptComplete) {
      return Promise.resolve(null);
    }

    // Wait for next update
    return new Promise((resolve) => {
      this.updateResolver = resolve;
    });
  }
}

/**
 * Helper to extract only text content from updates
 */
export async function* textOnly(
  updates: AsyncIterable<SessionUpdate>
): AsyncGenerator<string, void, void> {
  for await (const update of updates) {
    if (
      update.sessionUpdate === "agent_message_chunk" &&
      update.content.type === "text"
    ) {
      yield update.content.text;
    }
  }
}

/**
 * Collect all text content from updates into a single string
 */
export async function collectText(
  updates: AsyncIterable<SessionUpdate>
): Promise<string> {
  let text = "";
  for await (const chunk of textOnly(updates)) {
    text += chunk;
  }
  return text;
}

/**
 * Filter updates to only tool calls
 */
export async function* toolCallsOnly(
  updates: AsyncIterable<SessionUpdate>
): AsyncGenerator<SessionUpdate, void, void> {
  for await (const update of updates) {
    if (
      update.sessionUpdate === "tool_call" ||
      update.sessionUpdate === "tool_call_update"
    ) {
      yield update;
    }
  }
}
