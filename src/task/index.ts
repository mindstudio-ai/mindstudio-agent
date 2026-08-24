/**
 * Task agent runtime — multi-step tool-use loop.
 *
 * The developer provides a prompt, a set of SDK actions as tools, and an
 * output example. The API runs a tool-use loop (model → tool calls →
 * results → repeat) and returns structured output.
 *
 * Two execution modes:
 * - **Poll** (default): POST returns a token, SDK polls until complete.
 * - **SSE** (when onEvent provided): POST streams events in real time.
 */

import { randomUUID } from 'node:crypto';

import { request, type HttpClientConfig } from '../http.js';
import { MindStudioError } from '../errors.js';
import { getRequestContext } from '../context.js';
import { stepMetadata } from '../generated/metadata.js';
import { buildExampleFromSchema } from './schema.js';
import type {
  TaskToolConfig,
  RunTaskOptions,
  RunTaskResult,
  TaskEvent,
  TaskRequestBody,
  TaskUsage,
  TaskToolCall,
} from './types.js';

export type {
  TaskToolConfig,
  RunTaskOptions,
  RunTaskOptionsWithExample,
  RunTaskOptionsWithSchema,
  RunTaskResult,
  TaskEvent,
  TaskUsage,
  TaskToolCall,
} from './types.js';
export type {
  JsonSchema,
  JsonObjectSchema,
  JsonSchemaTypeName,
  FromSchema,
  SchemaValidationError,
} from './schema.js';

// ---------------------------------------------------------------------------
// Tool mapping — developer-friendly config → API request format
// ---------------------------------------------------------------------------

/** Resolve a public method name (which may be an alias) to the real API step type. */
function resolveStepType(name: string): string {
  const meta = (stepMetadata as Record<string, { stepType: string }>)[name];
  return meta ? meta.stepType : name;
}

/** Map developer tool configs to API request format with alias resolution. */
export function mapTools(tools: TaskToolConfig[]): TaskRequestBody['tools'] {
  return tools.map((t) => {
    // App methods pass through untouched. `resolveStepType` looks names up in
    // `stepMetadata`, so running an app method id through it would silently
    // rewrite any method that happens to share a name with an SDK alias.
    if (typeof t === 'object' && 'appMethod' in t) {
      return {
        appMethod: t.appMethod,
        ...(t.description ? { description: t.description } : {}),
        ...(t.defaults ? { defaults: t.defaults } : {}),
      };
    }

    const method = typeof t === 'string' ? t : t.method;
    const stepType = resolveStepType(method);
    const defaults = typeof t === 'object' ? t.defaults : undefined;
    return defaults ? { stepType, defaults } : { stepType };
  });
}

/** Build the API request body from developer options. */
export function buildTaskRequestBody(options: RunTaskOptions): TaskRequestBody {
  return {
    prompt: options.prompt,
    input: options.input,
    tools: mapTools(options.tools),
    // The legacy whole-task route requires structuredOutputExample and
    // composes its own prompt server-side, so in schema mode we synthesize a
    // skeleton example from the schema. Validation still happens client-side
    // after the result comes back (see _runTaskInner).
    structuredOutputExample: options.outputSchema
      ? JSON.stringify(buildExampleFromSchema(options.outputSchema))
      : typeof options.structuredOutputExample === 'string'
        ? options.structuredOutputExample
        : JSON.stringify(options.structuredOutputExample),
    model: options.model,
    ...(options.maxTurns != null && { maxTurns: options.maxTurns }),
    ...(options.appId != null && { appId: options.appId }),
    ...(options.threadId != null && { threadId: options.threadId }),
  };
}

// ---------------------------------------------------------------------------
// Poll mode
// ---------------------------------------------------------------------------

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Check if running in managed/sandbox mode (dev tunnel or ALS). */
export function isDevMode(): boolean {
  return !!(process.env.CALLBACK_TOKEN || getRequestContext()?.callbackToken);
}

/** Log task result summary to console in dev mode. */
export function logTaskResult(result: RunTaskResult<unknown>): void {
  if (!isDevMode()) return;

  const toolSummary = result.toolCalls
    .map((tc) => `${tc.name} (${tc.durationMs}ms) ${tc.success ? '✓' : '✗'}`)
    .join(', ');

  console.log(
    `[task] ${result.turns} turn${result.turns === 1 ? '' : 's'}` +
      (toolSummary ? `: ${toolSummary}` : '') +
      ` | ${result.parsedSuccessfully ? 'output OK' : '⚠ output not valid JSON'}` +
      ` | cost: ${result.usage.totalBillingCost}`,
  );
}

/** Run a task agent via async polling. */
export async function runTaskPoll<T = unknown>(
  httpConfig: HttpClientConfig,
  body: TaskRequestBody,
): Promise<RunTaskResult<T>> {
  // Legacy server-side loop: turns never reach `/task/turn`, so nothing is
  // recorded under this id — minted only to satisfy the result contract.
  const traceId = randomUUID();
  // POST to async endpoint — returns immediately with a poll token
  const { data } = await request<{ taskToken: string }>(
    httpConfig,
    'POST',
    '/task',
    body,
  );

  const pollUrl = `${httpConfig.baseUrl}/developer/v2/task/poll/${data.taskToken}`;

  // Poll with exponential backoff
  let pollDelay = 300;
  while (true) {
    await sleep(pollDelay);
    pollDelay = Math.min(pollDelay * 1.5, 3000);

    const res = await fetch(pollUrl, {
      headers: { 'User-Agent': '@mindstudio-ai/agent' },
    });

    // Retry silently on transient server errors
    if (res.status === 502 || res.status === 503 || res.status === 504)
      continue;

    if (res.status === 404) {
      throw new MindStudioError(
        'Task poll token not found or expired.',
        'poll_token_expired',
        404,
      );
    }

    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({}));
      throw new MindStudioError(
        (errorBody as Record<string, string>).message ??
          (errorBody as Record<string, string>).error ??
          `Task poll failed: ${res.status} ${res.statusText}`,
        (errorBody as Record<string, string>).code ?? 'poll_error',
        res.status,
        errorBody,
      );
    }

    const poll = (await res.json()) as {
      status: 'pending' | 'complete' | 'error';
      currentTurn?: number;
      maxTurns?: number;
      output?: T;
      outputRaw?: string;
      parsedSuccessfully?: boolean;
      turns?: number;
      usage?: TaskUsage;
      toolCalls?: TaskToolCall[];
      error?: string;
    };

    if (poll.status === 'pending') {
      if (isDevMode() && poll.currentTurn != null) {
        console.log(
          `[task] running... turn ${poll.currentTurn}/${poll.maxTurns ?? '?'}`,
        );
      }
      continue;
    }

    if (poll.status === 'error') {
      throw new MindStudioError(
        poll.error ?? 'Task execution failed.',
        'task_execution_error',
        500,
      );
    }

    const result: RunTaskResult<T> = {
      output: poll.output as T,
      outputRaw: poll.outputRaw ?? '',
      parsedSuccessfully: poll.parsedSuccessfully ?? true,
      turns: poll.turns ?? 0,
      usage: poll.usage ?? {
        inputTokens: 0,
        outputTokens: 0,
        totalBillingCost: 0,
      },
      toolCalls: poll.toolCalls ?? [],
      traceId,
    };

    logTaskResult(result);
    return result;
  }
}

// ---------------------------------------------------------------------------
// SSE streaming mode
// ---------------------------------------------------------------------------

/** Run a task agent with SSE streaming. */
export async function runTaskStream<T = unknown>(
  httpConfig: HttpClientConfig,
  body: TaskRequestBody,
  onEvent: (event: TaskEvent) => void,
): Promise<RunTaskResult<T>> {
  // Legacy server-side loop — see the note in runTaskPoll.
  const traceId = randomUUID();
  const url = `${httpConfig.baseUrl}/developer/v2/task`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${httpConfig.token}`,
      'Content-Type': 'application/json',
      'User-Agent': '@mindstudio-ai/agent',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    let code = 'api_error';
    let details: unknown;
    try {
      const text = await res.text();
      try {
        const errBody = JSON.parse(text) as Record<string, unknown>;
        details = errBody;
        const errMsg =
          (typeof errBody.error === 'string' ? errBody.error : undefined) ??
          (typeof errBody.message === 'string' ? errBody.message : undefined);
        if (errMsg) message = errMsg;
        if (errBody.code) code = errBody.code as string;
      } catch {
        const stripped = text
          .replace(/<[^>]*>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        if (stripped) message = stripped.slice(0, 200);
      }
    } catch {}
    throw new MindStudioError(`[task] ${message}`, code, res.status, details);
  }

  // Parse SSE stream
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result: RunTaskResult<T> | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      try {
        const event = JSON.parse(line.slice(6)) as TaskEvent;

        onEvent(event);

        if (event.type === 'error') {
          throw new MindStudioError(
            (event.error as string) ?? 'Task execution failed.',
            'task_execution_error',
            500,
          );
        }

        if (event.type === 'done') {
          result = {
            output: event.output as T,
            outputRaw: (event.outputRaw as string) ?? '',
            parsedSuccessfully: (event.parsedSuccessfully as boolean) ?? true,
            turns: (event.turns as number) ?? 0,
            usage: (event.usage as TaskUsage) ?? {
              inputTokens: 0,
              outputTokens: 0,
              totalBillingCost: 0,
            },
            toolCalls: (event.toolCalls as TaskToolCall[]) ?? [],
            traceId,
          };
        }
      } catch (err) {
        if (err instanceof MindStudioError) throw err;
        // Skip malformed SSE lines
      }
    }
  }

  // Flush remaining buffer
  if (buffer.startsWith('data: ')) {
    try {
      const event = JSON.parse(buffer.slice(6)) as TaskEvent;
      onEvent(event);

      if (event.type === 'error') {
        throw new MindStudioError(
          (event.error as string) ?? 'Task execution failed.',
          'task_execution_error',
          500,
        );
      }

      if (event.type === 'done') {
        result = {
          output: event.output as T,
          outputRaw: (event.outputRaw as string) ?? '',
          parsedSuccessfully: (event.parsedSuccessfully as boolean) ?? true,
          turns: (event.turns as number) ?? 0,
          usage: (event.usage as TaskUsage) ?? {
            inputTokens: 0,
            outputTokens: 0,
            totalBillingCost: 0,
          },
          toolCalls: (event.toolCalls as TaskToolCall[]) ?? [],
          traceId,
        };
      }
    } catch (err) {
      if (err instanceof MindStudioError) throw err;
    }
  }

  if (!result) {
    throw new MindStudioError(
      '[task] Stream ended without a done event. The task execution may have been interrupted.',
      'stream_error',
      500,
    );
  }

  logTaskResult(result);
  return result;
}
