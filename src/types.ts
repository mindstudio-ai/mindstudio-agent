/** Configuration options for creating a {@link MindStudioAgent}. */
export interface AgentOptions {
  /**
   * MindStudio API key. Used as a Bearer token for authentication.
   *
   * If omitted, the SDK looks for `MINDSTUDIO_API_KEY` in the environment,
   * then falls back to `CALLBACK_TOKEN` (available automatically
   * inside MindStudio custom functions).
   */
  apiKey?: string;

  /**
   * Base URL of the MindStudio API.
   *
   * If omitted, the SDK looks for `MINDSTUDIO_BASE_URL` in the environment,
   * then `REMOTE_HOSTNAME` (available automatically inside MindStudio
   * custom functions), then falls back to `https://v1.mindstudio-api.com`.
   */
  baseUrl?: string;

  /**
   * Maximum number of automatic retries on 429 (rate limited) responses.
   * Each retry waits for the duration specified by the `Retry-After` header.
   *
   * @default 3
   */
  maxRetries?: number;

  /**
   * When true, the thread ID from the first API response is automatically
   * reused for all subsequent calls (unless an explicit `threadId` is passed).
   * Useful for local debugging to simulate custom function sandbox behavior.
   *
   * If omitted, the SDK checks `MINDSTUDIO_REUSE_THREAD_ID` in the environment.
   * Any truthy value (`"true"`, `"1"`) enables reuse.
   *
   * @default false
   */
  reuseThreadId?: boolean;
}

/** Options for a single step execution call. */
export interface StepExecutionOptions {
  /**
   * App ID to execute within. When using an API key, omit this to let the
   * API create a service account app automatically. Pass a previously returned
   * `appId` to reuse an existing app context.
   */
  appId?: string;

  /**
   * Thread ID for state persistence across calls. Omit to create an ephemeral
   * thread. Pass a previously returned `threadId` to maintain conversation
   * history or variable state.
   */
  threadId?: string;
}

/** Execution metadata returned alongside every step result. */
export interface StepExecutionMeta {
  /** The app ID used for this execution. Pass to subsequent calls to reuse. */
  $appId: string;

  /** The thread ID used for this execution. Pass to subsequent calls to maintain state. */
  $threadId: string;

  /**
   * Number of API calls remaining in the current rate limit window.
   * Useful for throttling proactively before hitting the limit.
   */
  $rateLimitRemaining?: number;

  /** Cost in credits for this step execution. */
  $billingCost?: number;

  /** Itemized billing events for this step execution. */
  $billingEvents?: Array<Record<string, unknown>>;
}

/**
 * Result of a step execution call.
 *
 * Output properties are spread at the top level for easy destructuring:
 * ```ts
 * const { content } = await agent.generateText({ ... });
 * ```
 *
 * Execution metadata (`$appId`, `$threadId`, `$rateLimitRemaining`, `$billingCost`, `$billingEvents`) is also available:
 * ```ts
 * const result = await agent.generateText({ ... });
 * console.log(result.content, result.$threadId, result.$rateLimitRemaining);
 * ```
 */
export type StepExecutionResult<TOutput = Record<string, unknown>> =
  TOutput & StepExecutionMeta;
