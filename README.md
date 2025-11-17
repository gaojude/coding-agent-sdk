



# coding-agent-sdk

Build agentic workflows that delegate to your users' existing coding agents—Claude Code, Codex, or Gemini.

```typescript
import { query } from 'coding-agent-sdk';

// One API. Works with whatever agent your user has.
await query("Refactor the auth module");
```

## Overview

This SDK enables you to build agentic workflows (code reviewers, migration tools, testing assistants) that leverage coding agents your users already have installed. Instead of embedding your own agent, delegate tasks to the user's existing setup—whether that's Claude Code, Codex, or Gemini.

```typescript
// Your workflow
async function migrateToTypeScript() {
  await query("Find all .js files in src/");
  await query("Convert them to TypeScript");
  await query("Fix any type errors");
  await query("Run the test suite");
}
```

The SDK handles:
- Auto-detection of available agents (Claude, Codex, or Gemini)
- Translation of requests into the appropriate format
- Unified event streaming across different agents
- Single API that works with all supported agents

## Benefits

**For workflow builders:**
- Users already have the agent installed
- No API costs—runs on the user's credentials
- No vendor lock-in—supports multiple agents
- Focus on workflow logic instead of agent implementation

**For users:**
- Leverage agents they already use
- Works with Claude, Codex, or Gemini
- Maintains their existing setup and preferences
- No additional subscriptions or API keys

## How It Works

Install the SDK:

```bash
npm install coding-agent-sdk
```

**⚠️ Important: Auto-Approval Mode**

By default, the SDK runs in "YOLO mode" (auto-approve enabled), which means coding agents will automatically execute actions without asking for your permission. This is designed for workflow automation but means tools will run, files will be modified, and commands will be executed automatically.

If you need to control approvals, you can configure the approval policy through the underlying CLI tools.

Build your workflow:

```typescript
import { query } from 'coding-agent-sdk';

// Your workflow delegates to the user's agent
const result = await query("Deploy the application");

// Stream events as they happen
for await (const event of result.events) {
  if (event.type === 'message') {
    console.log(event.content);
  }
}
```

Your user runs it with their existing agent:

```bash
# They already have Claude Code, Codex, or Gemini installed
# They already have an API key
# Your workflow just works
```

The SDK:
1. Auto-detects which agent they have
2. Spawns the right CLI process
3. Parses the output into unified events
4. Returns a clean stream you can work with

## The API

One function. That's it.

```typescript
query(prompt: string, options?: QueryOptions): Promise<QueryResult>
```

**Parameters:**
- `prompt` - What you want the agent to do
- `options` - Optional backend, session resume, working directory

**Returns:**
- `sessionId` - Resume the conversation later
- `events` - Async generator of unified events
- `backend` - Which agent was used

**Example:**

```typescript
import { query } from 'coding-agent-sdk';

const result = await query("Add error handling to the API routes");

for await (const event of result.events) {
  switch (event.type) {
    case 'message':   // AI responses
    case 'action':    // File changes, tool calls
    case 'progress':  // Todo lists, status updates
    case 'turn':      // Conversation boundaries
    case 'session':   // Session lifecycle
    case 'error':     // Warnings and errors
    case 'metrics':   // Usage statistics
  }
}
```

## Real-World Example

Here's a code review workflow that works with any agent:

```typescript
import { query } from 'coding-agent-sdk';

async function reviewPullRequest(prNumber: number) {
  // Step 1: Get the diff
  const diffResult = await query(`Get the git diff for PR #${prNumber}`);

  // Step 2: Review the changes
  const reviewResult = await query(
    `Review this code for:
    - Security vulnerabilities
    - Performance issues
    - Best practices
    - Test coverage`
  );

  // Step 3: Suggest improvements
  await query("Suggest specific improvements with code examples");
}
```

Your users run this with Claude, Codex, or Gemini. Same workflow. Zero changes.

## Use Cases

This SDK is designed for building reusable workflows that delegate to existing agents:

- Code migration tools (e.g., "Convert this repo from JS to TS")
- Automated reviewers (e.g., "Review this PR for security issues")
- Testing assistants (e.g., "Generate e2e tests for this feature")
- Deployment orchestrators (e.g., "Deploy to staging and run smoke tests")

The SDK provides a unified interface across different agents, letting you focus on workflow orchestration rather than agent-specific implementation details.

## Supported Agents

| Agent | CLI | API Key |
|-------|-----|---------|
| Claude Code | `claude` | `ANTHROPIC_API_KEY` |
| OpenAI Codex | `codex` | `OPENAI_API_KEY` |
| Google Gemini | `gemini` | `GEMINI_API_KEY` |

The SDK auto-detects which one is available. Your workflow just works.

## Installation

```bash
npm install coding-agent-sdk
```

Your users need:
1. One of the supported CLIs installed (Claude Code, Codex, or Gemini)
2. The corresponding API key in their environment

That's it. No SDK API keys. No additional setup.

## Advanced Usage

### Resume Sessions

```typescript
const result1 = await query("Start the refactor");
const sessionId = result1.sessionId;

// Later...
const result2 = await query("Continue", { resume: sessionId });
```

### Specify Backend

```typescript
await query("Deploy", {
  backend: 'claude',
  workingDir: '/path/to/project'
});
```

### Stream Progress

```typescript
const result = await query("Migrate to TypeScript");

for await (const event of result.events) {
  if (event.type === 'progress' && event.todo_items) {
    console.log(`Progress: ${event.todo_items.filter(t => t.status === 'completed').length}/${event.todo_items.length} tasks done`);
  }
}
```

### Monitor Actions

```typescript
const result = await query("Deploy to production");

for await (const event of result.events) {
  if (event.type === 'action' && event.subtype === 'tool') {
    console.log(`Action: ${event.tool_name} - ${event.status}`);
  }
}
```

## See It In Action

Want to see the magic? Run this:

```bash
npx coding-agent-sdk -p "List all TypeScript files"
```

The SDK will:
1. Auto-detect which agent you have installed (Claude, Codex, or Gemini)
2. Delegate the task to that agent
3. Stream back the results

No configuration. No setup. It just works.

The real value is the `query()` API for building workflows, but this shows you how it automatically detects and delegates to whatever agent your users have.

## Contributing

We're building the interface layer between workflows and agents. PRs welcome.

```bash
npm test              # Run tests
npm run build         # Build
```

## License

MIT

---

[GitHub](https://github.com/gaojude/coding-agent-sdk) • [NPM](https://www.npmjs.com/package/coding-agent-sdk)
