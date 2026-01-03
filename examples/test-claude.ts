/**
 * Test example for Claude Code provider
 *
 * Usage:
 *   npx tsx examples/test-claude.ts
 */

import { createClient } from "../src/index.js";

async function main() {
  console.log("Creating client...");

  const client = createClient({
    provider: "claude", // Explicitly use Claude
    autoApprove: true,
    cwd: process.cwd(),
  });

  try {
    console.log("Connecting to Claude Code...");
    await client.connect();
    console.log("Connected!");

    console.log("Creating new session...");
    const session = await client.newSession();
    console.log(`Session ID: ${session.sessionId}\n`);

    console.log('Sending prompt: "What is 2 + 2? Reply with just the number."\n');
    console.log("--- Response ---");

    for await (const update of session.prompt(
      "What is 2 + 2? Reply with just the number."
    )) {
      if (update.sessionUpdate === "agent_message_chunk") {
        if (update.content.type === "text") {
          process.stdout.write(update.content.text);
        }
      } else if (update.sessionUpdate === "tool_call") {
        console.log(`\n[Tool: ${update.title}]`);
      }
    }

    console.log("\n--- End Response ---");
    console.log(`Stop reason: ${session.stopReason}`);
  } catch (error) {
    console.error("Error:", error);
  } finally {
    console.log("\nDisconnecting...");
    await client.disconnect();
    console.log("Done!");
  }
}

main();
