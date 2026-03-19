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

/** Events emitted during the ask agent loop. */
export type AskEvent =
  | { type: 'text'; text: string }
  | { type: 'tool_start'; name: string; input: Record<string, any> }
  | { type: 'tool_done'; name: string; isError: boolean }
  | { type: 'error'; error: string };

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
 *
 * @param onEvent - Optional callback for streaming events as they happen.
 */
export async function runAsk(
  question: string,
  options: { apiKey?: string; baseUrl?: string } = {},
  onEvent?: (event: AskEvent) => void,
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
          onEvent?.({ type: 'text', text: event.text });
          break;

        case 'tool_use':
          toolCalls.push({
            id: event.id,
            name: event.name,
            input: event.input,
          });
          onEvent?.({
            type: 'tool_start',
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
        onEvent?.({ type: 'tool_done', name: tc.name, isError });
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

// ANSI helpers
const ansi = {
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
};

/** Summarize tool input into a short string for display. */
function summarizeInput(input: Record<string, any>): string {
  const vals = Object.values(input).filter((v) => typeof v === 'string');
  const summary = vals.join(', ');
  return summary.length > 60 ? summary.slice(0, 57) + '...' : summary;
}

/**
 * CLI entry point — streams to stderr for human UX, writes final
 * result to stdout for piping. When stdout is a TTY the final write
 * is skipped (already visible via stderr).
 */
export async function cmdAsk(
  question: string,
  options: { apiKey?: string; baseUrl?: string },
): Promise<void> {
  try {
    const response = await runAsk(question, options, (event) => {
      switch (event.type) {
        case 'text':
          process.stderr.write(event.text);
          break;
        case 'tool_start':
          process.stderr.write(
            `\n ${ansi.cyan('⟡')} ${ansi.bold(event.name)} ${ansi.dim(summarizeInput(event.input))}\n`,
          );
          break;
        case 'tool_done':
          // Tool results are consumed by the next LLM turn, not shown
          break;
      }
    });

    if (process.stdout.isTTY) {
      process.stderr.write('\n');
    } else {
      process.stdout.write(response + '\n');
    }
  } catch (err: any) {
    process.stderr.write(`Error: ${err.message}\n`);
    process.exit(1);
  }
}
