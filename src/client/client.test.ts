import { describe, it, expect } from "vitest";
import { createClient } from "../index.js";

describe("CodingAgentClient", () => {
  it("should handle multi-turn conversation and disconnect cleanly", async () => {
    const client = createClient({
      provider: "claude",
      autoApprove: true,
    });

    await client.connect();
    expect(client.isConnected).toBe(true);

    const session = await client.newSession();
    expect(session.sessionId).toBeDefined();

    // First turn
    const { updates: updates1 } = await session.promptAndCollect(
      "My name is TestUser. Remember this."
    );
    expect(updates1.length).toBeGreaterThan(0);

    // Second turn - verify conversation memory
    const { updates: updates2 } = await session.promptAndCollect(
      "What is my name?"
    );

    // Extract text from updates
    let responseText = "";
    for (const update of updates2) {
      if (
        update.sessionUpdate === "agent_message_chunk" &&
        update.content.type === "text"
      ) {
        responseText += update.content.text;
      }
    }

    // Should remember the name from the first turn
    expect(responseText.toLowerCase()).toContain("testuser");

    // Disconnect should complete without hanging
    await client.disconnect();
    expect(client.isConnected).toBe(false);
  }, 60000); // 60 second timeout for LLM responses

  it("should stream responses correctly", async () => {
    const client = createClient({
      provider: "claude",
      autoApprove: true,
    });

    await client.connect();
    const session = await client.newSession();

    const chunks: string[] = [];
    for await (const update of session.prompt("Say hello in exactly 3 words")) {
      if (
        update.sessionUpdate === "agent_message_chunk" &&
        update.content.type === "text"
      ) {
        chunks.push(update.content.text);
      }
    }

    // Should have received multiple streaming chunks
    expect(chunks.length).toBeGreaterThan(0);

    // Combined text should have content
    const fullText = chunks.join("");
    expect(fullText.length).toBeGreaterThan(0);

    await client.disconnect();
  }, 30000);

  it("should handle disconnect during idle session", async () => {
    const client = createClient({
      provider: "claude",
      autoApprove: true,
    });

    await client.connect();
    await client.newSession();

    // Disconnect without sending any prompts
    await client.disconnect();
    expect(client.isConnected).toBe(false);
  }, 30000);
});
