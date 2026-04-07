/**
 * Types for the task agent runtime.
 *
 * A task agent is a multi-step tool-use loop: the model receives a prompt
 * and a set of SDK actions as tools, calls them as needed, and produces
 * structured output matching the developer's example.
 */

/**
 * Tool configuration for {@link RunTaskOptions.tools}.
 * - String: SDK method name (e.g. `'searchGoogle'`).
 * - Object: method name with default input overrides that merge with the model's tool call arguments.
 */
export type TaskToolConfig =
  | string
  | { method: string; defaults?: Record<string, unknown> };

/** Options for {@link MindStudioAgent.runTask}. */
export interface RunTaskOptions {
  /** System prompt — defines the agent's behavior and approach. */
  prompt: string;
  /** Structured input for this task instance. Passed as the user message. */
  input: Record<string, unknown>;
  /** SDK method names to make available as tools, with optional default overrides. */
  tools: TaskToolConfig[];
  /** JSON string showing the expected output shape. Model conforms to this. */
  structuredOutputExample: string;
  /** Model ID for the task agent. Must support tool use. */
  model: string;
  /** Max loop iterations before forcing final output. Default 10, max 25. */
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

/** An event from a streaming task agent execution. */
export interface TaskEvent {
  type: 'text' | 'tool_call_start' | 'tool_call_result' | 'thinking' | 'error' | 'done';
  [key: string]: unknown;
}

/** Usage stats from a task agent execution. */
export interface TaskUsage {
  inputTokens: number;
  outputTokens: number;
  totalBillingCost: number;
}

/** Result of {@link MindStudioAgent.runTask}. */
export interface RunTaskResult<T = unknown> {
  /** Structured output from the task agent, parsed as JSON. */
  output: T;
  /** Number of loop iterations used. */
  turns: number;
  /** Token and cost usage. */
  usage: TaskUsage;
}

/** @internal API request body shape for POST /developer/v2/task. */
export interface TaskRequestBody {
  prompt: string;
  input: Record<string, unknown>;
  tools: Array<{ stepType: string; defaults?: Record<string, unknown> }>;
  structuredOutputExample: string;
  model: string;
  maxTurns?: number;
  appId?: string;
  threadId?: string;
}
