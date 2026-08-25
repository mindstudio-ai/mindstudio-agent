/**
 * Types for the task agent runtime.
 *
 * A task agent is a multi-step tool-use loop: the model receives a prompt
 * and a set of SDK actions as tools, calls them as needed, and produces
 * structured output — validated against the developer's `outputSchema`, or
 * shaped by a `structuredOutputExample`.
 */

import type { JsonObjectSchema } from './schema.js';

/**
 * Tool configuration for {@link RunTaskOptions.tools}.
 * - String: SDK method name (e.g. `'searchGoogle'`).
 * - `{ method }`: SDK method name with default input overrides.
 * - `{ appMethod }`: one of your own app's methods, called as the invoking
 *   user with their roles.
 *
 * Defaults win over whatever the model passes for the same field, including
 * nested fields — the model decides what to do, you pin how it's done.
 */
export type TaskToolConfig =
  | string
  | { method: string; defaults?: Record<string, unknown> }
  | {
      appMethod: string;
      /**
       * How this method should be framed for *this* task. Falls back to the
       * method's own description. Worth writing: the same method often serves
       * different purposes across tasks, and the description is what tells the
       * model when to reach for it.
       */
      description?: string;
      defaults?: Record<string, unknown>;
    };

/** Options shared by both output modes of {@link MindStudioAgent.runTask}. */
interface RunTaskOptionsBase {
  /** System prompt — defines the agent's behavior and approach. */
  prompt: string;
  /** Structured input for this task instance. Passed as the user message. */
  input: Record<string, unknown>;
  /** SDK actions and/or app methods to make available as tools. */
  tools: TaskToolConfig[];
  /**
   * Model ID for the task agent. Must support tool use. Tuned model lines
   * (`tuned/{appId}/{methodId}`) are supported — that's how a jewel is
   * promoted onto its own fine-tuned model; tool support depends on the
   * tuned model's base (qwen bases: yes) and is enforced server-side with a
   * deterministic error.
   */
  model: string;
  /** Max loop iterations before forcing final output. Default 20, max 100. */
  maxTurns?: number;
  /** App ID to execute within. */
  appId?: string;
  /** Thread ID for state persistence. */
  threadId?: string;
  /**
   * SSE event callback. When provided, uses streaming mode instead of polling.
   * Events include text chunks, tool call starts/results, thinking blocks,
   * errors, and the final done event with the structured output.
   */
  onEvent?: (event: TaskEvent) => void;
}

/**
 * Example mode: the output shape is suggested by example only. `output` is
 * whatever `JSON.parse` produced (or the raw string when
 * `parsedSuccessfully` is false) — callers must validate it themselves.
 */
export interface RunTaskOptionsWithExample extends RunTaskOptionsBase {
  /** Expected output shape. Pass a JSON string or an object (will be stringified automatically). */
  structuredOutputExample: string | Record<string, unknown>;
  outputSchema?: never;
}

/**
 * Schema mode: the output contract is a plain JSON Schema (the Anthropic
 * tool `input_schema` dialect subset — type/properties/required/enum/items,
 * nullability via type arrays like `['string', 'null']`). Output is
 * validated every turn with automatic repair, `result.output` is typed by
 * inference from the schema value, and `runTask` either returns conforming
 * output or throws (`task_output_schema_mismatch`) — it never resolves with
 * garbage.
 */
export interface RunTaskOptionsWithSchema<
  S extends JsonObjectSchema = JsonObjectSchema,
> extends RunTaskOptionsBase {
  /** Plain JSON Schema for the output. Root must be `type: 'object'`. */
  outputSchema: S;
  structuredOutputExample?: never;
}

/** Options for {@link MindStudioAgent.runTask} — one of the two output modes. */
export type RunTaskOptions = RunTaskOptionsWithExample | RunTaskOptionsWithSchema;

/** An event from a streaming task agent execution. */
export interface TaskEvent {
  type:
    | 'text'
    | 'thinking'
    | 'thinking_complete'
    | 'tool_use'
    | 'tool_input_delta'
    | 'tool_input_args'
    | 'tool_call_start'
    | 'tool_call_result'
    | 'error'
    | 'done';
  [key: string]: unknown;
}

/** Summary of a single tool call within a task execution. */
export interface TaskToolCall {
  name: string;
  success: boolean;
  durationMs: number;
}

/** Usage stats from a task agent execution. */
export interface TaskUsage {
  inputTokens: number;
  outputTokens: number;
  /** Total cost in nanodollars (1/1,000,000,000th of a US dollar). */
  totalBillingCost: number;
}

/** Result of {@link MindStudioAgent.runTask}. */
export interface RunTaskResult<T = unknown> {
  /** Structured output from the task agent, parsed as JSON. */
  output: T;
  /** Raw model text before JSON parse. Useful for debugging when output is garbage. */
  outputRaw: string;
  /** Whether the output was valid JSON. When false, `output` is the raw string. */
  parsedSuccessfully: boolean;
  /** Number of loop iterations used. */
  turns: number;
  /** Token and cost usage. */
  usage: TaskUsage;
  /** Summary of every tool call made during execution. */
  toolCalls: TaskToolCall[];
  /**
   * Stable id for this task's model transcript. Inside a jewel, attach it to
   * the propose/grade return (`trace: task.traceId`) to preserve the full
   * transcript with the pair — the training row and the audit trail. The
   * platform records transcripts server-side per turn; only the id rides the
   * result.
   */
  traceId: string;
}

/** @internal API request body shape for POST /developer/v2/task. */
export interface TaskRequestBody {
  prompt: string;
  input: Record<string, unknown>;
  tools: Array<
    | { stepType: string; defaults?: Record<string, unknown> }
    | {
        appMethod: string;
        description?: string;
        defaults?: Record<string, unknown>;
      }
  >;
  structuredOutputExample: string;
  model: string;
  maxTurns?: number;
  appId?: string;
  threadId?: string;
}
