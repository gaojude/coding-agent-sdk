/**
 * Basic example of using coding-agent-sdk
 *
 * Demonstrates:
 * - Creating a client and session
 * - Sending multiple messages in a conversation
 * - Streaming responses and handling different update types
 *
 * Usage:
 *   npx tsx examples/basic.ts
 */

import { createClient } from "../src/index.js";

async function main() {
  console.log("Creating client...");

  // Auto-detects provider from environment (claude > codex > gemini)
  const client = createClient({
    autoApprove: true, // Enable auto-approval for automated workflows
  });

  try {
    console.log("Connecting...");
    await client.connect();
    console.log("Connected!\n");

    console.log("Creating session...");
    const session = await client.newSession();
    console.log(`Session ID: ${session.sessionId}\n`);

    // First message
    console.log("=== Message 1 ===");
    console.log('Prompt: "What files are in the current directory?"\n');

    for await (const update of session.prompt(
      "What files are in the current directory?"
    )) {
      if (
        update.sessionUpdate === "agent_message_chunk" &&
        update.content.type === "text"
      ) {
        process.stdout.write(update.content.text);
      } else if (update.sessionUpdate === "tool_call") {
        console.log(`\n[Tool: ${update.title}]`);
      }
    }
    console.log("\n");

    // Second message - follows up on the first
    console.log("=== Message 2 ===");
    console.log('Prompt: "Which of those is the main entry point?"\n');

    for await (const update of session.prompt(
      "Which of those is the main entry point?"
    )) {
      if (
        update.sessionUpdate === "agent_message_chunk" &&
        update.content.type === "text"
      ) {
        process.stdout.write(update.content.text);
      } else if (update.sessionUpdate === "tool_call") {
        console.log(`\n[Tool: ${update.title}]`);
      }
    }
    console.log("\n");

    // Third message - demonstrates conversation memory
    console.log("=== Message 3 ===");
    console.log('Prompt: "Summarize what we discussed"\n');

    for await (const update of session.prompt("Summarize what we discussed")) {
      if (
        update.sessionUpdate === "agent_message_chunk" &&
        update.content.type === "text"
      ) {
        process.stdout.write(update.content.text);
      }
    }
    console.log("\n");

    console.log("--- Session Complete ---");
    console.log(`Final stop reason: ${session.stopReason}`);
  } catch (error: unknown) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    console.log("\nDisconnecting...");
    await client.disconnect();
    console.log("Done!");
  }
}

main();
