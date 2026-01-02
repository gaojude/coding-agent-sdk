# coding-agent-sdk

Build agentic workflows that work with Claude Code, Codex CLI, Gemini CLI, and other coding agents.

```typescript
import { createClient, streamText } from 'coding-agent-sdk';

// One API. Works with whatever agent your user has.
for await (const text of streamText("Refactor the auth module")) {
  process.stdout.write(text);
}
```

## Overview

This SDK enables you to build agentic workflows (code reviewers, migration tools, testing assistants) that leverage coding agents your users already have installed. Instead of embedding your own agent, delegate tasks to the user's existing setup.

```typescript
const client = createClient({ provider: 'claude' });
await client.connect();

const session = await client.newSession();

for await (const update of session.prompt("Fix the bug in auth.ts")) {
  if (update.sessionUpdate === 'agent_message_chunk') {
    process.stdout.write(update.content.text);
  }
}

await client.disconnect();
```

## Benefits

**For workflow builders:**
- Users already have the agent installed
- No API costs—runs on the user's credentials
- No vendor lock-in—supports multiple agents
- Focus on workflow logic instead of agent implementation

**For users:**
- Leverage agents they already use
- Works with Claude Code, Codex CLI, or Gemini CLI
- Maintains their existing setup and preferences
- No additional subscriptions or API keys

## Installation

```bash
npm install coding-agent-sdk
```

Your users need:
1. One of the supported agents installed (Claude Code, Codex CLI, or Gemini CLI)
2. The corresponding API key in their environment

## Quick Start

### One-liner for simple tasks

```typescript
import { streamText } from 'coding-agent-sdk';

for await (const text of streamText("Explain this codebase")) {
  process.stdout.write(text);
}
```

### Full control with Client and Session

```typescript
import { createClient } from 'coding-agent-sdk';

const client = createClient({
  provider: 'claude',  // or 'codex', 'gemini', or omit for auto-detect
  autoApprove: true,   // auto-approve tool calls
});

await client.connect();

const session = await client.newSession();

// Stream updates as they happen
for await (const update of session.prompt("Add tests for the User model")) {
  switch (update.sessionUpdate) {
    case 'agent_message_chunk':
      process.stdout.write(update.content.text);
      break;
    case 'tool_call':
      console.log(`\nTool: ${update.title}`);
      break;
    case 'plan':
      console.log('Plan:', update.entries.map(e => e.content));
      break;
  }
}

await client.disconnect();
```

### Collect all updates (non-streaming)

```typescript
import { prompt } from 'coding-agent-sdk';

const { updates, stopReason } = await prompt("List all TODO comments");

for (const update of updates) {
  // Process updates after completion
}
```

## API Reference

### Convenience Functions

```typescript
// Stream text only
streamText(prompt: string, options?: ClientOptions): AsyncGenerator<string>

// Stream all updates
streamPrompt(prompt: string, options?: ClientOptions): AsyncGenerator<SessionUpdate>

// Collect all updates
prompt(prompt: string, options?: ClientOptions): Promise<{ updates, stopReason }>

// Create a client
createClient(options?: ClientOptions): CodingAgentClient
```

### CodingAgentClient

```typescript
const client = createClient(options);

await client.connect();           // Connect to the agent
await client.newSession();        // Create a new conversation
await client.loadSession(opts);   // Resume an existing session
await client.disconnect();        // Clean up

client.isConnected;               // Check connection status
client.providerType;              // 'claude' | 'codex' | 'gemini'
```

### Session

```typescript
const session = await client.newSession();

// Stream updates
for await (const update of session.prompt("Fix the bug")) {
  // handle update
}

// Or collect all
const { updates, stopReason } = await session.promptAndCollect("Fix the bug");

// Control
await session.cancel();           // Cancel current operation
await session.setMode('code');    // Set session mode

session.sessionId;                // Get session ID for resuming
session.stopReason;               // Get last stop reason
```

### ClientOptions

```typescript
interface ClientOptions {
  provider?: 'claude' | 'codex' | 'gemini';  // Auto-detects if omitted
  cwd?: string;                               // Working directory
  autoApprove?: boolean;                      // Auto-approve tool calls
  mcpServers?: MCPServerConfig[];             // MCP servers to connect
  onPermissionRequest?: PermissionHandler;    // Custom permission handling
}
```

### SessionUpdate Types

Updates have a `sessionUpdate` field indicating the type:

| Type | Description |
|------|-------------|
| `agent_message_chunk` | Text from the agent |
| `tool_call` | Tool invocation started |
| `tool_call_update` | Tool execution progress |
| `plan` | Agent's execution plan |

## Real-World Example

```typescript
import { createClient, collectText } from 'coding-agent-sdk';

async function reviewPullRequest(prNumber: number) {
  const client = createClient({ autoApprove: true });
  await client.connect();

  try {
    const session = await client.newSession();

    // Get the diff
    await session.promptAndCollect(`Get the git diff for PR #${prNumber}`);

    // Review the changes
    for await (const update of session.prompt(`
      Review this code for:
      - Security vulnerabilities
      - Performance issues
      - Best practices
    `)) {
      if (update.sessionUpdate === 'agent_message_chunk') {
        process.stdout.write(update.content.text);
      }
    }
  } finally {
    await client.disconnect();
  }
}
```

## Supported Agents

| Agent | Provider | Requires |
|-------|----------|----------|
| Claude Code | `claude` | `ANTHROPIC_API_KEY` |
| Codex CLI | `codex` | `OPENAI_API_KEY` |
| Gemini CLI | `gemini` | `GEMINI_API_KEY` |

The SDK auto-detects which agent is available if you don't specify a provider.

## Auto-Approval Mode

By default, `autoApprove` is `false`. When enabled, the SDK automatically approves tool calls without user interaction—useful for automation but means files will be modified and commands executed automatically.

```typescript
// Enable auto-approval for automation
const client = createClient({ autoApprove: true });

// Or handle permissions manually
const client = createClient({
  onPermissionRequest: async (request) => {
    console.log(`Permission requested: ${request.title}`);
    return { optionId: 'allow_once' };
  }
});
```

## Contributing

```bash
npm test              # Run tests
npm run build         # Build
```

## License

MIT

---

[GitHub](https://github.com/gaojude/coding-agent-sdk) • [NPM](https://www.npmjs.com/package/coding-agent-sdk)
