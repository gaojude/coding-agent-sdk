#!/usr/bin/env node

/**
 * CLI for coding-agent-sdk
 * Allows users to run queries directly from the command line
 */

import { parseArgs } from "node:util";
import { query, detectBackend } from "./index.js";

interface CliOptions {
  prompt?: string;
  backend?: "claude" | "codex" | "gemini";
  workingDir?: string;
  resume?: string;
  help?: boolean;
  version?: boolean;
}

const HELP_TEXT = `
coding-agent-sdk - Unified CLI for AI coding agents

Usage:
  npx coding-agent-sdk [options]

Options:
  -p, --prompt <text>      Prompt to send to the agent (required)
  -b, --backend <name>     Backend to use: claude, codex, or gemini (auto-detected if not specified)
  -w, --working-dir <dir>  Working directory (default: current directory)
  -r, --resume <id>        Resume from a previous session ID
  -h, --help               Show this help message
  -v, --version            Show version number

Examples:
  # Auto-detect backend and run a query
  npx coding-agent-sdk -p "Fix the failing tests"

  # Use a specific backend
  npx coding-agent-sdk -p "Add type annotations" -b claude

  # Resume a previous session
  npx coding-agent-sdk -p "Continue where we left off" -r abc123

  # Specify working directory
  npx coding-agent-sdk -p "Analyze the codebase" -w /path/to/project

Environment Variables:
  ANTHROPIC_API_KEY    API key for Claude Code
  CODEX_API_KEY        API key for Codex CLI
  GEMINI_API_KEY       API key for Gemini CLI

Documentation: https://github.com/yourusername/coding-agent-sdk
`;

async function main(): Promise<void> {
  try {
    const { values } = parseArgs({
      options: {
        prompt: {
          type: "string",
          short: "p",
        },
        backend: {
          type: "string",
          short: "b",
        },
        "working-dir": {
          type: "string",
          short: "w",
        },
        resume: {
          type: "string",
          short: "r",
        },
        help: {
          type: "boolean",
          short: "h",
        },
        version: {
          type: "boolean",
          short: "v",
        },
      },
      strict: true,
      allowPositionals: false,
    });

    const options = values as CliOptions;

    // Handle --version
    if (options.version) {
      // Hardcoded version - will be updated during build
      console.log("0.2.0");
      process.exit(0);
    }

    // Handle --help
    if (options.help) {
      console.log(HELP_TEXT);
      process.exit(0);
    }

    // Validate required options
    if (!options.prompt) {
      console.error("Error: --prompt is required\n");
      console.log(HELP_TEXT);
      process.exit(1);
    }

    // Validate backend if specified
    if (
      options.backend &&
      !["claude", "codex", "gemini"].includes(options.backend)
    ) {
      console.error(
        `Error: Invalid backend "${options.backend}". Must be one of: claude, codex, gemini\n`
      );
      process.exit(1);
    }

    // Detect and display backend
    let backendToUse: "claude" | "codex" | "gemini";
    if (options.backend) {
      backendToUse = options.backend;
      console.log(`✅ Using backend: ${backendToUse}\n`);
    } else {
      console.log("🔍 Detecting available backend...");
      const detection = await detectBackend();
      backendToUse = detection.backend;
      console.log(`✅ Using backend: ${backendToUse}\n`);
    }

    // Run the query
    console.log(`📝 Prompt: ${options.prompt}\n`);
    console.log("🤖 Agent response:\n");

    const result = await query(options.prompt, {
      backend: backendToUse,
      workingDir: options.workingDir,
      resume: options.resume,
    });

    // Stream and display events
    for await (const event of result.events) {
      // Display assistant messages
      if (event.type === "message" && event.role === "assistant") {
        if (event.is_delta) {
          // Streaming chunks - print without newline
          process.stdout.write(event.content);
        } else {
          // Complete message
          console.log(event.content);
        }
      }

      // Display errors
      if (event.type === "error") {
        console.error(`\n❌ [${event.severity}] ${event.message}`);
      }

      // Display session end
      if (event.type === "session" && event.subtype === "end") {
        console.log(`\n\n✅ Session completed`);
        console.log(`📋 Session ID: ${event.session_id}`);
        if (event.metadata) {
          console.log(`📊 Metadata:`, JSON.stringify(event.metadata, null, 2));
        }
      }

      // Display token usage on turn completion
      if (event.type === "turn" && event.subtype === "completed" && event.usage) {
        console.log(`\n📊 Token Usage:`);
        if (event.usage.input_tokens) {
          console.log(`   Input: ${event.usage.input_tokens}`);
        }
        if (event.usage.output_tokens) {
          console.log(`   Output: ${event.usage.output_tokens}`);
        }
        if (event.usage.cached_tokens) {
          console.log(`   Cached: ${event.usage.cached_tokens}`);
        }
      }
    }

    console.log(`\n\n🎉 Done!`);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`\n❌ Error: ${error.message}`);

      // Provide helpful hints for common errors
      if (error.message.includes("API key")) {
        console.error("\n💡 Tip: Make sure you've set the appropriate API key:");
        console.error("   - ANTHROPIC_API_KEY for Claude");
        console.error("   - CODEX_API_KEY for Codex");
        console.error("   - GEMINI_API_KEY for Gemini");
      } else if (error.message.includes("No agent binaries found")) {
        console.error("\n💡 Tip: Install at least one agent CLI:");
        console.error("   - Claude: https://claude.com/code");
        console.error("   - Codex: npm install -g @openai/codex");
        console.error("   - Gemini: https://github.com/google-gemini/gemini-cli");
      }
    } else {
      console.error(`\n❌ Unknown error:`, error);
    }
    process.exit(1);
  }
}

main();
