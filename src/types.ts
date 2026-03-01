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

// ---------------------------------------------------------------------------
// Agent (pre-built app) types
// ---------------------------------------------------------------------------

/** Information about a pre-built agent in the organization. */
export interface AgentInfo {
  /** Agent UUID. Pass as `appId` to {@link RunAgentOptions}. */
  id: string;
  /** Display name. */
  name: string;
  /** Short description. */
  description: string;
  /** URL-friendly identifier. */
  slug: string;
  /** Agent icon URL. */
  iconUrl: string;
  /** Links: run, edit, details, logs. */
  refs: Record<string, string>;
  /** ISO timestamp. */
  dateCreated: string;
  /** ISO timestamp. */
  dateLastEdited: string;
}

/** Result of {@link MindStudioAgent.listAgents}. */
export interface ListAgentsResult {
  /** Organization UUID. */
  orgId: string;
  /** Organization display name. */
  orgName: string;
  /** Agents in the organization. */
  apps: AgentInfo[];
}

/** Options for {@link MindStudioAgent.runAgent}. */
export interface RunAgentOptions {
  /** App/agent ID to run (required). */
  appId: string;
  /** Input variables as key-value pairs. */
  variables?: Record<string, unknown>;
  /** Workflow name to execute. Omit for the app's default. */
  workflow?: string;
  /** App version override (e.g. "draft"). Defaults to "live". */
  version?: string;
  /** Include billing cost in the response. */
  includeBillingCost?: boolean;
  /** Arbitrary metadata stored with the API request log. */
  metadata?: Record<string, unknown>;
  /** Polling interval in milliseconds. @default 1000 */
  pollIntervalMs?: number;
}

/** Result of a successful agent run. */
export interface RunAgentResult {
  /** Whether the run succeeded. */
  success: boolean;
  /** Thread ID for the run. */
  threadId: string;
  /** The result content (last system message). */
  result: string;
  /** Thread messages, if returned. */
  thread?: unknown;
  /** Cost in credits, if `includeBillingCost` was set. */
  billingCost?: number;
}
