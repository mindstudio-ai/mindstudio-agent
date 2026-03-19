/**
 * `mindstudio ask` — built-in SDK agent.
 *
 * Answers questions about MindStudio SDK actions, models, connectors,
 * and integrations. Runs an agent loop against the platform's chat
 * endpoint with tool-calling support.
 *
 * Primary consumer: other AI agents (Remy, Claude Code via MCP, etc.)
 * that need method signatures, code examples, and correct model IDs.
 */

import { loadConfig } from '../config.js';
import { MindStudioAgent } from '../client.js';
import { streamChat } from './sse.js';
import { ASK_TOOLS, executeTool } from './tools.js';
import { buildSystemPrompt } from './prompt.js';
import type { Message, ToolCall } from './types.js';

const DEFAULT_BASE_URL = 'https://v1.mindstudio-api.com';

/**
 * Resolve raw API credentials for the SSE client.
 * Mirrors MindStudioAgent constructor resolution order.
 */
function resolveCredentials(options: { apiKey?: string; baseUrl?: string }): {
  apiKey: string;
  baseUrl: string;
} {
  const config = loadConfig();

  const apiKey =
    process.env.CALLBACK_TOKEN ??
    options.apiKey ??
    process.env.MINDSTUDIO_API_KEY ??
    config.apiKey;

  if (!apiKey) {
    throw new Error(
      'Not authenticated. Run `mindstudio login` or set MINDSTUDIO_API_KEY.',
    );
  }

  const baseUrl =
    options.baseUrl ??
    process.env.MINDSTUDIO_BASE_URL ??
    process.env.REMOTE_HOSTNAME ??
    config.baseUrl ??
    DEFAULT_BASE_URL;

  return { apiKey, baseUrl };
}

/**
 * Run the ask agent and return the response as a string.
 * Used by both the CLI command and the MCP tool.
 */
export async function runAsk(
  question: string,
  options: { apiKey?: string; baseUrl?: string } = {},
): Promise<string> {
  const { apiKey, baseUrl } = resolveCredentials(options);

  const agent = new MindStudioAgent({
    apiKey: options.apiKey,
    baseUrl: options.baseUrl,
  });

  const system = await buildSystemPrompt(agent);

  const messages: Message[] = [{ role: 'user', content: question }];

  while (true) {
    let assistantText = '';
    const toolCalls: ToolCall[] = [];
    let stopReason = 'end_turn';

    for await (const event of streamChat({
      baseUrl,
      apiKey,
      system,
      messages,
      tools: ASK_TOOLS,
    })) {
      switch (event.type) {
        case 'text':
          assistantText += event.text;
          break;

        case 'tool_use':
          toolCalls.push({
            id: event.id,
            name: event.name,
            input: event.input,
          });
          break;

        case 'done':
          stopReason = event.stopReason;
          break;

        case 'error':
          throw new Error(event.error);
      }
    }

    messages.push({
      role: 'assistant',
      content: assistantText,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    });

    if (stopReason !== 'tool_use' || toolCalls.length === 0) {
      return assistantText;
    }

    const results = await Promise.all(
      toolCalls.map(async (tc) => {
        const { result, isError } = await executeTool(agent, tc.name, tc.input);
        return { id: tc.id, result, isError };
      }),
    );

    for (const r of results) {
      messages.push({
        role: 'user',
        content: r.result,
        toolCallId: r.id,
        isToolError: r.isError,
      });
    }
  }
}

/**
 * CLI entry point — runs the agent and writes to stdout.
 */
export async function cmdAsk(
  question: string,
  options: { apiKey?: string; baseUrl?: string },
): Promise<void> {
  try {
    const response = await runAsk(question, options);
    process.stdout.write(response + '\n');
  } catch (err: any) {
    process.stderr.write(`Error: ${err.message}\n`);
    process.exit(1);
  }
}
