/**
 * SDK-owned task loop.
 *
 * The loop lives in the caller's process (sandbox pod, dev tunnel, or the
 * developer's own server) and uses the API as a stateless per-turn transport
 * (`POST /developer/v2/task/turn`), the same shape Remy uses its chat
 * endpoint. That's what makes tasks survive platform deploys: API pods are
 * recycled on every roll and used to take in-flight server-side loops with
 * them, while the processes that call `runTask()` are not.
 *
 * Each turn is retried on transient transport failures with per-attempt event
 * buffering — a failed attempt's partial output never reaches the accumulated
 * messages or the caller's `onEvent`. Tool calls execute from here (steps via
 * the normal step-execute path, app methods via `/task/invoke-method`) and are
 * NOT retried blindly: they have side effects, and a failure is fed back to
 * the model as tool output for it to work around.
 *
 * The legacy whole-task routes remain server-side for SDK versions pinned in
 * already-shipped releases; `runTask` falls back to them when the server
 * doesn't have the turn endpoint yet.
 */

import { request, type HttpClientConfig } from '../http.js';
import { MindStudioError } from '../errors.js';
import { mapTools, isDevMode, logTaskResult, sleep } from './index.js';
import {
  assertSupportedSchema,
  validateAgainstSchema,
  formatValidationErrors,
  stripCodeFences,
  type SchemaValidationError,
} from './schema.js';
import type {
  RunTaskOptions,
  RunTaskResult,
  TaskEvent,
  TaskToolCall,
  TaskUsage,
  TaskRequestBody,
} from './types.js';

const DEFAULT_MAX_TURNS = 20;
const MAX_TURNS_LIMIT = 100;

/** In schema mode, how many schema-repair round-trips a task may spend.
 *  Separate from maxTurns so repairs can't starve tool use (or vice versa). */
const MAX_SCHEMA_REPAIR_ATTEMPTS = 3;

/** Keep a large tool result from blowing the model's context window. */
const MAX_TOOL_OUTPUT_CHARS = 50_000;

const MAX_TURN_ATTEMPTS = 5;
const INITIAL_BACKOFF_MS = 1000;
const STALL_TIMEOUT_MS = 300_000; // 5 minutes with no stream data = dead turn

/** Sentinel code: the server has no `/task/turn` route (deployed before this
 *  SDK version) — `runTask` catches it and falls back to the legacy loop. */
export const TURN_UNAVAILABLE_CODE = 'task_turn_unavailable';

// ---------------------------------------------------------------------------
// Tool input/output shaping
// ---------------------------------------------------------------------------

// Assigning `out['__proto__']` on an object literal sets its prototype (unlike
// a spread, which only copies own properties). One side of this merge is
// model-generated, so skip the keys that would reach the prototype chain.
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Merge the developer's tool defaults over the model's tool call arguments.
 * Defaults win on every key they specify, including nested fields — the model
 * decides what to do, the developer pins which model/config it does it with.
 * Only plain objects recurse; arrays and everything else replace wholesale.
 */
export function mergeToolInput(
  modelInput: Record<string, unknown>,
  defaults: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...modelInput };

  for (const [key, defaultValue] of Object.entries(defaults)) {
    if (UNSAFE_KEYS.has(key)) {
      continue;
    }

    const modelValue = merged[key];
    merged[key] =
      isPlainObject(defaultValue) && isPlainObject(modelValue)
        ? mergeToolInput(modelValue, defaultValue)
        : defaultValue;
  }

  return merged;
}

function truncateToolOutput(output: unknown): unknown {
  const serialized = JSON.stringify(output);
  return serialized && serialized.length > MAX_TOOL_OUTPUT_CHARS
    ? serialized.slice(0, MAX_TOOL_OUTPUT_CHARS) + '... [truncated]'
    : output;
}

// ---------------------------------------------------------------------------
// Turn transport
// ---------------------------------------------------------------------------

interface WireMessage {
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    input: Record<string, unknown>;
  }>;
  toolCallId?: string;
  isToolError?: boolean;
}

interface TurnRequestBody {
  model: string;
  system: string;
  messages: WireMessage[];
  tools: TaskRequestBody['tools'];
}

interface TurnResult {
  /** Raw stream events, buffered per attempt and only surfaced on success. */
  events: TaskEvent[];
  text: string;
  toolCalls: Array<{
    id: string;
    name: string;
    input: Record<string, unknown>;
  }>;
  stopReason: string;
  usage: {
    inputTokens?: number;
    outputTokens?: number;
    cacheCreationTokens?: number;
    cacheReadTokens?: number;
  };
  billingCost: number;
}

/**
 * `request`: HTTP-level failure before the stream started (auth, validation,
 * rate limit, route missing, network) — task-fatal or retryable transport.
 * `model`: the server reported a failed model call as an SSE error event —
 * matches the legacy loop's "return what we have" contract, not a throw.
 */
class TurnError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly phase: 'request' | 'model',
    readonly status?: number,
    readonly errorCode?: string,
  ) {
    super(message);
  }
}

/** One attempt at one turn. Buffers everything; throws TurnError on failure. */
async function attemptTurn(
  httpConfig: HttpClientConfig,
  body: TurnRequestBody,
): Promise<TurnResult> {
  const url = `${httpConfig.baseUrl}/developer/v2/task/turn`;

  await httpConfig.rateLimiter.acquire();

  try {
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${httpConfig.token}`,
          'Content-Type': 'application/json',
          'User-Agent': '@mindstudio-ai/agent',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      throw new TurnError(
        `Network error: ${err instanceof Error ? err.message : 'fetch failed'}`,
        true,
        'request',
      );
    }

    httpConfig.rateLimiter.updateFromHeaders(res.headers);

    if (!res.ok) {
      let message = `${res.status} ${res.statusText}`;
      let code: string | undefined;
      try {
        const errBody = (await res.json()) as Record<string, unknown>;
        const errMsg =
          (typeof errBody.errorMessage === 'string'
            ? errBody.errorMessage
            : undefined) ??
          (typeof errBody.errorString === 'string'
            ? errBody.errorString
            : undefined) ??
          (typeof errBody.error === 'string' ? errBody.error : undefined);
        if (errMsg) message = errMsg;
        if (typeof errBody.errorString === 'string') code = errBody.errorString;
      } catch {}

      const retryable = res.status >= 500 || res.status === 429;
      throw new TurnError(message, retryable, 'request', res.status, code);
    }

    // Parse the SSE stream, buffering events until the turn completes.
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    const events: TaskEvent[] = [];
    let text = '';
    const toolCalls: TurnResult['toolCalls'] = [];
    let turn: TurnResult | null = null;

    const handleLine = (line: string) => {
      if (!line.startsWith('data: ')) {
        return;
      }
      let event: Record<string, unknown>;
      try {
        event = JSON.parse(line.slice(6)) as Record<string, unknown>;
      } catch {
        return; // Skip malformed SSE lines
      }

      if (event.type === 'error') {
        const status = typeof event.status === 'number' ? event.status : 500;
        const message =
          typeof event.error === 'string' ? event.error : 'Model call failed';
        // 5xx / transport-flavored errors are worth retrying the turn;
        // deterministic model errors (4xx: bad model id, no credits) are not.
        const retryable =
          status >= 500 || /overloaded|terminated|network/i.test(message);
        throw new TurnError(message, retryable, 'model', status);
      }

      if (event.type === 'turn') {
        turn = {
          events,
          text,
          toolCalls,
          stopReason:
            typeof event.stopReason === 'string'
              ? event.stopReason
              : 'end_turn',
          usage: (event.usage as TurnResult['usage']) ?? {},
          billingCost:
            typeof event.billingCost === 'number' ? event.billingCost : 0,
        };
        return;
      }

      if (event.type === 'text' && typeof event.text === 'string') {
        text += event.text;
      } else if (event.type === 'tool_use') {
        toolCalls.push({
          id: event.id as string,
          name: event.name as string,
          input: (event.input as Record<string, unknown>) ?? {},
        });
      }
      events.push(event as TaskEvent);
    };

    while (true) {
      let stallTimer: ReturnType<typeof setTimeout> | undefined;
      let readResult: ReadableStreamReadResult<Uint8Array>;
      try {
        readResult = await Promise.race([
          reader.read(),
          new Promise<never>((_, reject) => {
            stallTimer = setTimeout(
              () => reject(new Error('stream_stall')),
              STALL_TIMEOUT_MS,
            );
          }),
        ]);
        clearTimeout(stallTimer);
      } catch (err) {
        clearTimeout(stallTimer);
        // Cancel best-effort — on an already-errored stream this can itself
        // reject; don't let cleanup mask the original error.
        try {
          await reader.cancel();
        } catch {}
        if (err instanceof TurnError) {
          throw err;
        }
        const isStall = err instanceof Error && err.message === 'stream_stall';
        throw new TurnError(
          isStall
            ? 'Turn stalled — no data received for 5 minutes'
            : `Network error: stream interrupted — ${err instanceof Error ? err.message : 'unknown'}`,
          true,
          'request',
        );
      }

      if (readResult.done) {
        break;
      }

      buffer += decoder.decode(readResult.value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        handleLine(line);
      }
    }

    if (buffer) {
      handleLine(buffer);
    }

    if (!turn) {
      // Without the final turn event we don't know the stopReason — treating
      // a truncated turn as complete would push an assistant message with
      // orphan tool_use blocks and corrupt every turn after it.
      throw new TurnError(
        'Network error: stream ended before turn completion',
        true,
        'request',
      );
    }

    return turn;
  } finally {
    httpConfig.rateLimiter.release();
  }
}

/**
 * Run one turn with retries. Events are buffered inside each attempt, so a
 * retried turn surfaces nothing from its failed attempts.
 */
async function runTurnWithRetry(
  httpConfig: HttpClientConfig,
  body: TurnRequestBody,
): Promise<TurnResult> {
  for (let attempt = 0; attempt < MAX_TURN_ATTEMPTS; attempt++) {
    try {
      return await attemptTurn(httpConfig, body);
    } catch (err) {
      if (
        !(err instanceof TurnError) ||
        !err.retryable ||
        attempt >= MAX_TURN_ATTEMPTS - 1
      ) {
        throw err;
      }
      if (isDevMode()) {
        console.log(
          `[task] connection lost, retrying turn (attempt ${attempt + 2} of ${MAX_TURN_ATTEMPTS})`,
        );
      }
      await sleep(INITIAL_BACKOFF_MS * 2 ** attempt);
    }
  }
  // Unreachable — the final attempt either returns or throws above.
  throw new TurnError('Turn retries exhausted', false, 'request');
}

// ---------------------------------------------------------------------------
// The loop
// ---------------------------------------------------------------------------

export interface ToolExecutionResult {
  output: unknown;
  billingCost: number;
  isError: boolean;
}

export interface TaskLoopDeps {
  httpConfig: HttpClientConfig;
  /** Executes a step tool. Must not throw — failures come back as
   *  `{ output: { error }, isError: true }` for the model to work around. */
  executeStepTool: (
    stepType: string,
    input: Record<string, unknown>,
  ) => Promise<ToolExecutionResult>;
  /** Executes an app-method tool. Same no-throw contract. */
  executeMethodTool: (
    methodId: string,
    input: Record<string, unknown>,
  ) => Promise<ToolExecutionResult>;
}

export async function runTaskLocal<T = unknown>(
  deps: TaskLoopDeps,
  options: RunTaskOptions,
): Promise<RunTaskResult<T>> {
  const { httpConfig } = deps;
  const onEvent = options.onEvent;

  const outputSchema = options.outputSchema;
  if (outputSchema) assertSupportedSchema(outputSchema);

  let system: string;
  if (outputSchema) {
    // "NOT the schema" matters: echoing the schema back is a known failure
    // mode when a schema appears verbatim in the prompt.
    system = `${options.prompt}\n\nWhen you have completed the task, respond with your final output as a single JSON object that conforms to this JSON Schema. Respond with the JSON object itself — NOT the schema, no prose, no code fences:\n${JSON.stringify(outputSchema)}\n<!-- cache_breakpoint -->`;
  } else {
    const structuredOutputExample =
      typeof options.structuredOutputExample === 'string'
        ? options.structuredOutputExample
        : JSON.stringify(options.structuredOutputExample);

    // Same composition as the server-side loop — the cache breakpoint marker
    // is handled by the platform's system-message splitter.
    system = `${options.prompt}\n\nWhen you have completed the task, respond with your final output as JSON matching this example:\n${structuredOutputExample}\n<!-- cache_breakpoint -->`;
  }

  const wireTools = mapTools(options.tools);
  const toolKinds = new Map<string, 'step' | 'method'>();
  const toolDefaults = new Map<string, Record<string, unknown>>();
  for (const t of wireTools) {
    if ('appMethod' in t) {
      toolKinds.set(t.appMethod, 'method');
      if (t.defaults) toolDefaults.set(t.appMethod, t.defaults);
    } else {
      toolKinds.set(t.stepType, 'step');
      if (t.defaults) toolDefaults.set(t.stepType, t.defaults);
    }
  }

  const maxTurns = Math.min(
    Math.max(options.maxTurns || DEFAULT_MAX_TURNS, 1),
    MAX_TURNS_LIMIT,
  );

  const messages: WireMessage[] = [
    { role: 'user', content: JSON.stringify(options.input) },
  ];

  let loopCount = 0;
  let schemaRepairCount = 0;
  const toolCallLog: TaskToolCall[] = [];
  const totalUsage = {
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
    totalBillingCost: 0,
  };

  const buildResult = (
    output: unknown,
    outputRaw: string,
    parsedSuccessfully: boolean,
    turns: number,
  ): RunTaskResult<T> => ({
    output: output as T,
    outputRaw,
    parsedSuccessfully,
    turns,
    usage: totalUsage as TaskUsage,
    toolCalls: toolCallLog,
  });

  const accumulate = (turn: TurnResult) => {
    totalUsage.inputTokens += turn.usage.inputTokens ?? 0;
    totalUsage.outputTokens += turn.usage.outputTokens ?? 0;
    totalUsage.cacheCreationTokens += turn.usage.cacheCreationTokens ?? 0;
    totalUsage.cacheReadTokens += turn.usage.cacheReadTokens ?? 0;
    totalUsage.totalBillingCost += turn.billingCost;
    for (const event of turn.events) {
      onEvent?.(event);
    }
  };

  const finish = (result: RunTaskResult<T>): RunTaskResult<T> => {
    onEvent?.({ type: 'done', ...result });
    logTaskResult(result);
    return result;
  };

  /**
   * Schema mode never resolves with garbage: build the throwable for output
   * that couldn't be made to conform. Usage and tool calls ride in `details`
   * so billing data survives the throw. An `error` event is emitted first so
   * streaming consumers get terminal-event parity with the `done` path.
   */
  const schemaMismatch = (
    outputRaw: string,
    errors: SchemaValidationError[],
  ): MindStudioError => {
    onEvent?.({
      type: 'error',
      error: 'Output did not conform to outputSchema.',
      errors,
    });
    return new MindStudioError(
      '[task] Output did not conform to outputSchema after all repair attempts.',
      'task_output_schema_mismatch',
      422,
      {
        outputRaw,
        errors,
        turns: loopCount,
        usage: totalUsage,
        toolCalls: toolCallLog,
      },
    );
  };

  /** Maps a failed turn to the caller-facing contract. */
  const turnFailure = (err: unknown): RunTaskResult<T> => {
    if (err instanceof TurnError && err.phase === 'model') {
      // The model call failed server-side (no credits, model disabled,
      // context too large) — same contract as the legacy loop: resolve with
      // an unparsed result rather than throw.
      if (isDevMode()) {
        console.error(`[task] Model call failed: ${err.message}`);
      }
      if (outputSchema) {
        // Schema mode promises typed output or a throw — resolving with
        // `output: null` would hand the caller null typed as FromSchema<S>.
        throw new MindStudioError(
          `[task] ${err.message}`,
          'task_execution_error',
          500,
          { turns: loopCount, usage: totalUsage, toolCalls: toolCallLog },
        );
      }
      return finish(buildResult(null, '', false, loopCount));
    }
    if (err instanceof TurnError) {
      throw new MindStudioError(
        `[task] ${err.message}`,
        err.errorCode ?? 'task_turn_error',
        err.status ?? 500,
      );
    }
    throw err;
  };

  while (loopCount < maxTurns) {
    loopCount++;

    let turn: TurnResult;
    try {
      turn = await runTurnWithRetry(httpConfig, {
        model: options.model,
        system,
        messages,
        tools: wireTools,
      });
    } catch (err) {
      // Route missing on the first turn (nothing has run yet) — signal
      // `runTask` to fall back to the legacy server-side loop.
      if (
        loopCount === 1 &&
        err instanceof TurnError &&
        err.status === 404 &&
        err.errorCode === 'not_found'
      ) {
        throw new MindStudioError(
          'Task turn endpoint unavailable.',
          TURN_UNAVAILABLE_CODE,
          404,
        );
      }
      return turnFailure(err);
    }

    accumulate(turn);

    if (turn.stopReason === 'tool_use' && turn.toolCalls.length > 0) {
      messages.push({
        role: 'assistant',
        content: turn.text,
        toolCalls: turn.toolCalls,
      });

      // Execute tool calls in parallel — order of results back to the model
      // matters, parallelism of execution doesn't.
      const results = await Promise.all(
        turn.toolCalls.map(async (toolCall) => {
          onEvent?.({
            type: 'tool_call_start',
            id: toolCall.id,
            name: toolCall.name,
          });

          const startTime = Date.now();
          const defaults = toolDefaults.get(toolCall.name) || {};
          const mergedInput = mergeToolInput(toolCall.input, defaults);

          const execute =
            toolKinds.get(toolCall.name) === 'method'
              ? deps.executeMethodTool
              : deps.executeStepTool;
          const result = await execute(toolCall.name, mergedInput);

          toolCallLog.push({
            name: toolCall.name,
            success: !result.isError,
            durationMs: Date.now() - startTime,
          });

          return { toolCall, ...result };
        }),
      );

      for (const { toolCall, output, billingCost, isError } of results) {
        if (billingCost) {
          totalUsage.totalBillingCost += billingCost;
        }

        const truncated = truncateToolOutput(output);
        messages.push({
          role: 'user',
          content: JSON.stringify(truncated),
          toolCallId: toolCall.id,
          ...(isError && { isToolError: true }),
        });

        onEvent?.({
          type: 'tool_call_result',
          id: toolCall.id,
          output: truncated,
        });
      }

      if (isDevMode()) {
        console.log(`[task] running... turn ${loopCount}/${maxTurns}`);
      }

      continue;
    }

    // end_turn or max_tokens — try to parse as JSON
    messages.push({ role: 'assistant', content: turn.text });

    let output: unknown;
    let parseOk = true;
    try {
      output = JSON.parse(outputSchema ? stripCodeFences(turn.text) : turn.text);
    } catch {
      parseOk = false;
    }

    if (parseOk) {
      if (!outputSchema) {
        return finish(buildResult(output, turn.text, true, loopCount));
      }
      const errors = validateAgainstSchema(output, outputSchema);
      if (errors.length === 0) {
        return finish(buildResult(output, turn.text, true, loopCount));
      }
      if (loopCount < maxTurns && schemaRepairCount < MAX_SCHEMA_REPAIR_ATTEMPTS) {
        schemaRepairCount++;
        messages.push({
          role: 'user',
          content: `Your JSON output did not conform to the required schema. Fix these problems and respond again with ONLY the corrected JSON:\n${formatValidationErrors(errors)}`,
        });
        continue;
      }
      throw schemaMismatch(turn.text, errors);
    }

    // Not valid JSON — if turns remain, ask the model to fix it
    if (loopCount < maxTurns) {
      messages.push({
        role: 'user',
        content:
          'Your response was not valid JSON. Please respond with ONLY the JSON output, no other text.',
      });
      continue;
    }

    if (outputSchema) {
      throw schemaMismatch(turn.text, [
        { path: '$', message: 'output was not valid JSON' },
      ]);
    }
    return finish(buildResult(turn.text, turn.text, false, loopCount));
  }

  // Max turns reached — force final output with tools disabled
  messages.push({
    role: 'user',
    content:
      'You have reached the maximum number of turns. Please provide your final output now as JSON.',
  });

  let finalText = '';
  try {
    const turn = await runTurnWithRetry(httpConfig, {
      model: options.model,
      system,
      messages,
      tools: [],
    });
    accumulate(turn);
    finalText = turn.text;
  } catch (err) {
    if (err instanceof TurnError && err.phase === 'model') {
      if (isDevMode()) {
        console.error(`[task] Final model call failed: ${err.message}`);
      }
      // Fall through with empty output — legacy contract.
    } else {
      return turnFailure(err);
    }
  }

  let parsedSuccessfully = true;
  let output: unknown;
  try {
    output = JSON.parse(outputSchema ? stripCodeFences(finalText) : finalText);
  } catch {
    output = finalText;
    parsedSuccessfully = false;
  }

  if (outputSchema) {
    // The forced final turn is the last chance — validate it too.
    if (!parsedSuccessfully) {
      throw schemaMismatch(finalText, [
        { path: '$', message: 'output was not valid JSON' },
      ]);
    }
    const errors = validateAgainstSchema(output, outputSchema);
    if (errors.length > 0) {
      throw schemaMismatch(finalText, errors);
    }
  }

  return finish(
    buildResult(output, finalText, parsedSuccessfully, loopCount + 1),
  );
}
