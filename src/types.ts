/** Configuration options for creating a {@link MindStudioAgent}. */
export interface AgentOptions {
  /**
   * MindStudio API key. Used as a Bearer token for authentication.
   *
   * If omitted, the SDK checks (in order):
   * 1. `MINDSTUDIO_API_KEY` environment variable
   * 2. `~/.mindstudio/config.json` (set via `mindstudio login`)
   * 3. `CALLBACK_TOKEN` environment variable (auto-set inside MindStudio custom functions)
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
   * App ID for auth and database context. Required when using `auth` or
   * `db` namespaces outside the MindStudio sandbox.
   *
   * If omitted, the SDK checks:
   * 1. `MINDSTUDIO_APP_ID` environment variable
   * 2. Sandbox globals (when running inside MindStudio)
   * 3. Auto-detected from the first `executeStep` response header
   *
   * Not needed for plain step execution — only for `db` and `auth`.
   */
  appId?: string;

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

/** Result of {@link MindStudioAgent.getUserInfo}. */
export interface UserInfoResult {
  userId: string;
  displayName: string;
  organizationId: string;
  organizationName: string;
  members: {
    userId: string;
    displayName: string;
    role: 'owner' | 'admin' | 'member' | 'guest' | 'agent';
    isAgent: boolean;
  }[];
}

// ---------------------------------------------------------------------------
// User type — branded string for database user references
// ---------------------------------------------------------------------------

/**
 * A reference to a MindStudio platform user. Stored as a UUID string.
 *
 * In the database, user values are stored with a `@@user@@` prefix
 * (e.g. `@@user@@550e8400-...`). The SDK handles this automatically —
 * values are clean UUIDs in application code, prefixed/stripped
 * transparently during read/write operations.
 *
 * Use `resolveUser(userId)` when you need display info (name, email, etc.).
 *
 * @example
 * ```ts
 * interface Order {
 *   id: string;
 *   createdAt: number;
 *   updatedAt: number;
 *   lastUpdatedBy: string;
 *   requestedBy: User;
 * }
 * ```
 */
export type User = string;

/**
 * Resolved display info for a platform user. Returned by `resolveUser()`
 * and `resolveUsers()`.
 */
export interface ResolvedUser {
  /** User ID. */
  id: string;
  /** Display name. */
  name: string;
  /** Email address, if available. */
  email?: string | null;
  /** Profile picture URL, if set. */
  profilePictureUrl?: string | null;
}

// ---------------------------------------------------------------------------
// Helper types (models, connectors, connections, cost estimates)
// ---------------------------------------------------------------------------

/** An AI model available on MindStudio. */
export interface MindStudioModel {
  id?: string;
  /** Display name of the model. */
  name?: string;
  /** One of: `llm_chat`, `image_generation`, `video_generation`, `video_analysis`, `text_to_speech`, `vision`, `transcription`. */
  type?: ModelType;
  maxTemperature?: number;
  maxResponseSize?: number;
  /** Accepted input types for this model (text, imageUrl, videoUrl, etc.). */
  inputs?: Record<string, unknown>[];
}

/** A lightweight AI model summary. */
export interface MindStudioModelSummary {
  id?: string;
  /** Display name of the model. */
  name?: string;
  /** One of: `llm_chat`, `image_generation`, `video_generation`, `video_analysis`, `text_to_speech`, `vision`, `transcription`. */
  type?: ModelType;
  /** Comma-separated tags for the model. */
  tags?: string;
}

/** Supported model type categories for filtering. */
export type ModelType =
  | 'llm_chat'
  | 'image_generation'
  | 'video_generation'
  | 'video_analysis'
  | 'text_to_speech'
  | 'vision'
  | 'transcription';

// ---------------------------------------------------------------------------
// App context types (auth & database metadata)
// ---------------------------------------------------------------------------

/** Role assignment for a user within an app. */
export interface AppRoleAssignment {
  userId: string;
  roleName: string;
}

/** Auth context for an app. */
export interface AppAuthContext {
  /** The authenticated user ID. */
  userId: string;
  /** All role assignments for this app (all users, all roles). */
  roleAssignments: AppRoleAssignment[];
}

/** Column schema for a managed database table. */
export interface AppDatabaseColumnSchema {
  name: string;
  type: 'text' | 'number' | 'boolean' | 'json' | 'user';
  required: boolean;
}

/** Table schema within a managed database. */
export interface AppDatabaseTable {
  name: string;
  schema: AppDatabaseColumnSchema[];
}

/** A managed SQLite database for an app. */
export interface AppDatabase {
  id: string;
  name: string;
  tables: AppDatabaseTable[];
}

/** Result of {@link MindStudioAgent.getAppContext}. */
export interface AppContextResult {
  auth: AppAuthContext;
  databases: AppDatabase[];
}

/** An OAuth connector service with its available actions. Third-party integration from the MindStudio Connector Registry. */
export interface ConnectorService {
  id?: string;
  /** Display name of the connector service. */
  name?: string;
  icon?: string;
  /** Available actions for this connector service. */
  actions?: {
    id?: string;
    /** Display name of the action. */
    name?: string;
  }[];
}

/** Full configuration details for an OAuth connector action. */
export interface ConnectorActionDetail {
  id?: string;
  /** Display name of the action. */
  name?: string;
  /** What this action does. */
  description?: string;
  /** Short usage guidance for the action. */
  quickHelp?: string;
  /** Input field groups required to call this action. */
  configuration?: {
    title?: string;
    items?: {
      label?: string;
      helpText?: string;
      /** The variable name to use when passing this input. */
      variable?: string;
      /** One of: `text`, `outputVariableName`, `select`. */
      type?: 'text' | 'outputVariableName' | 'select';
      defaultValue?: string;
      placeholder?: string;
      selectOptions?: {
        options?: {
          label?: string;
          value?: string;
        }[];
      };
    }[];
  }[];
}

/** An OAuth connection to a third-party service. */
export interface Connection {
  /** Connection ID. Pass this when executing connector actions. */
  id?: string;
  /** The integration provider (e.g., slack, google, github). */
  provider?: string;
  /** Display name or account identifier for the connection. */
  name?: string;
}

/** A single cost estimate entry for an action. */
export interface StepCostEstimateEntry {
  /** Billing event type identifier. */
  eventType?: string;
  /** Human-readable label for the cost. */
  label?: string;
  /** Price per unit in billing units (1/1,000,000,000th of a credit). */
  unitPrice?: number;
  /** What constitutes a unit (e.g. "token", "request"). */
  unitType?: string;
  /** Estimated total cost in billing units, or null if not estimable. */
  estimatedCost?: number;
  /** Number of billable units. */
  quantity?: number;
  /** Estimated latency based on recent global model metrics. null when no metrics are available. */
  latency?: unknown;
}

/** Result of {@link MindStudioAgent.uploadFile}. */
export interface UploadFileResult {
  /** Permanent public URL where the file is accessible. */
  url: string;
}

// ---------------------------------------------------------------------------
// Agent (pre-built app) types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Batch execution types
// ---------------------------------------------------------------------------

/** A single step in a batch request. */
export interface BatchStepInput {
  /** The step type to execute (e.g. "generateImage", "userMessage"). */
  stepType: string;
  /** Step configuration — same format as the single execute endpoint. */
  step: Record<string, unknown>;
}

/** Result for a single step in a batch response. */
export interface BatchStepResult {
  /** The step type that was executed. */
  stepType: string;
  /** Step output data. Present on success. */
  output?: Record<string, unknown>;
  /** Cost of this step in billing units. Present on success. */
  billingCost?: number;
  /** Error message. Present when this step failed. */
  error?: string;
}

/** Options for {@link MindStudioAgent.executeStepBatch}. */
export interface ExecuteStepBatchOptions {
  /** App ID to execute within. If omitted, a service account app is used. */
  appId?: string;
  /** Thread ID for state persistence. If omitted, an ephemeral thread is created. */
  threadId?: string;
}

/** Result of {@link MindStudioAgent.executeStepBatch}. */
export interface ExecuteStepBatchResult {
  /** Results in the same order as the input steps. */
  results: BatchStepResult[];
  /** Sum of billingCost across all successful steps. */
  totalBillingCost?: number;
  /** The app ID used for execution. */
  appId?: string;
  /** The thread ID used for execution. */
  threadId?: string;
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
