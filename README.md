# coding-agent-sdk

**Unified SDK for Claude Code, Codex CLI, and Gemini CLI** - Programmatic access to AI coding agents with a consistent interface.

## Features

✅ **Unified API** - Single `query()` function works across all three backends
✅ **CLI Mode** - Run queries directly from command line with `npx coding-agent-sdk`
✅ **Auto-detection** - Automatically selects backend based on environment variables
✅ **Streaming Events** - Real-time event streaming with unified event schema
✅ **Session Management** - Resume previous sessions across all backends
✅ **TypeScript** - Full type definitions included
✅ **Zero Config** - Works out of the box with sensible defaults

## Installation

```bash
npm install coding-agent-sdk
```

### Backend Requirements

Each backend requires its CLI to be installed globally:

```bash
# For Claude Code
# Install from https://claude.com/code
# Verify: claude --version

# For Codex CLI
npm install -g @openai/codex
# Or: brew install --cask codex
# Verify: codex --version

# For Gemini CLI
# Install from https://github.com/google-gemini/gemini-cli
# Verify: gemini --version
```

**Important:** The SDK spawns CLI processes directly (`claude`, `codex`, `gemini`). Make sure the binaries are in your PATH.

## Quick Start

### Option A: CLI Mode (Easiest)

Run queries directly from the command line:

```bash
# Auto-detect backend and run a query
npx coding-agent-sdk -p "Fix the failing tests"

# Use a specific backend
npx coding-agent-sdk -p "Add type annotations" -b claude

# Show help
npx coding-agent-sdk --help
```

**CLI Options:**
- `-p, --prompt <text>` - Prompt to send to the agent (required)
- `-b, --backend <name>` - Backend to use: claude, codex, or gemini (auto-detected if not specified)
- `-w, --working-dir <dir>` - Working directory (default: current directory)
- `-r, --resume <id>` - Resume from a previous session ID
- `-h, --help` - Show help message
- `-v, --version` - Show version number

### Option B: Programmatic API

### 1. Set up API Keys

The SDK auto-detects which backend to use based on environment variables:

```bash
# Use Claude Code
export ANTHROPIC_API_KEY=your_anthropic_key

# Use Codex CLI
export CODEX_API_KEY=your_codex_key

# Use Gemini CLI
export GEMINI_API_KEY=your_gemini_key
```

### 2. Basic Usage

```typescript
import { query } from 'coding-agent-sdk';

// Auto-detects backend from environment variables
const result = await query("Fix the failing tests");

// Stream events
for await (const event of result.events) {
  if (event.type === 'message') {
    console.log(`[${event.role}]:`, event.content);
  }
}

console.log('Session ID:', result.sessionId);
console.log('Backend used:', result.backend);
```

### 3. Explicit Backend Selection

```typescript
import { query } from 'coding-agent-sdk';

const result = await query("Deploy the application", {
  backend: 'claude',
  workingDir: '/path/to/project',
});
```

### 4. Resume Previous Session

```typescript
import { query } from 'coding-agent-sdk';

// Initial query
const result1 = await query("Start implementing the feature");
const sessionId = result1.sessionId;

// Resume later
const result2 = await query("Continue from where we left off", {
  resume: sessionId,
});
```

## Unified Event Schema

The SDK provides **7 unified event types** that work across all backends:

### 1. SessionEvent - Session lifecycle

```typescript
{
  type: 'session',
  subtype: 'init' | 'end',
  session_id: string,
  backend: 'claude' | 'codex' | 'gemini',
  timestamp?: string,
  metadata?: { ... }
}
```

### 2. TurnEvent - Conversation turn boundaries

```typescript
{
  type: 'turn',
  subtype: 'started' | 'completed' | 'failed',
  usage?: {
    input_tokens?: number,
    output_tokens?: number,
    cached_tokens?: number,
    thinking_tokens?: number,
  },
  error?: string
}
```

### 3. MessageEvent - User/assistant text messages

```typescript
{
  type: 'message',
  role: 'user' | 'assistant',
  content: string,
  is_delta?: boolean,        // True for streaming chunks
  content_index?: number,    // For multi-block messages
  parent_id?: string         // For subagent messages
}
```

### 4. ActionEvent - Tool execution, commands, file changes

```typescript
{
  type: 'action',
  subtype: 'tool' | 'command' | 'file_change' | 'web_search' | 'reasoning' | 'mcp_tool',
  action_id?: string,
  status: 'started' | 'in_progress' | 'completed' | 'failed',

  // Tool-specific fields
  tool_name?: string,
  tool_input?: unknown,
  tool_output?: unknown,

  // Command-specific fields
  command?: string,
  command_output?: string,
  exit_code?: number,

  // File change-specific fields
  file_path?: string,
  change_type?: 'add' | 'update' | 'delete',

  // And more...
}
```

### 5. ProgressEvent - Long-running operations

```typescript
{
  type: 'progress',
  subtype: 'todo_update' | 'status_update' | 'elapsed_time',
  todo_items?: Array<{ title: string, status: string }>,
  status_message?: string,
  elapsed_ms?: number
}
```

### 6. ErrorEvent - Errors and warnings

```typescript
{
  type: 'error',
  severity: 'warning' | 'error' | 'fatal',
  message: string,
  related_action_id?: string
}
```

### 7. MetricsEvent - Usage statistics

```typescript
{
  type: 'metrics',
  subtype: 'usage_update' | 'session_summary',
  per_model?: Record<string, { ... }>,
  per_tool?: Record<string, { ... }>,
  files?: { ... }
}
```

## Advanced Usage

### Backend-Specific Options

Each backend supports custom configuration:

```typescript
import { query } from 'coding-agent-sdk';

const result = await query("Complex task", {
  backend: 'claude',
  backendOptions: {
    claude: {
      maxThinkingTokens: 10000,
      mcpServers: ['next-devtools-mcp'],
      permissionMode: 'prompt', // Override default YOLO mode
    },
  },
});
```

### Filtering Events

```typescript
import { query } from 'coding-agent-sdk';

const result = await query("Refactor the codebase");

for await (const event of result.events) {
  // Only show assistant messages
  if (event.type === 'message' && event.role === 'assistant') {
    console.log(event.content);
  }

  // Track tool usage
  if (event.type === 'action' && event.subtype === 'tool') {
    console.log(`Tool: ${event.tool_name} (${event.status})`);
  }

  // Monitor errors
  if (event.type === 'error') {
    console.error(`[${event.severity}]`, event.message);
  }
}
```

### Collecting All Events

```typescript
import { query } from 'coding-agent-sdk';

const result = await query("Analyze the project");

// Collect all events
const events: UnifiedEvent[] = [];
for await (const event of result.events) {
  events.push(event);
}

// Process collected events
const messages = events.filter(e => e.type === 'message');
const actions = events.filter(e => e.type === 'action');
console.log(`Total messages: ${messages.length}`);
console.log(`Total actions: ${actions.length}`);
```

## API Reference

### `query(prompt, options?)`

Main function to query AI coding agents.

**Parameters:**
- `prompt: string` - The prompt to send to the agent
- `options?: QueryOptions` - Optional configuration

**Returns:** `Promise<QueryResult>`

### `QueryOptions`

```typescript
interface QueryOptions {
  backend?: 'claude' | 'codex' | 'gemini';  // Auto-detected if not specified
  resume?: string;                           // Session ID to resume
  workingDir?: string;                       // Working directory (default: cwd)
  autoApprove?: boolean;                     // YOLO mode (default: true)
  backendOptions?: {
    claude?: ClaudeBackendOptions;
    codex?: CodexBackendOptions;
    gemini?: GeminiBackendOptions;
  };
}
```

### `QueryResult`

```typescript
interface QueryResult {
  sessionId: string;                              // Session ID for resumption
  events: AsyncGenerator<UnifiedEvent>;           // Event stream
  backend: 'claude' | 'codex' | 'gemini';        // Backend used
}
```

### `isBackendAvailable(backend)`

Check if a specific backend is available.

```typescript
import { isBackendAvailable } from 'coding-agent-sdk';

if (isBackendAvailable('claude')) {
  console.log('Claude is available!');
}
```

## Backend Comparison

| Feature | Claude Code | Codex CLI | Gemini CLI |
|---------|-------------|-----------|------------|
| **Installation** | https://claude.com/code | `npm i -g @openai/codex` | https://github.com/google-gemini/gemini-cli |
| **Binary** | `claude` | `codex` | `gemini` |
| **API Key Env** | `ANTHROPIC_API_KEY` | `CODEX_API_KEY` | `GEMINI_API_KEY` |
| **Output Format** | `--output-format stream-json` | `--experimental-json` | `--output-format stream-json` |
| **Session Resume** | ✅ `--resume` | ✅ `resume` arg | ✅ `--resume` |
| **MCP Support** | ✅ | ✅ | ✅ |
| **Extended Thinking** | ✅ | ✅ | ❌ |
| **Structured Output** | ❌ | ✅ | ❌ |
| **Web Search** | ✅ | ✅ | ❌ |
| **Todo Tracking** | ❌ | ✅ | ❌ |

## Error Handling

```typescript
import { query, BackendNotAvailableError, NoBackendFoundError } from 'coding-agent-sdk';

try {
  const result = await query("Deploy the app");

  for await (const event of result.events) {
    if (event.type === 'error') {
      console.error(`Error: ${event.message}`);
    }
  }
} catch (error) {
  if (error instanceof NoBackendFoundError) {
    console.error('No API key found. Set ANTHROPIC_API_KEY, CODEX_API_KEY, or GEMINI_API_KEY');
  } else if (error instanceof BackendNotAvailableError) {
    console.error(`Backend ${error.backend} is not available: ${error.message}`);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## Examples

### Simple Task

```typescript
import { query } from 'coding-agent-sdk';

const result = await query("Add type annotations to all functions");

for await (const event of result.events) {
  if (event.type === 'message' && event.role === 'assistant') {
    console.log(event.content);
  }
}
```

### Monitor Progress

```typescript
import { query } from 'coding-agent-sdk';

const result = await query("Refactor the authentication module");

for await (const event of result.events) {
  if (event.type === 'progress' && event.subtype === 'todo_update') {
    console.log('Todo List:');
    event.todo_items?.forEach(todo => {
      console.log(`  [${todo.status}] ${todo.title}`);
    });
  }
}
```

### Track Token Usage

```typescript
import { query } from 'coding-agent-sdk';

const result = await query("Optimize database queries");

for await (const event of result.events) {
  if (event.type === 'turn' && event.subtype === 'completed') {
    console.log('Token Usage:', event.usage);
  }
}
```

## Testing

The SDK includes a comprehensive test suite with >95% coverage.

### Running Tests

```bash
# Run all tests
npm test

# Watch mode for development
npm run test:watch

# Generate coverage report
npm run test:coverage
```

### Test Structure

- `src/**/*.test.ts` - Unit and integration tests
- Tests cover:
  - Event mappers for all backends
  - Backend auto-detection
  - Error handling
  - Type definitions
  - Query function behavior

### Coverage

Current test coverage: **95%+**

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

Before submitting a PR:
1. Run `npm test` to ensure all tests pass
2. Run `npm run test:coverage` to verify coverage remains high
3. Run `npm run build` to ensure the build succeeds

## License

MIT

## Related Projects

- [Claude Code](https://claude.com/code) - Official Claude CLI
- [Codex CLI](https://github.com/openai/codex) - OpenAI's Codex CLI
- [Gemini CLI](https://github.com/google-gemini/gemini-cli) - Google's Gemini CLI
