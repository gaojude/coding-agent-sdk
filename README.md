# coding-agent-sdk

> **One API. Three AI coding agents. Zero config.**

Control Claude Code, Codex CLI, and Gemini CLI from a single, unified interface. Ship AI-powered workflows in minutes.

```bash
npx coding-agent-sdk -p "Fix the failing tests"
```

## Why?

You want to build with AI coding agents. But each one has a different API, different output formats, and different quirks. This SDK gives you:

- 🎯 **One interface** for Claude, Codex, and Gemini
- 🚀 **Auto-detection** - Just set your API key and go
- 📡 **Streaming events** - Real-time progress, not just final output
- 🔄 **Session resume** - Pick up where you left off
- 🎨 **Clean CLI** - Or use the programmatic API

## Quick Start

### CLI Mode

```bash
# Auto-detect backend from your API keys
npx coding-agent-sdk -p "Refactor the auth module"

# Specify a backend
npx coding-agent-sdk -p "Add tests" -b claude

# Resume a session
npx coding-agent-sdk -p "Continue" -r session_id
```

### Programmatic API

```typescript
import { query } from 'coding-agent-sdk';

// One line. That's it.
const result = await query("Deploy the application");

// Stream events as they happen
for await (const event of result.events) {
  if (event.type === 'message') {
    console.log(event.content);
  }
}
```

## Installation

```bash
npm install coding-agent-sdk
```

**Set your API key:**

```bash
# Pick one (or all three)
export ANTHROPIC_API_KEY=your_key    # For Claude
export OPENAI_API_KEY=your_key       # For Codex
export GEMINI_API_KEY=your_key       # For Gemini
```

**Install the backend CLI:**

```bash
# Claude Code: https://claude.com/code
# Codex CLI: npm install -g @openai/codex
# Gemini CLI: https://github.com/google-gemini/gemini-cli
```

## Features

| Feature | You Get |
|---------|---------|
| **Unified API** | One `query()` function for all backends |
| **Auto-detection** | SDK picks the right backend automatically |
| **Streaming** | Real-time events, not batch responses |
| **Session resume** | Continue conversations across runs |
| **TypeScript** | Full type safety out of the box |
| **Zero config** | Sensible defaults, easy overrides |

## Event Types

Get **7 unified event types** across all backends:

```typescript
for await (const event of result.events) {
  switch (event.type) {
    case 'message':    // AI responses and user messages
    case 'action':     // Tool calls, file changes, commands
    case 'progress':   // Todo lists, status updates
    case 'turn':       // Conversation boundaries, token usage
    case 'session':    // Session start/end
    case 'error':      // Warnings and errors
    case 'metrics':    // Usage statistics
  }
}
```

## Examples

### Get just the AI response

```typescript
import { query } from 'coding-agent-sdk';

const result = await query("Add error handling");

for await (const event of result.events) {
  if (event.type === 'message' && event.role === 'assistant') {
    console.log(event.content);
  }
}
```

### Track progress in real-time

```typescript
const result = await query("Migrate to TypeScript");

for await (const event of result.events) {
  if (event.type === 'progress' && event.todo_items) {
    event.todo_items.forEach(todo => {
      console.log(`[${todo.status}] ${todo.title}`);
    });
  }
}
```

### Monitor tool usage

```typescript
const result = await query("Deploy to production");

for await (const event of result.events) {
  if (event.type === 'action' && event.subtype === 'tool') {
    console.log(`${event.tool_name}: ${event.status}`);
  }
}
```

### Resume a conversation

```typescript
// First run
const result1 = await query("Start the refactor");
const sessionId = result1.sessionId;

// Later...
const result2 = await query("Continue", { resume: sessionId });
```

### Use a specific backend

```typescript
const result = await query("Complex task", {
  backend: 'claude',
  workingDir: '/path/to/project',
  backendOptions: {
    claude: {
      maxThinkingTokens: 10000,
      mcpServers: ['next-devtools-mcp'],
    },
  },
});
```

## CLI Options

```bash
npx coding-agent-sdk [options]

Options:
  -p, --prompt <text>      Your prompt (required)
  -b, --backend <name>     claude | codex | gemini (auto-detected)
  -w, --working-dir <dir>  Project directory (default: .)
  -r, --resume <id>        Resume session by ID
  -h, --help               Show help
  -v, --version            Show version
```

## API Reference

### `query(prompt, options?)`

Main function to query AI agents.

```typescript
interface QueryOptions {
  backend?: 'claude' | 'codex' | 'gemini';  // Auto-detected
  resume?: string;                           // Session ID
  workingDir?: string;                       // Project path
  autoApprove?: boolean;                     // Auto-approve actions (default: true)
  backendOptions?: {
    claude?: { maxThinkingTokens?: number; mcpServers?: string[] };
    codex?: { structuredOutput?: boolean; outputSchemaFile?: string };
    gemini?: { cliArgs?: string[] };
  };
}

interface QueryResult {
  sessionId: string;                              // For resuming
  events: AsyncGenerator<UnifiedEvent>;           // Event stream
  backend: 'claude' | 'codex' | 'gemini';        // Backend used
}
```

### `isBackendAvailable(backend)`

Check if a backend is available:

```typescript
import { isBackendAvailable } from 'coding-agent-sdk';

if (await isBackendAvailable('claude')) {
  console.log('Claude is ready!');
}
```

## Error Handling

```typescript
import { query, NoBackendFoundError } from 'coding-agent-sdk';

try {
  const result = await query("Deploy");
  for await (const event of result.events) {
    if (event.type === 'error') {
      console.error(event.message);
    }
  }
} catch (error) {
  if (error instanceof NoBackendFoundError) {
    console.error('No API key found. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or GEMINI_API_KEY');
  }
}
```

## Backend Comparison

|  | Claude | Codex | Gemini |
|--|--------|-------|--------|
| **Binary** | `claude` | `codex` | `gemini` |
| **API Key** | `ANTHROPIC_API_KEY` | `OPENAI_API_KEY` | `GEMINI_API_KEY` |
| **Session Resume** | ✅ | ✅ | ✅ |
| **Extended Thinking** | ✅ | ✅ | ❌ |
| **Web Search** | ✅ | ✅ | ❌ |
| **Todo Tracking** | ❌ | ✅ | ❌ |

## Contributing

PRs welcome! Make sure tests pass:

```bash
npm test              # Run tests
npm run test:coverage # Check coverage (95%+)
npm run build         # Build
```

## License

MIT

---

**Built with ❤️ by the community**

[GitHub](https://github.com/yourusername/coding-agent-sdk) • [Issues](https://github.com/yourusername/coding-agent-sdk/issues) • [NPM](https://www.npmjs.com/package/coding-agent-sdk)
