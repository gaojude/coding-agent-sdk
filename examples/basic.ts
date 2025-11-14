/**
 * Basic example of using coding-agent-sdk
 */

import { query } from '../src/index.js';

async function main() {
  try {
    console.log('Starting query...');

    // Auto-detects backend from environment variables
    const result = await query("List the files in the current directory");

    console.log(`Backend: ${result.backend}`);
    console.log('Streaming events...\n');

    // Stream and display events
    for await (const event of result.events) {
      switch (event.type) {
        case 'session':
          console.log(`[SESSION] ${event.subtype} - ID: ${event.session_id}`);
          break;

        case 'turn':
          if (event.subtype === 'completed') {
            console.log('[TURN] Completed');
            if (event.usage) {
              console.log(`  Tokens: ${event.usage.input_tokens} in, ${event.usage.output_tokens} out`);
            }
          }
          break;

        case 'message':
          if (!event.is_delta) {
            console.log(`[${event.role.toUpperCase()}] ${event.content}`);
          }
          break;

        case 'action':
          console.log(`[ACTION] ${event.subtype} (${event.status})`);
          if (event.tool_name) {
            console.log(`  Tool: ${event.tool_name}`);
          }
          if (event.command) {
            console.log(`  Command: ${event.command}`);
          }
          break;

        case 'progress':
          if (event.subtype === 'todo_update' && event.todo_items) {
            console.log('[TODO LIST]');
            event.todo_items.forEach(todo => {
              console.log(`  [${todo.status}] ${todo.title}`);
            });
          }
          break;

        case 'error':
          console.error(`[ERROR:${event.severity}] ${event.message}`);
          break;

        case 'metrics':
          console.log('[METRICS]');
          if (event.per_model) {
            Object.entries(event.per_model).forEach(([model, metrics]) => {
              console.log(`  ${model}:`, metrics);
            });
          }
          break;
      }
    }

    console.log(`\nSession ID: ${result.sessionId}`);
    console.log('Done!');
  } catch (error: any) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
