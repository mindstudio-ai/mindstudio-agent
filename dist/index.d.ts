/**
 * Access level of a file store. `private` (the default) → reads are signed /
 * session-authorized; `public` → world-readable, CDN-served on the app's own
 * domain (and resizable via image query params).
 */
type FileAccess = 'public' | 'private';
/** Options for {@link Store.put}. */
interface PutOptions {
    /**
     * Object key within the store (nested paths allowed, e.g. `reports/q1.pdf`).
     * Omit to auto-generate a UUID key (with `filename`'s extension, if given).
     */
    key?: string;
    /** MIME type stored on the object and returned on read. */
    contentType?: string;
    /** Original filename — used only to derive an extension when `key` is omitted. */
    filename?: string;
    /**
     * When true (and no explicit `key`), derive the key from a content hash
     * (`<sha256>.<ext>`) instead of a random UUID — immutable + idempotent, so
     * re-uploading identical bytes yields the same key/URL. Ideal for public
     * assets baked into source.
     */
    contentAddressed?: boolean;
}
/** Options for {@link Store.list}. */
interface ListOptions {
    /** Restrict to keys under this prefix (relative to the store). */
    prefix?: string;
    /** Pagination cursor from a previous page. */
    cursor?: string;
    /** Max objects per page. */
    limit?: number;
}
/** A stored object plus a ready-to-use URL. */
interface StoredFile {
    store: string;
    key: string;
    access: FileAccess;
    size?: number;
    contentType?: string;
    updatedAt?: string;
    /**
     * Stable, on-domain URL for the app's own frontend — drop straight into
     * `<img src>`, `fetch`, or `<a download>`. Relative (resolves against the
     * app's origin); a same-origin logged-in request authorizes automatically
     * via the app session, so there's nothing to await.
     */
    url: string;
    /**
     * Mint an ABSOLUTE, signed share URL that works with **no** active session —
     * email it, or embed it on another site. Expires (default 24h). Private
     * stores only.
     */
    shareUrl(options?: {
        expiresIn?: number;
    }): Promise<string>;
}
/**
 * A token for a client-direct upload, from {@link Store.createUploadToken}.
 * Return it from a backend method and pass it straight to the frontend's
 * `platform.upload(token, file)` — the browser then POSTs the file directly to
 * storage (no bytes through the platform).
 */
interface UploadToken {
    /** The object key the upload will land at (within the store). */
    key: string;
    /** The stable on-domain URL the file will be readable at once uploaded. */
    url: string;
    /** @internal The scoped presigned POST the frontend submits to. */
    upload: {
        url: string;
        fields: Record<string, string>;
    };
}
/** @internal Per-store upload policy carried from `defineStore`. */
interface StorePolicy {
    maxSize?: number;
    contentTypes?: string[];
}
/** @internal Transport: `POST /_internal/v2/files/<op>` with the hook token. */
type FilesTransport = (op: string, body: unknown) => Promise<any>;
/**
 * A typed handle to one named file store. Lazy — nothing executes until a
 * method is awaited, so it's safe to `defineStore()` at module scope and import
 * the handle into route handlers (same ergonomics as `db.defineTable`).
 */
declare class Store {
    private readonly _store;
    private readonly _access;
    private readonly _call;
    private readonly _policy;
    constructor(_store: string, _access: FileAccess, _call: FilesTransport, _policy?: StorePolicy);
    /** The store's name. */
    get name(): string;
    /** The store's access level. */
    get access(): FileAccess;
    /** Store bytes. Returns a {@link StoredFile} with a ready-to-use `url`. */
    put(content: Buffer | Uint8Array | string, options?: PutOptions): Promise<StoredFile>;
    /** Read an object's bytes (backend / trusted context). */
    get(key: string): Promise<Buffer>;
    /** Metadata without downloading. Rejects if the object doesn't exist. */
    head(key: string): Promise<StoredFile>;
    /** Whether an object exists. */
    exists(key: string): Promise<boolean>;
    /** List objects in the store (optionally under `prefix`), one page at a time. */
    list(options?: ListOptions): Promise<{
        files: StoredFile[];
        cursor?: string;
    }>;
    /** Delete an object. No-op if it doesn't exist. */
    delete(key: string): Promise<void>;
    /**
     * Mint an ABSOLUTE, signed share URL for a key — works with **no** active
     * session (email it, or embed it on another site). Expires (default 24h).
     * Private stores only.
     *
     * The same link is available as `file.shareUrl()` on a {@link StoredFile};
     * this convenience skips the `head()` when you already hold just the key.
     */
    shareUrl(key: string, options?: {
        expiresIn?: number;
    }): Promise<string>;
    /**
     * Mint an {@link UploadToken} for a **client-direct** upload — the browser
     * POSTs the file straight to storage, so the bytes never pass through the
     * platform. Return the token from a backend method and hand it to the
     * frontend's `platform.upload(token, file)`. Works for private + public stores.
     *
     * Enforced at upload time by the presigned POST: a max size (this call's
     * `maxSize`, else the store's, else the platform default) and — when
     * `contentType` is set — an exact content-type match. When the store declares
     * `contentTypes`, `contentType` must be one of them.
     *
     * Note: a presigned POST can pin exactly ONE content-type per token, so the
     * *allowlist* is declared on `defineStore({ contentTypes })` and each token
     * pins one type from it. This is by design, not a per-token limitation.
     *
     * @example
     * ```ts
     * // backend method
     * export async function getUploadSlot(input: { contentType: string }) {
     *   return Uploads.createUploadToken({ contentType: input.contentType, maxSize: 50 * 1024 * 1024 });
     * }
     * ```
     */
    createUploadToken(options?: {
        key?: string;
        contentType?: string;
        filename?: string;
        maxSize?: number;
        expiresIn?: number;
    }): Promise<UploadToken>;
    private _toFile;
}

/** Configuration options for creating a {@link MindStudioAgent}. */
interface AgentOptions {
    /**
     * MindStudio API key. Used as a Bearer token for authentication.
     *
     * Note: `CALLBACK_TOKEN` (auto-set inside MindStudio) always takes
     * priority over all other auth sources when present.
     *
     * If omitted (and no CALLBACK_TOKEN), the SDK checks (in order):
     * 1. `MINDSTUDIO_API_KEY` environment variable
     * 2. `~/.mindstudio/config.json` (set via `mindstudio login`)
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
/** A debug log event emitted during streaming step execution. */
interface StepLogEvent {
    /** Log message text. */
    value: string;
    /** Step display name, e.g. "Generate Image", "Scrape URL". */
    tag: string;
    /** Unix timestamp in milliseconds. */
    ts: number;
}
/** Options for a single step execution call. */
interface StepExecutionOptions {
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
    /**
     * Called for each debug log event during step execution. When set, the SDK
     * uses SSE streaming to receive real-time progress updates from the API.
     * When omitted, the endpoint returns a single JSON response as before.
     *
     * Log content and frequency varies by step type — image generation emits
     * 2-3 logs, scrape steps emit per-URL progress, LLM steps may emit model
     * selection and token info.
     */
    onLog?: (event: StepLogEvent) => void;
    /**
     * Send any asset this step generates to one of the app's own file stores
     * instead of the shared public MindStudio CDN.
     *
     * **Optional — the default is fine for most cases.** Omit it and generated
     * assets keep going to the public CDN, exactly as before. Reach for it when
     * the asset is user-specific, should be private, or belongs alongside the
     * app's other files (where it shows up in the app's Files dashboard).
     *
     * The store's `access` comes from its `defineStore()`, so a private store
     * yields a private asset — the returned URL is an on-domain
     * `/_/files/private/...` link that only an authorized session can load,
     * rather than a permanent public one.
     *
     * v2 apps only.
     *
     * @example
     * ```ts
     * const Photos = files.defineStore('product-photos', { access: 'public' });
     *
     * const { imageUrl } = await agent.generateImage(
     *   { prompt: 'a red sneaker on concrete' },
     *   { store: Photos },
     * );
     * ```
     */
    store?: Store;
    /**
     * @internal Usage-metrics attribution label for this call (e.g. `v2-task`
     * for task-agent tool calls). Analytics-only. Overrides the instance-level
     * source when set.
     */
    requestSource?: string;
}
/** Execution metadata returned alongside every step result. */
interface StepExecutionMeta {
    /** The app ID used for this execution. Pass to subsequent calls to reuse. */
    $appId: string;
    /** The thread ID used for this execution. Pass to subsequent calls to maintain state. */
    $threadId: string;
    /**
     * Number of API calls remaining in the current rate limit window.
     * Useful for throttling proactively before hitting the limit.
     */
    $rateLimitRemaining?: number;
    /**
     * Cost of this step execution in nanodollars (1/1,000,000,000th of a US
     * dollar). Divide by 1e9 to get USD — e.g. `40000000` = $0.04.
     */
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
type StepExecutionResult<TOutput = Record<string, unknown>> = TOutput & StepExecutionMeta;
/** Information about a pre-built agent in the organization. */
interface AgentInfo {
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
interface ListAgentsResult {
    /** Organization UUID. */
    orgId: string;
    /** Organization display name. */
    orgName: string;
    /** Agents in the organization. */
    apps: AgentInfo[];
}
/** Result of {@link MindStudioAgent.getUserInfo}. */
interface UserInfoResult {
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
type User = string;
/**
 * Resolved display info for a platform user. Returned by `resolveUser()`
 * and `resolveUsers()`.
 */
interface ResolvedUser {
    /** User ID. */
    id: string;
    /** Display name. */
    name: string;
    /** Email address, if available. */
    email?: string | null;
    /** Profile picture URL, if set. */
    profilePictureUrl?: string | null;
}
/** Input for {@link MindStudioAgent.reportIssue}. */
interface ReportIssueInput {
    /** Short summary. Required, non-empty, ≤ 300 chars (trimmed server-side). */
    title: string;
    /** Longer description. Optional, ≤ 10,000 chars. Defaults to `""`. */
    body?: string;
    /** Report kind. Defaults to `"bug"`. */
    kind?: 'bug' | 'idea';
    /**
     * Free-form label for who reported it — a name, email, or ticket id.
     * ≤ 200 chars. Display-only; NOT an identity check and NOT tied to a user.
     * Omit for an anonymous report.
     */
    reporter?: string;
}
/** A filed issue, returned by {@link MindStudioAgent.reportIssue}. */
interface ReportedIssue {
    id: string;
    /** Friendly per-app number — show the user "Reported as #42". */
    number: number;
    title: string;
    body: string;
    kind: 'bug' | 'idea';
    status: 'open';
    /** `"sdk"` for in-app reports filed through this method. */
    authorKind: 'sdk';
    authorUserId: string | null;
    /** Echoes the `reporter` that was sent, or null. */
    reporter: string | null;
    /** ISO-8601. */
    createdAt: string;
    /** ISO-8601. */
    updatedAt: string;
    closedAt: string | null;
}
/** An AI model available on MindStudio. */
interface MindStudioModel {
    id?: string;
    /** Display name of the model. */
    name?: string;
    /** See `ModelType` for the full set. */
    type?: ModelType;
    maxTemperature?: number;
    maxResponseSize?: number;
    /** Accepted input types for this model (text, imageUrl, videoUrl, etc.). */
    inputs?: Record<string, unknown>[];
}
/** A lightweight AI model summary. */
interface MindStudioModelSummary {
    id?: string;
    /** Display name of the model. */
    name?: string;
    /** See `ModelType` for the full set. */
    type?: ModelType;
    /** Comma-separated tags for the model. */
    tags?: string;
}
/**
 * Supported model type categories for filtering.
 *
 * `embedding`, `reranking` and `document_extraction` have no SDK step — the
 * data-source pipeline chooses those platform-side and reports the result on
 * `pipeline.embeddingModelId`. They are listed so the catalog can be queried
 * and described, not so they can be passed to a generate call.
 */
type ModelType = 'llm_chat' | 'image_generation' | '3d_generation' | 'video_generation' | 'video_analysis' | 'text_to_speech' | 'music_generation' | 'lipsync' | 'vision' | 'transcription' | 'embedding' | 'reranking' | 'document_extraction';
/** Role assignment for a user within an app. */
interface AppRoleAssignment {
    userId: string;
    roleName: string;
}
/** Auth context for an app. */
interface AppAuthContext {
    /** The authenticated user ID, or null for unauthenticated users. */
    userId: string | null;
    /** All role assignments for this app (all users, all roles). */
    roleAssignments: AppRoleAssignment[];
}
/** Column schema for a managed database table. */
interface AppDatabaseColumnSchema {
    name: string;
    type: 'text' | 'number' | 'boolean' | 'json' | 'user';
    required: boolean;
}
/** Table schema within a managed database. */
interface AppDatabaseTable {
    name: string;
    schema: AppDatabaseColumnSchema[];
}
/** A managed SQLite database for an app. */
interface AppDatabase {
    id: string;
    name: string;
    tables: AppDatabaseTable[];
}
/** Result of {@link MindStudioAgent.getAppContext}. */
interface AppContextResult {
    auth: AppAuthContext;
    databases: AppDatabase[];
    authConfig?: AuthTableConfig;
}
/** Auth table config from the app manifest. Tells the SDK which table/columns are platform-managed. */
interface AuthTableConfig {
    table: string;
    columns: {
        email?: string;
        phone?: string;
        roles?: string;
    };
}
/** An OAuth connector service with its available actions. Third-party integration from the MindStudio Connector Registry. */
interface ConnectorService {
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
interface ConnectorActionDetail {
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
interface Connection {
    /** Connection ID. Pass this when executing connector actions. */
    id?: string;
    /** The integration provider (e.g., slack, google, github). */
    provider?: string;
    /** Display name or account identifier for the connection. */
    name?: string;
}
interface PackagedWorkflowInput {
    /** Variable key for this input */
    key: string;
    /** Display name of the input */
    name: string;
    /** Description of what this input is for */
    description: string;
    /** Placeholder text shown in the input field */
    placeholder: string;
    /** Whether this input must be provided */
    required: boolean;
    /** Default value if the input is not provided */
    defaultValue?: string;
    /** Input field type */
    type: 'text' | 'select' | 'transition';
    /** Settings for text-type inputs */
    textSettings?: {
        /** Text input format */
        type: 'default' | 'markdown';
    };
    /** Settings for select-type inputs */
    selectSettings?: {
        /** Available options for the select input */
        options: {
            /** Option value */
            value: string;
            /** Option display label */
            label: string;
        }[];
    };
}
interface PackagedWorkflowSignature {
    /** Metadata about the packaged workflow */
    metadata: {
        /** Display name of the packaged workflow */
        name: string;
        /** Description of what the packaged workflow does */
        description: string;
        /** Icon URL for the packaged workflow */
        iconUrl: string;
        /** Quick help text for users */
        quickHelp: string;
        /** Transition type for the packaged workflow */
        transitionType?: 'controlled' | 'dynamic';
    };
    /** Input parameters the packaged workflow accepts */
    inputs: PackagedWorkflowInput[];
    /** Output variables the packaged workflow returns */
    outputs: {
        /** Output variable key */
        key: string;
        /** Display name of the output */
        name: string;
        /** Description of the output */
        description: string;
        /** Data type of the output */
        type: string;
    }[];
}
interface PackagedWorkflow {
    appId: string;
    workflowId: string;
    appShortId: string;
    workflowName: string;
    signature: PackagedWorkflowSignature;
}
/** A single cost estimate entry for an action. */
interface StepCostEstimateEntry {
    /** Billing event type identifier. */
    eventType?: string;
    /** Human-readable label for the cost. */
    label?: string;
    /** Price per unit in nanodollars (1/1,000,000,000th of a US dollar). */
    unitPrice?: number;
    /** What constitutes a unit (e.g. "token", "request"). */
    unitType?: string;
    /** Estimated total cost in nanodollars (divide by 1e9 for USD), or null if not estimable. */
    estimatedCost?: number;
    /** Number of billable units. */
    quantity?: number;
    /** Estimated latency based on recent global model metrics. null when no metrics are available. */
    latency?: unknown;
}
/** Result of {@link MindStudioAgent.uploadFile}. */
interface UploadFileResult {
    /** Permanent public URL where the file is accessible. */
    url: string;
}
/** Options for {@link MindStudioAgent.runAgent}. */
interface RunAgentOptions {
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
/** A single step in a batch request. */
interface BatchStepInput {
    /** The step type to execute (e.g. "generateImage", "userMessage"). */
    stepType: string;
    /** Step configuration — same format as the single execute endpoint. */
    step: Record<string, unknown>;
}
/** Result for a single step in a batch response. */
interface BatchStepResult {
    /** The step type that was executed. */
    stepType: string;
    /** Step output data. Present on success. */
    output?: Record<string, unknown>;
    /** Cost of this step in nanodollars (divide by 1e9 for USD). Present on success. */
    billingCost?: number;
    /** Error message. Present when this step failed. */
    error?: string;
}
/** Options for {@link MindStudioAgent.executeStepBatch}. */
interface ExecuteStepBatchOptions {
    /** App ID to execute within. If omitted, a service account app is used. */
    appId?: string;
    /** Thread ID for state persistence. If omitted, an ephemeral thread is created. */
    threadId?: string;
    /** Progress callback, called on each poll while the batch is running. */
    onProgress?: (completedSteps: number, totalSteps: number) => void;
    /**
     * Send assets generated by any step in this batch to one of the app's own
     * file stores instead of the shared public MindStudio CDN. Optional; applies
     * to every step in the batch. See {@link StepExecutionOptions.store}.
     */
    store?: Store;
}
/** Result of {@link MindStudioAgent.executeStepBatch}. */
interface ExecuteStepBatchResult {
    /** Results in the same order as the input steps. */
    results: BatchStepResult[];
    /** Sum of billingCost across all successful steps, in nanodollars. */
    totalBillingCost?: number;
    /** The app ID used for execution. */
    appId?: string;
    /** The thread ID used for execution. */
    threadId?: string;
}
/** Result of a successful agent run. */
interface RunAgentResult {
    /** Whether the run succeeded. */
    success: boolean;
    /** Thread ID for the run. */
    threadId: string;
    /** The result content (last system message). */
    result: string;
    /** Thread messages, if returned. */
    thread?: unknown;
    /** Cost in nanodollars (divide by 1e9 for USD), if `includeBillingCost` was set. */
    billingCost?: number;
}

type AuthType = 'internal' | 'apiKey';
declare class RateLimiter {
    readonly authType: AuthType;
    private inflight;
    private concurrencyLimit;
    private callCount;
    private callCap;
    private queue;
    constructor(authType: AuthType);
    /** Acquire a slot. Resolves when a concurrent slot is available. */
    acquire(): Promise<void>;
    /** Release a slot and let the next queued request proceed. */
    release(): void;
    /** Update limits from response headers. */
    updateFromHeaders(headers: Headers): void;
    /** Read current rate limit state from response headers. */
    static parseHeaders(headers: Headers): {
        remaining: number | undefined;
        concurrencyRemaining: number | undefined;
    };
}

interface HttpClientConfig {
    baseUrl: string;
    token: string;
    rateLimiter: RateLimiter;
    maxRetries: number;
}

/**
 * Auth namespace — role-based access control for MindStudio apps.
 *
 * Provides synchronous access to the current user's identity and roles
 * within an app. Hydrated once from app context (either sandbox globals
 * or the `GET /helpers/app-context` endpoint), then all access is sync.
 *
 * ## How it works
 *
 * 1. The platform stores role assignments per app: `{ userId, roleName }[]`
 * 2. On context hydration, the full role map is loaded into memory
 * 3. `auth.hasRole()` / `auth.requireRole()` are simple array lookups
 * 4. `auth.getUsersByRole()` scans the preloaded assignments
 *
 * ## Usage
 *
 * ```ts
 * import { auth, Roles } from '@mindstudio-ai/agent';
 *
 * // Check permissions
 * if (auth.hasRole(Roles.admin, Roles.approver)) {
 *   // user has at least one of these roles
 * }
 *
 * // Gate a route — throws 403 if user lacks the role
 * auth.requireRole(Roles.admin);
 *
 * // Look up who has a role
 * const admins = auth.getUsersByRole(Roles.admin);
 * ```
 *
 * ## Roles proxy
 *
 * `Roles` is a convenience proxy: `Roles.admin` === `"admin"`. It provides
 * discoverability and typo prevention. In the future, the compilation
 * pipeline will generate a typed `Roles` object from `app.json`, giving
 * compile-time safety. For now, any string property access works.
 */

/**
 * Auth context for the current execution. Created from the app's role
 * assignments and the current user's identity.
 *
 * All methods are synchronous — the full role map is preloaded at
 * context hydration time.
 */
declare class AuthContext {
    /** The current user's ID, or null for unauthenticated users. */
    readonly userId: string | null;
    /** The current user's roles in this app. */
    readonly roles: readonly string[];
    /** All role assignments for this app (all users, all roles). */
    private readonly _roleAssignments;
    constructor(ctx: AppAuthContext);
    /**
     * Check if the current user has **any** of the given roles.
     * Returns true if at least one matches.
     *
     * @example
     * ```ts
     * if (auth.hasRole(Roles.admin, Roles.approver)) {
     *   // user is an admin OR an approver
     * }
     * ```
     */
    hasRole(...roles: string[]): boolean;
    /**
     * Require the current user to have at least one of the given roles.
     * Throws a `MindStudioError` with code `'forbidden'` and status 403
     * if the user lacks all of the specified roles.
     *
     * Use this at the top of route handlers to gate access.
     *
     * @example
     * ```ts
     * auth.requireRole(Roles.admin);
     * // code below only runs if user is an admin
     * ```
     */
    requireRole(...roles: string[]): void;
    /**
     * Get all user IDs that have the given role in this app.
     * Synchronous — scans the preloaded role assignments.
     *
     * @example
     * ```ts
     * const reviewers = auth.getUsersByRole(Roles.reviewer);
     * // ['user-id-1', 'user-id-2', ...]
     * ```
     */
    getUsersByRole(role: string): string[];
}
/**
 * Convenience proxy for referencing role names. Any property access
 * returns the property name as a string: `Roles.admin === "admin"`.
 *
 * This provides:
 * - Discoverability via autocomplete (in typed environments)
 * - Typo prevention (vs raw string literals)
 * - Forward compatibility with the future typed Roles generation
 *
 * In the future, the compilation pipeline will generate a typed `Roles`
 * object from `app.json` roles, replacing this proxy with compile-time
 * checked constants.
 *
 * @example
 * ```ts
 * Roles.admin      // "admin"
 * Roles.approver   // "approver"
 * Roles.anything   // "anything" (no runtime error, any string works)
 * ```
 */
declare const Roles: Record<string, string>;

/**
 * Internal type definitions for the `db` namespace.
 *
 * These types power the chainable collection API over MindStudio's managed
 * SQLite databases. They're used internally by Table, Query, and the
 * predicate compiler — most are also re-exported from the package for
 * consumers who need them in type annotations.
 *
 * Key concepts:
 * - **SystemFields**: columns managed by the platform (id, timestamps, audit).
 *   Stripped from write inputs automatically.
 * - **Predicate / Accessor**: callback shapes used in filter(), sortBy(), etc.
 *   Predicates are compiled to SQL WHERE clauses when possible, with a JS
 *   fallback for complex expressions.
 * - **TableConfig**: runtime binding between a Table instance and the
 *   underlying queryAppDatabase step execution.
 */

/**
 * Names of columns that the platform manages automatically.
 *
 * - `id`: UUID primary key, generated on INSERT
 * - `created_at`: unix timestamp (ms), set on INSERT
 * - `updated_at`: unix timestamp (ms), set on INSERT and every UPDATE
 * - `last_updated_by`: reference to the run ID that last wrote this row
 *
 * Both snake_case (platform convention) and camelCase (legacy) are
 * stripped to support either naming convention in table interfaces.
 */
type SystemFields = 'id' | 'created_at' | 'createdAt' | 'updated_at' | 'updatedAt' | 'last_updated_by' | 'lastUpdatedBy';
/**
 * System columns added to every row on read. This is the concrete shape
 * of the platform-managed columns — used to augment user-defined interfaces
 * so reads include id, timestamps, etc. regardless of whether the user
 * declared them.
 */
interface SystemColumns {
    id: string;
    created_at: number;
    updated_at: number;
    last_updated_by: string;
}
/**
 * Input type for `Table.push()`. Excludes system-managed fields.
 * Optional fields in T remain optional.
 *
 * @example
 * ```ts
 * // If Order has { item: string; amount: number }
 * // then PushInput<Order> is { item: string; amount: number }
 * // (system fields like id, created_at are not required)
 * ```
 */
type PushInput<T> = Omit<T, SystemFields>;
/**
 * Input type for `Table.update()`. Excludes system-managed fields,
 * and all remaining fields are optional (partial update).
 */
type UpdateInput<T> = Partial<Omit<T, SystemFields>>;
/**
 * A predicate function for filtering rows. Receives a typed row and
 * returns a boolean.
 *
 * The SDK attempts to compile the predicate to a SQL WHERE clause for
 * performance. Simple expressions (field comparisons, &&/||, .includes())
 * compile to efficient SQL. If the predicate can't be compiled (function
 * calls, regex, computed expressions), the SDK falls back to fetching all
 * rows and evaluating in JS. Both paths produce identical results.
 *
 * For predicates that compare to outer-scope values (e.g.
 * `o => o.companyId === input.companyId`), prefer the explicit-bindings
 * form so the filter compiles to SQL instead of falling back to JS:
 *
 * ```ts
 * Investments.filter(
 *   (i, $) => i.companyId === $.companyId,
 *   { companyId: input.companyId },
 * )
 * ```
 */
type Predicate<T> = (row: T, bindings?: any) => boolean;
/**
 * Bindings for an explicit-bindings predicate — a plain object of named
 * scalar values referenced via the predicate's second parameter.
 *
 * @example
 * ```ts
 * const bindings: PredicateBindings = { companyId: 'abc', minAmount: 1000 };
 * Investments.filter((i, $) => i.companyId === $.companyId && i.amount >= $.minAmount, bindings);
 * ```
 */
type PredicateBindings = Record<string, unknown>;
/**
 * A field accessor function used by sortBy(), min(), max(), groupBy().
 * Receives a typed row and returns the value to sort/aggregate by.
 *
 * @example
 * ```ts
 * .sortBy(o => o.createdAt)      // sort by createdAt
 * .min(o => o.amount)            // row with smallest amount
 * .groupBy(o => o.status)        // group rows by status
 * ```
 */
type Accessor<T, R = unknown> = (row: T) => R;
/**
 * Runtime configuration for a Table instance. Created by `createDb()` when
 * `defineTable()` is called. Contains everything the Table needs to execute
 * queries against the correct database.
 */
interface TableConfig {
    /** The managed database ID (from app context metadata). */
    databaseId: string;
    /** The SQL table name (as declared in defineTable). */
    tableName: string;
    /**
     * Column schema from app context. Used to identify user-type columns
     * (which need @@user@@ prefix handling) and for validation.
     */
    columns: AppDatabaseColumnSchema[];
    /**
     * Unique constraints declared via defineTable options.
     * Each entry is an array of column names that form a unique constraint.
     * e.g. [['email'], ['userId', 'orgId']]
     */
    unique?: string[][];
    /**
     * Default values for columns, applied client-side in push() and upsert().
     * Explicit values in the input override defaults.
     */
    defaults?: Record<string, unknown>;
    /**
     * Platform-managed auth columns. Set when this table is the app's auth
     * table. Writes to email/phone/apiKey columns throw; roles writes are allowed.
     */
    managedColumns?: {
        email?: string;
        phone?: string;
        roles?: string;
        apiKey?: string;
    };
    /**
     * Sync role changes to the platform after a successful auth table write.
     * Fire-and-forget: failures are caught and logged internally.
     * @internal Provided by the agent instance; has closure over HTTP config.
     */
    syncRoles?: (userId: string, roles: unknown) => Promise<void>;
    /**
     * Execute one or more SQL queries against the managed database in a
     * single round trip. All queries run on the same SQLite connection,
     * enabling RETURNING clauses and multi-statement batches.
     *
     * Bound to the `POST /_internal/v2/db/query` endpoint at creation time.
     *
     * @param queries - Array of SQL queries with optional bind params
     * @returns Array of results in the same order as the input queries
     */
    executeBatch: (queries: SqlQuery[]) => Promise<SqlResult[]>;
}
/** A single SQL query with optional positional bind params. */
interface SqlQuery {
    sql: string;
    params?: unknown[];
}
/** Result of a single SQL query execution. */
interface SqlResult {
    rows: unknown[];
    changes: number;
}
/**
 * A predicate paired with its bindings. Stored internally on Query so that
 * each filter call's bindings travel with its predicate through the chain.
 * @internal
 */
interface PredicateEntry<T> {
    fn: Predicate<T>;
    bindings?: PredicateBindings;
}

/**
 * Query chain builder — lazy, immutable query construction for database reads.
 *
 * A Query<T> represents a pending database query. It accumulates operations
 * (filter, sort, limit, skip) without executing anything. Execution happens
 * only when the query is awaited (via PromiseLike) or a terminal method
 * is called (first, last, count, some, every, min, max, groupBy).
 *
 * ## Immutability
 *
 * Every chain method returns a NEW Query instance. This means chains can
 * safely fork:
 *
 * ```ts
 * const base = Orders.filter(o => o.status === 'active');
 * const recent = base.sortBy(o => o.createdAt).reverse().take(10);
 * const count = await base.count();  // doesn't affect `recent`
 * ```
 *
 * ## Execution strategy (SQL fast path vs JS fallback)
 *
 * When a Query is executed, it attempts to compile all predicates to SQL:
 *
 * - **Fast path**: All predicates compile → single SQL query with WHERE,
 *   ORDER BY, LIMIT, OFFSET. Efficient, minimal data transfer.
 *
 * - **Fallback path**: Any predicate fails to compile → fetch ALL rows
 *   from the table (SELECT *), then apply the entire chain as native JS
 *   array operations (Array.filter, Array.sort, Array.slice, etc.).
 *   A warning is logged so developers can optimize if needed.
 *
 * Both paths produce identical results. The SQL path is a transparent
 * performance optimization.
 */

declare class Query<T, TResult = T[]> implements PromiseLike<TResult> {
    private readonly _predicates;
    private readonly _sortAccessor;
    private readonly _reversed;
    private readonly _limit;
    private readonly _offset;
    private readonly _config;
    /** @internal Pre-compiled WHERE clause (bypasses predicate compiler). Used by Table.get(). */
    private readonly _rawWhere;
    private readonly _rawWhereParams;
    /** @internal Post-process transform applied after row deserialization. */
    readonly _postProcess: ((rows: T[]) => TResult) | undefined;
    constructor(config: TableConfig, options?: {
        predicates?: PredicateEntry<T>[];
        sortAccessor?: Accessor<T>;
        reversed?: boolean;
        limit?: number;
        offset?: number;
        postProcess?: (rows: T[]) => TResult;
        rawWhere?: string;
        rawWhereParams?: unknown[];
    });
    private _clone;
    filter(predicate: Predicate<T>): Query<T>;
    filter<B extends PredicateBindings>(predicate: (row: T, bindings: B) => boolean, bindings: B): Query<T>;
    sortBy(accessor: Accessor<T>): Query<T>;
    reverse(): Query<T>;
    take(n: number): Query<T>;
    skip(n: number): Query<T>;
    first(): Query<T, T | null>;
    last(): Query<T, T | null>;
    count(): Query<T, number>;
    some(): Query<T, boolean>;
    every(): Promise<boolean>;
    min(accessor: Accessor<T, number>): Query<T, T | null>;
    max(accessor: Accessor<T, number>): Query<T, T | null>;
    groupBy<K extends string | number>(accessor: Accessor<T, K>): Query<T, Map<K, T[]>>;
    /**
     * @internal Compile this query into a SqlQuery for batch execution.
     *
     * Returns the compiled SQL query (if all predicates compile to SQL),
     * or null (if JS fallback is needed). In the fallback case, a bare
     * `SELECT *` is returned as `fallbackQuery` so the batch can fetch
     * all rows and this query can filter them in JS post-fetch.
     */
    _compile(): CompiledQuery<T, TResult>;
    /**
     * @internal Process raw SQL results into typed rows. Used by db.batch()
     * after executing the compiled query.
     *
     * For SQL-compiled queries: just deserialize the rows.
     * For JS-fallback queries: filter, sort, and slice in JS.
     */
    static _processResults<T, R = T[]>(result: SqlResult, compiled: CompiledQuery<T, R>): R;
    then<TResult1 = TResult, TResult2 = never>(onfulfilled?: ((value: TResult) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null): Promise<TResult1 | TResult2>;
    catch<TResult2 = never>(onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null): Promise<TResult | TResult2>;
    private _execute;
    private _compilePredicates;
    private _fetchAndFilterInJs;
    private _fetchAllRows;
}
/**
 * Result of Query._compile(). Contains either a compiled SQL query
 * (fast path) or a fallback SELECT * with JS processing metadata.
 */
interface CompiledQuery<T, TResult = T[]> {
    type: 'query';
    /** Compiled SQL query, or null if JS fallback needed. */
    query: SqlQuery | null;
    /** SELECT * fallback query, or null if SQL compiled. */
    fallbackQuery: SqlQuery | null;
    /** Table config for deserialization. */
    config: TableConfig;
    /** JS predicates (only for fallback). */
    predicates?: PredicateEntry<T>[];
    /** Sort accessor (only for fallback). */
    sortAccessor?: Accessor<T>;
    /** Sort direction (only for fallback). */
    reversed?: boolean;
    /** Limit (only for fallback). */
    limit?: number;
    /** Offset (only for fallback). */
    offset?: number;
    /** Post-process transform (e.g. first() extracts [0] ?? null). */
    postProcess?: (rows: T[]) => TResult;
}

/**
 * Mutation<T> — a lazy write operation backed by SQLite.
 *
 * Created by Table write methods (push, update, remove, removeAll, clear).
 * Like Query, implements PromiseLike so `await` triggers execution. Unlike
 * Query, there's no chaining — a Mutation is a fixed set of SQL statements
 * with a result processor.
 *
 * ## Batch support
 *
 * `db.batch()` calls `_compile()` to extract the SQL without executing,
 * then bundles it with other operations into a single round trip. After
 * execution, `_processResults()` deserializes the raw SQL results.
 *
 * ## Non-batchable mutations
 *
 * Some mutations (e.g. `removeAll` with a JS-fallback predicate) require
 * multi-step execution that can't be expressed as a fixed SQL batch.
 * These are created via `Mutation.fromExecutor()` and work fine when
 * awaited standalone, but throw if passed to `db.batch()`.
 */

interface CompiledMutation<TResult> {
    type: 'mutation';
    queries: SqlQuery[];
    config: TableConfig;
    processResult: (results: SqlResult[]) => TResult;
}
declare class Mutation<TResult> implements PromiseLike<TResult> {
    /** @internal */
    private readonly _config;
    /** @internal */
    private readonly _queries;
    /** @internal */
    private readonly _processResult;
    /** @internal Non-batchable executor for complex mutations (e.g. removeAll JS fallback). */
    private readonly _executor;
    constructor(config: TableConfig, queries: SqlQuery[], processResult: (results: SqlResult[]) => TResult);
    /**
     * Create a non-batchable mutation that wraps an async executor.
     * Used for operations that require multi-step execution (e.g. removeAll
     * with a JS-fallback predicate: fetch all rows → filter → delete).
     *
     * Works fine when awaited standalone. Throws if passed to db.batch().
     *
     * @internal
     */
    static fromExecutor<T>(config: TableConfig, executor: () => Promise<T>): Mutation<T>;
    then<T1 = TResult, T2 = never>(onfulfilled?: ((value: TResult) => T1 | PromiseLike<T1>) | null, onrejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null): Promise<T1 | T2>;
    catch<T2 = never>(onrejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null): Promise<TResult | T2>;
    /**
     * @internal Compile this mutation into SQL for batch execution.
     * Returns the queries and a result processor.
     *
     * Throws if this is a non-batchable mutation (created via fromExecutor).
     */
    _compile(): CompiledMutation<TResult>;
    /**
     * @internal Process raw SQL results into the typed result.
     * Used by db.batch() after executing the compiled queries.
     */
    static _processResults<T>(results: SqlResult[], compiled: CompiledMutation<T>): T;
    private _execute;
}

/**
 * Table<T> — a typed persistent collection backed by SQLite.
 *
 * Created via `db.defineTable<T>(name)`. Every method either returns a
 * chainable Query<T> (for lazy reads), a Mutation<T> (for lazy writes),
 * or a Promise (for terminal reads).
 *
 * ## Write operations use RETURNING
 *
 * INSERT and UPDATE use `RETURNING *` to get the created/updated row
 * back in a single round trip — no separate SELECT needed. This is
 * executed via the batch endpoint which runs all queries on a single
 * SQLite connection.
 */

declare class Table<T> {
    /** @internal */
    private readonly _config;
    constructor(config: TableConfig);
    /** Get a single row by ID. Returns null if not found. */
    get(id: string): Query<T, T | null>;
    /** Find the first row matching a predicate. Returns null if none match. */
    findOne(predicate: Predicate<T>): Query<T, T | null>;
    findOne<B extends PredicateBindings>(predicate: (row: T, bindings: B) => boolean, bindings: B): Query<T, T | null>;
    /** Count all rows, or rows matching a predicate. */
    count(): Query<T, number>;
    count(predicate: Predicate<T>): Query<T, number>;
    count<B extends PredicateBindings>(predicate: (row: T, bindings: B) => boolean, bindings: B): Query<T, number>;
    /** True if any row matches the predicate. */
    some(predicate: Predicate<T>): Query<T, boolean>;
    some<B extends PredicateBindings>(predicate: (row: T, bindings: B) => boolean, bindings: B): Query<T, boolean>;
    /** True if all rows match the predicate. */
    every(predicate: Predicate<T>): Promise<boolean>;
    every<B extends PredicateBindings>(predicate: (row: T, bindings: B) => boolean, bindings: B): Promise<boolean>;
    /** True if the table has zero rows. */
    isEmpty(): Promise<boolean>;
    /** Row with the minimum value for a field, or null if table is empty. */
    min(accessor: Accessor<T, number>): Query<T, T | null>;
    /** Row with the maximum value for a field, or null if table is empty. */
    max(accessor: Accessor<T, number>): Query<T, T | null>;
    /** Group rows by a field. Returns a Map. */
    groupBy<K extends string | number>(accessor: Accessor<T, K>): Query<T, Map<K, T[]>>;
    /** Get all rows as an array. */
    toArray(): Query<T>;
    /** Filter rows by a predicate. Returns a chainable Query. */
    filter(predicate: Predicate<T>): Query<T>;
    filter<B extends PredicateBindings>(predicate: (row: T, bindings: B) => boolean, bindings: B): Query<T>;
    /** Sort rows by a field. Returns a chainable Query. */
    sortBy(accessor: Accessor<T>): Query<T>;
    /**
     * Insert one or more rows. Returns the created row(s) with system fields
     * populated (id, createdAt, updatedAt, lastUpdatedBy).
     *
     * Uses `INSERT ... RETURNING *` so the created row comes back in a
     * single round trip — no separate SELECT needed.
     */
    push(data: PushInput<T>): Mutation<T>;
    push(data: PushInput<T>[]): Mutation<T[]>;
    /**
     * Update a row by ID. Only the provided fields are changed.
     * Returns the updated row via `UPDATE ... RETURNING *`.
     */
    update(id: string, data: UpdateInput<T>): Mutation<T>;
    remove(id: string): Mutation<{
        deleted: boolean;
    }>;
    /**
     * Remove all rows matching a predicate. Returns the count removed.
     */
    removeAll(predicate: Predicate<T>): Mutation<number>;
    removeAll<B extends PredicateBindings>(predicate: (row: T, bindings: B) => boolean, bindings: B): Mutation<number>;
    clear(): Mutation<number>;
    /**
     * Insert a row, or update it if a row with the same unique key already
     * exists. The conflict key must match a `unique` constraint declared in
     * defineTable options. Returns the created or updated row.
     *
     * Uses SQLite's `INSERT ... ON CONFLICT ... DO UPDATE SET ... RETURNING *`.
     *
     * @param conflictKey - Column name(s) that form the unique constraint.
     *   Pass a single string for single-column unique, or an array for compound.
     * @param data - Row data to insert (or update on conflict). Defaults apply.
     */
    upsert(conflictKey: (keyof Omit<T, SystemFields> & string) | (keyof Omit<T, SystemFields> & string)[], data: PushInput<T>): Mutation<T>;
    /** @internal Throw if data includes a platform-managed read-only column. */
    private _checkManagedColumns;
    /**
     * @internal Fire role sync for rows that wrote to the roles column.
     * Called inside processResult (runs after SQL execution in both
     * standalone and batch paths). Fire-and-forget.
     */
    private _syncRolesIfNeeded;
    /** @internal Validate that the given columns match a declared unique constraint. */
    private _validateUniqueConstraint;
}

/**
 * The `db` namespace — factory and time helpers for MindStudio managed databases.
 *
 * This module provides `createDb()`, which builds the `Db` object that users
 * interact with. The Db object has:
 *
 * - `defineTable<T>(name)` — creates a typed Table<T> for a given table name
 * - Time helpers: `now()`, `days()`, `hours()`, `minutes()`, `ago()`, `fromNow()`
 *
 * ## How defineTable works
 *
 * `defineTable` is a factory that binds a table name to the correct database
 * and execution context. It:
 *
 * 1. Looks up the table name in the app context database metadata
 * 2. Resolves the databaseId (implicit if only one database exists)
 * 3. Gets the column schema (for user-type handling and JSON parsing)
 * 4. Returns a Table<T> instance bound to the executeQuery function
 *
 * Tables are typically defined at module scope and imported into route handlers:
 *
 * ```ts
 * // tables/orders.ts
 * import { db } from '@mindstudio-ai/agent';
 * export const Orders = db.defineTable<Order>('orders');
 *
 * // routes/getOrders.ts
 * import { Orders } from '../tables/orders';
 * const active = await Orders.filter(o => o.status === 'active').take(10);
 * ```
 *
 * Since `defineTable()` is lazy (no queries execute until you await something
 * on the Table), it's safe to call at module scope. The actual database
 * context resolution happens on first query execution.
 *
 * ## Time helpers
 *
 * All timestamps in MindStudio databases are unix timestamps (milliseconds
 * since epoch). The time helpers make it easy to work with relative times
 * without writing `Date.now() - 48 * 60 * 60 * 1000` everywhere:
 *
 * ```ts
 * const cutoff = db.ago(db.days(2));           // 2 days ago (unix ms)
 * const deadline = db.fromNow(db.hours(48));   // 48 hours from now
 * const window = db.days(7) + db.hours(12);    // composable durations
 * ```
 */

/**
 * Options for `db.defineTable()`.
 */
interface DefineTableOptions<T = unknown> {
    /**
     * Database name or ID to target. Required when the app has multiple
     * databases and the table name alone is ambiguous.
     *
     * Accepts either the database's display name or its ID. The SDK
     * matches against both.
     *
     * If omitted, the SDK resolves the database automatically:
     * - Single database → used implicitly
     * - Multiple databases → searched by table name
     */
    database?: string;
    /**
     * Unique constraints for the table. Each entry is an array of column
     * names that together must be unique. The SDK communicates these to
     * the platform which creates the corresponding SQLite UNIQUE indexes.
     *
     * Required for `upsert()` — the conflict key must match a declared
     * unique constraint.
     *
     * @example
     * ```ts
     * // Single column unique
     * db.defineTable<User>('users', { unique: [['email']] });
     *
     * // Compound unique
     * db.defineTable<Membership>('memberships', { unique: [['userId', 'orgId']] });
     *
     * // Multiple constraints
     * db.defineTable<User>('users', { unique: [['email'], ['slug']] });
     * ```
     */
    unique?: (keyof T & string)[][];
    /**
     * Default values for columns, applied client-side in `push()` and
     * `upsert()`. Explicit values in the input override defaults.
     *
     * @example
     * ```ts
     * db.defineTable<Order>('orders', {
     *   defaults: { status: 'pending', retryCount: 0 },
     * });
     * ```
     */
    defaults?: Partial<Omit<T, SystemFields>>;
}

/**
 * The `db` namespace object. Contains `defineTable()` for creating typed
 * collections and time helpers for working with unix timestamps.
 */
interface Db {
    /**
     * Define a typed table. Returns a Table<T> bound to the app's managed
     * database. The table name must match a table in the app's database schema.
     *
     * Tables are lazy — nothing executes until you call a method on the Table
     * and await the result. This makes it safe to call `defineTable()` at
     * module scope.
     *
     * Database resolution:
     * - If the app has a single database (common case), it's used automatically.
     * - If the app has multiple databases, pass `{ database }` with the
     *   database name or ID to target the right one. If omitted, the SDK
     *   searches all databases by table name.
     *
     * @example
     * ```ts
     * // Single database (common) — no need to specify
     * const Orders = db.defineTable<Order>('orders');
     *
     * // Multiple databases — specify which one
     * const Orders = db.defineTable<Order>('orders', { database: 'main' });
     * ```
     */
    defineTable<T>(name: string, options?: DefineTableOptions<T>): Table<T & SystemColumns>;
    /** Returns the current time as a unix timestamp (ms). Equivalent to `Date.now()`. */
    now(): number;
    /** Returns milliseconds for n days. Composable with `+`. */
    days(n: number): number;
    /** Returns milliseconds for n hours. Composable with `+`. */
    hours(n: number): number;
    /** Returns milliseconds for n minutes. Composable with `+`. */
    minutes(n: number): number;
    /** Returns a unix timestamp for (now - duration). Use with days/hours/minutes. */
    ago(ms: number): number;
    /** Returns a unix timestamp for (now + duration). Use with days/hours/minutes. */
    fromNow(ms: number): number;
    /**
     * Type a plain UUID string as a `User` reference, for writing into
     * user-typed columns without an `as any` cast. Strips any existing
     * `@@user@@` prefix so the input is always a bare UUID in app code.
     *
     * The SDK adds the `@@user@@` prefix automatically on write — you do
     * not need to (and should not) add it yourself.
     *
     * @example
     * ```ts
     * await Orders.push({
     *   requestedBy: db.userRef(someUuid),
     *   ...
     * });
     * ```
     */
    userRef(id: string): User;
    /**
     * Execute multiple reads and writes in a single round trip. All
     * operations run on the same database connection, eliminating
     * per-operation HTTP overhead. Writes execute in argument order.
     *
     * Accepts Query objects (reads) and Mutation objects (writes from
     * push, update, remove, removeAll, clear). Compiles them to SQL,
     * sends all in one batch request, and returns typed results.
     *
     * Only un-awaited Query/Mutation objects can be batched — their SQL is
     * compiled and bundled. A plain Promise has no SQL to extract, so it is
     * rejected at the type level (and would throw at runtime): pass
     * `Table.filter(...)`, not `await`ed results or wrapper functions.
     *
     * @example
     * ```ts
     * // Mixed reads and writes in one round trip
     * const [, newCard, cards] = await db.batch(
     *   Cards.update(card1.id, { position: 1 }),
     *   Cards.push({ title: 'New', columnId, position: 0 }),
     *   Cards.filter(c => c.columnId === columnId),
     * );
     * ```
     */
    batch<A>(q1: Batchable<A>): Promise<[A]>;
    batch<A, B>(q1: Batchable<A>, q2: Batchable<B>): Promise<[A, B]>;
    batch<A, B, C>(q1: Batchable<A>, q2: Batchable<B>, q3: Batchable<C>): Promise<[A, B, C]>;
    batch<A, B, C, D>(q1: Batchable<A>, q2: Batchable<B>, q3: Batchable<C>, q4: Batchable<D>): Promise<[A, B, C, D]>;
    batch<A, B, C, D, E>(q1: Batchable<A>, q2: Batchable<B>, q3: Batchable<C>, q4: Batchable<D>, q5: Batchable<E>): Promise<[A, B, C, D, E]>;
    batch(...queries: Batchable<unknown>[]): Promise<unknown[]>;
}
/**
 * An operation `db.batch()` can bundle: an un-awaited Query (read) or
 * Mutation (write). The batch executor compiles these to SQL — a plain
 * Promise carries no SQL and cannot be batched, which is why this is not
 * `PromiseLike`.
 */
type Batchable<A> = Query<any, A> | Mutation<A>;

/**
 * The `files` namespace — typed, private-by-default file storage for MindStudio
 * apps. Think of a store as a CDN-backed bucket the app talks to, not app-defined
 * state like a `db` table: the API is *shaped* like `db` (define a store at module
 * scope, import the handle into route handlers), but its contents are arbitrary
 * durable blobs, and one store is shared across dev and prod.
 *
 * ```ts
 * // files/uploads.ts
 * import { files } from '@mindstudio-ai/agent';
 * export const Uploads = files.defineStore('uploads');               // private
 * export const Assets  = files.defineStore('assets', { access: 'public' });
 *
 * // routes/upload.ts
 * import { Uploads } from '../files/uploads';
 * const f = await Uploads.put(buffer, { contentType, filename });
 * return { url: f.url };            // drop into <img src> / <a download>
 * ```
 *
 * `file.url` is a stable, on-domain URL a logged-in user's browser can load
 * directly. For a link that works without a session (email, cross-site embed),
 * use `await file.shareUrl({ expiresIn })`.
 */

/** Options for `files.defineStore()`. */
interface DefineStoreOptions {
    /**
     * Access level. **Defaults to `'private'`** (signed / session-authorized
     * reads). `'public'` marks the store world-readable and CDN-served on the
     * app's own domain (resizable via image query params). Pinned at define-time
     * — no `put()` can change it.
     */
    access?: FileAccess;
    /**
     * Max upload size in bytes for client-direct uploads (the default for
     * `createUploadToken`; enforced by the presigned POST). Overridable per call;
     * capped at the platform ceiling.
     */
    maxSize?: number;
    /**
     * Allowed content types for client-direct uploads. When set,
     * `createUploadToken({ contentType })` must pass one of these.
     */
    contentTypes?: string[];
}
/** The `files` namespace object. */
interface Files {
    /**
     * Define a typed file store. Lazy — nothing executes until you await a method
     * on the returned {@link Store}, so it's safe to call at module scope.
     */
    defineStore(name: string, options?: DefineStoreOptions): Store;
}

/**
 * Jewels — agentic shadow companions for app methods.
 *
 * A jewel lives in `foo.jewel.ts` beside the method `foo.ts` it shadows. It
 * proposes what a careful teammate would have done — an input for the method
 * — without ever applying it: the method stays the only door for writes.
 *
 * ```ts
 * // updateIssue.jewel.ts
 * export default defineJewel(updateIssue, {
 *   subject: ({ issueId }) => ({ issueId }),
 *   propose: async ({ issueId }) => {
 *     // arbitrary TS: reads via plain imports, model calls via runTask
 *     return { input: { issueId, status: 'triaged' }, reasoning: '...' };
 *   },
 * });
 * ```
 *
 * `defineJewel` returns a CALLABLE — the executor — with the config attached
 * as properties (the Express-app pattern). That shape is deliberate: the
 * platform's sandbox worker invokes one exported function per execution
 * frame (`mod[handlerName](params)`), so a jewel run is an ordinary
 * method-execution frame with zero worker or protocol changes. Dev tooling
 * calls the same function, so dev and production share one executor body,
 * versioned here in the SDK.
 *
 * Three run modes, discriminated by which key the caller provides:
 * - `{ humanInput }` — shadow mode. The subject is derived via the jewel's
 *   projection (the human's decision fields never reach `propose`), and
 *   `humanInput` doubles as ground truth for grading.
 * - `{ subject }` — eval / arrival mode. No human action exists yet, so the
 *   record is ungraded (an arrival proposal is graded later, when the human
 *   acts — see the grade mode below).
 * - `{ grade: { proposed, actual } }` — grade-only mode: deferred grading of
 *   an earlier arrival proposal against the human's eventual action. Runs
 *   the jewel's own `grade` (or the default deep-equal) and nothing else.
 *
 * The executor NEVER throws: a shadow run must never break anything. Author
 * code failing (`subject`/`propose`) is captured in the record's `error`;
 * `grade` failing softens to verdict `'skip'`.
 */
/** Any app method a jewel can shadow: one JSON-serializable input, any result. */
type JewelMethod = (input: any) => any;
/**
 * The input type of the shadowed method. Guarded so a zero-parameter method
 * resolves to `undefined` instead of erroring on `Parameters<M>[0]`.
 */
type JewelMethodInput<M extends JewelMethod> = Parameters<M> extends [] ? undefined : Parameters<M>[0];
/**
 * What `propose` returns. `input: null` is abstention — a first-class,
 * graded outcome, not an error. Reasoning is most valuable on abstention.
 */
interface JewelProposal<I> {
    input: I | null;
    reasoning: string;
}
interface JewelVerdict {
    verdict: 'agree' | 'disagree' | 'skip';
    notes?: string;
}
/**
 * Argument to a custom `grade`. `proposed` is null when the jewel abstained;
 * `actual` is always present — grading only happens in shadow mode, where
 * the human acted.
 */
interface JewelGradeContext<I> {
    proposed: I | null;
    actual: I;
}
type MaybePromise<T> = T | Promise<T>;
/**
 * Authoring config. Declare `subject` before `propose` — the subject type
 * is inferred from the projection's return and flows into `propose`'s
 * parameter.
 */
interface JewelConfig<M extends JewelMethod, S> {
    /**
     * Projection: method input → subject. What the human was looking at,
     * never what they decided — this is what keeps the label out of the exam.
     */
    subject: (input: JewelMethodInput<M>) => S;
    /**
     * The proposal. Runs on the projection only; arbitrary TS (plain imports
     * for context, model calls via runTask). Throwing never propagates — it
     * becomes an `error` on the pair record.
     */
    propose: (subject: NoInfer<S>) => MaybePromise<JewelProposal<JewelMethodInput<M>>>;
    /**
     * The custom assertion. Omit for deep-equal on the method input. May be
     * async and call models. Throwing softens to verdict `'skip'`.
     *
     * Strict-safe field iteration, when grading only touched fields:
     * ```ts
     * grade: ({ proposed, actual }) => {
     *   if (!proposed) return { verdict: 'disagree', notes: 'abstained' };
     *   const keys = Object.keys(actual) as (keyof typeof actual)[];
     *   const misses = keys.filter((k) => proposed[k] !== actual[k]);
     *   return misses.length
     *     ? { verdict: 'disagree', notes: misses.join(', ') }
     *     : { verdict: 'agree' };
     * }
     * ```
     */
    grade?: (ctx: JewelGradeContext<JewelMethodInput<M>>) => MaybePromise<JewelVerdict>;
}
/**
 * Executor params — constructed by the platform (or dev tooling), exactly
 * one key. `?: never` on the other keys rejects passing more than one.
 */
type JewelRunParams<I, S> = {
    humanInput: I;
    subject?: never;
    grade?: never;
} | {
    subject: S;
    humanInput?: never;
    grade?: never;
} | {
    grade: JewelGradeContext<I>;
    humanInput?: never;
    subject?: never;
};
/**
 * The versioned, JSON-serializable output of one jewel run — the row the
 * pair ledger stores. Values are kept verbatim, so method inputs must be
 * JSON-safe (they already crossed the wire as JSON in real use).
 */
interface JewelPairRecord<I = unknown, S = unknown> {
    v: 1;
    /** `grade` records are consumed by the platform (verdict extracted from a
     *  grade-only run) and never persisted as pair rows themselves. */
    mode: 'shadow' | 'eval' | 'grade';
    /** Absent only when the projection itself threw (shadow mode). */
    subject?: S;
    /** null = abstention. Absent when propose failed. */
    proposed?: I | null;
    /** Absent when propose failed. */
    reasoning?: string;
    /** The human's input — present in shadow mode. */
    actual?: I;
    /** Present iff graded (shadow or grade mode, propose succeeded). */
    verdict?: 'agree' | 'disagree' | 'skip';
    notes?: string;
    /** Present iff subject() or propose() threw. Grade errors become verdict 'skip'. */
    error?: {
        phase: 'subject' | 'propose';
        message: string;
        stack?: string;
    };
    /**
     * Whether this jewel declares a custom `grade`. The platform's deferred
     * grading dispatches a grade-mode run when true; when false it grades
     * locally with an equivalent of the default deep-equal (no sandbox trip
     * to evaluate a pure structural comparison).
     */
    customGrade: boolean;
    startedAt: number;
    durationMs: number;
}
/**
 * The export of a `foo.jewel.ts` file: the executor, callable as an
 * ordinary handler, with the authored config attached for the compiler and
 * dev tooling. `method` carries the actual function reference — reference
 * identity is what lets the compiler verify the manifest's method↔jewel
 * pairing against the code. `grade` is `undefined` when the default
 * deep-equal grade applies; presence is the custom-grade signal.
 */
interface Jewel<M extends JewelMethod, S> {
    (params: JewelRunParams<JewelMethodInput<M>, S>): Promise<JewelPairRecord<JewelMethodInput<M>, S>>;
    readonly kind: 'jewel';
    readonly method: M;
    readonly subject: (input: JewelMethodInput<M>) => S;
    readonly propose: (subject: S) => MaybePromise<JewelProposal<JewelMethodInput<M>>>;
    readonly grade: ((ctx: JewelGradeContext<JewelMethodInput<M>>) => MaybePromise<JewelVerdict>) | undefined;
}
/**
 * What the platform did with a proposal, routed by the method's autonomy:
 * - `recorded` — shadow: proposal written to the pair ledger, graded later
 *   against the human's eventual action (within the attribution window).
 * - `queued` — approve: waiting in the review queue.
 * - `committed` — auto: the jewel's proposal was applied (the method ran);
 *   `output` carries the method's return value.
 * - `abstained` — the jewel chose not to act; recorded, still gradeable.
 * - `disabled` — the method has no jewel or autonomy is `manual`. Returned,
 *   never thrown: dialing a method down must not break the app code that
 *   proposes to it.
 * - `skipped` — dev session, jewel-descended recursion, or unsampled
 *   (sampleRate).
 * - `failed` — an auto commit was attempted and the method rejected it
 *   (e.g. the state was consumed concurrently). The moment stays pending.
 * - `pending` — a concurrent replay: the original propose for this
 *   idempotencyKey is still mid-run. Treat as accepted.
 */
type JewelProposeOutcome = 'recorded' | 'queued' | 'committed' | 'abstained' | 'disabled' | 'skipped' | 'failed' | 'pending';
interface JewelProposeResult {
    outcome: JewelProposeOutcome;
    /** Present on `committed` — the method's return value. */
    output?: unknown;
    /** Present on `queued` — address the item via `jewels.queue.resolve`. */
    queueItemId?: string;
}
/** A pending approval-queue item awaiting a reviewer. */
interface JewelQueueItem {
    id: string;
    methodId: string;
    subject: Record<string, unknown>;
    /** The method input the jewel proposes to apply. */
    proposed: unknown;
    reasoning: string | null;
    proposedAt: string;
    /** Unresolved items expire (verdict `expired`) at the attribution window. */
    expiresAt: string;
}
type JewelQueueResolution = 'approved' | 'edited' | 'dismissed';
interface JewelQueueResolveResult {
    resolution: JewelQueueResolution;
    /** Present on approve — the applied method's return value. */
    output?: unknown;
}
interface JewelsApi {
    /**
     * Hand a decision moment to a method's jewel — the arrival-shaped trigger.
     * Place it where the app knows the moment was born (an ingest branch that
     * lands a row in its pending state). The platform routes by the method's
     * autonomy; see {@link JewelProposeOutcome}.
     *
     * `idempotencyKey` (Stripe semantics — a replayed key returns the ORIGINAL
     * outcome, so retried webhooks are invisible to this code) defaults to a
     * hash of the subject. Sibling proposals for one decision moment should
     * share a key so cross-verb grading can close them together.
     *
     * Backend/managed contexts only (rides the execution's hook token). Runs
     * the jewel synchronously — wrap chains in `mindstudio.waitUntil(...)` so
     * the calling method returns immediately:
     *
     * ```ts
     * mindstudio.waitUntil((async () => {
     *   const merge = await mindstudio.jewels.propose(
     *     'merge-issues', { sourceId: issue.id }, { idempotencyKey: issue.id });
     *   if (merge.outcome !== 'committed') {
     *     await mindstudio.jewels.propose(
     *       'triage-issue', { issueId: issue.id }, { idempotencyKey: issue.id });
     *   }
     * })());
     * ```
     */
    propose(methodId: string, subject: Record<string, unknown>, opts?: {
        idempotencyKey?: string;
    }): Promise<JewelProposeResult>;
    /**
     * The app-native approval queue for `approve`-mode methods. Build the
     * review UI in the app itself: a backend method lists items (gate it with
     * the app's reviewer role), the frontend renders the inbox, and a resolve
     * method approves or dismisses.
     */
    queue: {
        /** Pending items, oldest first. */
        list(opts?: {
            methodId?: string;
            limit?: number;
        }): Promise<{
            items: JewelQueueItem[];
        }>;
        /**
         * Resolve one item. `approve` APPLIES the target method as the current
         * session user — the reviewer — so the effect belongs to the human who
         * clicked, and the target method's own auth checks are the real gate on
         * who may approve. Pass `input` to apply an edited version of the
         * proposal (captured as resolution `edited` — proposed/edited/final ride
         * the pair record; the richest training signal). `dismiss` records the
         * rejection and closes the item without running anything; other verbs'
         * proposals for the same moment stay open.
         */
        resolve(itemId: string, opts: {
            action: 'approve' | 'dismiss';
            input?: Record<string, unknown>;
        }): Promise<JewelQueueResolveResult>;
    };
}
/**
 * Define a jewel — the agentic shadow companion for an app method.
 *
 * @example
 * ```ts
 * export default defineJewel(updateIssue, {
 *   subject: ({ issueId }) => ({ issueId }),
 *   propose: async ({ issueId }) => {
 *     const issue = await resolveIssue(issueId);
 *     if (!issue || issue.status !== 'new') {
 *       return { input: null, reasoning: 'Nothing to propose.' };
 *     }
 *     // ...gather context, call a model via runTask + outputSchema...
 *     return { input: { issueId, status: 'triaged' }, reasoning: '...' };
 *   },
 *   grade: async ({ proposed, actual }) => {
 *     if (!proposed) return { verdict: 'disagree', notes: 'abstained' };
 *     return proposed.status === actual.status
 *       ? { verdict: 'agree' }
 *       : { verdict: 'disagree' };
 *   },
 * });
 * ```
 */
declare function defineJewel<M extends JewelMethod, S>(method: M, config: JewelConfig<M, S>): Jewel<M, S>;

/** @internal Transport: `POST /_internal/v2/datasources/<op>` with the hook token. */
type DataSourcesTransport = (op: string, body: unknown) => Promise<any>;
/** Where a retrieved chunk came from — enough to show the user the source. */
interface Citation {
    documentId: string;
    filename: string | null;
    /** 1-based. Null for formats with no pagination (plain text, html). */
    pageNumber: number | null;
    /**
     * Position within the document, 0-based.
     *
     * `(documentId, chunkIndex)` is the stable identity of a chunk — use it as
     * the key for an eval set or a regression check rather than matching on
     * `text`. Stable for as long as the corpus keeps its current configuration:
     * re-chunking a source (a different chunk size, say) moves the boundaries and
     * therefore renumbers, which is inherent rather than a wobble.
     */
    chunkIndex: number | null;
    /** Enclosing headings, outermost first. */
    headingPath: string[];
    /**
     * Region of the page this chunk came from, when the format had a layout to
     * measure — PDFs do, docx and plain text don't. Precise enough to highlight.
     */
    boundingBox?: {
        topLeftX: number;
        topLeftY: number;
        bottomRightX: number;
        bottomRightY: number;
    };
    /**
     * Stable on-domain URL for the source document. Drop it in an `<a href>` —
     * a same-origin logged-in request authorizes automatically, so there's
     * nothing to await.
     */
    url: string;
}
/** A metadata value as stored on a document: scalars only. */
type MetadataValue = string | number | boolean;
/**
 * Tags attached to a document when it's added — department, year, doc type,
 * a per-user scope — and matched by {@link SearchFilter.metadata} at query
 * time. Up to 16 keys per document; keys are alphanumeric with `_`/`-`.
 */
type DocumentMetadata = Record<string, MetadataValue>;
/**
 * Which retrieval branches run for a search.
 *
 * - `hybrid` — semantic and keyword retrieval fused. The default.
 * - `semantic` — the embedding alone (what `hybrid: false` selects).
 * - `lexical` — keyword matching alone, with NO query embedding. The cheapest
 *   and fastest mode; right when the query is an identifier (an error code, a
 *   SKU, a name) rather than a meaning.
 */
type SearchMode = 'hybrid' | 'semantic' | 'lexical';
/**
 * Narrow a search before ranking. Every condition ANDs with the others, and a
 * filter can only ever narrow — it runs inside your corpus, not across it.
 */
interface SearchFilter {
    /**
     * Match document metadata set at add time. A scalar must equal; an array
     * matches any of its values. Keys AND together:
     * `{ department: 'legal', year: [2025, 2026] }`.
     */
    metadata?: Record<string, MetadataValue | MetadataValue[]>;
    /** Exact filename, or any of several. */
    filename?: string | string[];
    /** Restrict to specific documents (ids from {@link DataSource.documents}). */
    documentIds?: string[];
    /** Page range, inclusive — for paged formats like PDF. */
    pages?: {
        min?: number;
        max?: number;
    };
    /** Chunk text must contain ALL of these words, in any order. */
    contains?: string;
    /** Chunk text must contain this exact word sequence, adjacent and in order. */
    phrase?: string;
}
/** Where one retrieval branch put a hit, and what that branch scored it. */
interface BranchPosition {
    /** 0-based position within that branch's own results. */
    rank: number;
    score: number;
}
/**
 * Which half of hybrid retrieval found a hit. Only present when `explain` was
 * requested — see {@link SearchOptions.explain}.
 */
interface SearchExplain {
    /** Semantic (embedding) retrieval. Null if this branch didn't find the hit. */
    dense: BranchPosition | null;
    /** Keyword/IDF retrieval. Null when `hybrid` is off, or if it didn't find it. */
    lexical: BranchPosition | null;
    matchedVia: 'dense' | 'lexical' | 'both';
}
interface SearchHit {
    /** Provider relevance score. Comparable within a response, not across them. */
    score: number;
    /** The matched chunk, prefixed with its heading path for context. */
    text: string;
    citation: Citation;
    /**
     * Where retrieval put this hit BEFORE reranking, and what it scored.
     *
     * With reranking on, `score` is the reranker's relevance score and this is
     * the retriever's — different quantities, so they're kept apart rather than
     * blended. Comparing `retrievalRank` with the hit's final position is how you
     * see what reranking actually did ("retrieved 7th, reranked to 1st").
     *
     * Named for the stage rather than the method: it's a fused hybrid score when
     * `hybrid` is on and a cosine similarity when it's off.
     */
    retrievalRank?: number;
    retrievalScore?: number;
    /** Only when `explain` was requested. */
    explain?: SearchExplain;
    /** Only when `expand` was requested. Outermost first, so `[...before, text, ...after]` reads in order. */
    neighbors?: {
        before: string[];
        after: string[];
    };
    /**
     * Only when `highlight` was requested: where the query's most distinctive
     * terms land in `text`, as `text.slice(start, end)` ranges, each carrying the
     * `token` it matched so you can colour or group by term.
     *
     * NOT every query term — see {@link SearchOptions.highlight}. Keyword-based,
     * so a hit that matched semantically may report an empty array, which is
     * itself informative.
     */
    matches?: {
        start: number;
        end: number;
        token: string;
    }[];
}
/**
 * What a search actually ran — as opposed to what was asked for.
 *
 * Worth checking when a result surprises you: an omitted `mode` falls back to
 * the corpus's own configuration, and `reranked` is false when reranking was
 * skipped or failed open. Absent only when the data source doesn't exist yet,
 * in which case nothing ran at all.
 */
interface SearchRan {
    search: SearchMode;
    hybrid: boolean;
    reranked: boolean;
    /** Which build served the query. Changes when a re-vectorization is promoted. */
    pipelineVersion: number;
}
/**
 * Per-query overrides.
 *
 * These are the settings that are free to change: none of them touch a stored
 * vector, so they take effect on the next call and cost nothing. Anything that
 * would require rebuilding the corpus — chunking, the embedding model, whether
 * chunks are contextualized — is a property of the data source, configured
 * with `mindstudio-prod datasources config` rather than passed here.
 *
 * The defaults come from the data source's own configuration, so most callers
 * should pass nothing.
 */
interface SearchOptions {
    /** Results to return. Default 5, capped at 50. */
    topK?: number;
    /** Drop hits below this score. Provider-specific scale — measure before using. */
    scoreThreshold?: number;
    /**
     * Narrow the search to matching chunks before ranking — by document
     * metadata, filename, document ids, page range, or required words/phrases.
     * See {@link SearchFilter}.
     */
    filter?: SearchFilter;
    /**
     * Which retrieval branches run. Defaults to the source's configuration
     * (hybrid). `'lexical'` skips the query embedding entirely — fastest, and
     * right for identifier-shaped queries. See {@link SearchMode}.
     */
    mode?: SearchMode;
    /**
     * At most this many hits per document, backfilled from other documents —
     * stops one document from monopolizing the results. Useful whenever the
     * answer should draw on several sources.
     */
    maxPerDocument?: number;
    /**
     * Return {@link SearchHit.matches} on each hit: where query terms land in its
     * text, for rendering highlights.
     *
     * Only the query's **distinctive** terms are marked. English function words —
     * `the`, `for`, `is`, `of` — are never marked, and when a passage holds more
     * matches than it can usefully show, the rarest terms win the space. So
     * `what is the policy for parental leave` marks `policy`, `parental` and
     * `leave`, and nothing else. Without that a natural-language query lights up
     * most of the passage and you would need your own stopword list to render
     * anything. Words you filtered on (`contains`, `phrase`) are always marked.
     */
    highlight?: boolean;
    /**
     * Rerank results with a cross-encoder before returning them. On by default.
     *
     * Turn it off on a latency-sensitive path — it adds a round trip for a
     * meaningful ranking improvement, which is usually the right trade but not
     * always.
     */
    rerank?: boolean;
    /**
     * Combine semantic search with exact keyword matching. On by default.
     *
     * Keyword matching is what finds part numbers, error codes and proper nouns
     * that an embedding model never learned. Rarely worth disabling.
     * `hybrid: false` is the same as `mode: 'semantic'`; prefer `mode`, which
     * also offers `'lexical'`.
     */
    hybrid?: boolean;
    /**
     * Report which branch found each hit, and where each ranked it.
     *
     * A debugging aid, off by default because it costs two extra round trips: a
     * fused result carries one blended score, so the branches have to be asked
     * separately. Results and their order are identical either way — this only
     * adds {@link SearchHit.explain}.
     */
    explain?: boolean;
    /**
     * Also return this many chunks either side of each hit, in
     * {@link SearchHit.neighbors} — for showing a passage in context. 0-2.
     *
     * `text` is untouched, so citations and highlighting still point at the
     * chunk that actually matched.
     */
    expand?: number;
}
interface AddOptions {
    /**
     * Required — the extension selects the extraction route. PDFs and office
     * formats go to a document model; text and CSV are read directly.
     */
    filename: string;
    contentType?: string;
    /**
     * Tags to attach — filterable at search time via
     * {@link SearchFilter.metadata}. Scalars only, up to 16 keys. Re-adding the
     * same bytes with different metadata updates the tags in place with no
     * re-processing; supplying metadata replaces the whole object.
     */
    metadata?: DocumentMetadata;
}
interface DataSourceDocument {
    id: string;
    filename: string | null;
    status: 'processing' | 'done' | 'error';
    errorMessage: string | null;
    chunkCount: number | null;
    pageCount: number | null;
    /** Tags set at add time. See {@link AddOptions.metadata}. */
    metadata: DocumentMetadata | null;
    createdAt: string;
    ingestedAt: string | null;
}
/** One chunk exactly as it was indexed. See {@link DataSource.chunks}. */
interface DataSourceChunk {
    index: number;
    text: string;
    pageNumber: number;
    headingPath: string[];
    /**
     * Offsets into the page's extracted markdown. Null for PDFs, which carry a
     * `boundingBox` instead — there is no character stream to point into.
     */
    charStart: number | null;
    charEnd: number | null;
    boundingBox?: {
        topLeftX: number;
        topLeftY: number;
        bottomRightX: number;
        bottomRightY: number;
    };
    /** base64 of a Float32Array. Only when `vectors: true` was passed. */
    vector?: string;
}
/** How a corpus was built and what is in it. See {@link DataSource.stats}. */
interface DataSourceStats {
    /** False for a source nothing has created yet — everything else reads zero. */
    exists: boolean;
    documentCount: number;
    counts: {
        total: number;
        done: number;
        processing: number;
        error: number;
    };
    chunkCount: number;
    /** Original document bytes, not index size. */
    storageBytes: number;
    lastIngestedAt: string | null;
    /**
     * The configuration these documents were actually built with — not the
     * platform default, and not necessarily the newest. Changing it is an
     * explicit, owner-triggered migration.
     */
    pipeline: {
        version: number;
        embeddingModelId: string;
        dimensions: number;
        chunking: {
            strategy: string;
            version: number;
            maxChars: number;
            minChars: number;
            dropBlockTypes: string[];
        };
        contextual: {
            enabled: boolean;
            modelId: string | null;
        };
        images: {
            describe: boolean;
            modelId: string | null;
        };
    } | null;
}
/**
 * A typed handle to one data source. Lazy — nothing executes until a method is
 * awaited, so it's safe to `defineDataSource()` at module scope and import the
 * handle into route handlers (same ergonomics as `db.defineTable` and
 * `files.defineStore`).
 */
declare class DataSource {
    private readonly _slug;
    private readonly _call;
    constructor(_slug: string, _call: DataSourcesTransport);
    get name(): string;
    /**
     * Search the corpus.
     *
     * Returns chunks ranked by relevance, each with a citation. Searching a
     * source that doesn't exist yet returns no results rather than throwing —
     * code may name a corpus the build hasn't populated.
     *
     * **Deterministic** for a fixed corpus and configuration: the same query
     * returns the same hits in the same order, so it's safe to build an eval set
     * or a regression check on top of it. There is no seed to set. Two things do
     * legitimately move the results: adding or removing documents, and changing
     * the corpus configuration — both of which you control.
     *
     * Alongside `results` and `latencyMs` comes {@link SearchRan} — what the
     * search actually did, which is the first thing to check when results don't
     * look like the options you passed.
     */
    search(query: string, options?: SearchOptions): Promise<{
        results: SearchHit[];
        mode?: SearchRan;
        latencyMs: number;
    }>;
    /**
     * What is in the corpus, and how it was built.
     *
     * Document and chunk counts, storage, and the embedding model and chunking
     * settings actually in effect — which is not the same as the platform
     * default, since a corpus keeps the configuration it was built with until
     * someone migrates it.
     */
    stats(): Promise<DataSourceStats>;
    /**
     * Every chunk of one document, exactly as it was indexed.
     *
     * The direct answer to "why isn't this document coming back?" — search only
     * shows you the chunks that surface, which is no help when none do. Reading
     * how a document was actually split usually is.
     *
     * Pass `{ vectors: true }` to include each chunk's embedding. Large: roughly
     * 8KB per chunk, so a 500-chunk document is several megabytes.
     */
    chunks(documentId: string, options?: {
        vectors?: boolean;
    }): Promise<DataSourceChunk[]>;
    /**
     * Add a document to the corpus.
     *
     * Returns as soon as the document is queued — extraction and embedding run
     * in the background and take a while, so poll {@link documents} for status
     * rather than assuming the content is searchable on return.
     *
     * **Adding the same bytes twice is free.** Documents are content-addressed,
     * so a re-add is a no-op when this source has already processed those exact
     * bytes under its current configuration. Reconfiguring the source is what
     * makes a re-add do work again — and that is an explicit, owner-triggered
     * migration, never something a deploy causes.
     */
    add(content: Buffer | Uint8Array | string, options: AddOptions): Promise<{
        document: DataSourceDocument;
        queued: boolean;
    }>;
    /** Every document in the corpus, with ingest status. */
    documents(): Promise<DataSourceDocument[]>;
    /** Remove a document and its vectors. */
    remove(documentId: string): Promise<void>;
    /**
     * Create the data source if it doesn't exist yet.
     *
     * Rarely needed — `add` and `search` both handle a missing source. Useful
     * when you want it to exist (and appear in the dashboard) before any
     * document has been added.
     */
    ensure(name?: string): Promise<void>;
    /**
     * @internal Content hash of some bytes, matching what the server computes.
     * Exposed for callers that want to check whether they already added a file.
     */
    static contentHash(content: Buffer | Uint8Array | string): string;
}

/**
 * The `dataSources` namespace — searchable document corpora for MindStudio
 * apps. The retrieval half of the platform's managed data layer, shaped like
 * `db` and `files`: declare a source at module scope, import the handle into
 * route handlers.
 *
 * ```ts
 * // datasources/policies.ts
 * import { dataSources } from '@mindstudio-ai/agent';
 * export const Policies = dataSources.defineDataSource('policies');
 *
 * // routes/ask.ts
 * import { Policies } from '../datasources/policies';
 *
 * const { results } = await Policies.search('what are the payment terms?');
 * const context = results.map((r) => r.text).join('\n\n');
 * ```
 *
 * The platform owns parsing, chunking, embedding, storage and isolation. You
 * declare what the corpus is and search it; every hit comes back with a
 * citation pointing at the source document.
 *
 * **Corpora are usually built at development time**, not through your app's
 * UI — the agent adds documents while building, and the app is a consumer.
 * `add()` exists for apps where users upload documents themselves.
 *
 * **A data source is live and shared.** Unlike database tables there is no dev
 * copy and no per-release isolation: adding or removing a document affects
 * what the deployed app retrieves, immediately. Scenarios never reset a data
 * source, and re-ingesting a large corpus costs real money.
 */

/** The `dataSources` namespace object. */
interface DataSources {
    /**
     * Define a data source. Lazy — nothing executes until you await a method on
     * the returned {@link DataSource}, so it's safe to call at module scope.
     *
     * The source is created on first use if it doesn't exist, so naming one the
     * build hasn't populated yet is not an error; it just searches empty.
     */
    defineDataSource(name: string): DataSource;
}

/** The accepted outbound call, already dialing. */
interface VoiceCallResult {
    /** The call record's session id (appears in the app's voice call log). */
    sessionId: string;
    status: 'dialing';
    /** The caller-ID number the callee sees. */
    from: string;
    /** The dialed number. */
    to: string;
}
/** The `voice` namespace object. */
interface Voice {
    /**
     * Place an outbound call to `to` (E.164, e.g. `+13105551234`) and connect
     * the callee to this app's voice agent. Returns as soon as dialing starts;
     * the outcome (answered, busy, no answer) lands on the call record.
     */
    call(params: {
        to: string;
        assumeIdentity?: boolean;
    }): Promise<VoiceCallResult>;
}

/**
 * JSON Schema support for task-agent structured output.
 *
 * The dialect is a deliberately bounded subset of JSON Schema — the shape
 * used for Anthropic tool `input_schema` / OpenAI function parameters:
 * `type` (including type arrays for nullability), `properties`, `required`,
 * `additionalProperties`, `items`, `enum`, `const`. Everything in this file
 * covers exactly that subset and nothing more, on both levels:
 *
 * - {@link FromSchema} maps a schema *value* to the TypeScript type it
 *   describes (compile time).
 * - {@link validateAgainstSchema} checks a runtime value against the same
 *   constructs (runtime).
 *
 * Keeping the two in one module is the point: what the type infers is what
 * the validator enforces. Schemas using keywords outside the subset are
 * rejected loudly by {@link assertSupportedSchema} rather than silently
 * half-enforced.
 */
type JsonSchemaTypeName = 'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean' | 'null';
/**
 * A schema in the supported dialect. Every position is readonly so inline
 * literals inferred via `const` type parameters (which produce readonly
 * tuples/objects) are assignable.
 */
interface JsonSchema {
    readonly type?: JsonSchemaTypeName | readonly JsonSchemaTypeName[];
    readonly properties?: Readonly<Record<string, JsonSchema>>;
    readonly required?: readonly string[];
    readonly additionalProperties?: boolean;
    readonly items?: JsonSchema;
    readonly enum?: readonly (string | number | boolean | null)[];
    readonly const?: string | number | boolean | null;
    readonly description?: string;
}
/**
 * The root schema for task output must be an object schema. The literal
 * `type: 'object'` requirement also anchors overload resolution on
 * `runTask` — without it, nearly any object type would satisfy the schema
 * overload's constraint (every `JsonSchema` property is optional).
 */
interface JsonObjectSchema extends JsonSchema {
    readonly type: 'object';
    readonly properties: Readonly<Record<string, JsonSchema>>;
}
/**
 * Infers the TypeScript type described by a schema literal.
 *
 * ```ts
 * const schema = {
 *   type: 'object',
 *   properties: {
 *     action: { enum: ['approve', 'reject'] },
 *     note: { type: ['string', 'null'] },
 *   },
 *   required: ['action'],
 * } as const satisfies JsonObjectSchema;
 *
 * type Out = FromSchema<typeof schema>;
 * // { action: 'approve' | 'reject'; note?: string | null }
 * ```
 */
type FromSchema<S> = S extends {
    const: infer C;
} ? C : S extends {
    enum: readonly (infer E)[];
} ? E : S extends {
    type: readonly (infer TN extends JsonSchemaTypeName)[];
} ? FromTypeName<TN, S> : S extends {
    type: infer TN extends JsonSchemaTypeName;
} ? FromTypeName<TN, S> : unknown;
/** Distributes over union type names, so `['string','null']` → `string | null`. */
type FromTypeName<TN extends JsonSchemaTypeName, S> = (TN extends 'string' ? string : never) | (TN extends 'number' | 'integer' ? number : never) | (TN extends 'boolean' ? boolean : never) | (TN extends 'null' ? null : never) | (TN extends 'array' ? S extends {
    items: infer I;
} ? FromSchema<I>[] : unknown[] : never) | (TN extends 'object' ? FromObjectSchema<S> : never);
type RequiredKeys<S> = S extends {
    required: readonly (infer R extends string)[];
} ? R : never;
type FromObjectSchema<S> = S extends {
    properties: infer P;
} ? Prettify<{
    [K in Extract<keyof P, RequiredKeys<S>>]: FromSchema<P[K]>;
} & {
    [K in Exclude<keyof P, RequiredKeys<S>>]?: FromSchema<P[K]>;
}> : Record<string, unknown>;
/** Collapses the required/optional intersection into one readable object type. */
type Prettify<T> = {
    [K in keyof T]: T[K];
} & {};
interface SchemaValidationError {
    /** JSONPath-style location, e.g. `$.items[2].severity`. */
    path: string;
    /** Human-readable problem, e.g. `expected one of "low" | "high", got "critical"`. */
    message: string;
}

/**
 * Types for the task agent runtime.
 *
 * A task agent is a multi-step tool-use loop: the model receives a prompt
 * and a set of SDK actions as tools, calls them as needed, and produces
 * structured output — validated against the developer's `outputSchema`, or
 * shaped by a `structuredOutputExample`.
 */

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
type TaskToolConfig = string | {
    method: string;
    defaults?: Record<string, unknown>;
} | {
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
    /** Model ID for the task agent. Must support tool use. */
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
interface RunTaskOptionsWithExample extends RunTaskOptionsBase {
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
interface RunTaskOptionsWithSchema<S extends JsonObjectSchema = JsonObjectSchema> extends RunTaskOptionsBase {
    /** Plain JSON Schema for the output. Root must be `type: 'object'`. */
    outputSchema: S;
    structuredOutputExample?: never;
}
/** Options for {@link MindStudioAgent.runTask} — one of the two output modes. */
type RunTaskOptions = RunTaskOptionsWithExample | RunTaskOptionsWithSchema;
/** An event from a streaming task agent execution. */
interface TaskEvent {
    type: 'text' | 'thinking' | 'thinking_complete' | 'tool_use' | 'tool_input_delta' | 'tool_input_args' | 'tool_call_start' | 'tool_call_result' | 'error' | 'done';
    [key: string]: unknown;
}
/** Summary of a single tool call within a task execution. */
interface TaskToolCall {
    name: string;
    success: boolean;
    durationMs: number;
}
/** Usage stats from a task agent execution. */
interface TaskUsage {
    inputTokens: number;
    outputTokens: number;
    /** Total cost in nanodollars (1/1,000,000,000th of a US dollar). */
    totalBillingCost: number;
}
/** Result of {@link MindStudioAgent.runTask}. */
interface RunTaskResult<T = unknown> {
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
}

/**
 * Client for the MindStudio direct step execution API.
 *
 * Inside MindStudio apps, use the `mindstudio` singleton (auth is automatic):
 * ```ts
 * import { mindstudio } from '@mindstudio-ai/agent';
 * const { imageUrl } = await mindstudio.generateImage({ prompt: "a sunset" });
 * ```
 *
 * For external usage with an API key:
 * ```ts
 * const agent = new MindStudioAgent({ apiKey: "your-key" });
 * const { imageUrl } = await agent.generateImage({ prompt: "a sunset" });
 * ```
 *
 * Authentication is resolved in order:
 * 1. `CALLBACK_TOKEN` environment variable (auto-set inside MindStudio — always takes priority)
 * 2. `apiKey` passed to the constructor
 * 3. `MINDSTUDIO_API_KEY` environment variable
 * 4. `~/.mindstudio/config.json` (set via `mindstudio login`)
 *
 * Base URL is resolved in order:
 * 1. `baseUrl` passed to the constructor
 * 2. `MINDSTUDIO_BASE_URL` environment variable
 * 3. `REMOTE_HOSTNAME` environment variable (auto-set inside MindStudio custom functions)
 * 4. `~/.mindstudio/config.json`
 * 5. `https://v1.mindstudio-api.com` (production default)
 *
 * Rate limiting is handled automatically:
 * - Concurrent requests are queued to stay within server limits
 * - 429 responses are retried automatically using the `Retry-After` header
 * - Internal (hook) tokens are capped at 500 calls per execution
 */
declare class MindStudioAgent$1 {
    /** @internal */
    readonly _httpConfig: HttpClientConfig;
    /** @internal */
    private _reuseThreadId;
    /** @internal */
    private _threadId;
    /** @internal Stream ID for SSE token streaming. Set by sandbox via STREAM_ID env var. */
    private _streamId;
    /**
     * @internal App ID for context resolution. Resolved from:
     * constructor appId → MINDSTUDIO_APP_ID env → sandbox globals →
     * auto-detected from first executeStep response header.
     */
    private _appId;
    /**
     * @internal Cached app context (auth + databases). Populated by
     * ensureContext() and cached for the lifetime of the instance.
     */
    private _context;
    /**
     * @internal Deduplication promise for ensureContext(). Ensures only one
     * context fetch is in-flight at a time, even if multiple db/auth
     * operations trigger it concurrently.
     */
    private _contextPromise;
    /** @internal Cached AuthContext instance, created during context hydration. */
    private _auth;
    /** @internal Cached Db namespace instance, created during context hydration. */
    private _db;
    /** @internal Cached Files namespace instance (lazy; no context hydration needed). */
    private _files;
    private _dataSources;
    private _voice;
    /** @internal Auth type — 'internal' for CALLBACK_TOKEN (managed mode), 'apiKey' otherwise. */
    private _authType;
    /** @internal Usage source sent on step executions (from MINDSTUDIO_REQUEST_SOURCE).
     *  Only set for api-key (CLI) auth so in-app/managed runtime is unaffected. */
    private _requestSource;
    /**
     * @internal Resolve the current auth token. Checks ALS request context
     * first, then CALLBACK_TOKEN env var, then static config token.
     */
    private get _token();
    /**
     * @internal HTTP config with ALS-aware baseUrl and token resolution.
     * Used instead of `_httpConfig` at all `request()` call sites.
     */
    private get _currentHttpConfig();
    /**
     * @internal Stream ID with ALS-aware resolution.
     */
    private get _currentStreamId();
    /**
     * @internal Get resolved app context from ALS or instance cache.
     */
    private _getContext;
    constructor(options?: AgentOptions);
    /**
     * Execute any step by its type name. This is the low-level method that all
     * typed step methods delegate to. Use it as an escape hatch for step types
     * not yet covered by the generated methods.
     *
     * ```ts
     * const result = await agent.executeStep("generateImage", { prompt: "hello", mode: "background" });
     * ```
     */
    executeStep<TOutput = unknown>(stepType: string, step: Record<string, unknown>, options?: StepExecutionOptions): Promise<StepExecutionResult<TOutput>>;
    /**
     * @internal Streaming step execution — sends `Accept: text/event-stream`
     * and parses SSE events for real-time debug logs.
     */
    private _executeStepStreaming;
    /**
     * Execute multiple steps in parallel in a single request.
     *
     * All steps run in parallel on the server. Results are returned in the same
     * order as the input. Individual step failures do not affect other steps —
     * partial success is possible.
     *
     * ```ts
     * const { results } = await agent.executeStepBatch([
     *   { stepType: 'generateImage', step: { prompt: 'a sunset' } },
     *   { stepType: 'textToSpeech', step: { text: 'Hello world' } },
     * ]);
     * ```
     */
    executeStepBatch(steps: BatchStepInput[], options?: ExecuteStepBatchOptions): Promise<ExecuteStepBatchResult>;
    /**
     * Run a task agent — a multi-step tool-use loop that composes SDK actions
     * to produce structured output. The model receives the prompt and tools,
     * calls actions as needed, and returns structured JSON.
     *
     * Tools can be SDK actions, your own app's methods, or both. App methods run
     * as the user who invoked the method that started the task, with their roles.
     *
     * Prefer `outputSchema` (plain JSON Schema, tool-definition dialect):
     * output is validated every turn with automatic repair, `result.output` is
     * typed by inference from the schema — no generic argument, no manual
     * validation — and the call either returns conforming output or throws
     * (`task_output_schema_mismatch`).
     *
     * ```ts
     * const result = await agent.runTask({
     *   prompt: 'Find canonical info for this restaurant, then save it.',
     *   input: { restaurantName: 'Tartine Bakery SF' },
     *   tools: [
     *     'searchGoogle',
     *     'fetchUrl',
     *     { appMethod: 'saveRestaurant', description: 'Persist the researched restaurant.' },
     *   ],
     *   outputSchema: {
     *     type: 'object',
     *     properties: {
     *       name: { type: 'string' },
     *       url: { type: ['string', 'null'] },
     *       kind: { enum: ['bakery', 'cafe', 'restaurant'] },
     *     },
     *     required: ['name', 'kind'],
     *   },
     *   model: 'claude-4-6-sonnet',
     * });
     * result.output.kind; // typed as 'bakery' | 'cafe' | 'restaurant'
     * ```
     *
     * The legacy alternative, `structuredOutputExample`, shapes output by
     * example only: `output` is typed by the caller's generic argument and
     * must be validated manually (check `parsedSuccessfully` first).
     */
    runTask<const S extends JsonObjectSchema>(options: RunTaskOptionsWithSchema<S>): Promise<RunTaskResult<FromSchema<S>>>;
    runTask<T = unknown>(options: RunTaskOptionsWithExample): Promise<RunTaskResult<T>>;
    /**
     * Register background work with the platform so the sandbox stays alive
     * until it settles (bounded at ~30 minutes) instead of being reaped as
     * idle, and so an interruption is recorded in the request log if the
     * sandbox is torn down anyway.
     *
     * Use it for the fire-and-forget pattern — kick off slow work, return
     * early, write results back when it finishes:
     *
     * ```ts
     * mindstudio.waitUntil(
     *   enrichRecord(id)
     *     .then((data) => Records.update(id, { ...data, status: 'ready' }))
     *     .catch(() => Records.update(id, { status: 'failed' })),
     * );
     * return { status: 'processing' };
     * ```
     *
     * Failures of the registered promise are caught and logged to the request
     * log — they can never crash the sandbox. Outside a managed sandbox this
     * degrades to just that error-catching. If you need the result, keep your
     * own reference to the promise and `await` it — `waitUntil` returns void.
     */
    waitUntil(promise: Promise<unknown>): void;
    private _runTaskInner;
    /**
     * Get the authenticated user's identity and organization info.
     *
     * ```ts
     * const info = await agent.getUserInfo();
     * console.log(info.displayName, info.organizationName);
     * ```
     */
    getUserInfo(): Promise<UserInfoResult>;
    /**
     * List all pre-built agents in the organization.
     *
     * ```ts
     * const { apps } = await agent.listAgents();
     * for (const app of apps) console.log(app.name, app.id);
     * ```
     */
    listAgents(): Promise<ListAgentsResult>;
    /**
     * Run a pre-built agent and wait for the result.
     *
     * Uses async polling internally — the request returns immediately with a
     * callback token, then polls until the run completes or fails.
     *
     * ```ts
     * const result = await agent.runAgent({
     *   appId: 'your-agent-id',
     *   variables: { query: 'hello' },
     * });
     * console.log(result.result);
     * ```
     */
    runAgent(options: RunAgentOptions): Promise<RunAgentResult>;
    /** @internal Used by generated action methods. */
    _request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<{
        data: T;
        headers: Headers;
    }>;
    /** List all available AI models. */
    listModels(): Promise<{
        models: MindStudioModel[];
    }>;
    /** List AI models filtered by type. */
    listModelsByType(modelType: ModelType): Promise<{
        models: MindStudioModel[];
    }>;
    /** List all available AI models (summary). Returns only id, name, type, and tags. */
    listModelsSummary(): Promise<{
        models: MindStudioModelSummary[];
    }>;
    /** List AI models (summary) filtered by type. */
    listModelsSummaryByType(modelType: ModelType): Promise<{
        models: MindStudioModelSummary[];
    }>;
    /**
     * List available OAuth connector services (Slack, Google, HubSpot, etc.).
     *
     * These are third-party integrations from the MindStudio Connector Registry.
     * For most tasks, use actions directly instead.
     */
    listConnectors(): Promise<{
        services: ConnectorService[];
    }>;
    /** Get details for a single OAuth connector service. */
    getConnector(serviceId: string): Promise<{
        service: ConnectorService;
    }>;
    /** Get the full configuration for an OAuth connector action, including input fields. */
    getConnectorAction(serviceId: string, actionId: string): Promise<{
        action: ConnectorActionDetail;
    }>;
    /** List OAuth connections for the organization. These are authenticated third-party service links. */
    listConnections(): Promise<{
        connections: Connection[];
    }>;
    /** List packaged workflows available to the organization. */
    listPackagedWorkflows(): Promise<{
        packagedWorkflows: PackagedWorkflow[];
    }>;
    /** Estimate the cost of executing an action before running it. */
    estimateStepCost(stepType: string, step?: Record<string, unknown>, options?: {
        appId?: string;
        workflowId?: string;
    }): Promise<{
        costType?: string;
        estimates?: StepCostEstimateEntry[];
    }>;
    /**
     * Send a stream chunk to the caller via SSE.
     *
     * When invoked from a method that was called with `stream: true`, chunks
     * are delivered in real-time as Server-Sent Events. When there is no active
     * stream (no `STREAM_ID`), calls are silently ignored — so it's safe to
     * call unconditionally.
     *
     * Accepts strings (sent as `type: 'token'`) or structured data (sent as
     * `type: 'data'`). The caller receives each chunk as an SSE event.
     *
     * @example
     * ```ts
     * // Stream text tokens
     * await agent.stream('Processing item 1...');
     *
     * // Stream structured data
     * await agent.stream({ progress: 50, currentItem: 'abc' });
     * ```
     */
    stream: (data: string | Record<string, unknown>) => Promise<void>;
    /**
     * The `auth` namespace — synchronous role-based access control.
     *
     * Provides the current user's identity and roles. All methods are
     * synchronous since the role map is preloaded during context hydration.
     *
     * **Important**: Context must be hydrated before accessing `auth`.
     * - Inside the MindStudio sandbox: automatic (populated from globals)
     * - Outside the sandbox: call `await agent.ensureContext()` first,
     *   or access `auth` after any `db` operation (which auto-hydrates)
     *
     * @throws {MindStudioError} if context has not been hydrated yet
     *
     * @example
     * ```ts
     * await agent.ensureContext();
     * agent.auth.requireRole(Roles.admin);
     * const admins = agent.auth.getUsersByRole(Roles.admin);
     * ```
     */
    get auth(): AuthContext;
    /**
     * The `db` namespace — chainable collection API over managed databases.
     *
     * Use `db.defineTable<T>(name)` to get a typed Table<T>, then call
     * collection methods (filter, sortBy, push, update, etc.) on it.
     *
     * Context is auto-hydrated on first query execution — you can safely
     * call `defineTable()` at module scope without triggering any HTTP.
     *
     * @example
     * ```ts
     * const Orders = agent.db.defineTable<Order>('orders');
     * const active = await Orders.filter(o => o.status === 'active').take(10);
     * ```
     */
    get db(): Db;
    /**
     * Hydrate the app context (auth + database metadata). This must be
     * called before using `auth` synchronously. For `db`, hydration happens
     * automatically on first query.
     *
     * Context is fetched once and cached for the instance's lifetime.
     * Calling `ensureContext()` multiple times is safe (no-op after first).
     *
     * Context sources (checked in order):
     * 1. Sandbox globals (`globalThis.ai.auth`, `globalThis.ai.databases`)
     * 2. HTTP: `GET /developer/v2/helpers/app-context?appId={appId}`
     *
     * @throws {MindStudioError} if no `appId` is available
     *
     * @example
     * ```ts
     * await agent.ensureContext();
     * // auth is now available synchronously
     * agent.auth.requireRole(Roles.admin);
     * ```
     */
    ensureContext(): Promise<void>;
    /**
     * @internal Fetch and cache app context, then create auth + db instances.
     *
     * In managed mode (CALLBACK_TOKEN), the platform resolves the app from
     * the token — no appId needed. With an API key, appId is required.
     */
    private _hydrateContext;
    /**
     * @internal Apply a resolved context object — creates AuthContext and Db.
     * Used by both the HTTP path and sandbox hydration.
     */
    private _applyContext;
    /**
     * @internal Try to hydrate context synchronously from sandbox globals.
     * Called in the constructor when CALLBACK_TOKEN auth is detected.
     *
     * The MindStudio sandbox pre-populates `globalThis.ai` with:
     * - `ai.auth`: { userId, roleAssignments[] }
     * - `ai.databases`: [{ id, name, tables[] }]
     */
    private _trySandboxHydration;
    /**
     * The `files` namespace — typed, private-by-default file storage (the twin of
     * `db`). No context hydration needed: the hook token identifies the app
     * server-side and stores are code-defined (access travels per call).
     *
     * @example
     * ```ts
     * const Uploads = agent.files.defineStore('uploads');
     * const f = await Uploads.put(buffer, { contentType: 'image/png' });
     * return { url: f.url };
     * ```
     */
    get files(): Files;
    /**
     * Jewel surfaces: arrival-shaped triggers (`propose`) and the app-native
     * approval queue (`queue.list` / `queue.resolve`). See {@link JewelsApi}.
     */
    get jewels(): JewelsApi;
    /**
     * Raw hook-token call shared by the jewels surfaces (mirrors reportIssue).
     * No retries: propose holds the request for the jewel run and is idempotent
     * by key anyway; resolve applies a method and must never double-fire.
     */
    private _jewelsRequest;
    /**
     * Searchable document corpora.
     *
     * @example
     * ```ts
     * const Policies = agent.dataSources.defineDataSource('policies');
     * const { results } = await Policies.search('what are the payment terms?');
     * ```
     */
    get dataSources(): DataSources;
    /**
     * Telephony: outbound calls answered by this app's voice agent.
     *
     * @example
     * ```ts
     * await agent.voice.call({ to: '+13105551234', assumeIdentity: true });
     * ```
     */
    get voice(): Voice;
    /**
     * @internal Transport for the `files` namespace — POST /_internal/v2/files/<op>
     * with the raw hook token (mirrors `_executeDbBatch`).
     */
    private _filesRequest;
    /**
     * @internal Transport for the `dataSources` namespace —
     * POST /_internal/v2/datasources/<op> with the raw hook token.
     */
    private _dataSourcesRequest;
    /**
     * @internal Transport for the `voice` namespace —
     * POST /_internal/v2/voice/<op> with the raw hook token.
     */
    private _voiceRequest;
    /**
     * @internal Shared shape for the brokered `/_internal/v2/<ns>/<op>` data
     * planes. Factored out rather than copied per namespace so error handling
     * can't drift between them.
     */
    private _brokeredRequest;
    /**
     * @internal Execute a batch of SQL queries against a managed database.
     * Used as the `executeBatch` callback for Table/Query instances.
     *
     * Calls `POST /_internal/v2/db/query` directly with the hook token
     * (raw, no Bearer prefix). All queries run on a single SQLite connection,
     * enabling RETURNING clauses and multi-statement batches.
     */
    private _executeDbBatch;
    /**
     * @internal Sync a user's roles to the platform after a successful
     * auth table write. Calls POST /_internal/v2/auth/sync-user.
     * Fire-and-forget: errors are caught and logged, never propagated.
     */
    private _syncRoles;
    /**
     * @internal Create a lazy Db proxy that auto-hydrates context.
     *
     * defineTable() returns Table instances immediately (no async needed).
     * But the Table's executeBatch callback is wrapped to call ensureContext()
     * before the first query, so context is fetched lazily.
     */
    private _createLazyDb;
    /**
     * Resolve a single user ID to display info (name, email, profile picture).
     *
     * Use this when you have a `User`-typed field value and need the person's
     * display name, email, or avatar. Returns null if the user ID is not found.
     *
     * Also available as a top-level import:
     * ```ts
     * import { resolveUser } from '@mindstudio-ai/agent';
     * ```
     *
     * @param userId - The user ID to resolve (a `User` branded string or plain UUID)
     * @returns Resolved user info, or null if not found
     *
     * @example
     * ```ts
     * const user = await agent.resolveUser(order.requestedBy);
     * if (user) {
     *   console.log(user.name);              // "Jane Smith"
     *   console.log(user.email);             // "jane@example.com"
     *   console.log(user.profilePictureUrl); // "https://..." or null
     * }
     * ```
     */
    resolveUser(userId: string): Promise<ResolvedUser | null>;
    /**
     * Resolve multiple user IDs to display info in a single request.
     * Maximum 100 user IDs per request.
     *
     * Use this for batch resolution when you have multiple user references
     * to display (e.g. all approvers on a purchase order, all team members).
     *
     * @param userIds - Array of user IDs to resolve (max 100)
     * @returns Object with `users` array of resolved user info
     *
     * @example
     * ```ts
     * // Resolve all approvers at once
     * const approverIds = approvals.map(a => a.assignedTo);
     * const { users } = await agent.resolveUsers(approverIds);
     *
     * for (const u of users) {
     *   console.log(`${u.name} (${u.email})`);
     * }
     * ```
     */
    resolveUsers(userIds: string[]): Promise<{
        users: ResolvedUser[];
    }>;
    /**
     * File a bug report or feature idea into this app's issue tracker.
     *
     * For building an in-app "Report a bug" feature: wire the frontend UI to
     * an app backend method that calls this. The issue lands in the app's
     * issue tracker, visible to the app's team and available to the Remy agent.
     *
     * **Backend / managed-context only.** It authenticates with the app's hook
     * token (the same credential used for `db` queries), and the app id is
     * derived from that token server-side. Calling it outside a managed
     * context (e.g. with a plain API key) will fail with `401`.
     *
     * Rate limited per app (20 / 60s). On the limit this throws a
     * `MindStudioError` with `code === 'rate_limited'` and `status === 429` —
     * catch it to show a graceful "try again shortly" message. Every call
     * creates a new issue (no dedupe), so guard against double-submit in the UI.
     *
     * @returns The filed issue. Show `issue.number` to confirm "Reported as #42".
     *
     * @example
     * ```ts
     * // app backend method, e.g. exported as `reportBug`
     * export async function reportBug({ title, details, userEmail }) {
     *   try {
     *     const { number } = await mindstudio.reportIssue({
     *       title,
     *       body: details,
     *       kind: 'bug',
     *       reporter: userEmail, // free-form label; omit for anonymous
     *     });
     *     return { ok: true, issueNumber: number };
     *   } catch (e) {
     *     if (e instanceof MindStudioError && e.code === 'rate_limited') {
     *       return { ok: false, retry: true };
     *     }
     *     throw e;
     *   }
     * }
     * ```
     */
    reportIssue(input: ReportIssueInput): Promise<ReportedIssue>;
    /**
     * Invalidate the prerendered snapshot(s) for the current app so crawlers get
     * a fresh render on their next visit. Call after content behind a prerendered
     * page changes (e.g. a short URL's target). Omit `paths` (or pass an empty
     * array) to purge every snapshot for the app.
     *
     * Raw hook-token call (mirrors `reportIssue`) — the appId comes from the
     * token. Backend / managed-context only.
     *
     * ```ts
     * await mindstudio.invalidatePrerender(['/u/abc']);
     * ```
     */
    invalidatePrerender(paths?: string[]): Promise<{
        purged: number | 'all';
    }>;
    /**
     * Get auth and database context for an app.
     *
     * Returns role assignments and managed database schemas. Useful for
     * hydrating `auth` and `db` namespaces when running outside the sandbox.
     *
     * When called with a CALLBACK_TOKEN (managed mode), `appId` is optional —
     * the platform resolves the app from the token. With an API key, `appId`
     * is required.
     *
     * ```ts
     * const ctx = await agent.getAppContext('your-app-id');
     * console.log(ctx.auth.roleAssignments, ctx.databases);
     * ```
     */
    getAppContext(appId?: string): Promise<AppContextResult>;
    /** Update the display name of the authenticated user/agent. */
    changeName(displayName: string): Promise<void>;
    /** Update the profile picture of the authenticated user/agent. */
    changeProfilePicture(url: string): Promise<void>;
    /**
     * Upload a file to the MindStudio CDN.
     *
     * Gets a presigned upload request from the API, POSTs the file as
     * multipart/form-data, and returns the permanent public URL.
     *
     * @deprecated For app file storage use the `files` store
     * (`files.defineStore(...).put(...)`) — private by default, app-scoped, and
     * served on the app's own domain. `uploadFile` uploads to the shared account
     * media CDN; it remains only for account-level assets (e.g. an agent avatar
     * passed to `changeProfilePicture`).
     */
    uploadFile(content: Buffer | Uint8Array, options: {
        extension: string;
        type?: string;
        filename?: string;
    }): Promise<UploadFileResult>;
}

interface ActiveCampaignAddNoteStepInput {
    /** ActiveCampaign contact ID to add the note to */
    contactId: string;
    /** Note text content */
    note: string;
    /** ActiveCampaign OAuth connection ID */
    connectionId?: string;
}
type ActiveCampaignAddNoteStepOutput = unknown;
interface ActiveCampaignCreateContactStepInput {
    /** Contact email address */
    email: string;
    /** Contact first name */
    firstName: string;
    /** Contact last name */
    lastName: string;
    /** Contact phone number */
    phone: string;
    /** ActiveCampaign account ID to associate the contact with */
    accountId: string;
    /** Custom field values keyed by field ID */
    customFields: Record<string, unknown>;
    /** ActiveCampaign OAuth connection ID */
    connectionId?: string;
}
interface ActiveCampaignCreateContactStepOutput {
    /** ActiveCampaign contact ID of the created contact */
    contactId: string;
}
interface AddSubtitlesToVideoStepInput {
    /** URL of the source video */
    videoUrl: string;
    /** ISO language code for subtitle transcription */
    language: string;
    /** Google Font name for subtitle text */
    fontName: string;
    /** Font size in pixels. Default: 100. */
    fontSize: number;
    /** Font weight for subtitle text */
    fontWeight: "normal" | "bold" | "black";
    /** Color of the subtitle text */
    fontColor: "white" | "black" | "red" | "green" | "blue" | "yellow" | "orange" | "purple" | "pink" | "brown" | "gray" | "cyan" | "magenta";
    /** Color used to highlight the currently spoken word */
    highlightColor: "white" | "black" | "red" | "green" | "blue" | "yellow" | "orange" | "purple" | "pink" | "brown" | "gray" | "cyan" | "magenta";
    /** Width of the text stroke outline in pixels */
    strokeWidth: number;
    /** Color of the text stroke outline */
    strokeColor: "black" | "white" | "red" | "green" | "blue" | "yellow" | "orange" | "purple" | "pink" | "brown" | "gray" | "cyan" | "magenta";
    /** Background color behind subtitle text. Use 'none' for transparent. */
    backgroundColor: "black" | "white" | "red" | "green" | "blue" | "yellow" | "orange" | "purple" | "pink" | "brown" | "gray" | "cyan" | "magenta" | "none";
    /** Opacity of the subtitle background. 0.0 = fully transparent, 1.0 = fully opaque. */
    backgroundOpacity: number;
    /** Vertical position of subtitle text on screen */
    position: "top" | "center" | "bottom";
    /** Vertical offset in pixels from the position. Positive moves down, negative moves up. Default: 75. */
    yOffset: number;
    /** Maximum number of words per subtitle segment. Use 1 for single-word display, 2-3 for short phrases, or 8-12 for full sentences. Default: 3. */
    wordsPerSubtitle: number;
    /** When true, enables bounce-style entrance animation for subtitles. Default: true. */
    enableAnimation: boolean;
    /** When true, the asset is created but hidden from the user's gallery (tagged as intermediate) */
    intermediateAsset?: boolean;
}
interface AddSubtitlesToVideoStepOutput {
    /** URL of the video with subtitles added */
    videoUrl: string;
}
interface AirtableCreateUpdateRecordStepInput {
    /** Airtable OAuth connection ID */
    connectionId?: string;
    /** Airtable base ID */
    baseId: string;
    /** Airtable table ID */
    tableId: string;
    /** Record ID to update. Omit to create a new record */
    recordId?: string;
    /** How to handle unspecified fields on update. 'onlySpecified' leaves them as-is, 'all' clears them */
    updateMode?: "onlySpecified" | "all";
    /** Field schema metadata used for type resolution */
    fields: unknown;
    /** Field values to set, keyed by field ID */
    recordData: Record<string, unknown>;
}
interface AirtableCreateUpdateRecordStepOutput {
    /** The Airtable record ID of the created or updated record */
    recordId: string;
}
interface AirtableDeleteRecordStepInput {
    /** Airtable OAuth connection ID */
    connectionId?: string;
    /** Airtable base ID */
    baseId: string;
    /** Airtable table ID */
    tableId: string;
    /** Record ID to delete */
    recordId: string;
}
interface AirtableDeleteRecordStepOutput {
    /** Whether the record was successfully deleted */
    deleted: boolean;
}
interface AirtableGetRecordStepInput {
    /** Airtable OAuth connection ID */
    connectionId?: string;
    /** Airtable base ID (e.g. "appXXXXXX") */
    baseId: string;
    /** Airtable table ID (e.g. "tblXXXXXX") */
    tableId: string;
    /** Record ID to fetch (e.g. "recXXXXXX") */
    recordId: string;
}
interface AirtableGetRecordStepOutput {
    /** The retrieved Airtable record, or null if not found */
    record: {
        /** Airtable record ID */
        id: string;
        /** ISO 8601 timestamp when the record was created */
        createdTime: string;
        /** Field values keyed by field name */
        fields: Record<string, unknown>;
    } | null;
}
interface AirtableGetTableRecordsStepInput {
    /** Airtable OAuth connection ID */
    connectionId?: string;
    /** Airtable base ID (e.g. "appXXXXXX") */
    baseId: string;
    /** Airtable table ID (e.g. "tblXXXXXX") */
    tableId: string;
    /** Output format for the result. Defaults to 'json' */
    outputFormat?: "json" | "csv";
    /** Maximum number of records to return. Defaults to 100, max 1000 */
    limit?: number;
}
interface AirtableGetTableRecordsStepOutput {
    /** The list of records retrieved from the Airtable table */
    records: {
        /** Airtable record ID */
        id: string;
        /** ISO 8601 timestamp when the record was created */
        createdTime: string;
        /** Field values keyed by field name */
        fields: Record<string, unknown>;
    }[];
}
interface AnalyzeImageStepInput {
    /** Instructions describing what to look for or extract from the image */
    prompt: string;
    /** URL of a single image to analyze. Kept for backward compatibility; prefer imageUrls. */
    imageUrl?: string;
    /** One or more image URLs to analyze together in a single model request */
    imageUrls?: string[];
    /** Optional model configuration override. Uses the workflow's default vision model if not specified */
    visionModelOverride?: {
        model: string;
        config?: Record<string, unknown>;
    } | {
        /** Model identifier (e.g. "gpt-4", "claude-3-opus") */
        model: string;
        /** Sampling temperature for the model (0-2) */
        temperature: number;
        /** Maximum number of tokens in the model's response */
        maxResponseTokens: number;
        /** Whether to skip the system preamble/instructions */
        ignorePreamble?: boolean;
        /** Preprocessor applied to user messages before sending to the model */
        userMessagePreprocessor?: {
            /** Data source identifier for the preprocessor */
            dataSource?: string;
            /** Template string applied to user messages before sending to the model */
            messageTemplate?: string;
            /** Maximum number of results to include from the data source */
            maxResults?: number;
            /** Whether the preprocessor is active */
            enabled?: boolean;
            /** Whether child steps should inherit this preprocessor configuration */
            shouldInherit?: boolean;
        };
        /** System preamble/instructions for the model */
        preamble?: string;
        /** Whether multi-model candidate generation is enabled */
        multiModelEnabled?: boolean;
        /** Whether the user can edit the model's response */
        editResponseEnabled?: boolean;
        /** Additional model-specific configuration */
        config?: Record<string, unknown>;
    };
}
interface AnalyzeImageStepOutput {
    /** Text analysis of the image generated by the vision model */
    analysis: string;
}
interface AnalyzeVideoStepInput {
    /** Instructions describing what to look for or extract from the video */
    prompt: string;
    /** URL of the video to analyze */
    videoUrl: string;
    /** Optional model configuration override. Uses the workflow's default video analysis model if not specified */
    videoAnalysisModelOverride?: {
        model: string;
        config?: Record<string, unknown>;
    } | {
        /** Model identifier (e.g. "gpt-4", "claude-3-opus") */
        model: string;
        /** Sampling temperature for the model (0-2) */
        temperature: number;
        /** Maximum number of tokens in the model's response */
        maxResponseTokens: number;
        /** Whether to skip the system preamble/instructions */
        ignorePreamble?: boolean;
        /** Preprocessor applied to user messages before sending to the model */
        userMessagePreprocessor?: {
            /** Data source identifier for the preprocessor */
            dataSource?: string;
            /** Template string applied to user messages before sending to the model */
            messageTemplate?: string;
            /** Maximum number of results to include from the data source */
            maxResults?: number;
            /** Whether the preprocessor is active */
            enabled?: boolean;
            /** Whether child steps should inherit this preprocessor configuration */
            shouldInherit?: boolean;
        };
        /** System preamble/instructions for the model */
        preamble?: string;
        /** Whether multi-model candidate generation is enabled */
        multiModelEnabled?: boolean;
        /** Whether the user can edit the model's response */
        editResponseEnabled?: boolean;
        /** Additional model-specific configuration */
        config?: Record<string, unknown>;
    };
}
interface AnalyzeVideoStepOutput {
    /** Text analysis of the video generated by the video analysis model */
    analysis: string;
}
interface CaptureThumbnailStepInput {
    /** URL of the source video to capture a frame from */
    videoUrl: string;
    /** Timestamp in seconds to capture the frame, or 'last' for the final frame */
    at: number | string;
}
interface CaptureThumbnailStepOutput {
    /** URL of the captured thumbnail image */
    thumbnailUrl: string;
}
interface CheckAppRoleStepInput {
    /** The role name to check (supports {{variables}}) */
    roleName: string;
    /** Step to transition to if the user has the role (same workflow) */
    hasRoleStepId?: string;
    /** Workflow to jump to if the user has the role (cross workflow) */
    hasRoleWorkflowId?: string;
    /** Step to transition to if the user does not have the role (same workflow) */
    noRoleStepId?: string;
    /** Workflow to jump to if the user does not have the role (cross workflow) */
    noRoleWorkflowId?: string;
}
interface CheckAppRoleStepOutput {
    /** Whether the current user has the checked role */
    hasRole: boolean;
    /** All roles assigned to the current user for this app */
    userRoles: string[];
}
interface CodaCreateUpdatePageStepInput {
    /** Coda OAuth connection ID */
    connectionId?: string;
    /** Page configuration including document ID, title, content, and optional parent page */
    pageData: {
        /** Coda document ID */
        docId: string;
        /** Page ID to update. Omit to create a new page */
        pageId?: string;
        /** Page title */
        name: string;
        /** Page subtitle */
        subtitle: string;
        /** Page icon name */
        iconName: string;
        /** Page cover image URL */
        imageUrl: string;
        /** Parent page ID for nesting under another page */
        parentPageId?: string;
        /** Page content (markdown string or canvas content object) */
        pageContent: string | unknown;
        /** Content update payload for partial updates */
        contentUpdate?: unknown;
        /** How to insert content on update: "append" or "replace" */
        insertionMode?: string;
    };
}
interface CodaCreateUpdatePageStepOutput {
    /** The Coda page ID of the created or updated page */
    pageId: string;
}
interface CodaCreateUpdateRowStepInput {
    /** Coda OAuth connection ID */
    connectionId?: string;
    /** Coda document ID */
    docId: string;
    /** Table ID within the document */
    tableId: string;
    /** Row ID to update. Omit to create a new row */
    rowId?: string;
    /** Column values to set, keyed by column ID */
    rowData: Record<string, unknown>;
}
interface CodaCreateUpdateRowStepOutput {
    /** The Coda row ID of the created or updated row */
    rowId: string;
}
interface CodaFindRowStepInput {
    /** Coda OAuth connection ID */
    connectionId?: string;
    /** Coda document ID */
    docId: string;
    /** Table ID to search within */
    tableId: string;
    /** Column values to match against, keyed by column ID. All criteria are ANDed together */
    rowData: Record<string, unknown>;
}
interface CodaFindRowStepOutput {
    /** The first matching row, or null if no match was found */
    row: {
        /** Coda row ID */
        id: string;
        /** Column values keyed by column name */
        values: Record<string, unknown>;
    } | null;
}
interface CodaGetPageStepInput {
    /** Coda OAuth connection ID */
    connectionId?: string;
    /** Coda document ID */
    docId: string;
    /** Page ID within the document */
    pageId: string;
    /** Export format for the page content. Defaults to 'html' */
    outputFormat?: "html" | "markdown";
}
interface CodaGetPageStepOutput {
    /** Page content in the requested format (HTML or Markdown) */
    content: string;
}
interface CodaGetTableRowsStepInput {
    /** Coda OAuth connection ID */
    connectionId?: string;
    /** Coda document ID */
    docId: string;
    /** Table ID within the document */
    tableId: string;
    /** Maximum number of rows to return. Defaults to 10000 */
    limit?: number | string;
    /** Output format for the result. Defaults to 'json' */
    outputFormat?: "json" | "csv";
}
interface CodaGetTableRowsStepOutput {
    /** The list of rows retrieved from the Coda table */
    rows: {
        /** Coda row ID */
        id: string;
        /** Column values keyed by column name */
        values: Record<string, unknown>;
    }[];
}
interface ConvertPdfToImagesStepInput {
    /** URL of the PDF document to convert */
    pdfUrl: string;
}
interface ConvertPdfToImagesStepOutput {
    /** CDN URLs of the generated page images, one per page of the PDF */
    imageUrls: string[];
}
interface CreateDataSourceStepInput {
    /** Name for the new data source (supports variable interpolation) */
    name: string;
}
type CreateDataSourceStepOutput = unknown;
interface CreateGmailDraftStepInput {
    /** Recipient email address(es), comma-separated for multiple */
    to: string;
    /** Email subject line */
    subject: string;
    /** Email body content */
    message: string;
    /** Google OAuth connection ID */
    connectionId?: string;
    /** Body format: "plain", "html", or "markdown" */
    messageType: "plain" | "html" | "markdown";
}
interface CreateGmailDraftStepOutput {
    /** Gmail draft ID */
    draftId: string;
}
interface CreateGoogleCalendarEventStepInput {
    /** Google OAuth connection ID */
    connectionId?: string;
    /** Event title */
    summary: string;
    /** Event description */
    description?: string;
    /** Event location */
    location?: string;
    /** Start time in ISO 8601 format */
    startDateTime: string;
    /** End time in ISO 8601 format */
    endDateTime: string;
    /** Attendee email addresses, one per line */
    attendees?: string;
    /** Whether to attach a Google Meet video call link */
    addMeetLink?: boolean;
    /** Calendar ID (defaults to "primary" if omitted) */
    calendarId?: string;
}
interface CreateGoogleCalendarEventStepOutput {
    /** Google Calendar event ID */
    eventId: string;
    /** URL to view the event in Google Calendar */
    htmlLink: string;
}
interface CreateGoogleDocStepInput {
    /** Title for the new document */
    title: string;
    /** Document body content */
    text: string;
    /** Google OAuth connection ID */
    connectionId?: string;
    /** Format of the text field: "plain", "html", or "markdown" */
    textType: "plain" | "html" | "markdown";
}
interface CreateGoogleDocStepOutput {
    /** URL of the newly created Google Document */
    documentUrl: string;
}
interface CreateGoogleSheetStepInput {
    /** Title for the new spreadsheet */
    title: string;
    /** CSV data to populate the sheet with */
    text: string;
    /** Google OAuth connection ID */
    connectionId?: string;
}
interface CreateGoogleSheetStepOutput {
    /** URL of the newly created Google Spreadsheet */
    spreadsheetUrl: string;
}
interface DeleteDataSourceStepInput {
    /** ID of the data source to delete (supports variable interpolation) */
    dataSourceId: string;
}
type DeleteDataSourceStepOutput = unknown;
interface DeleteDataSourceDocumentStepInput {
    /** ID of the data source containing the document (supports variable interpolation) */
    dataSourceId: string;
    /** ID of the document to delete (supports variable interpolation) */
    documentId: string;
}
type DeleteDataSourceDocumentStepOutput = unknown;
interface DeleteGmailEmailStepInput {
    /** Gmail message ID to delete (move to trash) */
    messageId: string;
    /** Google OAuth connection ID */
    connectionId?: string;
}
type DeleteGmailEmailStepOutput = unknown;
interface DeleteGoogleCalendarEventStepInput {
    /** Google OAuth connection ID */
    connectionId?: string;
    /** Google Calendar event ID to delete */
    eventId: string;
    /** Calendar ID (defaults to "primary" if omitted) */
    calendarId?: string;
}
type DeleteGoogleCalendarEventStepOutput = unknown;
interface DeleteGoogleSheetRowsStepInput {
    /** Google Spreadsheet ID or URL */
    documentId: string;
    /** Sheet/tab name (defaults to first sheet) */
    sheetName?: string;
    /** First row to delete (1-based, inclusive) */
    startRow: string;
    /** Last row to delete (1-based, inclusive) */
    endRow: string;
    /** Google OAuth connection ID */
    connectionId?: string;
}
type DeleteGoogleSheetRowsStepOutput = unknown;
interface DetectChangesStepInput {
    /** Detection mode: 'comparison' for strict string inequality, 'ai' for LLM-based. Default: 'comparison' */
    mode: "ai" | "comparison";
    /** Current value to check (variable template) */
    input: string;
    /** AI mode: what constitutes a meaningful change */
    prompt?: string;
    /** AI mode: model settings override */
    modelOverride?: {
        /** Model identifier (e.g. "gpt-4", "claude-3-opus") */
        model: string;
        /** Sampling temperature for the model (0-2) */
        temperature: number;
        /** Maximum number of tokens in the model's response */
        maxResponseTokens: number;
        /** Whether to skip the system preamble/instructions */
        ignorePreamble?: boolean;
        /** Preprocessor applied to user messages before sending to the model */
        userMessagePreprocessor?: {
            /** Data source identifier for the preprocessor */
            dataSource?: string;
            /** Template string applied to user messages before sending to the model */
            messageTemplate?: string;
            /** Maximum number of results to include from the data source */
            maxResults?: number;
            /** Whether the preprocessor is active */
            enabled?: boolean;
            /** Whether child steps should inherit this preprocessor configuration */
            shouldInherit?: boolean;
        };
        /** System preamble/instructions for the model */
        preamble?: string;
        /** Whether multi-model candidate generation is enabled */
        multiModelEnabled?: boolean;
        /** Whether the user can edit the model's response */
        editResponseEnabled?: boolean;
        /** Additional model-specific configuration */
        config?: Record<string, unknown>;
    };
    /** Optional variable name to store the previous value into for downstream access */
    previousValueVariable?: string;
    /** Step to transition to if changed (same workflow) */
    changedStepId?: string;
    /** Workflow to jump to if changed (cross workflow) */
    changedWorkflowId?: string;
    /** Step to transition to if unchanged (same workflow) */
    unchangedStepId?: string;
    /** Workflow to jump to if unchanged (cross workflow) */
    unchangedWorkflowId?: string;
}
interface DetectChangesStepOutput {
    /** Whether a change was detected */
    hasChanged: boolean;
    /** The resolved input value */
    currentValue: string;
    /** The stored value from last run (empty string on first run) */
    previousValue: string;
    /** True when no previous state exists */
    isFirstRun: boolean;
}
interface DetectPIIStepInput {
    /** Text to scan for personally identifiable information */
    input: string;
    /** Language code of the input text (e.g. "en") */
    language: string;
    /** PII entity types to scan for (e.g. ["PHONE_NUMBER", "EMAIL_ADDRESS"]). Empty array means nothing is scanned. */
    entities: string[];
    /** Step to transition to if PII is detected (workflow mode) */
    detectedStepId?: string;
    /** Step to transition to if no PII is detected (workflow mode) */
    notDetectedStepId?: string;
    /** Variable name to store the raw detection results */
    outputLogVariable?: string | null;
}
interface DetectPIIStepOutput {
    /** Whether any PII was found in the input text */
    detected: boolean;
    /** List of detected PII entities with type, location, and confidence */
    detections: {
        /** PII entity type (e.g. "PHONE_NUMBER", "EMAIL_ADDRESS", "PERSON") */
        entity_type: string;
        /** Start character index in the input text */
        start: number;
        /** End character index in the input text */
        end: number;
        /** Confidence score between 0 and 1 */
        score: number;
    }[];
}
interface DiscordEditMessageStepInput {
    /** Discord bot token for authentication */
    botToken: string;
    /** Discord channel ID containing the message */
    channelId: string;
    /** ID of the message to edit (returned by Send Discord Message) */
    messageId: string;
    /** New message text to replace the existing content */
    text: string;
    /** URL of a file to download and attach to the message (replaces any previous attachments) */
    attachmentUrl?: string;
}
type DiscordEditMessageStepOutput = unknown;
interface DiscordSendFollowUpStepInput {
    /** Discord application ID from the bot registration */
    applicationId: string;
    /** Interaction token provided by the Discord trigger — expires after 15 minutes */
    interactionToken: string;
    /** Message text to send as a follow-up */
    text: string;
    /** URL of a file to download and attach to the message */
    attachmentUrl?: string;
}
interface DiscordSendFollowUpStepOutput {
    /** ID of the sent follow-up message */
    messageId: string;
}
interface DiscordSendMessageStepInput {
    /** "edit" replaces the loading message, "send" sends a new channel message */
    mode: "edit" | "send";
    /** Message text to send */
    text: string;
    /** Discord application ID from the bot registration (required for "reply" mode) */
    applicationId?: string;
    /** Interaction token provided by the Discord trigger — expires after 15 minutes (required for "reply" mode) */
    interactionToken?: string;
    /** Discord bot token for authentication (required for "send" mode) */
    botToken?: string;
    /** Discord channel ID to send the message to (required for "send" mode) */
    channelId?: string;
    /** URL of a file to download and attach to the message */
    attachmentUrl?: string;
}
interface DiscordSendMessageStepOutput {
    /** ID of the sent Discord message, only present in "send" mode (use with Edit Discord Message) */
    messageId?: string;
}
interface DownloadVideoStepInput {
    /** URL of the video to download (supports YouTube, TikTok, etc. via yt-dlp) */
    videoUrl: string;
    /** Output format for the downloaded file */
    format: "mp4" | "mp3";
}
interface DownloadVideoStepOutput {
    /** URL of the downloaded and re-hosted video file */
    videoUrl: string;
}
interface EnhanceImageGenerationPromptStepInput {
    /** The raw prompt to enhance */
    initialPrompt: string;
    /** Whether to also generate a negative prompt */
    includeNegativePrompt: boolean;
    /** Variable name to save the negative prompt into */
    negativePromptDestinationVariableName?: string;
    /** Custom system prompt for the enhancement model. Uses a default prompt if not provided */
    systemPrompt: string;
    /** Model override settings. Leave undefined to use the default model */
    modelOverride?: unknown;
}
interface EnhanceImageGenerationPromptStepOutput {
    /** The enhanced image generation prompt */
    prompt: string;
    /** The negative prompt, only present when includeNegativePrompt was true */
    negativePrompt?: string;
}
interface EnhanceVideoGenerationPromptStepInput {
    /** The raw prompt to enhance */
    initialPrompt: string;
    /** Whether to also generate a negative prompt */
    includeNegativePrompt: boolean;
    /** Variable name to save the negative prompt into */
    negativePromptDestinationVariableName?: string;
    /** Custom system prompt for the enhancement model. Uses a default prompt if not provided */
    systemPrompt: string;
    /** Model override settings. Leave undefined to use the default model */
    modelOverride?: unknown;
}
interface EnhanceVideoGenerationPromptStepOutput {
    /** The enhanced video generation prompt */
    prompt: string;
    /** The negative prompt, only present when includeNegativePrompt was true */
    negativePrompt?: string;
}
interface EnrichPersonStepInput {
    /** Search parameters to identify the person (ID, name, LinkedIn URL, email, or domain) */
    params: {
        /** Apollo person ID */
        id: string;
        /** Person's full name */
        name: string;
        /** LinkedIn profile URL */
        linkedinUrl: string;
        /** Email address */
        email: string;
        /** Company domain */
        domain: string;
    };
}
interface EnrichPersonStepOutput {
    /** Apollo enrichment result with contact details, employment history, and social profiles */
    data: unknown;
}
interface ExtractAudioFromVideoStepInput {
    /** URL of the source video to extract audio from */
    videoUrl: string;
}
interface ExtractAudioFromVideoStepOutput {
    /** URL of the extracted audio MP3 file */
    audioUrl: string;
}
interface ExtractTextStepInput {
    /** URL or array of URLs to extract text from. Accepts a single URL, comma-separated list, or JSON array */
    url: string | string[];
    /** Optional extraction model id (a `document_extraction` model, e.g. `mistral-ocr-latest`, `llamaparse`, `google-document-ai`). Defaults to the platform default when omitted. */
    model?: string;
}
interface ExtractTextStepOutput {
    /** Extracted text content. A single string for one URL, or an array for multiple URLs */
    text: string | string[];
}
interface FetchDataSourceDocumentStepInput {
    /** ID of the data source containing the document (supports variable interpolation) */
    dataSourceId: string;
    /** ID of the document to fetch (supports variable interpolation) */
    documentId: string;
}
type FetchDataSourceDocumentStepOutput = unknown;
interface FetchGoogleDocStepInput {
    /** Google Document ID (from the document URL) */
    documentId: string;
    /** Google OAuth connection ID */
    connectionId?: string;
    /** Output format: "html", "markdown", "json", or "plain" */
    exportType: "html" | "markdown" | "json" | "plain";
}
interface FetchGoogleDocStepOutput {
    /** Document contents in the requested export format */
    content: string;
}
interface FetchGoogleSheetStepInput {
    /** Google Spreadsheet ID (from the spreadsheet URL) */
    spreadsheetId: string;
    /** Cell range in A1 notation (e.g. "Sheet1!A1:C10") */
    range: string;
    /** Google OAuth connection ID */
    connectionId?: string;
    /** Output format: "csv" or "json" */
    exportType: "csv" | "json";
}
interface FetchGoogleSheetStepOutput {
    /** Spreadsheet data in the requested export format */
    content: string;
}
interface FetchSlackChannelHistoryStepInput {
    /** Slack OAuth connection ID (leave empty to allow user to select) */
    connectionId?: string;
    /** Slack channel ID (leave empty to allow user to select a channel) */
    channelId: string;
    /** Maximum number of messages to return (1-15) */
    limit?: number;
    /** Earliest date to include messages from */
    startDate?: string;
    /** Latest date to include messages up to */
    endDate?: string;
    /** Whether to include images in the output */
    includeImages?: boolean;
    /** Whether to include the raw Slack message object (useful for bot messages with complex attachments) */
    includeRawMessage?: boolean;
}
interface FetchSlackChannelHistoryStepOutput {
    /** List of messages from the channel history */
    messages: {
        from: string;
        content: string;
        timestamp?: string;
        images?: string[];
        rawMessage?: {
            app_id?: string;
            assistant_app_thread?: {
                first_user_thread_reply?: string;
                title?: string;
                title_blocks?: unknown[];
            };
            attachments?: {
                actions?: unknown[];
                app_id?: string;
                app_unfurl_url?: string;
                author_icon?: string;
                author_id?: string;
                author_link?: string;
                author_name?: string;
                author_subname?: string;
                blocks?: unknown[];
                bot_id?: string;
                bot_team_id?: string;
                callback_id?: string;
                channel_id?: string;
                channel_name?: string;
                channel_team?: string;
                color?: string;
                fallback?: string;
                fields?: unknown[];
                file_id?: string;
                filename?: string;
                files?: unknown[];
                footer?: string;
                footer_icon?: string;
                from_url?: string;
                hide_border?: boolean;
                hide_color?: boolean;
                id?: number;
                image_bytes?: number;
                image_height?: number;
                image_url?: string;
                image_width?: number;
                indent?: boolean;
                is_app_unfurl?: boolean;
                is_file_attachment?: boolean;
                is_msg_unfurl?: boolean;
                is_reply_unfurl?: boolean;
                is_thread_root_unfurl?: boolean;
                list?: unknown;
                list_record?: unknown;
                list_record_id?: string;
                list_records?: unknown[];
                list_schema?: unknown[];
                list_view?: unknown;
                list_view_id?: string;
                message_blocks?: unknown[];
                metadata?: unknown;
                mimetype?: string;
                mrkdwn_in?: string[];
                msg_subtype?: string;
                original_url?: string;
                pretext?: string;
                preview?: unknown;
                service_icon?: string;
                service_name?: string;
                service_url?: string;
                size?: number;
                text?: string;
                thumb_height?: number;
                thumb_url?: string;
                thumb_width?: number;
                title?: string;
                title_link?: string;
                ts?: string;
                url?: string;
                video_html?: string;
                video_html_height?: number;
                video_html_width?: number;
                video_url?: string;
            }[];
            blocks?: {
                accessory?: unknown;
                alt_text?: string;
                api_decoration_available?: boolean;
                app_collaborators?: string[];
                app_id?: string;
                author_name?: string;
                block_id?: string;
                bot_user_id?: string;
                button_label?: string;
                call?: unknown;
                call_id?: string;
                description?: unknown;
                developer_trace_id?: string;
                dispatch_action?: boolean;
                element?: unknown;
                elements?: unknown[];
                expand?: boolean;
                external_id?: string;
                fallback?: string;
                fields?: unknown[];
                file?: unknown;
                file_id?: string;
                function_trigger_id?: string;
                hint?: unknown;
                image_bytes?: number;
                image_height?: number;
                image_url?: string;
                image_width?: number;
                is_animated?: boolean;
                is_workflow_app?: boolean;
                label?: unknown;
                optional?: boolean;
                owning_team_id?: string;
                provider_icon_url?: string;
                provider_name?: string;
                sales_home_workflow_app_type?: number;
                share_url?: string;
                slack_file?: unknown;
                source?: string;
                text?: unknown;
                thumbnail_url?: string;
                title?: unknown;
                title_url?: string;
                trigger_subtype?: string;
                trigger_type?: string;
                type?: unknown;
                url?: string;
                video_url?: string;
                workflow_id?: string;
            }[];
            bot_id?: string;
            bot_profile?: {
                app_id?: string;
                deleted?: boolean;
                icons?: unknown;
                id?: string;
                name?: string;
                team_id?: string;
                updated?: number;
            };
            client_msg_id?: string;
            display_as_bot?: boolean;
            edited?: {
                ts?: string;
                user?: string;
            };
            files?: {
                access?: string;
                alt_txt?: string;
                app_id?: string;
                app_name?: string;
                attachments?: unknown[];
                blocks?: unknown[];
                bot_id?: string;
                can_toggle_canvas_lock?: boolean;
                canvas_printing_enabled?: boolean;
                canvas_template_mode?: string;
                cc?: unknown[];
                channel_actions_count?: number;
                channel_actions_ts?: string;
                channels?: string[];
                comments_count?: number;
                converted_pdf?: string;
                created?: number;
                deanimate?: string;
                deanimate_gif?: string;
                display_as_bot?: boolean;
                dm_mpdm_users_with_file_access?: unknown[];
                duration_ms?: number;
                edit_link?: string;
                edit_timestamp?: number;
                editable?: boolean;
                editor?: string;
                editors?: string[];
                external_id?: string;
                external_type?: string;
                external_url?: string;
                favorites?: unknown[];
                file_access?: string;
                filetype?: string;
                from?: unknown[];
                groups?: string[];
                has_more?: boolean;
                has_more_shares?: boolean;
                has_rich_preview?: boolean;
                headers?: unknown;
                hls?: string;
                hls_embed?: string;
                id?: string;
                image_exif_rotation?: number;
                ims?: string[];
                initial_comment?: unknown;
                is_channel_space?: boolean;
                is_external?: boolean;
                is_public?: boolean;
                is_restricted_sharing_enabled?: boolean;
                is_starred?: boolean;
                last_editor?: string;
                last_read?: number;
                lines?: number;
                lines_more?: number;
                linked_channel_id?: string;
                list_csv_download_url?: string;
                list_limits?: unknown;
                list_metadata?: unknown;
                media_display_type?: string;
                media_progress?: unknown;
                mimetype?: string;
                mode?: string;
                mp4?: string;
                mp4_low?: string;
                name?: string;
                non_owner_editable?: boolean;
                num_stars?: number;
                org_or_workspace_access?: string;
                original_attachment_count?: number;
                original_h?: string;
                original_w?: string;
                permalink?: string;
                permalink_public?: string;
                pinned_to?: string[];
                pjpeg?: string;
                plain_text?: string;
                pretty_type?: string;
                preview?: string;
                preview_highlight?: string;
                preview_is_truncated?: boolean;
                preview_plain_text?: string;
                private_channels_with_file_access_count?: number;
                private_file_with_access_count?: number;
                public_url_shared?: boolean;
                quip_thread_id?: string;
                reactions?: unknown[];
                saved?: unknown;
                sent_to_self?: boolean;
                shares?: unknown;
                show_badge?: boolean;
                simplified_html?: string;
                size?: number;
                source_team?: string;
                subject?: string;
                subtype?: string;
                team_pref_version_history_enabled?: boolean;
                teams_shared_with?: unknown[];
                template_conversion_ts?: number;
                template_description?: string;
                template_icon?: string;
                template_name?: string;
                template_title?: string;
                thumb_1024?: string;
                thumb_1024_gif?: string;
                thumb_1024_h?: string;
                thumb_1024_w?: string;
                thumb_160?: string;
                thumb_160_gif?: string;
                thumb_160_h?: string;
                thumb_160_w?: string;
                thumb_360?: string;
                thumb_360_gif?: string;
                thumb_360_h?: string;
                thumb_360_w?: string;
                thumb_480?: string;
                thumb_480_gif?: string;
                thumb_480_h?: string;
                thumb_480_w?: string;
                thumb_64?: string;
                thumb_64_gif?: string;
                thumb_64_h?: string;
                thumb_64_w?: string;
                thumb_720?: string;
                thumb_720_gif?: string;
                thumb_720_h?: string;
                thumb_720_w?: string;
                thumb_80?: string;
                thumb_800?: string;
                thumb_800_gif?: string;
                thumb_800_h?: string;
                thumb_800_w?: string;
                thumb_80_gif?: string;
                thumb_80_h?: string;
                thumb_80_w?: string;
                thumb_960?: string;
                thumb_960_gif?: string;
                thumb_960_h?: string;
                thumb_960_w?: string;
                thumb_gif?: string;
                thumb_pdf?: string;
                thumb_pdf_h?: string;
                thumb_pdf_w?: string;
                thumb_tiny?: string;
                thumb_video?: string;
                thumb_video_h?: number;
                thumb_video_w?: number;
                timestamp?: number;
                title?: string;
                title_blocks?: unknown[];
                to?: unknown[];
                transcription?: unknown;
                update_notification?: number;
                updated?: number;
                url_private?: string;
                url_private_download?: string;
                url_static_preview?: string;
                user?: string;
                user_team?: string;
                username?: string;
                vtt?: string;
            }[];
            icons?: {
                emoji?: string;
                image_36?: string;
                image_48?: string;
                image_64?: string;
                image_72?: string;
            };
            inviter?: string;
            is_locked?: boolean;
            latest_reply?: string;
            metadata?: {
                event_payload?: unknown;
                event_type?: string;
            };
            parent_user_id?: string;
            purpose?: string;
            reactions?: {
                count?: number;
                name?: string;
                url?: string;
                users?: string[];
            }[];
            reply_count?: number;
            reply_users?: string[];
            reply_users_count?: number;
            root?: {
                bot_id?: string;
                icons?: unknown;
                latest_reply?: string;
                parent_user_id?: string;
                reply_count?: number;
                reply_users?: string[];
                reply_users_count?: number;
                subscribed?: boolean;
                subtype?: string;
                text?: string;
                thread_ts?: string;
                ts?: string;
                type?: string;
                username?: string;
            };
            subscribed?: boolean;
            subtype?: string;
            team?: string;
            text?: string;
            thread_ts?: string;
            topic?: string;
            ts?: string;
            type?: string;
            upload?: boolean;
            user?: string;
            username?: string;
            x_files?: string[];
        };
    }[];
}
interface FetchYoutubeCaptionsStepInput {
    /** YouTube video URL to fetch captions for */
    videoUrl: string;
    /** Output format: "text" for timestamped plain text, "json" for structured transcript data */
    exportType: "text" | "json";
    /** Language code for the captions (e.g. "en") */
    language: string;
}
interface FetchYoutubeCaptionsStepOutput {
    /** Parsed transcript segments with text and start timestamps */
    transcripts: {
        /** Transcript text segment */
        text: string;
        /** Start time of the segment in seconds */
        start: number;
    }[];
}
interface FetchYoutubeChannelStepInput {
    /** YouTube channel URL (e.g. https://www.youtube.com/@ChannelName or /channel/ID) */
    channelUrl: string;
}
type FetchYoutubeChannelStepOutput = Record<string, unknown>;
interface FetchYoutubeCommentsStepInput {
    /** YouTube video URL to fetch comments for */
    videoUrl: string;
    /** Output format: "text" for markdown-formatted text, "json" for structured comment data */
    exportType: "text" | "json";
    /** Maximum number of comment pages to fetch (1-5) */
    limitPages: string;
}
interface FetchYoutubeCommentsStepOutput {
    /** List of comments retrieved from the video */
    comments: {
        /** Unique comment identifier */
        id: string;
        /** Direct URL to the comment */
        link: string;
        /** Date the comment was published */
        publishedDate: string;
        /** Text content of the comment */
        text: string;
        /** Number of likes on the comment */
        likes: number;
        /** Number of replies to the comment */
        replies: number;
        /** Display name of the comment author */
        author: string;
        /** URL to the author's YouTube channel */
        authorLink: string;
        /** URL of the author's profile image */
        authorImg: string;
    }[];
}
interface FetchYoutubeVideoStepInput {
    /** YouTube video URL to fetch metadata for */
    videoUrl: string;
}
type FetchYoutubeVideoStepOutput = Record<string, unknown>;
interface Generate3dModelStepInput {
    /** Text prompt for text-to-3D models, or optional guidance for image-to-3D models */
    prompt?: string;
    /** When true, the asset is created but hidden from the user's gallery (tagged as intermediate) */
    intermediateAsset?: boolean;
    /** Optional model configuration override. Uses the workflow's default 3D model if not specified */
    threeDModelOverride?: {
        /** 3D generation model identifier */
        model: string;
        /** Additional model-specific configuration */
        config?: Record<string, unknown>;
    };
}
interface Generate3dModelStepOutput {
    prompt?: string;
    glbUrl: string;
    fbxUrl?: string;
    objUrl?: string;
    usdzUrl?: string;
    thumbnailUrl?: string;
    textureUrls?: Record<string, unknown>[];
    providerTaskId?: string;
    resolvedConfig?: Record<string, unknown>;
}
interface GenerateChartStepInput {
    /** Chart configuration including type, data, and rendering options */
    chart: {
        /** The type of chart to generate */
        chartType: "bar" | "line" | "pie";
        /** Chart.js-compatible JSON data serialized as a string */
        data: string;
        /** Image rendering options */
        options: {
            /** Image width in pixels (e.g. "500") */
            width: string;
            /** Image height in pixels (e.g. "300") */
            height: string;
        };
    };
}
interface GenerateChartStepOutput {
    /** URL of the generated chart image */
    chartUrl: string;
}
interface GenerateImageStepInput {
    /** Text prompt describing the image to generate */
    prompt: string;
    /** When true, the asset is created but hidden from the user's gallery (tagged as intermediate) */
    intermediateAsset?: boolean;
    /** Optional model configuration override. Uses the workflow's default image model if not specified */
    imageModelOverride?: {
        /** Image generation model identifier */
        model: string;
        /** Additional model-specific configuration */
        config?: Record<string, unknown>;
    };
    /** Whether to generate multiple image variants in parallel */
    generateVariants?: boolean;
    /** Number of variants to generate (max 10) */
    numVariants?: number;
    /**
   * Whether to add a MindStudio watermark to the generated image.
   *
   * The watermark is a product mark on assets generated in the MindStudio UI. A step run directly via the SDK or API is producing the app's own asset, so it is never watermarked and this flag has no effect there.
   */
    addWatermark?: boolean;
}
interface GenerateImageStepOutput {
    /** CDN URL of the generated image, or array of URLs when generating multiple variants */
    imageUrl: string | string[];
}
interface GenerateLipsyncStepInput {
    /** When true, the asset is created but hidden from the user's gallery (tagged as intermediate) */
    intermediateAsset?: boolean;
    /**
   * Whether to add a MindStudio watermark to the generated video.
   *
   * The watermark is a product mark on assets generated in the MindStudio UI. A step run directly via the SDK or API is producing the app's own asset, so it is never watermarked and this flag has no effect there.
   */
    addWatermark?: boolean;
    /** Optional model configuration override. Uses the workflow's default lipsync model if not specified */
    lipsyncModelOverride?: {
        model: string;
        config?: Record<string, unknown>;
    };
}
type GenerateLipsyncStepOutput = unknown;
interface GenerateMusicStepInput {
    /** The instructions (prompt) for the music generation */
    text: string;
    /** When true, the asset is created but hidden from the user's gallery (tagged as intermediate) */
    intermediateAsset?: boolean;
    /** Optional model configuration override. Uses the workflow's default music model if not specified */
    musicModelOverride?: {
        model: string;
        config?: Record<string, unknown>;
    };
}
type GenerateMusicStepOutput = unknown;
interface GeneratePdfStepInput {
    /** The HTML or Markdown source template for the asset */
    source: string;
    /** Source type: html, markdown (auto-formatted), spa (single page app), raw (pre-generated HTML in a variable), dynamic (AI-generated from prompt), or customInterface */
    sourceType: "html" | "markdown" | "spa" | "raw" | "dynamic" | "customInterface";
    /** The output format for the generated asset */
    outputFormat: "pdf" | "png" | "html" | "mp4" | "openGraph";
    /** Page size for PDF, PNG, or MP4 output */
    pageSize: "full" | "letter" | "A4" | "custom";
    /** Test data used for previewing the template with sample variable values */
    testData: Record<string, unknown>;
    /** Additional rendering options */
    options?: {
        /** Custom page width in pixels (for custom pageSize) */
        pageWidthPx?: number;
        /** Custom page height in pixels (for custom pageSize) */
        pageHeightPx?: number;
        /** Page orientation for the rendered output */
        pageOrientation?: "portrait" | "landscape";
        /** Whether to re-host third-party images on the MindStudio CDN */
        rehostMedia?: boolean;
        /** Duration in seconds for MP4 video output */
        videoDurationSeconds?: number;
    };
    /** Single page app source configuration (advanced) */
    spaSource?: {
        /** Source code of the SPA (legacy, use files instead) */
        source?: string;
        /** Last compiled source (cached) */
        lastCompiledSource?: string;
        /** Multi-file SPA source */
        files?: Record<string, unknown>;
        /** Available route paths in the SPA */
        paths: string[];
        /** Root URL of the SPA bundle */
        root: string;
        /** URL of the zipped SPA bundle */
        zipUrl: string;
    };
    /** Raw HTML source stored in a variable, using handlebars syntax (e.g. {{myHtmlVariable}}) */
    rawSource?: string;
    /** Prompt to generate the HTML dynamically when sourceType is "dynamic" */
    dynamicPrompt?: string;
    /** Model override for dynamic HTML generation. Leave undefined to use the default model */
    dynamicSourceModelOverride?: {
        /** Model identifier (e.g. "gpt-4", "claude-3-opus") */
        model: string;
        /** Sampling temperature for the model (0-2) */
        temperature: number;
        /** Maximum number of tokens in the model's response */
        maxResponseTokens: number;
        /** Whether to skip the system preamble/instructions */
        ignorePreamble?: boolean;
        /** Preprocessor applied to user messages before sending to the model */
        userMessagePreprocessor?: {
            /** Data source identifier for the preprocessor */
            dataSource?: string;
            /** Template string applied to user messages before sending to the model */
            messageTemplate?: string;
            /** Maximum number of results to include from the data source */
            maxResults?: number;
            /** Whether the preprocessor is active */
            enabled?: boolean;
            /** Whether child steps should inherit this preprocessor configuration */
            shouldInherit?: boolean;
        };
        /** System preamble/instructions for the model */
        preamble?: string;
        /** Whether multi-model candidate generation is enabled */
        multiModelEnabled?: boolean;
        /** Whether the user can edit the model's response */
        editResponseEnabled?: boolean;
        /** Additional model-specific configuration */
        config?: Record<string, unknown>;
    };
    /** Controls how the step transitions after displaying in foreground mode */
    transitionControl?: "default" | "native";
    /** Controls visibility of the share button on displayed assets */
    shareControl?: "default" | "hidden";
    /** URL of a custom Open Graph share image */
    shareImageUrl?: string;
    /** When true, the asset is created but hidden from the user's gallery (tagged as intermediate) */
    intermediateAsset?: boolean;
}
interface GeneratePdfStepOutput {
    /** CDN URL of the generated asset (PDF, PNG, HTML, or MP4 depending on outputFormat) */
    url: string;
}
interface GenerateStaticVideoFromImageStepInput {
    /** URL of the source image to convert to video */
    imageUrl: string;
    /** Duration of the output video in seconds */
    duration: string;
}
interface GenerateStaticVideoFromImageStepOutput {
    /** URL of the generated static video */
    videoUrl: string;
}
interface GenerateVideoStepInput {
    /** Text prompt describing the video to generate */
    prompt: string;
    /** When true, the asset is created but hidden from the user's gallery (tagged as intermediate) */
    intermediateAsset?: boolean;
    /** Optional model configuration override. Uses the workflow's default video model if not specified */
    videoModelOverride?: {
        /** Video generation model identifier */
        model: string;
        /** Additional model-specific configuration */
        config?: Record<string, unknown>;
    };
    /** Whether to generate multiple video variants in parallel */
    generateVariants?: boolean;
    /** Number of variants to generate (max 10) */
    numVariants?: number;
    /**
   * Whether to add a MindStudio watermark to the generated video.
   *
   * The watermark is a product mark on assets generated in the MindStudio UI. A step run directly via the SDK or API is producing the app's own asset, so it is never watermarked and this flag has no effect there.
   */
    addWatermark?: boolean;
}
interface GenerateVideoStepOutput {
    /** CDN URL of the generated video, or array of URLs when generating multiple variants */
    videoUrl: string | string[];
}
interface GetGmailAttachmentsStepInput {
    /** Gmail message ID */
    messageId: string;
    /** Google OAuth connection ID */
    connectionId?: string;
}
type GetGmailAttachmentsStepOutput = unknown;
interface GetGmailDraftStepInput {
    /** Gmail draft ID to retrieve */
    draftId: string;
    /** Google OAuth connection ID */
    connectionId?: string;
}
interface GetGmailDraftStepOutput {
    /** Gmail draft ID */
    draftId: string;
    /** Gmail message ID */
    messageId: string;
    /** Email subject */
    subject: string;
    /** Recipient email */
    to: string;
    /** Sender email */
    from: string;
    /** Draft body content */
    body: string;
}
interface GetGmailEmailStepInput {
    /** Gmail message ID to retrieve */
    messageId: string;
    /** Google OAuth connection ID */
    connectionId?: string;
}
interface GetGmailEmailStepOutput {
    /** Gmail message ID */
    messageId: string;
    /** Email subject */
    subject: string;
    /** Sender email */
    from: string;
    /** Recipient email */
    to: string;
    /** Email date */
    date: string;
    /** Email body content */
    body: string;
    /** Comma-separated label IDs */
    labels: string;
}
interface GetGmailUnreadCountStepInput {
    /** Google OAuth connection ID */
    connectionId?: string;
}
type GetGmailUnreadCountStepOutput = unknown;
interface GetGoogleCalendarEventStepInput {
    /** Google OAuth connection ID */
    connectionId?: string;
    /** Google Calendar event ID to retrieve */
    eventId: string;
    /** Format for the variable output: "json" or "text" */
    exportType: "json" | "text";
    /** Calendar ID (defaults to "primary" if omitted) */
    calendarId?: string;
}
interface GetGoogleCalendarEventStepOutput {
    /** The retrieved calendar event */
    event: {
        /** Google Calendar event ID */
        id?: string | null;
        /** Event status (e.g. "confirmed", "tentative", "cancelled") */
        status?: string | null;
        /** URL to view the event in Google Calendar */
        htmlLink?: string | null;
        /** Timestamp when the event was created */
        created?: string | null;
        /** Timestamp when the event was last updated */
        updated?: string | null;
        /** Event title */
        summary?: string | null;
        /** Event description */
        description?: string | null;
        /** Event location */
        location?: string | null;
        /** Event organizer */
        organizer?: {
            displayName?: string | null;
            email?: string | null;
        } | null;
        /** Event start time and timezone */
        start?: {
            dateTime?: string | null;
            timeZone?: string | null;
        } | null;
        /** Event end time and timezone */
        end?: {
            dateTime?: string | null;
            timeZone?: string | null;
        } | null;
        /** List of event attendees */
        attendees?: ({
            displayName?: string | null;
            email?: string | null;
            responseStatus?: string | null;
        })[] | null;
    };
}
interface GetGoogleDriveFileStepInput {
    /** Google Drive file ID */
    fileId: string;
    /** Google OAuth connection ID */
    connectionId?: string;
}
interface GetGoogleDriveFileStepOutput {
    /** CDN URL of the downloaded file */
    url: string;
    /** Original file name */
    name: string;
    /** File MIME type */
    mimeType: string;
    /** File size in bytes */
    size: number;
}
interface GetGoogleSheetInfoStepInput {
    /** Google Spreadsheet ID or URL */
    documentId: string;
    /** Google OAuth connection ID */
    connectionId?: string;
}
interface GetGoogleSheetInfoStepOutput {
    /** Spreadsheet title */
    title: string;
    /** List of sheets with their properties */
    sheets: {
        sheetId: number;
        title: string;
        rowCount: number;
        columnCount: number;
    }[];
}
interface GetMediaMetadataStepInput {
    /** URL of the audio or video file to analyze */
    mediaUrl: string;
}
interface GetMediaMetadataStepOutput {
    /** JSON string containing the media file metadata */
    metadata: string;
}
interface HubspotCreateCompanyStepInput {
    /** HubSpot OAuth connection ID */
    connectionId?: string;
    /** Company data including domain, name, and additional properties */
    company: {
        /** Company domain, used for matching existing companies */
        domain: string;
        /** Company name */
        name: string;
    };
    /** HubSpot properties enabled for this step, used for type validation */
    enabledProperties: ({
        /** Display label for the HubSpot property */
        label: string;
        /** HubSpot property internal name */
        value: string;
        /** Data type of the property value */
        type: "string" | "number" | "bool";
    })[];
}
interface HubspotCreateCompanyStepOutput {
    /** HubSpot company ID of the created or updated company */
    companyId: string;
}
interface HubspotCreateContactStepInput {
    /** HubSpot OAuth connection ID */
    connectionId?: string;
    /** Contact data including email, first name, last name, and additional properties */
    contact: {
        /** Contact email address, used for matching existing contacts */
        email: string;
        /** Contact first name */
        firstname: string;
        /** Contact last name */
        lastname: string;
    };
    /** HubSpot properties enabled for this step, used for type validation */
    enabledProperties: ({
        /** Display label for the HubSpot property */
        label: string;
        /** HubSpot property internal name */
        value: string;
        /** Data type of the property value */
        type: "string" | "number" | "bool";
    })[];
    /** Company domain to associate the contact with. Creates the company if it does not exist */
    companyDomain: string;
}
interface HubspotCreateContactStepOutput {
    /** HubSpot contact ID of the created or updated contact */
    contactId: string;
}
interface HubspotGetCompanyStepInput {
    /** HubSpot OAuth connection ID */
    connectionId?: string;
    /** How to look up the company: by domain name or HubSpot company ID */
    searchBy: "domain" | "id";
    /** Domain to search by (used when searchBy is 'domain') */
    companyDomain: string;
    /** HubSpot company ID (used when searchBy is 'id') */
    companyId: string;
    /** Extra HubSpot property names to include in the response beyond the defaults */
    additionalProperties: string[];
}
interface HubspotGetCompanyStepOutput {
    /** The retrieved HubSpot company, or null if not found */
    company: {
        id: string;
        properties: Record<string, unknown>;
        createdAt: string;
        updatedAt: string;
        archived: boolean;
    } | null;
}
interface HubspotGetContactStepInput {
    /** HubSpot OAuth connection ID */
    connectionId?: string;
    /** How to look up the contact: by email address or HubSpot contact ID */
    searchBy: "email" | "id";
    /** Email address to search by (used when searchBy is 'email') */
    contactEmail: string;
    /** HubSpot contact ID (used when searchBy is 'id') */
    contactId: string;
    /** Extra HubSpot property names to include in the response beyond the defaults */
    additionalProperties: string[];
}
interface HubspotGetContactStepOutput {
    /** The retrieved HubSpot contact, or null if not found */
    contact: {
        id: string;
        properties: Record<string, unknown>;
        createdAt: string;
        updatedAt: string;
        archived: boolean;
    } | null;
}
interface HunterApiCompanyEnrichmentStepInput {
    /** Domain or URL to look up (e.g. "example.com") */
    domain: string;
}
interface HunterApiCompanyEnrichmentStepOutput {
    /** Enriched company data, or null if the company was not found */
    data: {
        name: string;
        domain: string;
        description: string | null;
        country: string | null;
        state: string | null;
        city: string | null;
        industry: string | null;
        employees_range: string | null;
        logo_url: string | null;
        technologies: string[];
    } | null;
}
interface HunterApiDomainSearchStepInput {
    /** Domain or URL to search for email addresses (e.g. "example.com") */
    domain: string;
}
interface HunterApiDomainSearchStepOutput {
    /** Domain search results including emails and organization info */
    data: {
        /** The searched domain */
        domain: string;
        /** Whether the domain uses disposable email addresses */
        disposable: boolean;
        /** Whether the domain is a webmail provider */
        webmail: boolean;
        /** Whether the domain accepts all email addresses */
        accept_all: boolean;
        /** Common email pattern for the domain (e.g. "{first}.{last}") */
        pattern: string;
        /** Organization name associated with the domain */
        organization: string;
        /** Country of the organization */
        country: string | null;
        /** State or region of the organization */
        state: string | null;
        /** List of email addresses found for the domain */
        emails: ({
            /** Email address */
            value: string;
            /** Email type (e.g. "personal", "generic") */
            type: string;
            /** Confidence score (0-100) */
            confidence: number;
            /** Contact first name */
            first_name: string | null;
            /** Contact last name */
            last_name: string | null;
            /** Job title or position */
            position: string | null;
            /** Seniority level */
            seniority: string | null;
            /** Department within the organization */
            department: string | null;
            /** LinkedIn profile URL */
            linkedin: string | null;
            /** Twitter handle */
            twitter: string | null;
            /** Phone number */
            phone_number: string | null;
        })[];
        /** Other domains linked to this organization */
        linked_domains: string[];
    };
}
interface HunterApiEmailFinderStepInput {
    /** Domain to search (e.g. "example.com"). Full URLs are also accepted */
    domain: string;
    /** Person's first name */
    firstName: string;
    /** Person's last name */
    lastName: string;
}
interface HunterApiEmailFinderStepOutput {
    /** Email finder results including the found email and confidence score */
    data: {
        /** Person's first name */
        first_name: string;
        /** Person's last name */
        last_name: string;
        /** The found email address */
        email: string;
        /** Confidence score (0-100) */
        score: number;
        /** Domain searched */
        domain: string;
        /** Whether the domain accepts all email addresses */
        accept_all: boolean;
        /** Job title or position */
        position: string | null;
        /** Twitter handle */
        twitter: string | null;
        /** LinkedIn profile URL */
        linkedin_url: string | null;
        /** Phone number */
        phone_number: string | null;
        /** Company name */
        company: string | null;
        /** Sources where the email was found */
        sources: {
            /** Domain where the email was found */
            domain: string;
            /** URI of the page where the email was found */
            uri: string;
            /** Date when the email was extracted */
            extracted_on: string;
        }[];
    };
}
interface HunterApiEmailVerificationStepInput {
    /** Email address to verify */
    email: string;
}
interface HunterApiEmailVerificationStepOutput {
    /** Email verification results including status, deliverability, and confidence score */
    data: {
        /** Verification status (e.g. "valid", "invalid", "accept_all", "webmail", "disposable", "unknown") */
        status: string;
        /** Deliverability result */
        result: string;
        /** Confidence score (0-100) */
        score: number;
        /** The verified email address */
        email: string;
        /** Whether the email matches a valid format */
        regexp: boolean;
        /** Whether the email appears to be gibberish */
        gibberish: boolean;
        /** Whether the email uses a disposable email service */
        disposable: boolean;
        /** Whether the email is from a webmail provider */
        webmail: boolean;
        /** Whether MX records exist for the domain */
        mx_records: boolean;
        /** Whether the SMTP server is reachable */
        smtp_server: boolean;
        /** Whether the SMTP mailbox check passed */
        smtp_check: boolean;
        /** Whether the domain accepts all email addresses */
        accept_all: boolean;
        /** Whether the email is blocked */
        block: boolean;
        /** Sources where the email was found */
        sources: {
            /** Domain where the email was found */
            domain: string;
            /** URI of the page where the email was found */
            uri: string;
            /** Date when the email was extracted */
            extracted_on: string;
        }[];
    };
}
interface HunterApiPersonEnrichmentStepInput {
    /** Email address to look up */
    email: string;
}
interface HunterApiPersonEnrichmentStepOutput {
    /** Enriched person data, or an error object if the person was not found */
    data: {
        first_name: string;
        last_name: string;
        email: string;
        position: string | null;
        seniority: string | null;
        department: string | null;
        linkedin_url: string | null;
        twitter: string | null;
        phone_number: string | null;
        company: {
            name: string;
            domain: string;
            industry: string | null;
        } | null;
    } | {
        error: string;
    };
}
interface ImageFaceSwapStepInput {
    /** URL of the target image containing the face to replace */
    imageUrl: string;
    /** URL of the image containing the replacement face */
    faceImageUrl: string;
    /** Face swap engine to use */
    engine: string;
}
interface ImageFaceSwapStepOutput {
    /** CDN URL of the face-swapped image (PNG) */
    imageUrl: string;
}
interface ImageRemoveWatermarkStepInput {
    /** URL of the image to remove the watermark from */
    imageUrl: string;
    /** Watermark removal engine to use */
    engine: string;
    /** When true, the asset is created but hidden from the user's gallery (tagged as intermediate) */
    intermediateAsset?: boolean;
}
interface ImageRemoveWatermarkStepOutput {
    /** CDN URL of the processed image with watermark removed (PNG) */
    imageUrl: string;
}
interface InsertVideoClipsStepInput {
    /** URL of the base video to insert clips into */
    baseVideoUrl: string;
    /** Array of overlay clips to insert at specified timecodes */
    overlayVideos: {
        /** URL of the overlay video clip */
        videoUrl: string;
        /** Timecode in seconds at which to insert this clip */
        startTimeSec: number;
    }[];
    /** Optional xfade transition effect name between clips */
    transition?: string;
    /** Duration of the transition in seconds */
    transitionDuration?: number;
    /** When true, uses audio from the overlay clips instead of the base video audio during inserts */
    useOverlayAudio?: boolean;
    /** When true, the asset is created but hidden from the user's gallery (tagged as intermediate) */
    intermediateAsset?: boolean;
}
interface InsertVideoClipsStepOutput {
    /** URL of the video with clips inserted */
    videoUrl: string;
}
type ListDataSourcesStepInput = Record<string, unknown>;
type ListDataSourcesStepOutput = unknown;
interface ListGmailDraftsStepInput {
    /** Google OAuth connection ID */
    connectionId?: string;
    /** Max drafts to return (default: 10, max: 50) */
    limit?: string;
    /** Format for the variable output: "json" or "text" */
    exportType: "json" | "text";
}
interface ListGmailDraftsStepOutput {
    /** List of draft summaries */
    drafts: {
        /** Gmail draft ID */
        draftId: string;
        /** Gmail message ID */
        messageId: string;
        /** Email subject */
        subject: string;
        /** Recipient email */
        to: string;
        /** Short preview text */
        snippet: string;
    }[];
}
interface ListGmailLabelsStepInput {
    /** Google OAuth connection ID */
    connectionId?: string;
}
type ListGmailLabelsStepOutput = unknown;
interface ListGoogleCalendarEventsStepInput {
    /** Google OAuth connection ID */
    connectionId?: string;
    /** Maximum number of events to return (default: 10) */
    limit: number;
    /** Format for the variable output: "json" or "text" */
    exportType: "json" | "text";
    /** Calendar ID (defaults to "primary" if omitted) */
    calendarId?: string;
}
interface ListGoogleCalendarEventsStepOutput {
    /** List of upcoming calendar events ordered by start time */
    events: ({
        /** Google Calendar event ID */
        id?: string | null;
        /** Event status (e.g. "confirmed", "tentative", "cancelled") */
        status?: string | null;
        /** URL to view the event in Google Calendar */
        htmlLink?: string | null;
        /** Timestamp when the event was created */
        created?: string | null;
        /** Timestamp when the event was last updated */
        updated?: string | null;
        /** Event title */
        summary?: string | null;
        /** Event description */
        description?: string | null;
        /** Event location */
        location?: string | null;
        /** Event organizer */
        organizer?: {
            displayName?: string | null;
            email?: string | null;
        } | null;
        /** Event start time and timezone */
        start?: {
            dateTime?: string | null;
            timeZone?: string | null;
        } | null;
        /** Event end time and timezone */
        end?: {
            dateTime?: string | null;
            timeZone?: string | null;
        } | null;
        /** List of event attendees */
        attendees?: ({
            displayName?: string | null;
            email?: string | null;
            responseStatus?: string | null;
        })[] | null;
    })[];
}
interface ListGoogleDriveFilesStepInput {
    /** Google Drive folder ID (defaults to root) */
    folderId?: string;
    /** Max files to return (default: 20) */
    limit?: number;
    /** Google OAuth connection ID */
    connectionId?: string;
    /** Format for the variable output: "json" or "text" */
    exportType: "json" | "text";
}
interface ListGoogleDriveFilesStepOutput {
    /** List of files in the folder */
    files: {
        id: string;
        name: string;
        mimeType: string;
        size: string;
        webViewLink: string;
        createdTime: string;
        modifiedTime: string;
    }[];
}
interface ListRecentGmailEmailsStepInput {
    /** Google OAuth connection ID */
    connectionId?: string;
    /** Format for the variable output: "json" or "text" */
    exportType: "json" | "text";
    /** Maximum number of emails to return (1-100, default: 5) */
    limit: string;
}
type ListRecentGmailEmailsStepOutput = unknown;
interface LogicStepInput {
    /** Evaluation mode: 'ai' for LLM-based, 'comparison' for operator-based. Default: 'ai' */
    mode?: "ai" | "comparison";
    /** AI mode: prompt context. Comparison mode: left operand (resolved via variables). */
    context: string;
    /** List of conditions to evaluate (objects for managed UIs, strings for code) */
    cases: ({
        /** Unique case identifier */
        id: string;
        /** AI mode: statement to evaluate. Comparison mode: right operand value. */
        condition: string;
        /** Comparison operator (comparison mode only) */
        operator?: "eq" | "neq" | "gt" | "lt" | "gte" | "lte" | "exists" | "not_exists" | "contains" | "not_contains" | "default";
        /** Step to transition to if this case wins (workflow mode only) */
        destinationStepId?: string;
        /** Workflow to jump to if this case wins (uses that workflow's initial step) */
        destinationWorkflowId?: string;
    } | string)[];
    /** Optional model settings override; uses the organization default if not specified (AI mode only) */
    modelOverride?: {
        /** Model identifier (e.g. "gpt-4", "claude-3-opus") */
        model: string;
        /** Sampling temperature for the model (0-2) */
        temperature: number;
        /** Maximum number of tokens in the model's response */
        maxResponseTokens: number;
        /** Whether to skip the system preamble/instructions */
        ignorePreamble?: boolean;
        /** Preprocessor applied to user messages before sending to the model */
        userMessagePreprocessor?: {
            /** Data source identifier for the preprocessor */
            dataSource?: string;
            /** Template string applied to user messages before sending to the model */
            messageTemplate?: string;
            /** Maximum number of results to include from the data source */
            maxResults?: number;
            /** Whether the preprocessor is active */
            enabled?: boolean;
            /** Whether child steps should inherit this preprocessor configuration */
            shouldInherit?: boolean;
        };
        /** System preamble/instructions for the model */
        preamble?: string;
        /** Whether multi-model candidate generation is enabled */
        multiModelEnabled?: boolean;
        /** Whether the user can edit the model's response */
        editResponseEnabled?: boolean;
        /** Additional model-specific configuration */
        config?: Record<string, unknown>;
    };
}
interface LogicStepOutput {
    /** The index of the winning case */
    selectedCase: number;
}
interface MakeDotComRunScenarioStepInput {
    /** Make.com webhook URL for the scenario */
    webhookUrl: string;
    /** Key-value pairs to send as the JSON POST body */
    input: Record<string, unknown>;
}
interface MakeDotComRunScenarioStepOutput {
    /** Response from the Make.com scenario (JSON or string depending on scenario configuration) */
    data: unknown;
}
interface MergeAudioStepInput {
    /** URLs of the MP3 audio clips to merge in order */
    mp3Urls: string[];
    /** FFmpeg MP3 metadata key-value pairs to embed in the output file */
    fileMetadata?: Record<string, unknown>;
    /** URL of an image to embed as album art in the output file */
    albumArtUrl?: string;
    /** When true, the asset is created but hidden from the user's gallery (tagged as intermediate) */
    intermediateAsset?: boolean;
}
interface MergeAudioStepOutput {
    /** URL of the merged audio file */
    audioUrl: string;
}
interface MergeVideosStepInput {
    /** URLs of the video clips to merge in order */
    videoUrls: string[];
    /** Optional xfade transition effect name */
    transition?: string;
    /** Duration of the transition in seconds */
    transitionDuration?: number;
    /** When true, the asset is created but hidden from the user's gallery (tagged as intermediate) */
    intermediateAsset?: boolean;
}
interface MergeVideosStepOutput {
    /** URL of the merged video */
    videoUrl: string;
}
interface MeshyAnimateStepInput {
    /** ID of a completed Meshy rigging task */
    rigTaskId: string;
    /** Animation action ID from the Meshy animation library */
    actionId: number;
}
interface MeshyAnimateStepOutput {
    glbUrl: string;
    fbxUrl?: string;
    objUrl?: string;
    usdzUrl?: string;
    thumbnailUrl?: string;
    textureUrls?: Record<string, unknown>[];
    animations?: {
        name: string;
        glbUrl?: string;
        fbxUrl?: string;
    }[];
    providerTaskId?: string;
}
interface MeshyImageTo3dStepInput {
    /** 1-4 image URLs depicting the same object from different angles */
    imageUrls: string[];
    /** Whether to generate textures (default true) */
    shouldTexture?: boolean;
    /** "triangle" (default) or "quad" */
    topology?: string;
    /** Target polygon count (default 30000, range 100-300000) */
    targetPolycount?: number;
    /** Symmetry mode: "auto" (default), "off", or "on" */
    symmetryMode?: string;
    /** Pose mode: "a-pose", "t-pose", or "" (default, no specific pose) */
    poseMode?: string;
    /** 2D image URL to guide the texturing process (.jpg, .jpeg, .png) */
    textureImageUrl?: string;
}
interface MeshyImageTo3dStepOutput {
    glbUrl: string;
    fbxUrl?: string;
    objUrl?: string;
    usdzUrl?: string;
    thumbnailUrl?: string;
    textureUrls?: Record<string, unknown>[];
    animations?: {
        name: string;
        glbUrl?: string;
        fbxUrl?: string;
    }[];
    providerTaskId?: string;
}
interface MeshyRemeshStepInput {
    /** ID of a completed Meshy task to remesh */
    inputTaskId?: string;
    /** URL to a 3D model file (.glb, .fbx, .obj, .stl) */
    modelUrl?: string;
    /** Topology: "triangle" (default) or "quad" */
    topology?: string;
    /** Target polygon count (default 30000, range 100-300000) */
    targetPolycount?: number;
    /** Resize model to this height in meters (0 or omitted = no resize) */
    resizeHeight?: number;
}
interface MeshyRemeshStepOutput {
    glbUrl: string;
    fbxUrl?: string;
    objUrl?: string;
    usdzUrl?: string;
    thumbnailUrl?: string;
    textureUrls?: Record<string, unknown>[];
    animations?: {
        name: string;
        glbUrl?: string;
        fbxUrl?: string;
    }[];
    providerTaskId?: string;
}
interface MeshyRigStepInput {
    /** ID of a completed Meshy task to rig */
    inputTaskId?: string;
    /** URL to a textured humanoid GLB file (preferred over inputTaskId) */
    modelUrl?: string;
    /** Approximate character height in meters (default 1.7) */
    heightMeters?: number;
}
interface MeshyRigStepOutput {
    glbUrl: string;
    fbxUrl?: string;
    objUrl?: string;
    usdzUrl?: string;
    thumbnailUrl?: string;
    textureUrls?: Record<string, unknown>[];
    animations?: {
        name: string;
        glbUrl?: string;
        fbxUrl?: string;
    }[];
    providerTaskId?: string;
}
interface MeshyTextTo3dStepInput {
    /** Description of the 3D model to generate (max 600 characters) */
    prompt: string;
    /** "standard" (default) or "lowpoly". Lowpoly ignores topology/target_polycount. */
    modelType?: string;
    /** "triangle" (default) or "quad" */
    topology?: string;
    /** Target polygon count (default 30000, range 100-300000) */
    targetPolycount?: number;
    /** Symmetry mode: "auto" (default), "off", or "on" */
    symmetryMode?: string;
    /** Pose mode: "a-pose", "t-pose", or "" (default, no specific pose) */
    poseMode?: string;
}
interface MeshyTextTo3dStepOutput {
    glbUrl: string;
    fbxUrl?: string;
    objUrl?: string;
    usdzUrl?: string;
    thumbnailUrl?: string;
    textureUrls?: Record<string, unknown>[];
    animations?: {
        name: string;
        glbUrl?: string;
        fbxUrl?: string;
    }[];
    providerTaskId?: string;
}
interface MeshyTextureStepInput {
    /** ID of a completed Meshy task to texture */
    inputTaskId?: string;
    /** URL to a 3D model file (.glb, .gltf, .obj, .fbx, .stl) */
    modelUrl?: string;
    /** Text description of desired texture style (max 600 characters) */
    textStylePrompt?: string;
    /** 2D image URL to guide texturing (.jpg, .jpeg, .png) */
    imageStyleUrl?: string;
    /** Preserve original UV mapping (default true) */
    enableOriginalUv?: boolean;
    /** Generate PBR maps (metallic, roughness, normal). Default false. */
    enablePbr?: boolean;
}
interface MeshyTextureStepOutput {
    glbUrl: string;
    fbxUrl?: string;
    objUrl?: string;
    usdzUrl?: string;
    thumbnailUrl?: string;
    textureUrls?: Record<string, unknown>[];
    animations?: {
        name: string;
        glbUrl?: string;
        fbxUrl?: string;
    }[];
    providerTaskId?: string;
}
interface MixAudioIntoVideoStepInput {
    /** URL of the source video */
    videoUrl: string;
    /** URL of the audio track to mix into the video */
    audioUrl: string;
    /** Audio mixing options */
    options: {
        /** When true, preserves the original video audio alongside the new track. Defaults to false. */
        keepVideoAudio?: boolean;
        /** Volume adjustment for the new audio track in decibels. Defaults to 0. */
        audioGainDb?: number;
        /** Volume adjustment for the existing video audio in decibels. Defaults to 0. */
        videoGainDb?: number;
        /** When true, loops the audio track to match the video duration. Defaults to false. */
        loopAudio?: boolean;
    };
    /** When true, the asset is created but hidden from the user's gallery (tagged as intermediate) */
    intermediateAsset?: boolean;
}
interface MixAudioIntoVideoStepOutput {
    /** URL of the video with the mixed audio track */
    videoUrl: string;
}
interface MuteVideoStepInput {
    /** URL of the source video to mute */
    videoUrl: string;
    /** When true, the asset is created but hidden from the user's gallery (tagged as intermediate) */
    intermediateAsset?: boolean;
}
interface MuteVideoStepOutput {
    /** URL of the muted video */
    videoUrl: string;
}
interface N8nRunNodeStepInput {
    /** HTTP method to use (GET or POST) */
    method: string;
    /** Authentication type for the webhook request */
    authentication: "none" | "basic" | "string";
    /** Username for Basic authentication */
    user: string;
    /** Password for Basic authentication */
    password: string;
    /** n8n webhook URL for the workflow node */
    webhookUrl: string;
    /** Key-value pairs sent as query params (GET) or JSON body (POST) */
    input: Record<string, unknown>;
}
interface N8nRunNodeStepOutput {
    /** Response from the n8n node (JSON or string depending on node configuration) */
    data: unknown;
}
interface NotionCreatePageStepInput {
    /** Parent page ID to create the new page under */
    pageId: string;
    /** Page content in markdown format */
    content: string;
    /** Page title */
    title: string;
    /** Notion OAuth connection ID */
    connectionId?: string;
}
interface NotionCreatePageStepOutput {
    /** Notion page ID of the created page */
    pageId: string;
    /** URL to view the page in Notion */
    pageUrl: string;
}
interface NotionUpdatePageStepInput {
    /** Notion page ID to update */
    pageId: string;
    /** New content in markdown format */
    content: string;
    /** How to apply the content: 'append' adds to end, 'overwrite' replaces all existing content */
    mode: "append" | "overwrite";
    /** Notion OAuth connection ID */
    connectionId?: string;
}
interface NotionUpdatePageStepOutput {
    /** Notion page ID of the updated page */
    pageId: string;
    /** URL to view the page in Notion */
    pageUrl: string;
}
interface ParticlePodcastsFindMentionsStepInput {
    /** Knowledge-graph entity ID (person, product, place, etc.) */
    entityId?: string;
    /** Company ID */
    companyId?: string;
    /** Surrounding dialogue lines to include with each mention */
    contextLines?: number;
    /** Max results, up to 100 */
    limit?: number;
    /** Pagination cursor */
    cursor?: string;
}
type ParticlePodcastsFindMentionsStepOutput = unknown;
interface ParticlePodcastsGetEpisodeStepInput {
    /** Episode ID or slug */
    id: string;
}
type ParticlePodcastsGetEpisodeStepOutput = unknown;
interface ParticlePodcastsGetEpisodeTranscriptStepInput {
    /** Episode ID or slug */
    id: string;
    /** Transcript format */
    format?: "dialogue" | "text" | "srt";
    /** Filter to a single speaker */
    speaker?: string;
    /** Start time in seconds */
    start?: number;
    /** End time in seconds */
    end?: number;
}
type ParticlePodcastsGetEpisodeTranscriptStepOutput = unknown;
interface ParticlePodcastsSearchCompaniesStepInput {
    /** Free-text company name */
    q?: string;
    /** Stock ticker */
    ticker?: string;
    /** Company domain */
    domain?: string;
    /** SEC CIK */
    cik?: string;
    /** Wikidata QID */
    qid?: string;
    /** Knowledge-graph entity ID */
    entityId?: string;
    /** Only include companies updated after this ISO timestamp */
    updatedAfter?: string;
    /** Max results */
    limit?: number;
    /** Pagination cursor */
    cursor?: string;
}
type ParticlePodcastsSearchCompaniesStepOutput = unknown;
interface ParticlePodcastsSearchDialogueStepInput {
    /** Meaning-based dialogue search */
    semanticSearch?: string;
    /** Exact-phrase dialogue search */
    keywordSearch?: string;
    /** Restrict to dialogue mentioning this entity */
    entityId?: string;
    /** Restrict to dialogue mentioning this company */
    companyId?: string;
    /** Max results, up to 100 */
    limit?: number;
    /** Pagination cursor */
    cursor?: string;
}
type ParticlePodcastsSearchDialogueStepOutput = unknown;
interface ParticlePodcastsSearchPodcastsStepInput {
    /** Free-text query across podcast title and description */
    q?: string;
    /** Particle taxonomy topic slug */
    topic?: string;
    /** BCP 47 language code */
    language?: string;
    /** Brand-suitability tier filter */
    suitabilityTier?: string;
    /** Max results, up to 100 */
    limit?: number;
    /** Pagination cursor */
    cursor?: string;
}
type ParticlePodcastsSearchPodcastsStepOutput = unknown;
interface PeopleSearchStepInput {
    /** Natural language search query (e.g. "marketing directors at SaaS companies in NYC") */
    smartQuery: string;
    /** Whether to enrich each result with full contact details */
    enrichPeople: boolean;
    /** Whether to enrich each result with full company details */
    enrichOrganizations: boolean;
    /** Maximum number of results to return */
    limit: string;
    /** Page number for pagination */
    page: string;
    /** Advanced search filter parameters */
    params: {
        /** Job titles to search for (comma-separated) */
        personTitles: string;
        /** Whether to include similar/related job titles */
        includeSimilarTitles: string;
        /** Keywords to search for in person profiles */
        qKeywords: string;
        /** Geographic locations of people (comma-separated) */
        personLocations: string;
        /** Seniority levels to filter by (comma-separated) */
        personSeniorities: string;
        /** Geographic locations of organizations (comma-separated) */
        organizationLocations: string;
        /** Organization domains to filter by (comma-separated) */
        qOrganizationDomainsList: string;
        /** Email verification status filter */
        contactEmailStatus: string;
        /** Employee count ranges as semicolon-separated pairs (e.g. "1,10; 250,500") */
        organizationNumEmployeesRanges: string;
        /** Minimum annual revenue filter */
        revenueRangeMin: string;
        /** Maximum annual revenue filter */
        revenueRangeMax: string;
        /** Technology UIDs the organization must use (all required) */
        currentlyUsingAllOfTechnologyUids: string;
        /** Technology UIDs the organization uses (any match) */
        currentlyUsingAnyOfTechnologyUids: string;
        /** Technology UIDs the organization must not use */
        currentlyNotUsingAnyOfTechnologyUids: string;
    };
}
interface PeopleSearchStepOutput {
    /** Apollo search results with matched people and optionally enriched data */
    results: unknown;
}
interface PostToLinkedInStepInput {
    /** The text content of the LinkedIn post */
    message: string;
    /** Who can see the post: "PUBLIC" or "CONNECTIONS" */
    visibility: "PUBLIC" | "CONNECTIONS";
    /** URL of an image to attach to the post */
    imageUrl?: string;
    /** URL of a video to attach to the post */
    videoUrl?: string;
    /** URL of a document (PDF, PPT, DOC) to attach to the post */
    documentUrl?: string;
    /** URL to share as an article link preview */
    articleUrl?: string;
    /** Title text for media or article attachments */
    titleText?: string;
    /** Description text for article attachments */
    descriptionText?: string;
    /** LinkedIn OAuth connection ID */
    connectionId?: string;
}
type PostToLinkedInStepOutput = unknown;
interface PostToSlackChannelStepInput {
    /** Slack channel ID (leave empty to allow user to select a channel) */
    channelId: string;
    /** Message format: "string" for plain text/markdown, "blocks" for Slack Block Kit JSON */
    messageType: "string" | "blocks";
    /** Message content (plain text/markdown for "string" type, or JSON for "blocks" type) */
    message: string;
    /** Slack OAuth connection ID (leave empty to allow user to select) */
    connectionId?: string;
}
type PostToSlackChannelStepOutput = unknown;
interface PostToXStepInput {
    /** The text content of the post (max 280 characters) */
    text: string;
    /** X (Twitter) OAuth connection ID */
    connectionId?: string;
    /** Up to 4 URLs of images, GIFs, or videos to attach to the post */
    mediaUrls?: string[];
}
type PostToXStepOutput = unknown;
interface PostToZapierStepInput {
    /** Zapier webhook URL to send data to */
    webhookUrl: string;
    /** Key-value pairs to send as the JSON POST body */
    input: Record<string, unknown>;
}
interface PostToZapierStepOutput {
    /** Parsed webhook response from Zapier (JSON object, array, or string) */
    data: unknown;
}
interface QueryAppDatabaseStepInput {
    /** Name or ID of the app data database to query */
    databaseId: string;
    /**
   * SQL query to execute. Use {{variables}} directly in the SQL — they are handled according to the `parameterize` setting.
   *
   * When parameterize is true (default):   {{variables}} are extracted from the SQL, replaced with ? placeholders,   resolved via the full MindStudio handlebars pipeline, and passed as safe   parameterized values to SQLite. This prevents SQL injection.   Example: INSERT INTO contacts (name, email) VALUES ({{name}}, {{email}})
   *
   * When parameterize is false:   The entire SQL string is resolved via compileString (standard handlebars   interpolation) and executed as-is. Use this for dynamic/generated SQL   where another step builds the query. The user is responsible for safety.   Example: {{generatedInsertQuery}}
   *
   * Ask the user for the database schema if they have not already provided it.
   */
    sql: string;
    /**
   * Whether to treat {{variables}} as parameterized query values (default: true).
   *
   * - true:  {{vars}} are extracted, replaced with ?, and passed as bind params.          Safe from SQL injection. Use for standard CRUD operations.
   * - false: {{vars}} are interpolated directly into the SQL string via handlebars.          Use when another step generates full or partial SQL (e.g. bulk inserts          with precomputed VALUES). The user is responsible for sanitization.
   */
    parameterize?: boolean;
}
interface QueryAppDatabaseStepOutput {
    /** Result rows for SELECT queries (empty array for write queries) */
    rows: unknown[];
    /** Number of rows affected by INSERT, UPDATE, or DELETE queries (0 for SELECT) */
    changes: number;
}
interface QueryDataSourceStepInput {
    /** ID of the vector data source to query */
    dataSourceId: string;
    /** The search query to run against the data source */
    query: string;
    /** Maximum number of chunks to return (recommended 1-3) */
    maxResults: number;
}
interface QueryDataSourceStepOutput {
    /** All matching chunks joined with newlines */
    text: string;
    /** Individual matching text chunks from the data source */
    chunks: string[];
    /** The resolved search query that was executed */
    query: string;
    /** Source citations for the matched chunks */
    citations: unknown[];
    /** Query execution time in milliseconds */
    latencyMs: number;
}
interface QueryExternalDatabaseStepInput {
    /** Database connection ID configured in the workspace */
    connectionId?: string;
    /** SQL query to execute (supports variable interpolation) */
    query: string;
    /** Output format for the result variable */
    outputFormat: "json" | "csv";
}
interface QueryExternalDatabaseStepOutput {
    /** Query result rows (array of objects for JSON, CSV string for CSV format) */
    data: unknown;
}
interface RedactPIIStepInput {
    /** Text to redact PII from */
    input: string;
    /** Language code of the input text (e.g. "en") */
    language: string;
    /** PII entity types to redact (e.g. ["PHONE_NUMBER", "EMAIL_ADDRESS"]). Empty array means nothing is redacted. */
    entities: string[];
}
interface RedactPIIStepOutput {
    /** The input text with detected PII replaced by entity type placeholders (e.g. "<PHONE_NUMBER>") */
    text: string;
}
interface RemoveBackgroundFromImageStepInput {
    /** Background removal quality tier */
    type?: "standard" | "advanced";
    /** URL of the source image to remove the background from */
    imageUrl: string;
    /** Whether to automatically trim transparent padding from the result, on by default */
    autoCrop?: boolean;
}
interface RemoveBackgroundFromImageStepOutput {
    /** CDN URL of the image with background removed (transparent PNG) */
    imageUrl: string;
}
interface ReplyToGmailEmailStepInput {
    /** Gmail message ID to reply to */
    messageId: string;
    /** Reply body content */
    message: string;
    /** Body format: "plain", "html", or "markdown" */
    messageType: "plain" | "html" | "markdown";
    /** Google OAuth connection ID */
    connectionId?: string;
}
interface ReplyToGmailEmailStepOutput {
    /** Gmail message ID of the sent reply */
    messageId: string;
}
interface ResizeVideoStepInput {
    /** URL of the source video to resize */
    videoUrl: string;
    /** Resize mode: 'fit' scales within max dimensions, 'exact' forces exact dimensions */
    mode: "fit" | "exact";
    /** Maximum width in pixels (used with 'fit' mode) */
    maxWidth?: number;
    /** Maximum height in pixels (used with 'fit' mode) */
    maxHeight?: number;
    /** Exact width in pixels (used with 'exact' mode) */
    width?: number;
    /** Exact height in pixels (used with 'exact' mode) */
    height?: number;
    /** Strategy for handling aspect ratio mismatch in 'exact' mode */
    strategy?: "pad" | "crop";
    /** When true, the asset is created but hidden from the user's gallery (tagged as intermediate) */
    intermediateAsset?: boolean;
}
interface ResizeVideoStepOutput {
    /** URL of the resized video */
    videoUrl: string;
}
interface RunFromConnectorRegistryStepInput {
    /** The connector action identifier in the format serviceId/actionId */
    actionId: string;
    /** Human-readable name of the connector action */
    displayName: string;
    /** Icon URL for the connector */
    icon: string;
    /** Key-value configuration parameters for the connector action */
    configurationValues: Record<string, unknown>;
    /** OAuth connection ID used to authenticate the connector request */
    __connectionId?: string;
}
interface RunFromConnectorRegistryStepOutput {
    /** Key-value map of output variables set by the connector */
    data: Record<string, unknown>;
}
interface RunPackagedWorkflowStepInput {
    /** The app ID of the packaged workflow source */
    appId: string;
    /** The source workflow ID to execute */
    workflowId: string;
    /** Variables to pass as input to the packaged workflow */
    inputVariables: Record<string, unknown>;
    /** Variables to capture from the packaged workflow output */
    outputVariables: Record<string, unknown>;
    /** Display name of the packaged workflow */
    name: string;
}
interface RunPackagedWorkflowStepOutput {
    /** The result data returned from the packaged workflow */
    data: unknown;
}
interface ScrapeLinkedInCompanyStepInput {
    /** LinkedIn company page URL (e.g. https://www.linkedin.com/company/mindstudioai) */
    url: string;
}
interface ScrapeLinkedInCompanyStepOutput {
    /** Scraped LinkedIn company data */
    company: unknown;
}
interface ScrapeLinkedInProfileStepInput {
    /** LinkedIn profile URL (e.g. https://www.linkedin.com/in/username) */
    url: string;
}
interface ScrapeLinkedInProfileStepOutput {
    /** Scraped LinkedIn profile data */
    profile: unknown;
}
interface ScrapeUrlStepInput {
    /** URL(s) to scrape. Accepts a single URL, JSON array, or comma/newline-separated list */
    url: string;
    /** Scraping service to use */
    service?: "default" | "firecrawl";
    /** No longer selects a provider — the default service's anti-bot engine decides per request how hard to work. Retained because existing workflows set it and the builder still renders it. */
    autoEnhance?: boolean;
    /** Output format: text returns markdown, html returns raw HTML, json returns structured scraper data, summary returns a model-written summary (Firecrawl only) */
    outputFormat?: "text" | "json" | "html" | "summary";
    /** Page-level scraping options (content filtering, screenshots, headers, etc.) */
    pageOptions?: {
        /** Whether to extract only the main content of the page, excluding navigation, footers, etc. */
        onlyMainContent: boolean;
        /** Whether to capture a screenshot of the page */
        screenshot: boolean;
        /** Milliseconds to wait before scraping (0 for immediate) */
        waitFor: number;
        /** Whether to convert relative URLs to absolute URLs in the result */
        replaceAllPathsWithAbsolutePaths: boolean;
        /** Custom HTTP request headers as key-value pairs */
        headers: Record<string, unknown>;
        /** HTML tags to remove from the scraped result */
        removeTags: string[];
        /** Whether to scrape using a mobile user-agent */
        mobile: boolean;
    };
}
interface ScrapeUrlStepOutput {
    /** Scraped content. Shape depends on outputFormat and number of URLs */
    content: string | string[] | {
        /** Markdown/plain-text content of the scraped page */
        text: string;
        /** Raw HTML content of the scraped page */
        html: string;
        /** Structured data extracted from the page */
        json?: Record<string, unknown>;
        /** Screenshot URL of the page (if requested) */
        screenshotUrl?: string;
        /** Page metadata (Open Graph / meta tags) */
        metadata?: {
            /** Page title */
            title: string;
            /** Page meta description */
            description: string;
            /** Canonical URL */
            url: string;
            /** Open Graph image URL */
            image: string;
        };
        /** Set when the scrape failed. `text`/`html` still carry the human-readable error so existing callers behave as before, but callers that care — billing, in particular — can tell a failure from real page content. */
        error?: {
            code: string;
            message: string;
        };
        /**
     * What the provider actually charged, when it tells us. Scrapfly returns an exact per-request credit total that varies with how hard the target fought back (6 for an unprotected page, 80 for Glassdoor), so billing a flat rate would either overcharge the easy case or eat the hard one. Providers that report nothing leave this undefined and fall back to the route's estimate.
     *
     * Includes every attempt made on the caller's behalf, not just the last one.
     */
        costUnits?: number;
    } | {
        /** Markdown/plain-text content of the scraped page */
        text: string;
        /** Raw HTML content of the scraped page */
        html: string;
        /** Structured data extracted from the page */
        json?: Record<string, unknown>;
        /** Screenshot URL of the page (if requested) */
        screenshotUrl?: string;
        /** Page metadata (Open Graph / meta tags) */
        metadata?: {
            /** Page title */
            title: string;
            /** Page meta description */
            description: string;
            /** Canonical URL */
            url: string;
            /** Open Graph image URL */
            image: string;
        };
        /** Set when the scrape failed. `text`/`html` still carry the human-readable error so existing callers behave as before, but callers that care — billing, in particular — can tell a failure from real page content. */
        error?: {
            code: string;
            message: string;
        };
        /**
     * What the provider actually charged, when it tells us. Scrapfly returns an exact per-request credit total that varies with how hard the target fought back (6 for an unprotected page, 80 for Glassdoor), so billing a flat rate would either overcharge the easy case or eat the hard one. Providers that report nothing leave this undefined and fall back to the route's estimate.
     *
     * Includes every attempt made on the caller's behalf, not just the last one.
     */
        costUnits?: number;
    }[];
    /** Screenshot URL(s), only present when a screenshot was captured */
    screenshot?: string | string[];
}
interface ScrapeXPostStepInput {
    /** Full URL to the X post (e.g. https://x.com/elonmusk/status/1655608985058267139) */
    url: string;
}
interface ScrapeXPostStepOutput {
    /** Scraped post data including text, HTML, and optional structured JSON */
    post: {
        /** Markdown/plain-text content of the scraped page */
        text: string;
        /** Raw HTML content of the scraped page */
        html: string;
        /** Structured data extracted from the page */
        json?: Record<string, unknown>;
        /** Screenshot URL of the page (if requested) */
        screenshotUrl?: string;
        /** Page metadata (Open Graph / meta tags) */
        metadata?: {
            /** Page title */
            title: string;
            /** Page meta description */
            description: string;
            /** Canonical URL */
            url: string;
            /** Open Graph image URL */
            image: string;
        };
        /** Set when the scrape failed. `text`/`html` still carry the human-readable error so existing callers behave as before, but callers that care — billing, in particular — can tell a failure from real page content. */
        error?: {
            code: string;
            message: string;
        };
        /**
     * What the provider actually charged, when it tells us. Scrapfly returns an exact per-request credit total that varies with how hard the target fought back (6 for an unprotected page, 80 for Glassdoor), so billing a flat rate would either overcharge the easy case or eat the hard one. Providers that report nothing leave this undefined and fall back to the route's estimate.
     *
     * Includes every attempt made on the caller's behalf, not just the last one.
     */
        costUnits?: number;
    };
}
interface ScrapeXProfileStepInput {
    /** Full URL or username for the X profile (e.g. https://x.com/elonmusk) */
    url: string;
}
interface ScrapeXProfileStepOutput {
    /** Scraped profile data including text, HTML, and optional structured JSON */
    profile: {
        /** Markdown/plain-text content of the scraped page */
        text: string;
        /** Raw HTML content of the scraped page */
        html: string;
        /** Structured data extracted from the page */
        json?: Record<string, unknown>;
        /** Screenshot URL of the page (if requested) */
        screenshotUrl?: string;
        /** Page metadata (Open Graph / meta tags) */
        metadata?: {
            /** Page title */
            title: string;
            /** Page meta description */
            description: string;
            /** Canonical URL */
            url: string;
            /** Open Graph image URL */
            image: string;
        };
        /** Set when the scrape failed. `text`/`html` still carry the human-readable error so existing callers behave as before, but callers that care — billing, in particular — can tell a failure from real page content. */
        error?: {
            code: string;
            message: string;
        };
        /**
     * What the provider actually charged, when it tells us. Scrapfly returns an exact per-request credit total that varies with how hard the target fought back (6 for an unprotected page, 80 for Glassdoor), so billing a flat rate would either overcharge the easy case or eat the hard one. Providers that report nothing leave this undefined and fall back to the route's estimate.
     *
     * Includes every attempt made on the caller's behalf, not just the last one.
     */
        costUnits?: number;
    };
}
interface ScreenshotUrlStepInput {
    /** URL to screenshot */
    url: string;
    /** Screenshot mode: viewport captures visible area, fullPage captures entire page */
    mode?: "viewport" | "fullPage";
    /** Viewport width in pixels (default: 1280) */
    width?: number;
    /** Viewport height in pixels (default: 800, ignored for fullPage mode) */
    height?: number;
    /** Milliseconds to wait before capturing (default: 0) */
    delay?: number;
    /** CSS selector to wait for before capturing */
    waitFor?: string;
}
interface ScreenshotUrlStepOutput {
    screenshotUrl: string;
}
interface SearchGmailEmailsStepInput {
    /** Gmail search query (e.g. "from:user@example.com", "subject:invoice", "is:unread") */
    query: string;
    /** Google OAuth connection ID */
    connectionId?: string;
    /** Format for the variable output: "json" or "text" */
    exportType: "json" | "text";
    /** Maximum number of emails to return (1-10, default: 5) */
    limit: string;
}
interface SearchGmailEmailsStepOutput {
    /** List of matching email messages */
    emails: {
        /** Gmail message ID */
        id: string;
        /** Email subject line */
        subject: string;
        /** Sender email address */
        from: string;
        /** Recipient email address */
        to: string;
        /** Email date */
        date: string;
        /** Plain text body content */
        plainBody: string;
        /** HTML body content (if available) */
        htmlBody: string;
        /** Comma-separated label IDs applied to the email */
        labels: string;
    }[];
}
interface SearchGoogleStepInput {
    /** The search query to send to Google */
    query: string;
    /** Format for the variable value: "text" or "json" */
    exportType: "text" | "json";
    /** Google gl country code (defaults to US) */
    countryCode?: string;
    /** Google hl language code (defaults to "en") */
    languageCode?: string;
    /** Time range filter: "hour", "day", "week", "month", "year", or "any" */
    dateRange?: "hour" | "day" | "week" | "month" | "year" | "any";
    /** Number of results to return (1-100, default: 30) */
    numResults?: number;
}
interface SearchGoogleStepOutput {
    /** List of search result entries */
    results: {
        /** Title of the search result */
        title: string;
        /** Snippet/description of the search result */
        description: string;
        /** URL of the search result page */
        url: string;
    }[];
}
interface SearchGoogleCalendarEventsStepInput {
    /** Text search term */
    query?: string;
    /** Start of time range (ISO 8601) */
    timeMin?: string;
    /** End of time range (ISO 8601) */
    timeMax?: string;
    /** Calendar ID (defaults to "primary") */
    calendarId?: string;
    /** Maximum number of events to return (default: 10) */
    limit?: number;
    /** Format for the variable output: "json" or "text" */
    exportType: "json" | "text";
    /** Google OAuth connection ID */
    connectionId?: string;
}
interface SearchGoogleCalendarEventsStepOutput {
    /** List of matching calendar events */
    events: ({
        /** Google Calendar event ID */
        id?: string | null;
        /** Event status (e.g. "confirmed", "tentative", "cancelled") */
        status?: string | null;
        /** URL to view the event in Google Calendar */
        htmlLink?: string | null;
        /** Timestamp when the event was created */
        created?: string | null;
        /** Timestamp when the event was last updated */
        updated?: string | null;
        /** Event title */
        summary?: string | null;
        /** Event description */
        description?: string | null;
        /** Event location */
        location?: string | null;
        /** Event organizer */
        organizer?: {
            displayName?: string | null;
            email?: string | null;
        } | null;
        /** Event start time and timezone */
        start?: {
            dateTime?: string | null;
            timeZone?: string | null;
        } | null;
        /** Event end time and timezone */
        end?: {
            dateTime?: string | null;
            timeZone?: string | null;
        } | null;
        /** List of event attendees */
        attendees?: ({
            displayName?: string | null;
            email?: string | null;
            responseStatus?: string | null;
        })[] | null;
    })[];
}
interface SearchGoogleDriveStepInput {
    /** Search keyword */
    query: string;
    /** Max files to return (default: 20) */
    limit?: number;
    /** Google OAuth connection ID */
    connectionId?: string;
    /** Format for the variable output: "json" or "text" */
    exportType: "json" | "text";
}
interface SearchGoogleDriveStepOutput {
    /** List of matching files */
    files: {
        id: string;
        name: string;
        mimeType: string;
        size: string;
        webViewLink: string;
        createdTime: string;
        modifiedTime: string;
    }[];
}
interface SearchGoogleImagesStepInput {
    /** The image search query */
    query: string;
    /** Format for the variable value: "text" or "json" */
    exportType: "text" | "json";
    /** Google gl country code (defaults to US) */
    countryCode?: string;
    /** Google hl language code (defaults to "en") */
    languageCode?: string;
    /** Time range filter: "hour", "day", "week", "month", "year", or "any" */
    dateRange?: "hour" | "day" | "week" | "month" | "year" | "any";
    /** Number of results to return (1-100, default: 30) */
    numResults?: number;
}
interface SearchGoogleImagesStepOutput {
    /** List of image search results with URLs and metadata */
    images: {
        /** Title/alt text of the image */
        title: string;
        /** Direct URL of the full-size image */
        imageUrl: string;
        /** Width of the full-size image in pixels */
        imageWidth: number;
        /** Height of the full-size image in pixels */
        imageHeight: number;
        /** URL of the thumbnail image */
        thumbnailUrl: string;
        /** Width of the thumbnail in pixels */
        thumbnailWidth: number;
        /** Height of the thumbnail in pixels */
        thumbnailHeight: number;
        /** Source website name */
        source: string;
        /** Domain of the source website */
        domain: string;
        /** URL of the page containing the image */
        link: string;
        /** Google Images URL for this result */
        googleUrl: string;
        /** Position/rank of this result in the search results */
        position: number;
    }[];
}
interface SearchGoogleNewsStepInput {
    /** The news search query */
    text: string;
    /** Format for the variable value: "text" or "json" */
    exportType: "text" | "json";
    /** Number of results to return (1-100, default: 30) */
    numResults?: number;
}
interface SearchGoogleNewsStepOutput {
    /** List of matching news articles */
    articles: {
        /** Headline of the news article */
        title: string;
        /** URL to the full article */
        link: string;
        /** Publication date of the article */
        date: string;
        /** Source publication */
        source: {
            /** Name of the news source */
            name: string;
        };
        /** Brief excerpt or summary of the article */
        snippet?: string;
    }[];
}
interface SearchGoogleTrendsStepInput {
    /** The search term to look up on Google Trends */
    text: string;
    /** Language code (e.g. "en") */
    hl: string;
    /** Geographic region: empty string for worldwide, or a two-letter country code */
    geo: string;
    /** Type of trend data to return */
    data_type: "TIMESERIES" | "GEO_MAP" | "GEO_MAP_0" | "RELATED_TOPICS" | "RELATED_QUERIES";
    /** Category filter ("0" for all categories) */
    cat: string;
    /** Date range for trend data. Available options:   - "now 1-H" - Past hour   - "now 4-H" - Past 4 hours   - "now 1-d" - Past day   - "now 7-d" - Past 7 days   - "today 1-m" - Past 30 days   - "today 3-m" - Past 90 days   - "today 12-m" - Past 12 months   - "today 5-y" - Past 5 years   - "all - 2004" - present   - You can also pass custom values: "yyyy-mm-dd yyyy-mm-dd" */
    date: string;
    /** Timezone offset in minutes (-1439 to 1439, default: 420 for PDT) */
    ts: string;
}
interface SearchGoogleTrendsStepOutput {
    /** Google Trends data for the searched term */
    trends: Record<string, unknown>;
}
interface SearchPerplexityStepInput {
    /** Search query to send to Perplexity */
    query: string;
    /** Output format for the variable: plain text or structured JSON */
    exportType: "text" | "json";
    /** ISO country code to filter results by region (e.g. "us", "gb") */
    countryCode?: string;
    /** Number of results to return (1-20, default: 10) */
    numResults?: number;
}
interface SearchPerplexityStepOutput {
    /** List of structured search results */
    results: {
        /** Page title of the search result */
        title: string;
        /** Snippet or description of the search result */
        description: string;
        /** URL of the search result page */
        url: string;
    }[];
}
interface SearchXPostsStepInput {
    /** Search query (max 512 chars, supports X API v2 search operators) */
    query: string;
    /** Search scope: "recent" for past 7 days or "all" for full archive */
    scope: "recent" | "all";
    /** Additional search options */
    options: {
        /** ISO 8601 date; only return posts after this time */
        startTime?: string;
        /** ISO 8601 date; only return posts before this time */
        endTime?: string;
        /** Number of results to return (default: 50, max: 100) */
        maxResults?: number;
    };
}
interface SearchXPostsStepOutput {
    /** List of matching X posts */
    posts: {
        /** Unique post identifier */
        id: string;
        /** Author's X user ID */
        authorId: string;
        /** ISO 8601 timestamp when the post was created */
        dateCreated: string;
        /** Text content of the post */
        text: string;
        /** Engagement statistics for the post */
        stats: {
            /** Number of retweets/reposts */
            retweets: number;
            /** Number of replies */
            replies: number;
            /** Number of likes */
            likes: number;
        };
    }[];
}
interface SearchYoutubeStepInput {
    /** Search query for YouTube videos */
    query: string;
    /** Maximum number of pages to fetch (1-5) */
    limitPages: string;
    /** YouTube search parameter (sp) filter value */
    filter: string;
    /** Filter type identifier */
    filterType: string;
    /** Google gl country code for regional results (default: "US") */
    countryCode?: string;
    /** Google hl language code for result language (default: "en") */
    languageCode?: string;
}
interface SearchYoutubeStepOutput {
    /** YouTube search results including video_results, channel_results, etc. */
    results: Record<string, unknown>;
}
interface SearchYoutubeTrendsStepInput {
    /** Trending category: "now" (trending now), "music", "gaming", or "films" */
    bp: "now" | "music" | "gaming" | "films";
    /** Language code (e.g. "en") */
    hl: string;
    /** Country code (e.g. "US") */
    gl: string;
}
type SearchYoutubeTrendsStepOutput = Record<string, unknown>;
interface SendEmailStepInput {
    /** Email subject line */
    subject: string;
    /** Email body content (plain text, markdown, HTML, or a CDN URL to an HTML file) */
    body: string;
    /**
   * Direct recipient email address(es). On the shared Remy sender these must be verified app users or members of the app's org; unrestricted when the app sends from a domain it owns.
   *
   * Optional, but only because recipients can come from elsewhere: omit it and supply `cc`/`bcc` for a hidden-list send (the To: header is then addressed to the app's own sender), or omit all three and recipients resolve from an OAuth connection. Naming nobody at all is an error.
   */
    to?: string | string[];
    /** Additional visible (Cc) recipient(s); same recipient rules as `to`. */
    cc?: string | string[];
    /** Additional hidden (Bcc) recipient(s); same recipient rules as `to`. */
    bcc?: string | string[];
    /** OAuth connection ID(s) for the recipient(s), comma-separated for multiple */
    connectionId?: string;
    /** When true, auto-convert the body text into a styled HTML email using AI */
    generateHtml?: boolean;
    /** Natural language instructions for the HTML generation style */
    generateHtmlInstructions?: string;
    /** Model settings override for HTML generation */
    generateHtmlModelOverride?: {
        /** Model identifier (e.g. "gpt-4", "claude-3-opus") */
        model: string;
        /** Sampling temperature for the model (0-2) */
        temperature: number;
        /** Maximum number of tokens in the model's response */
        maxResponseTokens: number;
        /** Whether to skip the system preamble/instructions */
        ignorePreamble?: boolean;
        /** Preprocessor applied to user messages before sending to the model */
        userMessagePreprocessor?: {
            /** Data source identifier for the preprocessor */
            dataSource?: string;
            /** Template string applied to user messages before sending to the model */
            messageTemplate?: string;
            /** Maximum number of results to include from the data source */
            maxResults?: number;
            /** Whether the preprocessor is active */
            enabled?: boolean;
            /** Whether child steps should inherit this preprocessor configuration */
            shouldInherit?: boolean;
        };
        /** System preamble/instructions for the model */
        preamble?: string;
        /** Whether multi-model candidate generation is enabled */
        multiModelEnabled?: boolean;
        /** Whether the user can edit the model's response */
        editResponseEnabled?: boolean;
        /** Additional model-specific configuration */
        config?: Record<string, unknown>;
    };
    /** Files to attach: each entry is a URL string, or an object `{ url, filename?, contentType? }` to control the displayed filename and MIME type. */
    attachments?: (string | {
        url: string;
        filename?: string;
        contentType?: string;
    })[];
    /** Custom sender handle — only for apps with a custom domain or subdomain. Bare handle (`support`), full `support@your-domain.com`, or `Name <support@your-domain.com>`. Must resolve to a domain the app owns. */
    from?: string;
    /** How to interpret `body`: `auto` (default — detect HTML, else render markdown), `html` (send as-is), `markdown` (render to HTML), or `text` (send as plain text only, no HTML part). Every send includes a text/plain alternative. */
    bodyType?: "auto" | "html" | "markdown" | "text";
    /** Explicit text/plain alternative body. Auto-derived from `body` if omitted. */
    text?: string;
    /** Reply-To address for the email. */
    replyTo?: string;
    /** Message-ID this email replies to, for inbox threading (In-Reply-To header). */
    inReplyTo?: string;
    /** Prior Message-IDs in the thread, for inbox threading (References header). */
    references?: string[];
}
interface SendEmailStepOutput {
    /** To addresses the message was sent to. */
    recipients: string[];
    /** Cc addresses on the message (empty if none). */
    cc: string[];
    /** Bcc addresses on the message (empty if none). */
    bcc: string[];
    /** The resolved sender address the message went out as (auto-selected when no `from` is given). */
    from: string;
}
interface SendGmailDraftStepInput {
    /** Gmail draft ID to send */
    draftId: string;
    /** Google OAuth connection ID */
    connectionId?: string;
}
type SendGmailDraftStepOutput = unknown;
interface SendGmailMessageStepInput {
    /** Recipient email address(es), comma-separated for multiple */
    to: string;
    /** Email subject line */
    subject: string;
    /** Email body content */
    message: string;
    /** Google OAuth connection ID */
    connectionId?: string;
    /** Body format: "plain", "html", or "markdown" */
    messageType: "plain" | "html" | "markdown";
}
interface SendGmailMessageStepOutput {
    /** Gmail message ID of the sent email */
    messageId: string;
}
interface SendSlackDirectMessageStepInput {
    /** Slack user ID of the recipient */
    slackUserId: string;
    /** Message format: "string" for plain text/markdown, "blocks" for Slack Block Kit JSON */
    messageType: "string" | "blocks";
    /** Message content (plain text/markdown for "string" type, or JSON for "blocks" type) */
    message: string;
    /** Slack OAuth connection ID (leave empty to allow user to select) */
    connectionId?: string;
}
type SendSlackDirectMessageStepOutput = unknown;
interface SendSMSStepInput {
    /** SMS message body text */
    body: string;
    /** OAuth connection ID for the recipient phone number */
    connectionId?: string;
    /** Optional array of media URLs to send as MMS (up to 10, 5MB each) */
    mediaUrls?: string[];
}
type SendSMSStepOutput = unknown;
interface SetGmailReadStatusStepInput {
    /** Gmail message ID(s), comma-separated */
    messageIds: string;
    /** true = mark as read, false = mark as unread */
    markAsRead: boolean;
    /** Google OAuth connection ID */
    connectionId?: string;
}
type SetGmailReadStatusStepOutput = unknown;
interface SetRunTitleStepInput {
    /** The title to assign to the agent run (supports variable interpolation) */
    title: string;
}
type SetRunTitleStepOutput = unknown;
interface SetVariableStepInput {
    /** Value to assign (string or array of strings, supports variable interpolation) */
    value: string | string[];
}
type SetVariableStepOutput = Record<string, unknown>;
interface TelegramEditMessageStepInput {
    /** Telegram bot token in "botId:token" format */
    botToken: string;
    /** Telegram chat ID containing the message */
    chatId: string;
    /** ID of the message to edit */
    messageId: string;
    /** New message text (MarkdownV2 formatting supported) */
    text: string;
}
type TelegramEditMessageStepOutput = unknown;
interface TelegramReplyToMessageStepInput {
    /** Telegram bot token in "botId:token" format */
    botToken: string;
    /** Telegram chat ID to send the reply to */
    chatId: string;
    /** ID of the message to reply to */
    replyToMessageId: string;
    /** Reply text (MarkdownV2 formatting supported) */
    text: string;
}
interface TelegramReplyToMessageStepOutput {
    /** ID of the sent reply message */
    messageId: number;
}
interface TelegramSendAudioStepInput {
    /** Telegram bot token in "botId:token" format */
    botToken: string;
    /** Telegram chat ID to send the audio to */
    chatId: string;
    /** URL of the audio file to send */
    audioUrl: string;
    /** Send as a standard audio track ("audio") or as a voice note ("voice") */
    mode: "audio" | "voice";
    /** Optional caption text for the audio */
    caption?: string;
}
type TelegramSendAudioStepOutput = unknown;
interface TelegramSendFileStepInput {
    /** Telegram bot token in "botId:token" format */
    botToken: string;
    /** Telegram chat ID to send the file to */
    chatId: string;
    /** URL of the document/file to send */
    fileUrl: string;
    /** Optional caption text for the file */
    caption?: string;
}
type TelegramSendFileStepOutput = unknown;
interface TelegramSendImageStepInput {
    /** Telegram bot token in "botId:token" format */
    botToken: string;
    /** Telegram chat ID to send the image to */
    chatId: string;
    /** URL of the image to send */
    imageUrl: string;
    /** Optional caption text for the image */
    caption?: string;
}
type TelegramSendImageStepOutput = unknown;
interface TelegramSendMessageStepInput {
    /** Telegram bot token in "botId:token" format */
    botToken: string;
    /** Telegram chat ID to send the message to */
    chatId: string;
    /** Message text to send (MarkdownV2 formatting supported) */
    text: string;
}
interface TelegramSendMessageStepOutput {
    /** ID of the sent Telegram message */
    messageId: number;
}
interface TelegramSendVideoStepInput {
    /** Telegram bot token in "botId:token" format */
    botToken: string;
    /** Telegram chat ID to send the video to */
    chatId: string;
    /** URL of the video to send */
    videoUrl: string;
    /** Optional caption text for the video */
    caption?: string;
}
type TelegramSendVideoStepOutput = unknown;
interface TelegramSetTypingStepInput {
    /** Telegram bot token in "botId:token" format */
    botToken: string;
    /** Telegram chat ID to show the typing indicator in */
    chatId: string;
}
type TelegramSetTypingStepOutput = unknown;
interface TextToSpeechStepInput {
    /** The text to convert to speech */
    text: string;
    intermediateAsset?: boolean;
    /** Optional model configuration override. Uses the workflow's default speech model if not specified */
    speechModelOverride?: {
        /** Speech synthesis model identifier */
        model: string;
        /** Additional model-specific configuration */
        config?: Record<string, unknown>;
    };
}
interface TextToSpeechStepOutput {
    /** URL of the generated audio file */
    audioUrl: string;
}
interface TranscribeAudioStepInput {
    /** URL of the audio file to transcribe */
    audioUrl: string;
    /** Optional context to improve transcription accuracy (e.g. language, speaker names, domain terms) */
    prompt: string;
    /** Optional model configuration override. Uses the workflow's default transcription model if not specified */
    transcriptionModelOverride?: {
        /** Audio transcription model identifier */
        model: string;
        /** Additional model-specific configuration */
        config?: Record<string, unknown>;
    };
}
interface TranscribeAudioStepOutput {
    /** The transcribed text from the audio file */
    text: string;
}
interface TrimMediaStepInput {
    /** URL of the source audio or video file to trim */
    inputUrl: string;
    /** Start position in seconds for the trim */
    start?: number | string;
    /** Duration of the trimmed segment in seconds. Omit to trim to the end of the clip. */
    duration?: string | number;
    /** When true, the asset is created but hidden from the user's gallery (tagged as intermediate) */
    intermediateAsset?: boolean;
}
interface TrimMediaStepOutput {
    /** URL of the trimmed media file */
    mediaUrl: string;
}
interface UpdateGmailLabelsStepInput {
    /** Gmail search query to find messages (alternative to messageIds) */
    query: string;
    /** Google OAuth connection ID */
    connectionId?: string;
    /** Comma-separated message IDs to target (alternative to query) */
    messageIds: string;
    /** Comma-separated label names or IDs to add */
    addLabelIds: string;
    /** Comma-separated label names or IDs to remove */
    removeLabelIds: string;
}
interface UpdateGmailLabelsStepOutput {
    /** Gmail message IDs that were updated */
    updatedMessageIds: string[];
}
interface UpdateGoogleCalendarEventStepInput {
    /** Google OAuth connection ID */
    connectionId?: string;
    /** Google Calendar event ID to update */
    eventId: string;
    /** Updated event title */
    summary?: string;
    /** Updated event description */
    description?: string;
    /** Updated event location */
    location?: string;
    /** Updated start time in ISO 8601 format */
    startDateTime?: string;
    /** Updated end time in ISO 8601 format */
    endDateTime?: string;
    /** Updated attendee email addresses (one per line, replaces all existing attendees) */
    attendees?: string;
    /** Calendar ID (defaults to "primary" if omitted) */
    calendarId?: string;
}
interface UpdateGoogleCalendarEventStepOutput {
    /** Google Calendar event ID */
    eventId: string;
    /** URL to view the updated event in Google Calendar */
    htmlLink: string;
}
interface UpdateGoogleDocStepInput {
    /** Google Document ID to update */
    documentId: string;
    /** Google OAuth connection ID */
    connectionId?: string;
    /** New content to write to the document */
    text: string;
    /** Format of the text field: "plain", "html", or "markdown" */
    textType: "plain" | "html" | "markdown";
    /** How to apply the content: "addToTop", "addToBottom", or "overwrite" */
    operationType: "addToTop" | "addToBottom" | "overwrite";
}
interface UpdateGoogleDocStepOutput {
    /** URL of the updated Google Document */
    documentUrl: string;
}
interface UpdateGoogleSheetStepInput {
    /** CSV data to write to the spreadsheet */
    text: string;
    /** Google OAuth connection ID */
    connectionId?: string;
    /** Google Spreadsheet ID to update */
    spreadsheetId: string;
    /** Target cell range in A1 notation (used with "range" operationType) */
    range: string;
    /** How to apply the data: "addToBottom", "overwrite", or "range" */
    operationType: "addToBottom" | "overwrite" | "range";
}
interface UpdateGoogleSheetStepOutput {
    /** URL of the updated Google Spreadsheet */
    spreadsheetUrl: string;
}
interface UploadDataSourceDocumentStepInput {
    /** ID of the target data source (supports variable interpolation) */
    dataSourceId: string;
    /** A URL to download, or raw text content to create a .txt document from (supports variable interpolation) */
    file: string;
    /** Display name for the document (supports variable interpolation) */
    fileName: string;
}
type UploadDataSourceDocumentStepOutput = unknown;
interface UpscaleImageStepInput {
    /** URL of the image to upscale */
    imageUrl: string;
    /** Target output resolution */
    targetResolution: "2k" | "4k" | "8k";
    /** Upscaling engine quality tier */
    engine: "standard" | "pro";
}
interface UpscaleImageStepOutput {
    /** CDN URL of the upscaled image (PNG) */
    imageUrl: string;
}
interface UpscaleVideoStepInput {
    /** URL of the source video to upscale */
    videoUrl: string;
    /** Target output resolution for the upscaled video */
    targetResolution: "720p" | "1080p" | "2K" | "4K";
    /** Upscaling engine to use. Higher tiers produce better quality at higher cost. */
    engine: "standard" | "pro" | "ultimate" | "flashvsr" | "seedance" | "seedvr2" | "runwayml/upscale-v1";
    /** When true, the asset is created but hidden from the user's gallery (tagged as intermediate) */
    intermediateAsset?: boolean;
}
interface UpscaleVideoStepOutput {
    /** URL of the upscaled video */
    videoUrl: string;
}
interface UserMessageStepInput {
    /** The message to send (prompt for AI, or text for system echo) */
    message: string;
    /** Message source: "user" sends to AI model, "system" echoes message content directly. Defaults to "user" */
    source?: "user" | "system";
    /** Model configuration override. Optional; uses the workflow's default model if not specified */
    modelOverride?: {
        /** Model identifier (e.g. "gpt-4", "claude-3-opus") */
        model: string;
        /** Sampling temperature for the model (0-2) */
        temperature: number;
        /** Maximum number of tokens in the model's response */
        maxResponseTokens: number;
        /** Whether to skip the system preamble/instructions */
        ignorePreamble?: boolean;
        /** Preprocessor applied to user messages before sending to the model */
        userMessagePreprocessor?: {
            /** Data source identifier for the preprocessor */
            dataSource?: string;
            /** Template string applied to user messages before sending to the model */
            messageTemplate?: string;
            /** Maximum number of results to include from the data source */
            maxResults?: number;
            /** Whether the preprocessor is active */
            enabled?: boolean;
            /** Whether child steps should inherit this preprocessor configuration */
            shouldInherit?: boolean;
        };
        /** System preamble/instructions for the model */
        preamble?: string;
        /** Whether multi-model candidate generation is enabled */
        multiModelEnabled?: boolean;
        /** Whether the user can edit the model's response */
        editResponseEnabled?: boolean;
        /** Additional model-specific configuration */
        config?: Record<string, unknown>;
    };
    /** Output format constraint for structured responses */
    structuredOutputType?: "text" | "json" | "csv";
    /** Sample showing the desired output shape (for JSON/CSV formats). A TypeScript interface is also useful here for more complex types. */
    structuredOutputExample?: string;
    /** Whether to include or exclude prior chat history in the AI context */
    chatHistoryMode?: "include" | "exclude";
}
interface UserMessageStepOutput {
    /** The AI model's response or echoed system message content */
    content: string;
}
interface VideoFaceSwapStepInput {
    /** URL of the source video containing faces to swap */
    videoUrl: string;
    /** URL of the image containing the replacement face */
    faceImageUrl: string;
    /** Zero-based index of the face to replace in the video */
    targetIndex: number;
    /** Face swap engine to use */
    engine: string;
    /** When true, the asset is created but hidden from the user's gallery (tagged as intermediate) */
    intermediateAsset?: boolean;
}
interface VideoFaceSwapStepOutput {
    /** URL of the face-swapped video */
    videoUrl: string;
}
interface VideoRemoveBackgroundStepInput {
    /** URL of the source video */
    videoUrl: string;
    /** Whether to make the background transparent or replace it with an image */
    newBackground: "transparent" | "image";
    /** URL of a replacement background image. Required when newBackground is 'image'. */
    newBackgroundImageUrl?: string;
    /** Background removal engine to use */
    engine: string;
    /** When true, the asset is created but hidden from the user's gallery (tagged as intermediate) */
    intermediateAsset?: boolean;
}
interface VideoRemoveBackgroundStepOutput {
    /** URL of the video with background removed or replaced */
    videoUrl: string;
}
interface VideoRemoveWatermarkStepInput {
    /** URL of the source video containing a watermark */
    videoUrl: string;
    /** Watermark removal engine to use */
    engine: string;
    /** When true, the asset is created but hidden from the user's gallery (tagged as intermediate) */
    intermediateAsset?: boolean;
}
interface VideoRemoveWatermarkStepOutput {
    /** URL of the video with watermark removed */
    videoUrl: string;
}
interface WatermarkImageStepInput {
    /** URL of the base image */
    imageUrl: string;
    /** URL of the watermark image to overlay */
    watermarkImageUrl: string;
    /** Corner position for the watermark placement */
    corner: "top-left" | "top-right" | "bottom-left" | "bottom-right";
    /** Padding from the corner in pixels */
    paddingPx: number;
    /** Width of the watermark overlay in pixels */
    widthPx: number;
    /** When true, the asset is created but hidden from the user's gallery (tagged as intermediate) */
    intermediateAsset?: boolean;
}
interface WatermarkImageStepOutput {
    /** CDN URL of the watermarked image */
    imageUrl: string;
}
interface WatermarkVideoStepInput {
    /** URL of the source video */
    videoUrl: string;
    /** URL of the watermark image to overlay */
    imageUrl: string;
    /** Corner position for the watermark placement */
    corner: "top-left" | "top-right" | "bottom-left" | "bottom-right";
    /** Padding from the corner in pixels */
    paddingPx: number;
    /** Width of the watermark overlay in pixels */
    widthPx: number;
    /** When true, the asset is created but hidden from the user's gallery (tagged as intermediate) */
    intermediateAsset?: boolean;
}
interface WatermarkVideoStepOutput {
    /** URL of the watermarked video */
    videoUrl: string;
}
interface YouDotComFinanceResearchStepInput {
    /** Financial research question */
    input: string;
    /** Depth of finance research to perform */
    researchEffort?: "deep" | "exhaustive";
}
interface YouDotComFinanceResearchStepOutput {
    /** Full response returned by the You.com API */
    data: Record<string, unknown> | unknown[];
}
interface YouDotComGetPageContentStepInput {
    /** URLs to fetch, max 10 */
    urls: string[];
    /** Content formats to return; defaults to markdown */
    formats?: ("markdown" | "html" | "metadata")[];
    /** Per-URL crawl timeout in seconds */
    crawlTimeout?: number;
}
interface YouDotComGetPageContentStepOutput {
    /** Full response returned by the You.com API */
    data: Record<string, unknown> | unknown[];
}
interface YouDotComLiveNewsStepInput {
    /** News query */
    query: string;
    /** Recency filter; defaults to day */
    freshness?: string;
    /** Max results per section, up to 100 */
    count?: number;
    /** ISO 3166-1 alpha-2 country code */
    country?: string;
    /** BCP 47 language code */
    language?: string;
    /** Content moderation level */
    safesearch?: "off" | "moderate" | "strict";
    /** Fetch full content for news or all results */
    livecrawl?: "news" | "all";
    /** Full-content formats to return when livecrawl is enabled */
    livecrawlFormats?: ("markdown" | "html")[];
}
interface YouDotComLiveNewsStepOutput {
    /** Full response returned by the You.com API */
    data: Record<string, unknown> | unknown[];
}
interface YouDotComWebResearchStepInput {
    /** Research question */
    input: string;
    /** Depth of research to perform */
    researchEffort?: "lite" | "standard" | "deep" | "exhaustive";
    /** Source constraints for the research agent */
    sourceControl?: {
        includeDomains?: string[];
        excludeDomains?: string[];
        boostDomains?: string[];
        freshness?: string;
        country?: string;
    } | string;
    /** JSON schema for structured output */
    outputSchema?: Record<string, unknown> | string;
}
interface YouDotComWebResearchStepOutput {
    /** Full response returned by the You.com API */
    data: Record<string, unknown> | unknown[];
}
interface YouDotComWebSearchStepInput {
    /** Search query; supports You.com search operators */
    query: string;
    /** Max results per section, up to 100 */
    count?: number;
    /** Recency filter: day, week, month, year, or YYYY-MM-DDtoYYYY-MM-DD */
    freshness?: string;
    /** ISO 3166-1 alpha-2 country code */
    country?: string;
    /** BCP 47 language code */
    language?: string;
    /** Pagination offset, 0-9 */
    offset?: number;
    /** Content moderation level */
    safesearch?: "off" | "moderate" | "strict";
    /** Fetch full content for web, news, or all results */
    livecrawl?: "web" | "news" | "all";
    /** Full-content formats to return when livecrawl is enabled */
    livecrawlFormats?: ("markdown" | "html")[];
    /** Maximum livecrawl timeout in seconds */
    crawlTimeout?: number;
    /** Restrict results to these domains */
    includeDomains?: string[];
    /** Exclude these domains */
    excludeDomains?: string[];
    /** Boost these domains without excluding other domains */
    boostDomains?: string[];
}
interface YouDotComWebSearchStepOutput {
    /** Full response returned by the You.com API */
    data: Record<string, unknown> | unknown[];
}
type GenerateAssetStepInput = GeneratePdfStepInput;
type GenerateAssetStepOutput = GeneratePdfStepOutput;
type GenerateTextStepInput = UserMessageStepInput;
type GenerateTextStepOutput = UserMessageStepOutput;
/** Union of all available step type names. */
type StepName = "activeCampaignAddNote" | "activeCampaignCreateContact" | "addSubtitlesToVideo" | "airtableCreateUpdateRecord" | "airtableDeleteRecord" | "airtableGetRecord" | "airtableGetTableRecords" | "analyzeImage" | "analyzeVideo" | "captureThumbnail" | "checkAppRole" | "codaCreateUpdatePage" | "codaCreateUpdateRow" | "codaFindRow" | "codaGetPage" | "codaGetTableRows" | "convertPdfToImages" | "createDataSource" | "createGmailDraft" | "createGoogleCalendarEvent" | "createGoogleDoc" | "createGoogleSheet" | "deleteDataSource" | "deleteDataSourceDocument" | "deleteGmailEmail" | "deleteGoogleCalendarEvent" | "deleteGoogleSheetRows" | "detectChanges" | "detectPII" | "discordEditMessage" | "discordSendFollowUp" | "discordSendMessage" | "downloadVideo" | "enhanceImageGenerationPrompt" | "enhanceVideoGenerationPrompt" | "enrichPerson" | "extractAudioFromVideo" | "extractText" | "fetchDataSourceDocument" | "fetchGoogleDoc" | "fetchGoogleSheet" | "fetchSlackChannelHistory" | "fetchYoutubeCaptions" | "fetchYoutubeChannel" | "fetchYoutubeComments" | "fetchYoutubeVideo" | "generate3dModel" | "generateChart" | "generateImage" | "generateLipsync" | "generateMusic" | "generatePdf" | "generateStaticVideoFromImage" | "generateVideo" | "getGmailAttachments" | "getGmailDraft" | "getGmailEmail" | "getGmailUnreadCount" | "getGoogleCalendarEvent" | "getGoogleDriveFile" | "getGoogleSheetInfo" | "getMediaMetadata" | "hubspotCreateCompany" | "hubspotCreateContact" | "hubspotGetCompany" | "hubspotGetContact" | "hunterApiCompanyEnrichment" | "hunterApiDomainSearch" | "hunterApiEmailFinder" | "hunterApiEmailVerification" | "hunterApiPersonEnrichment" | "imageFaceSwap" | "imageRemoveWatermark" | "insertVideoClips" | "listDataSources" | "listGmailDrafts" | "listGmailLabels" | "listGoogleCalendarEvents" | "listGoogleDriveFiles" | "listRecentGmailEmails" | "logic" | "makeDotComRunScenario" | "mergeAudio" | "mergeVideos" | "meshyAnimate" | "meshyImageTo3d" | "meshyRemesh" | "meshyRig" | "meshyTextTo3d" | "meshyTexture" | "mixAudioIntoVideo" | "muteVideo" | "n8nRunNode" | "notionCreatePage" | "notionUpdatePage" | "particlePodcastsFindMentions" | "particlePodcastsGetEpisode" | "particlePodcastsGetEpisodeTranscript" | "particlePodcastsSearchCompanies" | "particlePodcastsSearchDialogue" | "particlePodcastsSearchPodcasts" | "peopleSearch" | "postToLinkedIn" | "postToSlackChannel" | "postToX" | "postToZapier" | "queryAppDatabase" | "queryDataSource" | "queryExternalDatabase" | "redactPII" | "removeBackgroundFromImage" | "replyToGmailEmail" | "resizeVideo" | "runFromConnectorRegistry" | "runPackagedWorkflow" | "scrapeLinkedInCompany" | "scrapeLinkedInProfile" | "scrapeUrl" | "scrapeXPost" | "scrapeXProfile" | "screenshotUrl" | "searchGmailEmails" | "searchGoogle" | "searchGoogleCalendarEvents" | "searchGoogleDrive" | "searchGoogleImages" | "searchGoogleNews" | "searchGoogleTrends" | "searchPerplexity" | "searchXPosts" | "searchYoutube" | "searchYoutubeTrends" | "sendEmail" | "sendGmailDraft" | "sendGmailMessage" | "sendSlackDirectMessage" | "sendSMS" | "setGmailReadStatus" | "setRunTitle" | "setVariable" | "telegramEditMessage" | "telegramReplyToMessage" | "telegramSendAudio" | "telegramSendFile" | "telegramSendImage" | "telegramSendMessage" | "telegramSendVideo" | "telegramSetTyping" | "textToSpeech" | "transcribeAudio" | "trimMedia" | "updateGmailLabels" | "updateGoogleCalendarEvent" | "updateGoogleDoc" | "updateGoogleSheet" | "uploadDataSourceDocument" | "upscaleImage" | "upscaleVideo" | "userMessage" | "videoFaceSwap" | "videoRemoveBackground" | "videoRemoveWatermark" | "watermarkImage" | "watermarkVideo" | "youDotComFinanceResearch" | "youDotComGetPageContent" | "youDotComLiveNews" | "youDotComWebResearch" | "youDotComWebSearch";
/** Maps step names to their input types. */
interface StepInputMap {
    activeCampaignAddNote: ActiveCampaignAddNoteStepInput;
    activeCampaignCreateContact: ActiveCampaignCreateContactStepInput;
    addSubtitlesToVideo: AddSubtitlesToVideoStepInput;
    airtableCreateUpdateRecord: AirtableCreateUpdateRecordStepInput;
    airtableDeleteRecord: AirtableDeleteRecordStepInput;
    airtableGetRecord: AirtableGetRecordStepInput;
    airtableGetTableRecords: AirtableGetTableRecordsStepInput;
    analyzeImage: AnalyzeImageStepInput;
    analyzeVideo: AnalyzeVideoStepInput;
    captureThumbnail: CaptureThumbnailStepInput;
    checkAppRole: CheckAppRoleStepInput;
    codaCreateUpdatePage: CodaCreateUpdatePageStepInput;
    codaCreateUpdateRow: CodaCreateUpdateRowStepInput;
    codaFindRow: CodaFindRowStepInput;
    codaGetPage: CodaGetPageStepInput;
    codaGetTableRows: CodaGetTableRowsStepInput;
    convertPdfToImages: ConvertPdfToImagesStepInput;
    createDataSource: CreateDataSourceStepInput;
    createGmailDraft: CreateGmailDraftStepInput;
    createGoogleCalendarEvent: CreateGoogleCalendarEventStepInput;
    createGoogleDoc: CreateGoogleDocStepInput;
    createGoogleSheet: CreateGoogleSheetStepInput;
    deleteDataSource: DeleteDataSourceStepInput;
    deleteDataSourceDocument: DeleteDataSourceDocumentStepInput;
    deleteGmailEmail: DeleteGmailEmailStepInput;
    deleteGoogleCalendarEvent: DeleteGoogleCalendarEventStepInput;
    deleteGoogleSheetRows: DeleteGoogleSheetRowsStepInput;
    detectChanges: DetectChangesStepInput;
    detectPII: DetectPIIStepInput;
    discordEditMessage: DiscordEditMessageStepInput;
    discordSendFollowUp: DiscordSendFollowUpStepInput;
    discordSendMessage: DiscordSendMessageStepInput;
    downloadVideo: DownloadVideoStepInput;
    enhanceImageGenerationPrompt: EnhanceImageGenerationPromptStepInput;
    enhanceVideoGenerationPrompt: EnhanceVideoGenerationPromptStepInput;
    enrichPerson: EnrichPersonStepInput;
    extractAudioFromVideo: ExtractAudioFromVideoStepInput;
    extractText: ExtractTextStepInput;
    fetchDataSourceDocument: FetchDataSourceDocumentStepInput;
    fetchGoogleDoc: FetchGoogleDocStepInput;
    fetchGoogleSheet: FetchGoogleSheetStepInput;
    fetchSlackChannelHistory: FetchSlackChannelHistoryStepInput;
    fetchYoutubeCaptions: FetchYoutubeCaptionsStepInput;
    fetchYoutubeChannel: FetchYoutubeChannelStepInput;
    fetchYoutubeComments: FetchYoutubeCommentsStepInput;
    fetchYoutubeVideo: FetchYoutubeVideoStepInput;
    generate3dModel: Generate3dModelStepInput;
    generateChart: GenerateChartStepInput;
    generateImage: GenerateImageStepInput;
    generateLipsync: GenerateLipsyncStepInput;
    generateMusic: GenerateMusicStepInput;
    generatePdf: GeneratePdfStepInput;
    generateStaticVideoFromImage: GenerateStaticVideoFromImageStepInput;
    generateVideo: GenerateVideoStepInput;
    getGmailAttachments: GetGmailAttachmentsStepInput;
    getGmailDraft: GetGmailDraftStepInput;
    getGmailEmail: GetGmailEmailStepInput;
    getGmailUnreadCount: GetGmailUnreadCountStepInput;
    getGoogleCalendarEvent: GetGoogleCalendarEventStepInput;
    getGoogleDriveFile: GetGoogleDriveFileStepInput;
    getGoogleSheetInfo: GetGoogleSheetInfoStepInput;
    getMediaMetadata: GetMediaMetadataStepInput;
    hubspotCreateCompany: HubspotCreateCompanyStepInput;
    hubspotCreateContact: HubspotCreateContactStepInput;
    hubspotGetCompany: HubspotGetCompanyStepInput;
    hubspotGetContact: HubspotGetContactStepInput;
    hunterApiCompanyEnrichment: HunterApiCompanyEnrichmentStepInput;
    hunterApiDomainSearch: HunterApiDomainSearchStepInput;
    hunterApiEmailFinder: HunterApiEmailFinderStepInput;
    hunterApiEmailVerification: HunterApiEmailVerificationStepInput;
    hunterApiPersonEnrichment: HunterApiPersonEnrichmentStepInput;
    imageFaceSwap: ImageFaceSwapStepInput;
    imageRemoveWatermark: ImageRemoveWatermarkStepInput;
    insertVideoClips: InsertVideoClipsStepInput;
    listDataSources: ListDataSourcesStepInput;
    listGmailDrafts: ListGmailDraftsStepInput;
    listGmailLabels: ListGmailLabelsStepInput;
    listGoogleCalendarEvents: ListGoogleCalendarEventsStepInput;
    listGoogleDriveFiles: ListGoogleDriveFilesStepInput;
    listRecentGmailEmails: ListRecentGmailEmailsStepInput;
    logic: LogicStepInput;
    makeDotComRunScenario: MakeDotComRunScenarioStepInput;
    mergeAudio: MergeAudioStepInput;
    mergeVideos: MergeVideosStepInput;
    meshyAnimate: MeshyAnimateStepInput;
    meshyImageTo3d: MeshyImageTo3dStepInput;
    meshyRemesh: MeshyRemeshStepInput;
    meshyRig: MeshyRigStepInput;
    meshyTextTo3d: MeshyTextTo3dStepInput;
    meshyTexture: MeshyTextureStepInput;
    mixAudioIntoVideo: MixAudioIntoVideoStepInput;
    muteVideo: MuteVideoStepInput;
    n8nRunNode: N8nRunNodeStepInput;
    notionCreatePage: NotionCreatePageStepInput;
    notionUpdatePage: NotionUpdatePageStepInput;
    particlePodcastsFindMentions: ParticlePodcastsFindMentionsStepInput;
    particlePodcastsGetEpisode: ParticlePodcastsGetEpisodeStepInput;
    particlePodcastsGetEpisodeTranscript: ParticlePodcastsGetEpisodeTranscriptStepInput;
    particlePodcastsSearchCompanies: ParticlePodcastsSearchCompaniesStepInput;
    particlePodcastsSearchDialogue: ParticlePodcastsSearchDialogueStepInput;
    particlePodcastsSearchPodcasts: ParticlePodcastsSearchPodcastsStepInput;
    peopleSearch: PeopleSearchStepInput;
    postToLinkedIn: PostToLinkedInStepInput;
    postToSlackChannel: PostToSlackChannelStepInput;
    postToX: PostToXStepInput;
    postToZapier: PostToZapierStepInput;
    queryAppDatabase: QueryAppDatabaseStepInput;
    queryDataSource: QueryDataSourceStepInput;
    queryExternalDatabase: QueryExternalDatabaseStepInput;
    redactPII: RedactPIIStepInput;
    removeBackgroundFromImage: RemoveBackgroundFromImageStepInput;
    replyToGmailEmail: ReplyToGmailEmailStepInput;
    resizeVideo: ResizeVideoStepInput;
    runFromConnectorRegistry: RunFromConnectorRegistryStepInput;
    runPackagedWorkflow: RunPackagedWorkflowStepInput;
    scrapeLinkedInCompany: ScrapeLinkedInCompanyStepInput;
    scrapeLinkedInProfile: ScrapeLinkedInProfileStepInput;
    scrapeUrl: ScrapeUrlStepInput;
    scrapeXPost: ScrapeXPostStepInput;
    scrapeXProfile: ScrapeXProfileStepInput;
    screenshotUrl: ScreenshotUrlStepInput;
    searchGmailEmails: SearchGmailEmailsStepInput;
    searchGoogle: SearchGoogleStepInput;
    searchGoogleCalendarEvents: SearchGoogleCalendarEventsStepInput;
    searchGoogleDrive: SearchGoogleDriveStepInput;
    searchGoogleImages: SearchGoogleImagesStepInput;
    searchGoogleNews: SearchGoogleNewsStepInput;
    searchGoogleTrends: SearchGoogleTrendsStepInput;
    searchPerplexity: SearchPerplexityStepInput;
    searchXPosts: SearchXPostsStepInput;
    searchYoutube: SearchYoutubeStepInput;
    searchYoutubeTrends: SearchYoutubeTrendsStepInput;
    sendEmail: SendEmailStepInput;
    sendGmailDraft: SendGmailDraftStepInput;
    sendGmailMessage: SendGmailMessageStepInput;
    sendSlackDirectMessage: SendSlackDirectMessageStepInput;
    sendSMS: SendSMSStepInput;
    setGmailReadStatus: SetGmailReadStatusStepInput;
    setRunTitle: SetRunTitleStepInput;
    setVariable: SetVariableStepInput;
    telegramEditMessage: TelegramEditMessageStepInput;
    telegramReplyToMessage: TelegramReplyToMessageStepInput;
    telegramSendAudio: TelegramSendAudioStepInput;
    telegramSendFile: TelegramSendFileStepInput;
    telegramSendImage: TelegramSendImageStepInput;
    telegramSendMessage: TelegramSendMessageStepInput;
    telegramSendVideo: TelegramSendVideoStepInput;
    telegramSetTyping: TelegramSetTypingStepInput;
    textToSpeech: TextToSpeechStepInput;
    transcribeAudio: TranscribeAudioStepInput;
    trimMedia: TrimMediaStepInput;
    updateGmailLabels: UpdateGmailLabelsStepInput;
    updateGoogleCalendarEvent: UpdateGoogleCalendarEventStepInput;
    updateGoogleDoc: UpdateGoogleDocStepInput;
    updateGoogleSheet: UpdateGoogleSheetStepInput;
    uploadDataSourceDocument: UploadDataSourceDocumentStepInput;
    upscaleImage: UpscaleImageStepInput;
    upscaleVideo: UpscaleVideoStepInput;
    userMessage: UserMessageStepInput;
    videoFaceSwap: VideoFaceSwapStepInput;
    videoRemoveBackground: VideoRemoveBackgroundStepInput;
    videoRemoveWatermark: VideoRemoveWatermarkStepInput;
    watermarkImage: WatermarkImageStepInput;
    watermarkVideo: WatermarkVideoStepInput;
    youDotComFinanceResearch: YouDotComFinanceResearchStepInput;
    youDotComGetPageContent: YouDotComGetPageContentStepInput;
    youDotComLiveNews: YouDotComLiveNewsStepInput;
    youDotComWebResearch: YouDotComWebResearchStepInput;
    youDotComWebSearch: YouDotComWebSearchStepInput;
}
/** Maps step names to their output types. */
interface StepOutputMap {
    activeCampaignAddNote: ActiveCampaignAddNoteStepOutput;
    activeCampaignCreateContact: ActiveCampaignCreateContactStepOutput;
    addSubtitlesToVideo: AddSubtitlesToVideoStepOutput;
    airtableCreateUpdateRecord: AirtableCreateUpdateRecordStepOutput;
    airtableDeleteRecord: AirtableDeleteRecordStepOutput;
    airtableGetRecord: AirtableGetRecordStepOutput;
    airtableGetTableRecords: AirtableGetTableRecordsStepOutput;
    analyzeImage: AnalyzeImageStepOutput;
    analyzeVideo: AnalyzeVideoStepOutput;
    captureThumbnail: CaptureThumbnailStepOutput;
    checkAppRole: CheckAppRoleStepOutput;
    codaCreateUpdatePage: CodaCreateUpdatePageStepOutput;
    codaCreateUpdateRow: CodaCreateUpdateRowStepOutput;
    codaFindRow: CodaFindRowStepOutput;
    codaGetPage: CodaGetPageStepOutput;
    codaGetTableRows: CodaGetTableRowsStepOutput;
    convertPdfToImages: ConvertPdfToImagesStepOutput;
    createDataSource: CreateDataSourceStepOutput;
    createGmailDraft: CreateGmailDraftStepOutput;
    createGoogleCalendarEvent: CreateGoogleCalendarEventStepOutput;
    createGoogleDoc: CreateGoogleDocStepOutput;
    createGoogleSheet: CreateGoogleSheetStepOutput;
    deleteDataSource: DeleteDataSourceStepOutput;
    deleteDataSourceDocument: DeleteDataSourceDocumentStepOutput;
    deleteGmailEmail: DeleteGmailEmailStepOutput;
    deleteGoogleCalendarEvent: DeleteGoogleCalendarEventStepOutput;
    deleteGoogleSheetRows: DeleteGoogleSheetRowsStepOutput;
    detectChanges: DetectChangesStepOutput;
    detectPII: DetectPIIStepOutput;
    discordEditMessage: DiscordEditMessageStepOutput;
    discordSendFollowUp: DiscordSendFollowUpStepOutput;
    discordSendMessage: DiscordSendMessageStepOutput;
    downloadVideo: DownloadVideoStepOutput;
    enhanceImageGenerationPrompt: EnhanceImageGenerationPromptStepOutput;
    enhanceVideoGenerationPrompt: EnhanceVideoGenerationPromptStepOutput;
    enrichPerson: EnrichPersonStepOutput;
    extractAudioFromVideo: ExtractAudioFromVideoStepOutput;
    extractText: ExtractTextStepOutput;
    fetchDataSourceDocument: FetchDataSourceDocumentStepOutput;
    fetchGoogleDoc: FetchGoogleDocStepOutput;
    fetchGoogleSheet: FetchGoogleSheetStepOutput;
    fetchSlackChannelHistory: FetchSlackChannelHistoryStepOutput;
    fetchYoutubeCaptions: FetchYoutubeCaptionsStepOutput;
    fetchYoutubeChannel: FetchYoutubeChannelStepOutput;
    fetchYoutubeComments: FetchYoutubeCommentsStepOutput;
    fetchYoutubeVideo: FetchYoutubeVideoStepOutput;
    generate3dModel: Generate3dModelStepOutput;
    generateChart: GenerateChartStepOutput;
    generateImage: GenerateImageStepOutput;
    generateLipsync: GenerateLipsyncStepOutput;
    generateMusic: GenerateMusicStepOutput;
    generatePdf: GeneratePdfStepOutput;
    generateStaticVideoFromImage: GenerateStaticVideoFromImageStepOutput;
    generateVideo: GenerateVideoStepOutput;
    getGmailAttachments: GetGmailAttachmentsStepOutput;
    getGmailDraft: GetGmailDraftStepOutput;
    getGmailEmail: GetGmailEmailStepOutput;
    getGmailUnreadCount: GetGmailUnreadCountStepOutput;
    getGoogleCalendarEvent: GetGoogleCalendarEventStepOutput;
    getGoogleDriveFile: GetGoogleDriveFileStepOutput;
    getGoogleSheetInfo: GetGoogleSheetInfoStepOutput;
    getMediaMetadata: GetMediaMetadataStepOutput;
    hubspotCreateCompany: HubspotCreateCompanyStepOutput;
    hubspotCreateContact: HubspotCreateContactStepOutput;
    hubspotGetCompany: HubspotGetCompanyStepOutput;
    hubspotGetContact: HubspotGetContactStepOutput;
    hunterApiCompanyEnrichment: HunterApiCompanyEnrichmentStepOutput;
    hunterApiDomainSearch: HunterApiDomainSearchStepOutput;
    hunterApiEmailFinder: HunterApiEmailFinderStepOutput;
    hunterApiEmailVerification: HunterApiEmailVerificationStepOutput;
    hunterApiPersonEnrichment: HunterApiPersonEnrichmentStepOutput;
    imageFaceSwap: ImageFaceSwapStepOutput;
    imageRemoveWatermark: ImageRemoveWatermarkStepOutput;
    insertVideoClips: InsertVideoClipsStepOutput;
    listDataSources: ListDataSourcesStepOutput;
    listGmailDrafts: ListGmailDraftsStepOutput;
    listGmailLabels: ListGmailLabelsStepOutput;
    listGoogleCalendarEvents: ListGoogleCalendarEventsStepOutput;
    listGoogleDriveFiles: ListGoogleDriveFilesStepOutput;
    listRecentGmailEmails: ListRecentGmailEmailsStepOutput;
    logic: LogicStepOutput;
    makeDotComRunScenario: MakeDotComRunScenarioStepOutput;
    mergeAudio: MergeAudioStepOutput;
    mergeVideos: MergeVideosStepOutput;
    meshyAnimate: MeshyAnimateStepOutput;
    meshyImageTo3d: MeshyImageTo3dStepOutput;
    meshyRemesh: MeshyRemeshStepOutput;
    meshyRig: MeshyRigStepOutput;
    meshyTextTo3d: MeshyTextTo3dStepOutput;
    meshyTexture: MeshyTextureStepOutput;
    mixAudioIntoVideo: MixAudioIntoVideoStepOutput;
    muteVideo: MuteVideoStepOutput;
    n8nRunNode: N8nRunNodeStepOutput;
    notionCreatePage: NotionCreatePageStepOutput;
    notionUpdatePage: NotionUpdatePageStepOutput;
    particlePodcastsFindMentions: ParticlePodcastsFindMentionsStepOutput;
    particlePodcastsGetEpisode: ParticlePodcastsGetEpisodeStepOutput;
    particlePodcastsGetEpisodeTranscript: ParticlePodcastsGetEpisodeTranscriptStepOutput;
    particlePodcastsSearchCompanies: ParticlePodcastsSearchCompaniesStepOutput;
    particlePodcastsSearchDialogue: ParticlePodcastsSearchDialogueStepOutput;
    particlePodcastsSearchPodcasts: ParticlePodcastsSearchPodcastsStepOutput;
    peopleSearch: PeopleSearchStepOutput;
    postToLinkedIn: PostToLinkedInStepOutput;
    postToSlackChannel: PostToSlackChannelStepOutput;
    postToX: PostToXStepOutput;
    postToZapier: PostToZapierStepOutput;
    queryAppDatabase: QueryAppDatabaseStepOutput;
    queryDataSource: QueryDataSourceStepOutput;
    queryExternalDatabase: QueryExternalDatabaseStepOutput;
    redactPII: RedactPIIStepOutput;
    removeBackgroundFromImage: RemoveBackgroundFromImageStepOutput;
    replyToGmailEmail: ReplyToGmailEmailStepOutput;
    resizeVideo: ResizeVideoStepOutput;
    runFromConnectorRegistry: RunFromConnectorRegistryStepOutput;
    runPackagedWorkflow: RunPackagedWorkflowStepOutput;
    scrapeLinkedInCompany: ScrapeLinkedInCompanyStepOutput;
    scrapeLinkedInProfile: ScrapeLinkedInProfileStepOutput;
    scrapeUrl: ScrapeUrlStepOutput;
    scrapeXPost: ScrapeXPostStepOutput;
    scrapeXProfile: ScrapeXProfileStepOutput;
    screenshotUrl: ScreenshotUrlStepOutput;
    searchGmailEmails: SearchGmailEmailsStepOutput;
    searchGoogle: SearchGoogleStepOutput;
    searchGoogleCalendarEvents: SearchGoogleCalendarEventsStepOutput;
    searchGoogleDrive: SearchGoogleDriveStepOutput;
    searchGoogleImages: SearchGoogleImagesStepOutput;
    searchGoogleNews: SearchGoogleNewsStepOutput;
    searchGoogleTrends: SearchGoogleTrendsStepOutput;
    searchPerplexity: SearchPerplexityStepOutput;
    searchXPosts: SearchXPostsStepOutput;
    searchYoutube: SearchYoutubeStepOutput;
    searchYoutubeTrends: SearchYoutubeTrendsStepOutput;
    sendEmail: SendEmailStepOutput;
    sendGmailDraft: SendGmailDraftStepOutput;
    sendGmailMessage: SendGmailMessageStepOutput;
    sendSlackDirectMessage: SendSlackDirectMessageStepOutput;
    sendSMS: SendSMSStepOutput;
    setGmailReadStatus: SetGmailReadStatusStepOutput;
    setRunTitle: SetRunTitleStepOutput;
    setVariable: SetVariableStepOutput;
    telegramEditMessage: TelegramEditMessageStepOutput;
    telegramReplyToMessage: TelegramReplyToMessageStepOutput;
    telegramSendAudio: TelegramSendAudioStepOutput;
    telegramSendFile: TelegramSendFileStepOutput;
    telegramSendImage: TelegramSendImageStepOutput;
    telegramSendMessage: TelegramSendMessageStepOutput;
    telegramSendVideo: TelegramSendVideoStepOutput;
    telegramSetTyping: TelegramSetTypingStepOutput;
    textToSpeech: TextToSpeechStepOutput;
    transcribeAudio: TranscribeAudioStepOutput;
    trimMedia: TrimMediaStepOutput;
    updateGmailLabels: UpdateGmailLabelsStepOutput;
    updateGoogleCalendarEvent: UpdateGoogleCalendarEventStepOutput;
    updateGoogleDoc: UpdateGoogleDocStepOutput;
    updateGoogleSheet: UpdateGoogleSheetStepOutput;
    uploadDataSourceDocument: UploadDataSourceDocumentStepOutput;
    upscaleImage: UpscaleImageStepOutput;
    upscaleVideo: UpscaleVideoStepOutput;
    userMessage: UserMessageStepOutput;
    videoFaceSwap: VideoFaceSwapStepOutput;
    videoRemoveBackground: VideoRemoveBackgroundStepOutput;
    videoRemoveWatermark: VideoRemoveWatermarkStepOutput;
    watermarkImage: WatermarkImageStepOutput;
    watermarkVideo: WatermarkVideoStepOutput;
    youDotComFinanceResearch: YouDotComFinanceResearchStepOutput;
    youDotComGetPageContent: YouDotComGetPageContentStepOutput;
    youDotComLiveNews: YouDotComLiveNewsStepOutput;
    youDotComWebResearch: YouDotComWebResearchStepOutput;
    youDotComWebSearch: YouDotComWebSearchStepOutput;
}

interface StepMethods {
    /**
     * Add a note to an existing contact in ActiveCampaign.
     *
     * @remarks
     * - Requires an ActiveCampaign OAuth connection (connectionId).
     * - The contact must already exist — use the contact ID from a previous create or search step.
     *
     * @example
     * ```typescript
     * const result = await agent.activeCampaignAddNote({
     *   contactId: ``,
     *   note: ``,
     * });
     * ```
     */
    activeCampaignAddNote(step: ActiveCampaignAddNoteStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<ActiveCampaignAddNoteStepOutput>>;
    /**
     * Create or sync a contact in ActiveCampaign.
     *
     * @remarks
     * - Requires an ActiveCampaign OAuth connection (connectionId).
     * - If a contact with the email already exists, it may be updated depending on ActiveCampaign settings.
     * - Custom fields are passed as a key-value map where keys are field IDs.
     *
     * @example
     * ```typescript
     * const result = await agent.activeCampaignCreateContact({
     *   email: ``,
     *   firstName: ``,
     *   lastName: ``,
     *   phone: ``,
     *   accountId: ``,
     *   customFields: {},
     * });
     * ```
     */
    activeCampaignCreateContact(step: ActiveCampaignCreateContactStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<ActiveCampaignCreateContactStepOutput>>;
    /**
     * Automatically add subtitles to a video
     *
     * @remarks
     * - Can control style of text and animation
     *
     * @example
     * ```typescript
     * const result = await agent.addSubtitlesToVideo({
     *   videoUrl: ``,
     *   language: ``,
     *   fontName: ``,
     *   fontSize: 0,
     *   fontWeight: "normal",
     *   fontColor: "white",
     *   highlightColor: "white",
     *   strokeWidth: 0,
     *   strokeColor: "black",
     *   backgroundColor: "black",
     *   backgroundOpacity: 0,
     *   position: "top",
     *   yOffset: 0,
     *   wordsPerSubtitle: 0,
     *   enableAnimation: false,
     * });
     * ```
     */
    addSubtitlesToVideo(step: AddSubtitlesToVideoStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<AddSubtitlesToVideoStepOutput>>;
    /**
     * Create a new record or update an existing record in an Airtable table.
     *
     * @remarks
     * - If recordId is provided, updates that record. Otherwise, creates a new one.
     * - When updating with updateMode "onlySpecified", unspecified fields are left as-is. With "all", unspecified fields are cleared.
     * - Array fields (e.g. multipleAttachments) accept arrays of values.
     *
     * @example
     * ```typescript
     * const result = await agent.airtableCreateUpdateRecord({
     *   baseId: ``,
     *   tableId: ``,
     *   fields: ``,
     *   recordData: {},
     * });
     * ```
     */
    airtableCreateUpdateRecord(step: AirtableCreateUpdateRecordStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<AirtableCreateUpdateRecordStepOutput>>;
    /**
     * Delete a record from an Airtable table by its record ID.
     *
     * @remarks
     * - Requires an active Airtable OAuth connection (connectionId).
     * - Silently succeeds if the record does not exist.
     *
     * @example
     * ```typescript
     * const result = await agent.airtableDeleteRecord({
     *   baseId: ``,
     *   tableId: ``,
     *   recordId: ``,
     * });
     * ```
     */
    airtableDeleteRecord(step: AirtableDeleteRecordStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<AirtableDeleteRecordStepOutput>>;
    /**
     * Fetch a single record from an Airtable table by its record ID.
     *
     * @remarks
     * - Requires an active Airtable OAuth connection (connectionId).
     * - If the record is not found, returns a string message instead of a record object.
     *
     * @example
     * ```typescript
     * const result = await agent.airtableGetRecord({
     *   baseId: ``,
     *   tableId: ``,
     *   recordId: ``,
     * });
     * ```
     */
    airtableGetRecord(step: AirtableGetRecordStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<AirtableGetRecordStepOutput>>;
    /**
     * Fetch multiple records from an Airtable table with optional pagination.
     *
     * @remarks
     * - Requires an active Airtable OAuth connection (connectionId).
     * - Default limit is 100 records. Maximum is 1000.
     * - When outputFormat is 'csv', the variable receives CSV text. The direct execution output always returns parsed records.
     *
     * @example
     * ```typescript
     * const result = await agent.airtableGetTableRecords({
     *   baseId: ``,
     *   tableId: ``,
     * });
     * ```
     */
    airtableGetTableRecords(step: AirtableGetTableRecordsStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<AirtableGetTableRecordsStepOutput>>;
    /**
     * Analyze an image using a vision model based on a text prompt.
     *
     * @remarks
     * - Uses the configured vision model to generate a text analysis of the image.
     * - The prompt should describe what to look for or extract from the image.
     * - Pass imageUrl for a single image, or imageUrls for multiple images analyzed together in one request.
     * - Most vision models (OpenAI, Grok, Gemini) accept multiple images in one request. Ideogram describe is single-image only.
     *
     * @example
     * ```typescript
     * const result = await agent.analyzeImage({
     *   prompt: ``,
     * });
     * ```
     */
    analyzeImage(step: AnalyzeImageStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<AnalyzeImageStepOutput>>;
    /**
     * Analyze a video using a video analysis model based on a text prompt.
     *
     * @remarks
     * - Uses the configured video analysis model to generate a text analysis of the video.
     * - The prompt should describe what to look for or extract from the video.
     *
     * @example
     * ```typescript
     * const result = await agent.analyzeVideo({
     *   prompt: ``,
     *   videoUrl: ``,
     * });
     * ```
     */
    analyzeVideo(step: AnalyzeVideoStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<AnalyzeVideoStepOutput>>;
    /**
     * Capture a thumbnail from a video at a specified timestamp
     *
     * @example
     * ```typescript
     * const result = await agent.captureThumbnail({
     *   videoUrl: ``,
     *   at: ``,
     * });
     * ```
     */
    captureThumbnail(step: CaptureThumbnailStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<CaptureThumbnailStepOutput>>;
    /**
     * Check whether the current user has a specific app role and branch accordingly.
     *
     * @remarks
     * - Checks if the current user has been assigned a specific role in this app.
     * - If the user has the role, transitions to the "has role" path.
     * - If the user does not have the role, transitions to the "no role" path, or errors if no path is configured.
     * - Role names are defined by the app creator and assigned to users via the app roles system.
     * - The roleName field supports {{variables}} for dynamic role checks.
     *
     * @example
     * ```typescript
     * const result = await agent.checkAppRole({
     *   roleName: ``,
     * });
     * ```
     */
    checkAppRole(step: CheckAppRoleStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<CheckAppRoleStepOutput>>;
    /**
     * Create a new page or update an existing page in a Coda document.
     *
     * @remarks
     * - Requires a Coda OAuth connection (connectionId).
     * - If pageData.pageId is provided, updates that page. Otherwise, creates a new one.
     * - Page content is provided as markdown and converted to Coda's canvas format.
     * - When updating, insertionMode controls how content is applied (default: 'append').
     *
     * @example
     * ```typescript
     * const result = await agent.codaCreateUpdatePage({
     *   pageData: {},
     * });
     * ```
     */
    codaCreateUpdatePage(step: CodaCreateUpdatePageStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<CodaCreateUpdatePageStepOutput>>;
    /**
     * Create a new row or update an existing row in a Coda table.
     *
     * @remarks
     * - Requires a Coda OAuth connection (connectionId).
     * - If rowId is provided, updates that row. Otherwise, creates a new one.
     * - Row data keys are column IDs. Empty values are excluded.
     *
     * @example
     * ```typescript
     * const result = await agent.codaCreateUpdateRow({
     *   docId: ``,
     *   tableId: ``,
     *   rowData: {},
     * });
     * ```
     */
    codaCreateUpdateRow(step: CodaCreateUpdateRowStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<CodaCreateUpdateRowStepOutput>>;
    /**
     * Search for a row in a Coda table by matching column values.
     *
     * @remarks
     * - Requires a Coda OAuth connection (connectionId).
     * - Returns the first row matching all specified column values, or null if no match.
     * - Search criteria in rowData are ANDed together.
     *
     * @example
     * ```typescript
     * const result = await agent.codaFindRow({
     *   docId: ``,
     *   tableId: ``,
     *   rowData: {},
     * });
     * ```
     */
    codaFindRow(step: CodaFindRowStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<CodaFindRowStepOutput>>;
    /**
     * Export and read the contents of a page from a Coda document.
     *
     * @remarks
     * - Requires a Coda OAuth connection (connectionId).
     * - Page export is asynchronous on Coda's side — there may be a brief delay while it processes.
     * - If a page was just created in a prior step, there is an automatic 20-second retry if the first export attempt fails.
     *
     * @example
     * ```typescript
     * const result = await agent.codaGetPage({
     *   docId: ``,
     *   pageId: ``,
     * });
     * ```
     */
    codaGetPage(step: CodaGetPageStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<CodaGetPageStepOutput>>;
    /**
     * Fetch rows from a Coda table with optional pagination.
     *
     * @remarks
     * - Requires a Coda OAuth connection (connectionId).
     * - Default limit is 10000 rows. Rows are fetched in pages of 500.
     * - When outputFormat is 'csv', the variable receives CSV text. The direct execution output always returns parsed rows.
     *
     * @example
     * ```typescript
     * const result = await agent.codaGetTableRows({
     *   docId: ``,
     *   tableId: ``,
     * });
     * ```
     */
    codaGetTableRows(step: CodaGetTableRowsStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<CodaGetTableRowsStepOutput>>;
    /**
     * Convert each page of a PDF document into a PNG image.
     *
     * @remarks
     * - Each page is converted to a separate PNG and re-hosted on the CDN.
     * - Returns an array of image URLs, one per page.
     *
     * @example
     * ```typescript
     * const result = await agent.convertPdfToImages({
     *   pdfUrl: ``,
     * });
     * ```
     */
    convertPdfToImages(step: ConvertPdfToImagesStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<ConvertPdfToImagesStepOutput>>;
    /**
     * @deprecated Legacy v1 data sources. v2 apps should use `dataSources.defineDataSource()` from @mindstudio-ai/agent instead, which owns parsing, chunking, embedding and citations. Create a new empty vector data source for the current app.
     *
     * @remarks
     * - Creates a new data source (vector database) associated with the current app version.
     * - The data source is created empty — use the "Upload Data Source Document" block to add documents.
     * - Returns the new data source ID which can be used in subsequent blocks.
     *
     * @example
     * ```typescript
     * const result = await agent.createDataSource({
     *   name: ``,
     * });
     * ```
     */
    createDataSource(step: CreateDataSourceStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<CreateDataSourceStepOutput>>;
    /**
     * Create a draft email in the connected Gmail account.
     *
     * @remarks
     * - Requires a Google OAuth connection with Gmail compose scope.
     * - The draft appears in the user's Gmail Drafts folder but is not sent.
     * - messageType controls the body format: "plain" for plain text, "html" for raw HTML, "markdown" for auto-converted markdown.
     *
     * @example
     * ```typescript
     * const result = await agent.createGmailDraft({
     *   to: ``,
     *   subject: ``,
     *   message: ``,
     *   messageType: "plain",
     * });
     * ```
     */
    createGmailDraft(step: CreateGmailDraftStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<CreateGmailDraftStepOutput>>;
    /**
     * Create a new event on a Google Calendar.
     *
     * @remarks
     * - Requires a Google OAuth connection with Calendar events scope.
     * - Date/time values must be ISO 8601 format (e.g. "2025-07-02T10:00:00-07:00").
     * - Attendees are specified as one email address per line in a single string.
     * - Set addMeetLink to true to automatically attach a Google Meet video call.
     *
     * @example
     * ```typescript
     * const result = await agent.createGoogleCalendarEvent({
     *   summary: ``,
     *   startDateTime: ``,
     *   endDateTime: ``,
     * });
     * ```
     */
    createGoogleCalendarEvent(step: CreateGoogleCalendarEventStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<CreateGoogleCalendarEventStepOutput>>;
    /**
     * Create a new Google Document and optionally populate it with content.
     *
     * @remarks
     * - textType determines how the text field is interpreted: "plain" for plain text, "html" for HTML markup, "markdown" for Markdown.
     *
     * @example
     * ```typescript
     * const result = await agent.createGoogleDoc({
     *   title: ``,
     *   text: ``,
     *   textType: "plain",
     * });
     * ```
     */
    createGoogleDoc(step: CreateGoogleDocStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<CreateGoogleDocStepOutput>>;
    /**
     * Create a new Google Spreadsheet and populate it with CSV data.
     *
     * @example
     * ```typescript
     * const result = await agent.createGoogleSheet({
     *   title: ``,
     *   text: ``,
     * });
     * ```
     */
    createGoogleSheet(step: CreateGoogleSheetStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<CreateGoogleSheetStepOutput>>;
    /**
     * @deprecated Legacy v1 data sources. v2 apps should use `dataSources.defineDataSource()` from @mindstudio-ai/agent instead, which owns parsing, chunking, embedding and citations. Delete a vector data source from the current app.
     *
     * @remarks
     * - Soft-deletes a data source (vector database) by marking it as deleted.
     * - The Milvus partition is cleaned up asynchronously by a background cron job.
     * - The data source must belong to the current app version.
     *
     * @example
     * ```typescript
     * const result = await agent.deleteDataSource({
     *   dataSourceId: ``,
     * });
     * ```
     */
    deleteDataSource(step: DeleteDataSourceStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<DeleteDataSourceStepOutput>>;
    /**
     * @deprecated Legacy v1 data sources. v2 apps should use `dataSources.defineDataSource()` from @mindstudio-ai/agent instead, which owns parsing, chunking, embedding and citations. Delete a single document from a data source.
     *
     * @remarks
     * - Soft-deletes a document by marking it as deleted.
     * - Requires both the data source ID and document ID.
     * - After deletion, reloads vectors into Milvus so the data source reflects the change immediately.
     *
     * @example
     * ```typescript
     * const result = await agent.deleteDataSourceDocument({
     *   dataSourceId: ``,
     *   documentId: ``,
     * });
     * ```
     */
    deleteDataSourceDocument(step: DeleteDataSourceDocumentStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<DeleteDataSourceDocumentStepOutput>>;
    /**
     * Move an email to trash in the connected Gmail account (recoverable delete).
     *
     * @remarks
     * - Requires a Google OAuth connection with Gmail modify scope.
     * - Uses trash (recoverable) rather than permanent delete.
     *
     * @example
     * ```typescript
     * const result = await agent.deleteGmailEmail({
     *   messageId: ``,
     * });
     * ```
     */
    deleteGmailEmail(step: DeleteGmailEmailStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<DeleteGmailEmailStepOutput>>;
    /**
     * Retrieve a specific event from a Google Calendar by event ID.
     *
     * @remarks
     * - Requires a Google OAuth connection with Calendar events scope.
     * - The variable receives JSON or XML-like text depending on exportType. The direct execution output always returns the structured event.
     *
     * @example
     * ```typescript
     * const result = await agent.deleteGoogleCalendarEvent({
     *   eventId: ``,
     * });
     * ```
     */
    deleteGoogleCalendarEvent(step: DeleteGoogleCalendarEventStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<DeleteGoogleCalendarEventStepOutput>>;
    /**
     * Delete a range of rows from a Google Spreadsheet.
     *
     * @remarks
     * - Requires a Google OAuth connection with Drive scope.
     * - startRow and endRow are 1-based row numbers (inclusive).
     * - If sheetName is omitted, operates on the first sheet.
     *
     * @example
     * ```typescript
     * const result = await agent.deleteGoogleSheetRows({
     *   documentId: ``,
     *   startRow: ``,
     *   endRow: ``,
     * });
     * ```
     */
    deleteGoogleSheetRows(step: DeleteGoogleSheetRowsStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<DeleteGoogleSheetRowsStepOutput>>;
    /**
     * Detect changes between runs by comparing current input against previously stored state. Routes execution based on whether a change occurred.
     *
     * @remarks
     * - Persists state across runs using a global variable keyed to the step ID.
     * - Two modes: "comparison" (default) uses strict string inequality; "ai" uses an LLM to determine if a meaningful change occurred.
     * - First run always treats the value as "changed" since there is no previous state.
     * - Each mode supports transitions to different steps/workflows for the "changed" and "unchanged" paths.
     * - AI mode bills normally for the LLM call.
     *
     * @example
     * ```typescript
     * const result = await agent.detectChanges({
     *   mode: "ai",
     *   input: ``,
     * });
     * ```
     */
    detectChanges(step: DetectChangesStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<DetectChangesStepOutput>>;
    /**
     * Scan text for personally identifiable information using Microsoft Presidio.
     *
     * @remarks
     * - In workflow mode, transitions to detectedStepId if PII is found, notDetectedStepId otherwise.
     * - In direct execution, returns the detection results without transitioning.
     * - If entities is empty, returns immediately with no detections.
     *
     * @example
     * ```typescript
     * const result = await agent.detectPII({
     *   input: ``,
     *   language: ``,
     *   entities: [],
     * });
     * ```
     */
    detectPII(step: DetectPIIStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<DetectPIIStepOutput>>;
    /**
     * Edit a previously sent Discord channel message. Use with the message ID returned by Send Discord Message.
     *
     * @remarks
     * - Only messages sent by the bot can be edited.
     * - The messageId is returned by the Send Discord Message step.
     * - Optionally attach a file by providing a URL to attachmentUrl. The file is downloaded and uploaded to Discord.
     * - When editing with an attachment, the new attachment replaces any previous attachments on the message.
     * - URLs in the text are automatically embedded by Discord (link previews for images, videos, etc.).
     *
     * @example
     * ```typescript
     * const result = await agent.discordEditMessage({
     *   botToken: ``,
     *   channelId: ``,
     *   messageId: ``,
     *   text: ``,
     * });
     * ```
     */
    discordEditMessage(step: DiscordEditMessageStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<DiscordEditMessageStepOutput>>;
    /**
     * Send a follow-up message to a Discord slash command interaction.
     *
     * @remarks
     * - Requires the applicationId and interactionToken from the Discord trigger variables.
     * - Follow-up messages appear as new messages in the channel after the initial response.
     * - Returns the sent message ID.
     * - Interaction tokens expire after 15 minutes.
     * - Optionally attach a file by providing a URL to attachmentUrl. The file is downloaded and uploaded to Discord.
     * - URLs in the text are automatically embedded by Discord (link previews for images, videos, etc.).
     *
     * @example
     * ```typescript
     * const result = await agent.discordSendFollowUp({
     *   applicationId: ``,
     *   interactionToken: ``,
     *   text: ``,
     * });
     * ```
     */
    discordSendFollowUp(step: DiscordSendFollowUpStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<DiscordSendFollowUpStepOutput>>;
    /**
     * Send a message to Discord — either edit the loading message or send a new channel message.
     *
     * @remarks
     * - mode "edit" replaces the loading message (interaction response) with the final result. Uses applicationId and interactionToken from trigger variables. No bot permissions required.
     * - mode "send" sends a new message to a channel. Uses botToken and channelId from trigger variables. Returns a messageId that can be used with Edit Discord Message.
     * - Optionally attach a file by providing a URL to attachmentUrl. The file is downloaded and uploaded to Discord.
     * - URLs in the text are automatically embedded by Discord (link previews for images, videos, etc.).
     * - Interaction tokens expire after 15 minutes.
     *
     * @example
     * ```typescript
     * const result = await agent.discordSendMessage({
     *   mode: "edit",
     *   text: ``,
     * });
     * ```
     */
    discordSendMessage(step: DiscordSendMessageStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<DiscordSendMessageStepOutput>>;
    /**
     * Download a video file
     *
     * @remarks
     * - Works with YouTube, TikTok, etc., by using ytdlp behind the scenes
     * - Can save as mp4 or mp3
     *
     * @example
     * ```typescript
     * const result = await agent.downloadVideo({
     *   videoUrl: ``,
     *   format: "mp4",
     * });
     * ```
     */
    downloadVideo(step: DownloadVideoStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<DownloadVideoStepOutput>>;
    /**
     * Generate or enhance an image generation prompt using a language model. Optionally generates a negative prompt.
     *
     * @remarks
     * - Rewrites the user's prompt with added detail about style, lighting, colors, and composition.
     * - Also useful for initial generation, it doesn't always need to be enhancing an existing prompt
     * - When includeNegativePrompt is true, a second model call generates a negative prompt.
     *
     * @example
     * ```typescript
     * const result = await agent.enhanceImageGenerationPrompt({
     *   initialPrompt: ``,
     *   includeNegativePrompt: false,
     *   systemPrompt: ``,
     * });
     * ```
     */
    enhanceImageGenerationPrompt(step: EnhanceImageGenerationPromptStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<EnhanceImageGenerationPromptStepOutput>>;
    /**
     * Generate or enhance a video generation prompt using a language model. Optionally generates a negative prompt.
     *
     * @remarks
     * - Rewrites the user's prompt with added detail about style, camera movement, lighting, and composition.
     * - Also useful for initial generation, it doesn't always need to be enhancing an existing prompt
     * - When includeNegativePrompt is true, a second model call generates a negative prompt.
     *
     * @example
     * ```typescript
     * const result = await agent.enhanceVideoGenerationPrompt({
     *   initialPrompt: ``,
     *   includeNegativePrompt: false,
     *   systemPrompt: ``,
     * });
     * ```
     */
    enhanceVideoGenerationPrompt(step: EnhanceVideoGenerationPromptStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<EnhanceVideoGenerationPromptStepOutput>>;
    /**
     * Look up professional information about a person using Apollo.io. Search by ID, name, LinkedIn URL, email, or domain.
     *
     * @remarks
     * - At least one search parameter must be provided.
     * - Returns enriched data from Apollo including contact details, employment info, and social profiles.
     *
     * @example
     * ```typescript
     * const result = await agent.enrichPerson({
     *   params: {},
     * });
     * ```
     */
    enrichPerson(step: EnrichPersonStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<EnrichPersonStepOutput>>;
    /**
     * Extract audio MP3 from a video file
     *
     * @example
     * ```typescript
     * const result = await agent.extractAudioFromVideo({
     *   videoUrl: ``,
     * });
     * ```
     */
    extractAudioFromVideo(step: ExtractAudioFromVideoStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<ExtractAudioFromVideoStepOutput>>;
    /**
     * Download a file from a URL and extract its text content. Supports PDFs (including scanned/image-based PDFs via OCR), plain text files, and other document formats.
     *
     * @remarks
     * - Best suited for PDFs and raw text/document files. For web pages, use the scrapeUrl step instead.
     * - Handles both text-layer PDFs and image-based/scanned PDFs (e.g. Figma/Canva exports, scanned documents). Image-based PDFs are processed with OCR automatically — there is no need to convert PDF pages to images first.
     * - Accepts a single URL, a comma-separated list of URLs, or a JSON array of URLs.
     * - Files are rehosted on the MindStudio CDN before extraction.
     * - Optionally set `model` to a specific document-extraction model (`mistral-ocr-latest`, `llamaparse`, `google-document-ai`); omit to use the platform default.
     * - Maximum file size is 50MB per URL.
     *
     * @example
     * ```typescript
     * const result = await agent.extractText({
     *   url: ``,
     * });
     * ```
     */
    extractText(step: ExtractTextStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<ExtractTextStepOutput>>;
    /**
     * @deprecated Legacy v1 data sources. v2 apps should use `dataSources.defineDataSource()` from @mindstudio-ai/agent instead, which owns parsing, chunking, embedding and citations. Fetch the full extracted text contents of a document in a data source.
     *
     * @remarks
     * - Loads a document by ID and returns its full extracted text content.
     * - The document must have been successfully processed (status "done").
     * - Also returns document metadata (name, summary, word count).
     *
     * @example
     * ```typescript
     * const result = await agent.fetchDataSourceDocument({
     *   dataSourceId: ``,
     *   documentId: ``,
     * });
     * ```
     */
    fetchDataSourceDocument(step: FetchDataSourceDocumentStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<FetchDataSourceDocumentStepOutput>>;
    /**
     * Fetch the contents of an existing Google Document.
     *
     * @remarks
     * - exportType controls the output format: "html" for HTML markup, "markdown" for Markdown, "json" for structured JSON, "plain" for plain text.
     *
     * @example
     * ```typescript
     * const result = await agent.fetchGoogleDoc({
     *   documentId: ``,
     *   exportType: "html",
     * });
     * ```
     */
    fetchGoogleDoc(step: FetchGoogleDocStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<FetchGoogleDocStepOutput>>;
    /**
     * Fetch contents of a Google Spreadsheet range.
     *
     * @remarks
     * - range uses A1 notation (e.g. "Sheet1!A1:C10"). Omit to fetch the entire first sheet.
     * - exportType controls the output format: "csv" for comma-separated values, "json" for structured JSON.
     *
     * @example
     * ```typescript
     * const result = await agent.fetchGoogleSheet({
     *   spreadsheetId: ``,
     *   range: ``,
     *   exportType: "csv",
     * });
     * ```
     */
    fetchGoogleSheet(step: FetchGoogleSheetStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<FetchGoogleSheetStepOutput>>;
    /**
     * Fetch recent message history from a Slack channel.
     *
     * @remarks
     * - The user is responsible for connecting their Slack workspace and selecting the channel
     *
     * @example
     * ```typescript
     * const result = await agent.fetchSlackChannelHistory({
     *   channelId: ``,
     * });
     * ```
     */
    fetchSlackChannelHistory(step: FetchSlackChannelHistoryStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<FetchSlackChannelHistoryStepOutput>>;
    /**
     * Retrieve the captions/transcript for a YouTube video.
     *
     * @remarks
     * - Supports multiple languages via the language parameter.
     * - "text" export produces timestamped plain text; "json" export produces structured transcript data.
     *
     * @example
     * ```typescript
     * const result = await agent.fetchYoutubeCaptions({
     *   videoUrl: ``,
     *   exportType: "text",
     *   language: ``,
     * });
     * ```
     */
    fetchYoutubeCaptions(step: FetchYoutubeCaptionsStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<FetchYoutubeCaptionsStepOutput>>;
    /**
     * Retrieve metadata and recent videos for a YouTube channel.
     *
     * @remarks
     * - Accepts a YouTube channel URL (e.g. https://www.youtube.com/@ChannelName or /channel/ID).
     * - Returns channel info and video listings as a JSON object.
     *
     * @example
     * ```typescript
     * const result = await agent.fetchYoutubeChannel({
     *   channelUrl: ``,
     * });
     * ```
     */
    fetchYoutubeChannel(step: FetchYoutubeChannelStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<FetchYoutubeChannelStepOutput>>;
    /**
     * Retrieve comments for a YouTube video.
     *
     * @remarks
     * - Paginates through comments (up to 5 pages).
     * - "text" export produces markdown-formatted text; "json" export produces structured comment data.
     *
     * @example
     * ```typescript
     * const result = await agent.fetchYoutubeComments({
     *   videoUrl: ``,
     *   exportType: "text",
     *   limitPages: ``,
     * });
     * ```
     */
    fetchYoutubeComments(step: FetchYoutubeCommentsStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<FetchYoutubeCommentsStepOutput>>;
    /**
     * Retrieve metadata for a YouTube video (title, description, stats, channel info).
     *
     * @remarks
     * - Returns video metadata, channel info, and engagement stats.
     * - Video format data is excluded from the response.
     *
     * @example
     * ```typescript
     * const result = await agent.fetchYoutubeVideo({
     *   videoUrl: ``,
     * });
     * ```
     */
    fetchYoutubeVideo(step: FetchYoutubeVideoStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<FetchYoutubeVideoStepOutput>>;
    /**
     * Generate a 3D model using a 3D generation model.
     *
     * @remarks
     * - Text-to-3D models use the prompt field.
     * - Image-to-3D and multi-view models take image URLs through the selected model's configuration inputs.
     * - The output is standardized as a GLB URL plus optional FBX/OBJ/USDZ, thumbnail, texture maps, and provider task ID.
     *
     * @example
     * ```typescript
     * const result = await agent.generate3dModel({});
     * ```
     */
    generate3dModel(step: Generate3dModelStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<Generate3dModelStepOutput>>;
    /**
     * Create a chart image using QuickChart (Chart.js) and return the URL.
     *
     * @remarks
     * - The data field must be a Chart.js-compatible JSON object serialized as a string.
     * - Supported chart types: bar, line, pie.
     *
     * @example
     * ```typescript
     * const result = await agent.generateChart({
     *   chart: {},
     * });
     * ```
     */
    generateChart(step: GenerateChartStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<GenerateChartStepOutput>>;
    /**
     * Generate an image from a text prompt using an AI model.
     *
     * @remarks
     * - Prompts should be descriptive but concise (roughly 3–6 sentences).
     * - Images are automatically hosted on a CDN.
     * - In foreground mode, the image is displayed to the user. In background mode, the URL is saved to a variable.
     * - When generateVariants is true with numVariants > 1, multiple images are generated in parallel.
     * - In direct execution, foreground mode behaves as background, and userSelect variant behavior behaves as saveAll.
     *
     * @example
     * ```typescript
     * const result = await agent.generateImage({
     *   prompt: ``,
     * });
     * ```
     */
    generateImage(step: GenerateImageStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<GenerateImageStepOutput>>;
    /**
     * Generate a lip sync video from provided audio and image.
     *
     * @remarks
     * - In foreground mode, the video is displayed to the user. In background mode, the URL is saved to a variable.
     *
     * @example
     * ```typescript
     * const result = await agent.generateLipsync({});
     * ```
     */
    generateLipsync(step: GenerateLipsyncStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<GenerateLipsyncStepOutput>>;
    /**
     * Generate an audio file from provided instructions (text) using a music model.
     *
     * @remarks
     * - The text field contains the instructions (prompt) for the music generation.
     * - In foreground mode, the audio is displayed to the user. In background mode, the URL is saved to a variable.
     *
     * @example
     * ```typescript
     * const result = await agent.generateMusic({
     *   text: ``,
     * });
     * ```
     */
    generateMusic(step: GenerateMusicStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<GenerateMusicStepOutput>>;
    /**
     * Generate an HTML asset and export it as a webpage, PDF, or image
     *
     * @remarks
     * - Agents can generate HTML documents and export as webpage, PDFs, images, or videos. They do this by using the "generatePdf" block, which defines an HTML page with variables, and then the generation process renders the page to create the output and save its URL at the specified variable.
     * - The template for the HTML page is generated by a separate process, and it can only use variables that have already been defined in the workflow at the time of its execution. It has full access to handlebars to render the HTML template, including a handlebars helper to render a markdown variable string as HTML (which can be useful for creating templates that render long strings). The template can also create its own simple JavaScript to do things like format dates and strings.
     * - If PDF or composited image generation are part of the workflow, assistant adds the block and leaves the "source" empty. In a separate step, assistant generates a detailed request for the developer who will write the HTML.
     * - Can also auto-generate HTML from a prompt (like a generate text block to generate HTML). In these cases, create a prompt with variables in the dynamicPrompt variable describing, in detail, the document to generate
     * - Can either display output directly to user (foreground mode) or save the URL of the asset to a variable (background mode)
     *
     * @example
     * ```typescript
     * const result = await agent.generateAsset({
     *   source: ``,
     *   sourceType: "html",
     *   outputFormat: "pdf",
     *   pageSize: "full",
     *   testData: {},
     * });
     * ```
     */
    generateAsset(step: GeneratePdfStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<GeneratePdfStepOutput>>;
    /**
     * Convert a static image to an MP4
     *
     * @remarks
     * - Can use to create slides/intertitles/slates for video composition
     *
     * @example
     * ```typescript
     * const result = await agent.generateStaticVideoFromImage({
     *   imageUrl: ``,
     *   duration: ``,
     * });
     * ```
     */
    generateStaticVideoFromImage(step: GenerateStaticVideoFromImageStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<GenerateStaticVideoFromImageStepOutput>>;
    /**
     * Generate a video from a text prompt using an AI model.
     *
     * @remarks
     * - Prompts should be descriptive but concise (roughly 3–6 sentences).
     * - Videos are automatically hosted on a CDN.
     * - In foreground mode, the video is displayed to the user. In background mode, the URL is saved to a variable.
     * - When generateVariants is true with numVariants > 1, multiple videos are generated in parallel.
     * - In direct execution, foreground mode behaves as background, and userSelect variant behavior behaves as saveAll.
     *
     * @example
     * ```typescript
     * const result = await agent.generateVideo({
     *   prompt: ``,
     * });
     * ```
     */
    generateVideo(step: GenerateVideoStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<GenerateVideoStepOutput>>;
    /**
     * Download attachments from a Gmail email and re-host them on CDN.
     *
     * @remarks
     * - Requires a Google OAuth connection with Gmail readonly scope.
     * - Attachments are uploaded to CDN and returned as URLs.
     * - Attachments larger than 25MB are skipped.
     * - Use the message ID from Search Gmail Emails, List Recent Gmail Emails, or Get Gmail Email steps.
     *
     * @example
     * ```typescript
     * const result = await agent.getGmailAttachments({
     *   messageId: ``,
     * });
     * ```
     */
    getGmailAttachments(step: GetGmailAttachmentsStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<GetGmailAttachmentsStepOutput>>;
    /**
     * Retrieve a specific draft from Gmail by draft ID.
     *
     * @remarks
     * - Requires a Google OAuth connection with Gmail readonly scope.
     * - Returns the draft content including subject, recipients, sender, and body.
     *
     * @example
     * ```typescript
     * const result = await agent.getGmailDraft({
     *   draftId: ``,
     * });
     * ```
     */
    getGmailDraft(step: GetGmailDraftStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<GetGmailDraftStepOutput>>;
    /**
     * Retrieve a specific email from Gmail by message ID.
     *
     * @remarks
     * - Requires a Google OAuth connection with Gmail readonly scope.
     * - Returns the email subject, sender, recipient, date, body (plain text preferred, falls back to HTML), and labels.
     *
     * @example
     * ```typescript
     * const result = await agent.getGmailEmail({
     *   messageId: ``,
     * });
     * ```
     */
    getGmailEmail(step: GetGmailEmailStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<GetGmailEmailStepOutput>>;
    /**
     * Get the number of unread emails in the connected Gmail inbox.
     *
     * @remarks
     * - Requires a Google OAuth connection with Gmail readonly scope.
     * - Returns the unread message count for the inbox label.
     * - This is a lightweight call that does not fetch any email content.
     *
     * @example
     * ```typescript
     * const result = await agent.getGmailUnreadCount({});
     * ```
     */
    getGmailUnreadCount(step: GetGmailUnreadCountStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<GetGmailUnreadCountStepOutput>>;
    /**
     * Retrieve a specific event from a Google Calendar by event ID.
     *
     * @remarks
     * - Requires a Google OAuth connection with Calendar events scope.
     * - The variable receives JSON or XML-like text depending on exportType. The direct execution output always returns the structured event.
     *
     * @example
     * ```typescript
     * const result = await agent.getGoogleCalendarEvent({
     *   eventId: ``,
     *   exportType: "json",
     * });
     * ```
     */
    getGoogleCalendarEvent(step: GetGoogleCalendarEventStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<GetGoogleCalendarEventStepOutput>>;
    /**
     * Download a file from Google Drive and rehost it on the CDN. Returns a public CDN URL.
     *
     * @remarks
     * - Requires a Google OAuth connection with Drive scope.
     * - Google-native files (Docs, Sheets, Slides) cannot be downloaded — use dedicated steps instead.
     * - Maximum file size: 200MB.
     * - The file is downloaded and re-uploaded to the CDN; the returned URL is publicly accessible.
     *
     * @example
     * ```typescript
     * const result = await agent.getGoogleDriveFile({
     *   fileId: ``,
     * });
     * ```
     */
    getGoogleDriveFile(step: GetGoogleDriveFileStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<GetGoogleDriveFileStepOutput>>;
    /**
     * Get metadata about a Google Spreadsheet including sheet names, row counts, and column counts.
     *
     * @remarks
     * - Requires a Google OAuth connection with Drive scope.
     * - Returns the spreadsheet title and a list of all sheets with their dimensions.
     *
     * @example
     * ```typescript
     * const result = await agent.getGoogleSheetInfo({
     *   documentId: ``,
     * });
     * ```
     */
    getGoogleSheetInfo(step: GetGoogleSheetInfoStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<GetGoogleSheetInfoStepOutput>>;
    /**
     * Get info about a media file
     *
     * @example
     * ```typescript
     * const result = await agent.getMediaMetadata({
     *   mediaUrl: ``,
     * });
     * ```
     */
    getMediaMetadata(step: GetMediaMetadataStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<GetMediaMetadataStepOutput>>;
    /**
     * Create a new company or update an existing one in HubSpot. Matches by domain.
     *
     * @remarks
     * - Requires a HubSpot OAuth connection (connectionId).
     * - If a company with the given domain already exists, it is updated. Otherwise, a new one is created.
     * - Property values are type-checked against enabledProperties before being sent to HubSpot.
     *
     * @example
     * ```typescript
     * const result = await agent.hubspotCreateCompany({
     *   company: {},
     *   enabledProperties: [],
     * });
     * ```
     */
    hubspotCreateCompany(step: HubspotCreateCompanyStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<HubspotCreateCompanyStepOutput>>;
    /**
     * Create a new contact or update an existing one in HubSpot. Matches by email address.
     *
     * @remarks
     * - Requires a HubSpot OAuth connection (connectionId).
     * - If a contact with the given email already exists, it is updated. Otherwise, a new one is created.
     * - If companyDomain is provided, the contact is associated with that company (creating the company if needed).
     * - Property values are type-checked against enabledProperties before being sent to HubSpot.
     *
     * @example
     * ```typescript
     * const result = await agent.hubspotCreateContact({
     *   contact: {},
     *   enabledProperties: [],
     *   companyDomain: ``,
     * });
     * ```
     */
    hubspotCreateContact(step: HubspotCreateContactStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<HubspotCreateContactStepOutput>>;
    /**
     * Look up a HubSpot company by domain name or company ID.
     *
     * @remarks
     * - Requires a HubSpot OAuth connection (connectionId).
     * - Returns null if the company is not found.
     * - When searching by domain, performs a search query then fetches the full company record.
     * - Use additionalProperties to request specific HubSpot properties beyond the defaults.
     *
     * @example
     * ```typescript
     * const result = await agent.hubspotGetCompany({
     *   searchBy: "domain",
     *   companyDomain: ``,
     *   companyId: ``,
     *   additionalProperties: [],
     * });
     * ```
     */
    hubspotGetCompany(step: HubspotGetCompanyStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<HubspotGetCompanyStepOutput>>;
    /**
     * Look up a HubSpot contact by email address or contact ID.
     *
     * @remarks
     * - Requires a HubSpot OAuth connection (connectionId).
     * - Returns null if the contact is not found.
     * - Use additionalProperties to request specific HubSpot properties beyond the defaults.
     *
     * @example
     * ```typescript
     * const result = await agent.hubspotGetContact({
     *   searchBy: "email",
     *   contactEmail: ``,
     *   contactId: ``,
     *   additionalProperties: [],
     * });
     * ```
     */
    hubspotGetContact(step: HubspotGetContactStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<HubspotGetContactStepOutput>>;
    /**
     * Look up company information by domain using Hunter.io.
     *
     * @remarks
     * - Returns company name, description, location, industry, size, technologies, and more.
     * - If the domain input is a full URL, the hostname is automatically extracted.
     * - Returns null if the company is not found.
     *
     * @example
     * ```typescript
     * const result = await agent.hunterApiCompanyEnrichment({
     *   domain: ``,
     * });
     * ```
     */
    hunterApiCompanyEnrichment(step: HunterApiCompanyEnrichmentStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<HunterApiCompanyEnrichmentStepOutput>>;
    /**
     * Search for email addresses associated with a domain using Hunter.io.
     *
     * @remarks
     * - If the domain input is a full URL, the hostname is automatically extracted.
     * - Returns a list of email addresses found for the domain along with organization info.
     *
     * @example
     * ```typescript
     * const result = await agent.hunterApiDomainSearch({
     *   domain: ``,
     * });
     * ```
     */
    hunterApiDomainSearch(step: HunterApiDomainSearchStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<HunterApiDomainSearchStepOutput>>;
    /**
     * Find an email address for a specific person at a domain using Hunter.io.
     *
     * @remarks
     * - Requires a first name, last name, and domain.
     * - If the domain input is a full URL, the hostname is automatically extracted.
     * - Returns the most likely email address with a confidence score.
     *
     * @example
     * ```typescript
     * const result = await agent.hunterApiEmailFinder({
     *   domain: ``,
     *   firstName: ``,
     *   lastName: ``,
     * });
     * ```
     */
    hunterApiEmailFinder(step: HunterApiEmailFinderStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<HunterApiEmailFinderStepOutput>>;
    /**
     * Verify whether an email address is valid and deliverable using Hunter.io.
     *
     * @remarks
     * - Checks email format, MX records, SMTP server, and mailbox deliverability.
     * - Returns a status ("valid", "invalid", "accept_all", "webmail", "disposable", "unknown") and a score.
     *
     * @example
     * ```typescript
     * const result = await agent.hunterApiEmailVerification({
     *   email: ``,
     * });
     * ```
     */
    hunterApiEmailVerification(step: HunterApiEmailVerificationStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<HunterApiEmailVerificationStepOutput>>;
    /**
     * Look up professional information about a person by their email address using Hunter.io.
     *
     * @remarks
     * - Returns name, job title, social profiles, and company information.
     * - If the person is not found, returns an object with an error message instead of throwing.
     *
     * @example
     * ```typescript
     * const result = await agent.hunterApiPersonEnrichment({
     *   email: ``,
     * });
     * ```
     */
    hunterApiPersonEnrichment(step: HunterApiPersonEnrichmentStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<HunterApiPersonEnrichmentStepOutput>>;
    /**
     * Replace a face in an image with a face from another image using AI.
     *
     * @remarks
     * - Requires both a target image and a face source image.
     * - Output is re-hosted on the CDN as a PNG.
     *
     * @example
     * ```typescript
     * const result = await agent.imageFaceSwap({
     *   imageUrl: ``,
     *   faceImageUrl: ``,
     *   engine: ``,
     * });
     * ```
     */
    imageFaceSwap(step: ImageFaceSwapStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<ImageFaceSwapStepOutput>>;
    /**
     * Remove watermarks from an image using AI.
     *
     * @remarks
     * - Output is re-hosted on the CDN as a PNG.
     *
     * @example
     * ```typescript
     * const result = await agent.imageRemoveWatermark({
     *   imageUrl: ``,
     *   engine: ``,
     * });
     * ```
     */
    imageRemoveWatermark(step: ImageRemoveWatermarkStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<ImageRemoveWatermarkStepOutput>>;
    /**
     * Insert b-roll clips into a base video at a timecode, optionally with an xfade transition.
     *
     * @example
     * ```typescript
     * const result = await agent.insertVideoClips({
     *   baseVideoUrl: ``,
     *   overlayVideos: [],
     * });
     * ```
     */
    insertVideoClips(step: InsertVideoClipsStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<InsertVideoClipsStepOutput>>;
    /**
     * @deprecated Legacy v1 data sources. v2 apps should use `dataSources.defineDataSource()` from @mindstudio-ai/agent instead, which owns parsing, chunking, embedding and citations. List all data sources for the current app.
     *
     * @remarks
     * - Returns metadata for every data source associated with the current app version.
     * - Each entry includes the data source ID, name, description, status, and document list.
     *
     * @example
     * ```typescript
     * const result = await agent.listDataSources({});
     * ```
     */
    listDataSources(step: ListDataSourcesStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<ListDataSourcesStepOutput>>;
    /**
     * List drafts in the connected Gmail account.
     *
     * @remarks
     * - Requires a Google OAuth connection with Gmail readonly scope.
     * - Returns up to 50 drafts (default 10).
     * - The variable receives text or JSON depending on exportType.
     *
     * @example
     * ```typescript
     * const result = await agent.listGmailDrafts({
     *   exportType: "json",
     * });
     * ```
     */
    listGmailDrafts(step: ListGmailDraftsStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<ListGmailDraftsStepOutput>>;
    /**
     * List all labels in the connected Gmail account. Use these label IDs or names with the Update Gmail Labels step.
     *
     * @remarks
     * - Requires a Google OAuth connection with Gmail readonly scope.
     * - Returns both system labels (INBOX, SENT, TRASH, etc.) and user-created labels.
     * - Label type is "system" for built-in labels or "user" for custom labels.
     *
     * @example
     * ```typescript
     * const result = await agent.listGmailLabels({});
     * ```
     */
    listGmailLabels(step: ListGmailLabelsStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<ListGmailLabelsStepOutput>>;
    /**
     * List upcoming events from a Google Calendar, ordered by start time.
     *
     * @remarks
     * - Requires a Google OAuth connection with Calendar events scope.
     * - Only returns future events (timeMin = now).
     * - The variable receives JSON or XML-like text depending on exportType. The direct execution output always returns structured events.
     *
     * @example
     * ```typescript
     * const result = await agent.listGoogleCalendarEvents({
     *   limit: 0,
     *   exportType: "json",
     * });
     * ```
     */
    listGoogleCalendarEvents(step: ListGoogleCalendarEventsStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<ListGoogleCalendarEventsStepOutput>>;
    /**
     * List files in a Google Drive folder.
     *
     * @remarks
     * - Requires a Google OAuth connection with Drive scope.
     * - If folderId is omitted, lists files in the root folder.
     * - Returns file metadata including name, type, size, and links.
     *
     * @example
     * ```typescript
     * const result = await agent.listGoogleDriveFiles({
     *   exportType: "json",
     * });
     * ```
     */
    listGoogleDriveFiles(step: ListGoogleDriveFilesStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<ListGoogleDriveFilesStepOutput>>;
    /**
     * List recent emails from the connected Gmail inbox.
     *
     * @remarks
     * - Requires a Google OAuth connection with Gmail readonly scope.
     * - Returns up to 100 emails (default 5), ordered by most recent first.
     * - Functionally equivalent to Search Gmail Emails with an "in:inbox" query.
     *
     * @example
     * ```typescript
     * const result = await agent.listRecentGmailEmails({
     *   exportType: "json",
     *   limit: ``,
     * });
     * ```
     */
    listRecentGmailEmails(step: ListRecentGmailEmailsStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<ListRecentGmailEmailsStepOutput>>;
    /**
     * Route execution to different branches based on AI evaluation, comparison operators, or workflow jumps.
     *
     * @remarks
     * - Supports two modes: "ai" (default) uses an AI model to pick the most accurate statement; "comparison" uses operator-based checks.
     * - In AI mode, the model picks the most accurate statement from the list. All possible cases must be specified.
     * - In comparison mode, the context is the left operand and each case's condition is the right operand. First matching case wins. Use operator "default" as a fallback.
     * - Requires at least two cases.
     * - Each case can transition to a step in the current workflow (destinationStepId) or jump to another workflow (destinationWorkflowId).
     *
     * @example
     * ```typescript
     * const result = await agent.logic({
     *   context: ``,
     *   cases: [],
     * });
     * ```
     */
    logic(step: LogicStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<LogicStepOutput>>;
    /**
     * Trigger a Make.com (formerly Integromat) scenario via webhook and return the response.
     *
     * @remarks
     * - The webhook URL must be configured in your Make.com scenario.
     * - Input key-value pairs are sent as JSON in the POST body.
     * - Response format depends on the Make.com scenario configuration.
     *
     * @example
     * ```typescript
     * const result = await agent.makeDotComRunScenario({
     *   webhookUrl: ``,
     *   input: {},
     * });
     * ```
     */
    makeDotComRunScenario(step: MakeDotComRunScenarioStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<MakeDotComRunScenarioStepOutput>>;
    /**
     * Merge one or more clips into a single audio file.
     *
     * @example
     * ```typescript
     * const result = await agent.mergeAudio({
     *   mp3Urls: [],
     * });
     * ```
     */
    mergeAudio(step: MergeAudioStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<MergeAudioStepOutput>>;
    /**
     * Merge one or more clips into a single video.
     *
     * @example
     * ```typescript
     * const result = await agent.mergeVideos({
     *   videoUrls: [],
     * });
     * ```
     */
    mergeVideos(step: MergeVideosStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<MergeVideosStepOutput>>;
    /**
     * Apply a preset animation to a rigged 3D character model using Meshy.
     *
     * @remarks
     * - Requires a rig_task_id from a previously completed Meshy rigging step.
     * - Select an animation from Meshy's library of 600+ preset animations.
     * - Only works with humanoid (bipedal) rigged characters.
     * - Supports post-processing: FPS change (24/25/30/60), FBX-to-USDZ conversion, or armature extraction.
     * - Animation categories: DailyActions, WalkAndRun, Fighting, Dancing, BodyMovements.
     *
     * @example
     * ```typescript
     * const result = await agent.meshyAnimate({
     *   rigTaskId: ``,
     *   actionId: 0,
     * });
     * ```
     */
    meshyAnimate(step: MeshyAnimateStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<MeshyAnimateStepOutput>>;
    /**
     * Generate a 3D model from one or more images using Meshy. Uses the multi-image-to-3D endpoint.
     *
     * @remarks
     * - Accepts 1-4 image URLs. All images should depict the same object from different angles for best results.
     * - By default generates with textures. Set shouldTexture to false for mesh-only output.
     * - Uses should_remesh: false to preserve UV mapping integrity.
     *
     * @example
     * ```typescript
     * const result = await agent.meshyImageTo3d({
     *   imageUrls: [],
     * });
     * ```
     */
    meshyImageTo3d(step: MeshyImageTo3dStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<MeshyImageTo3dStepOutput>>;
    /**
     * Remesh an existing 3D model to adjust topology, polygon count, or convert formats using Meshy.
     *
     * @remarks
     * - Provide either an input task ID (from a previous Meshy step) or a model URL.
     * - Defaults to triangle topology with 30,000 target polys.
     * - Useful for reducing face count before rigging (max 300k faces for rigging).
     *
     * @example
     * ```typescript
     * const result = await agent.meshyRemesh({});
     * ```
     */
    meshyRemesh(step: MeshyRemeshStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<MeshyRemeshStepOutput>>;
    /**
     * Auto-rig a humanoid 3D model and generate basic walking/running animations using Meshy.
     *
     * @remarks
     * - Only works well with standard humanoid (bipedal) models with clearly defined limbs.
     * - Prefers model_url over input_task_id for cleaner rigging input.
     * - Models with more than 300,000 faces should be remeshed first.
     * - Returns rigged model files and optional basic animations.
     *
     * @example
     * ```typescript
     * const result = await agent.meshyRig({});
     * ```
     */
    meshyRig(step: MeshyRigStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<MeshyRigStepOutput>>;
    /**
     * Generate a 3D model preview from a text prompt using Meshy. Produces an untextured mesh (preview stage).
     *
     * @remarks
     * - Creates a text-to-3D preview task (mesh generation only, no texture).
     * - Use the Meshy Texture step to apply textures to the preview.
     * - Maximum prompt length is 600 characters.
     *
     * @example
     * ```typescript
     * const result = await agent.meshyTextTo3d({
     *   prompt: ``,
     * });
     * ```
     */
    meshyTextTo3d(step: MeshyTextTo3dStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<MeshyTextTo3dStepOutput>>;
    /**
     * Apply or replace textures on a 3D model using a text prompt or reference image via Meshy.
     *
     * @remarks
     * - Provide either an input task ID (from a previous Meshy step) or a model URL.
     * - Provide either a text style prompt or an image style URL to guide texturing.
     * - Supports .glb, .gltf, .obj, .fbx, .stl model formats when using modelUrl.
     * - By default preserves original UVs (enableOriginalUv = true).
     * - Works with any model source: text-to-3D previews, image-to-3D, remeshed models, or external files.
     *
     * @example
     * ```typescript
     * const result = await agent.meshyTexture({});
     * ```
     */
    meshyTexture(step: MeshyTextureStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<MeshyTextureStepOutput>>;
    /**
     * Mix an audio track into a video
     *
     * @example
     * ```typescript
     * const result = await agent.mixAudioIntoVideo({
     *   videoUrl: ``,
     *   audioUrl: ``,
     *   options: {},
     * });
     * ```
     */
    mixAudioIntoVideo(step: MixAudioIntoVideoStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<MixAudioIntoVideoStepOutput>>;
    /**
     * Mute a video file
     *
     * @example
     * ```typescript
     * const result = await agent.muteVideo({
     *   videoUrl: ``,
     * });
     * ```
     */
    muteVideo(step: MuteVideoStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<MuteVideoStepOutput>>;
    /**
     * Trigger an n8n workflow node via webhook and return the response.
     *
     * @remarks
     * - The webhook URL must be configured in your n8n workflow.
     * - Supports GET and POST methods with optional Basic authentication.
     * - For GET requests, input values are sent as query parameters. For POST, they are sent as JSON body.
     *
     * @example
     * ```typescript
     * const result = await agent.n8nRunNode({
     *   method: ``,
     *   authentication: "none",
     *   user: ``,
     *   password: ``,
     *   webhookUrl: ``,
     *   input: {},
     * });
     * ```
     */
    n8nRunNode(step: N8nRunNodeStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<N8nRunNodeStepOutput>>;
    /**
     * Create a new page in Notion as a child of an existing page.
     *
     * @remarks
     * - Requires a Notion OAuth connection (connectionId).
     * - Content is provided as markdown and converted to Notion blocks (headings, paragraphs, lists, code, quotes).
     * - The page is created as a child of the specified parent page (pageId).
     *
     * @example
     * ```typescript
     * const result = await agent.notionCreatePage({
     *   pageId: ``,
     *   content: ``,
     *   title: ``,
     * });
     * ```
     */
    notionCreatePage(step: NotionCreatePageStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<NotionCreatePageStepOutput>>;
    /**
     * Update the content of an existing Notion page.
     *
     * @remarks
     * - Requires a Notion OAuth connection (connectionId).
     * - Content is provided as markdown and converted to Notion blocks.
     * - "append" mode adds content to the end of the page. "overwrite" mode deletes all existing blocks first.
     *
     * @example
     * ```typescript
     * const result = await agent.notionUpdatePage({
     *   pageId: ``,
     *   content: ``,
     *   mode: "append",
     * });
     * ```
     */
    notionUpdatePage(step: NotionUpdatePageStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<NotionUpdatePageStepOutput>>;
    /**
     * Find every dialogue line mentioning a specific entity or company across all podcasts.
     *
     * @remarks
     * - Provide `entityId` (for people, products, places) OR `companyId` (for organizations). At least one is required.
     * - Use `contextLines` to include surrounding dialogue with each mention (default behavior is set by Particle).
     * - Resolve a name to an `entityId` / `companyId` first via Search Companies (or by inspecting a Search Dialogue response).
     * - Cursor-paginated; expect potentially large result sets for popular entities.
     *
     * @example
     * ```typescript
     * const result = await agent.particlePodcastsFindMentions({});
     * ```
     */
    particlePodcastsFindMentions(step: ParticlePodcastsFindMentionsStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<ParticlePodcastsFindMentionsStepOutput>>;
    /**
     * Fetch full metadata for a single episode: details, speakers, entities, clips, and ads — merged into one response.
     *
     * @remarks
     * - Pass an episode ID or slug as `id`.
     * - Returns five sub-resources merged: `episode` (metadata), `speakers` (diarized speaker list), `entities` (knowledge-graph mentions), `clips` (AI-extracted highlights), `ads` (detected ad spots).
     * - Use Get Episode Transcript separately when you need the full transcript text — it isn't bundled here because the payload is large and has its own format/range options.
     * - Bills as 5 units against the get-episode event type (one per sub-call).
     *
     * @example
     * ```typescript
     * const result = await agent.particlePodcastsGetEpisode({
     *   id: ``,
     * });
     * ```
     */
    particlePodcastsGetEpisode(step: ParticlePodcastsGetEpisodeStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<ParticlePodcastsGetEpisodeStepOutput>>;
    /**
     * Fetch the diarized transcript for an episode in dialogue, plain text, or SRT subtitle format.
     *
     * @remarks
     * - Pass an episode ID or slug as `id`.
     * - Use `format` = "dialogue" (default, with speaker turns), "text" (plain), or "srt" (subtitle).
     * - Filter to a single speaker with `speaker`, or to a time range with `start` / `end` (seconds).
     * - Transcripts are large — prefer time-range filtering when you only need a snippet.
     *
     * @example
     * ```typescript
     * const result = await agent.particlePodcastsGetEpisodeTranscript({
     *   id: ``,
     * });
     * ```
     */
    particlePodcastsGetEpisodeTranscript(step: ParticlePodcastsGetEpisodeTranscriptStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<ParticlePodcastsGetEpisodeTranscriptStepOutput>>;
    /**
     * Search the Particle knowledge graph for companies by name, ticker, domain, CIK, or QID.
     *
     * @remarks
     * - Provide one or more identifiers: `q` (free-text name), `ticker` (e.g. "TSLA"), `domain` (e.g. "tesla.com"), `cik` (SEC), or `qid` (Wikidata).
     * - Use this to resolve a company name to a canonical `companyId` for use with Find Mentions or Search Dialogue.
     * - Returned company objects include slugs, domains, and IDs — any of these can be passed to downstream blocks.
     *
     * @example
     * ```typescript
     * const result = await agent.particlePodcastsSearchCompanies({});
     * ```
     */
    particlePodcastsSearchCompanies(step: ParticlePodcastsSearchCompaniesStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<ParticlePodcastsSearchCompaniesStepOutput>>;
    /**
     * Search across podcast dialogue using semantic or keyword search. Returns matched lines grouped by episode.
     *
     * @remarks
     * - Provide `semanticSearch` for meaning-based discovery ("find moments where someone talks about market timing") or `keywordSearch` for exact phrase/proper-noun matching. At least one must be provided.
     * - Filter to a specific entity or company by passing `entityId` / `companyId`.
     * - Each returned dialogue line carries the source episode + speaker so you can chain to Get Episode or Get Episode Transcript for context.
     * - Cursor-paginated.
     *
     * @example
     * ```typescript
     * const result = await agent.particlePodcastsSearchDialogue({});
     * ```
     */
    particlePodcastsSearchDialogue(step: ParticlePodcastsSearchDialogueStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<ParticlePodcastsSearchDialogueStepOutput>>;
    /**
     * Search and list podcasts in the Particle catalog by keyword, topic, or language.
     *
     * @remarks
     * - Use `q` for free-text keyword search across podcast titles and descriptions.
     * - Use `topic` to filter to a Particle taxonomy topic.
     * - Use `language` (BCP 47, e.g. "en") to restrict to a language.
     * - Returns podcast objects with canonical IDs and slugs. Pass either to other Particle Podcasts blocks.
     * - Cursor-paginated; pass the returned `cursor` back to `cursor` for the next page.
     *
     * @example
     * ```typescript
     * const result = await agent.particlePodcastsSearchPodcasts({});
     * ```
     */
    particlePodcastsSearchPodcasts(step: ParticlePodcastsSearchPodcastsStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<ParticlePodcastsSearchPodcastsStepOutput>>;
    /**
     * Search for people matching specific criteria using Apollo.io. Supports natural language queries and advanced filters.
     *
     * @remarks
     * - Can use a natural language "smartQuery" which is converted to Apollo search parameters by an AI model.
     * - Advanced params can override or supplement the smart query results.
     * - Optionally enriches returned people and/or their organizations for additional detail.
     * - Results are paginated. Use limit and page to control the result window.
     *
     * @example
     * ```typescript
     * const result = await agent.peopleSearch({
     *   smartQuery: ``,
     *   enrichPeople: false,
     *   enrichOrganizations: false,
     *   limit: ``,
     *   page: ``,
     *   params: {},
     * });
     * ```
     */
    peopleSearch(step: PeopleSearchStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<PeopleSearchStepOutput>>;
    /**
     * Create a post on LinkedIn from the connected account.
     *
     * @remarks
     * - Requires a LinkedIn OAuth connection (connectionId).
     * - Supports text posts, image posts, video posts, document posts, and article posts.
     * - Attach one media type per post: image, video, document, or article.
     * - Documents support PDF, PPT, PPTX, DOC, DOCX (max 100MB, 300 pages). Displays as a slideshow carousel.
     * - Articles create a link preview with optional custom title, description, and thumbnail.
     * - Visibility controls who can see the post.
     *
     * @example
     * ```typescript
     * const result = await agent.postToLinkedIn({
     *   message: ``,
     *   visibility: "PUBLIC",
     * });
     * ```
     */
    postToLinkedIn(step: PostToLinkedInStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<PostToLinkedInStepOutput>>;
    /**
     * Send a message to a Slack channel via a connected bot.
     *
     * @remarks
     * - The user is responsible for connecting their Slack workspace and selecting the channel
     * - Supports both simple text messages and slack blocks messages
     * - Text messages can use limited markdown (slack-only fomatting—e.g., headers are just rendered as bold)
     *
     * @example
     * ```typescript
     * const result = await agent.postToSlackChannel({
     *   channelId: ``,
     *   messageType: "string",
     *   message: ``,
     * });
     * ```
     */
    postToSlackChannel(step: PostToSlackChannelStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<PostToSlackChannelStepOutput>>;
    /**
     * Create a post on X (Twitter) from the connected account.
     *
     * @remarks
     * - Requires an X OAuth connection (connectionId).
     * - Maximum 280 characters of text.
     * - Optionally attach up to 4 media items (images, GIFs, or videos) via mediaUrls.
     * - Media URLs must be publicly accessible. The service fetches and uploads them to X.
     * - Supported formats: JPEG, PNG, GIF, WEBP, MP4. Images up to 5MB, videos up to 512MB.
     *
     * @example
     * ```typescript
     * const result = await agent.postToX({
     *   text: ``,
     * });
     * ```
     */
    postToX(step: PostToXStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<PostToXStepOutput>>;
    /**
     * Send data to a Zapier Zap via webhook and return the response.
     *
     * @remarks
     * - The webhook URL must be configured in the Zapier Zap settings
     * - Input keys and values are sent as the JSON body of the POST request
     * - The webhook response (JSON or plain text) is returned as the output
     *
     * @example
     * ```typescript
     * const result = await agent.postToZapier({
     *   webhookUrl: ``,
     *   input: {},
     * });
     * ```
     */
    postToZapier(step: PostToZapierStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<PostToZapierStepOutput>>;
    /**
     * Execute a SQL query against the app managed database.
     *
     * @remarks
     * - Executes raw SQL against a SQLite database managed by the app.
     * - For SELECT queries, returns rows as JSON.
     * - For INSERT/UPDATE/DELETE, returns the number of affected rows.
     * - Use {{variables}} directly in your SQL. By default they are automatically extracted
     * and passed as safe parameterized values (preventing SQL injection).
     * Example: INSERT INTO contacts (name, comment) VALUES ({{name}}, {{comment}})
     * - Full MindStudio handlebars syntax is supported, including helpers like {{json myVar}},
     * {{get myVar "$.path"}}, {{global.orgName}}, etc.
     * - Set parameterize to false for raw/dynamic SQL where variables are interpolated directly
     * into the query string. Use this when another step generates full or partial SQL, e.g.
     * a bulk INSERT with a precomputed VALUES list. The user is responsible for sanitization
     * when parameterize is false.
     *
     * @example
     * ```typescript
     * const result = await agent.queryAppDatabase({
     *   databaseId: ``,
     *   sql: ``,
     * });
     * ```
     */
    queryAppDatabase(step: QueryAppDatabaseStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<QueryAppDatabaseStepOutput>>;
    /**
     * @deprecated Legacy v1 data sources. v2 apps should use `dataSources.defineDataSource()` from @mindstudio-ai/agent instead, which owns parsing, chunking, embedding and citations. Search a vector data source (RAG) and return relevant document chunks.
     *
     * @remarks
     * - Queries a vectorized data source and returns the most relevant chunks.
     * - Useful for retrieval-augmented generation (RAG) workflows.
     *
     * @example
     * ```typescript
     * const result = await agent.queryDataSource({
     *   dataSourceId: ``,
     *   query: ``,
     *   maxResults: 0,
     * });
     * ```
     */
    queryDataSource(step: QueryDataSourceStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<QueryDataSourceStepOutput>>;
    /**
     * Execute a SQL query against an external database connected to the workspace.
     *
     * @remarks
     * - Requires a database connection configured in the workspace.
     * - Supports PostgreSQL (including Supabase), MySQL, and MSSQL.
     * - Results can be returned as JSON or CSV.
     *
     * @example
     * ```typescript
     * const result = await agent.queryExternalDatabase({
     *   query: ``,
     *   outputFormat: "json",
     * });
     * ```
     */
    queryExternalDatabase(step: QueryExternalDatabaseStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<QueryExternalDatabaseStepOutput>>;
    /**
     * Replace personally identifiable information in text with placeholders using Microsoft Presidio.
     *
     * @remarks
     * - PII is replaced with entity type placeholders (e.g. "Call me at <PHONE_NUMBER>").
     * - If entities is empty, returns empty text immediately without processing.
     *
     * @example
     * ```typescript
     * const result = await agent.redactPII({
     *   input: ``,
     *   language: ``,
     *   entities: [],
     * });
     * ```
     */
    redactPII(step: RedactPIIStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<RedactPIIStepOutput>>;
    /**
     * Remove the background from an image using AI, producing a transparent PNG.
     *
     * @remarks
     * - Uses the Bria background removal model via fal.ai by default.
     * - Uses WaveSpeed's Ideogram background removal model when type is "advanced".
     * - Output is re-hosted on the CDN as a PNG with transparency.
     *
     * @example
     * ```typescript
     * const result = await agent.removeBackgroundFromImage({
     *   imageUrl: ``,
     * });
     * ```
     */
    removeBackgroundFromImage(step: RemoveBackgroundFromImageStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<RemoveBackgroundFromImageStepOutput>>;
    /**
     * Reply to an existing email in Gmail. The reply is threaded under the original message.
     *
     * @remarks
     * - Requires a Google OAuth connection with Gmail compose and readonly scopes.
     * - The reply is sent to the original sender and threaded under the original message.
     * - messageType controls the body format: "plain", "html", or "markdown".
     *
     * @example
     * ```typescript
     * const result = await agent.replyToGmailEmail({
     *   messageId: ``,
     *   message: ``,
     *   messageType: "plain",
     * });
     * ```
     */
    replyToGmailEmail(step: ReplyToGmailEmailStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<ReplyToGmailEmailStepOutput>>;
    /**
     * Resize a video file
     *
     * @example
     * ```typescript
     * const result = await agent.resizeVideo({
     *   videoUrl: ``,
     *   mode: "fit",
     * });
     * ```
     */
    resizeVideo(step: ResizeVideoStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<ResizeVideoStepOutput>>;
    /**
     * Run a raw API connector to a third-party service
     *
     * @remarks
     * - Use the /developer/v2/helpers/connectors endpoint to list available services and actions.
     * - Use /developer/v2/helpers/connectors/{serviceId}/{actionId} to get the full input configuration for an action.
     * - Use /developer/v2/helpers/connections to list your available OAuth connections.
     * - The actionId format is "serviceId/actionId" (e.g., "slack/send-message").
     * - Pass a __connectionId to authenticate the request with a specific OAuth connection, otherwise the default will be used (if configured).
     *
     * @example
     * ```typescript
     * const result = await agent.runFromConnectorRegistry({
     *   actionId: ``,
     *   displayName: ``,
     *   icon: ``,
     *   configurationValues: {},
     * });
     * ```
     */
    runFromConnectorRegistry(step: RunFromConnectorRegistryStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<RunFromConnectorRegistryStepOutput>>;
    /**
     * Run a packaged workflow ("custom block")
     *
     * @remarks
     * - From the user's perspective, packaged workflows are just ordinary blocks. Behind the scenes, they operate like packages/libraries in a programming language, letting the user execute custom functionality.
     * - Some of these packaged workflows are available as part of MindStudio's "Standard Library" and available to every user.
     * - Available packaged workflows are documented here as individual blocks, but the runPackagedWorkflow block is how they need to be wrapped in order to be executed correctly.
     *
     * @example
     * ```typescript
     * const result = await agent.runPackagedWorkflow({
     *   appId: ``,
     *   workflowId: ``,
     *   inputVariables: {},
     *   outputVariables: {},
     *   name: ``,
     * });
     * ```
     */
    runPackagedWorkflow(step: RunPackagedWorkflowStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<RunPackagedWorkflowStepOutput>>;
    /**
     * Scrape public company data from a LinkedIn company page.
     *
     * @remarks
     * - Requires a LinkedIn company URL (e.g. https://www.linkedin.com/company/mindstudioai).
     * - Returns structured company data including description, employees, updates, and similar companies.
     *
     * @example
     * ```typescript
     * const result = await agent.scrapeLinkedInCompany({
     *   url: ``,
     * });
     * ```
     */
    scrapeLinkedInCompany(step: ScrapeLinkedInCompanyStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<ScrapeLinkedInCompanyStepOutput>>;
    /**
     * Scrape public profile data from a LinkedIn profile page.
     *
     * @remarks
     * - Requires a LinkedIn profile URL (e.g. https://www.linkedin.com/in/username).
     * - Returns structured profile data including experience, education, articles, and activities.
     *
     * @example
     * ```typescript
     * const result = await agent.scrapeLinkedInProfile({
     *   url: ``,
     * });
     * ```
     */
    scrapeLinkedInProfile(step: ScrapeLinkedInProfileStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<ScrapeLinkedInProfileStepOutput>>;
    /**
     * Extract text, HTML, or structured content from one or more web pages.
     *
     * @remarks
     * - Accepts a single URL or multiple URLs (as a JSON array, comma-separated, or newline-separated).
     * - Output format controls the result shape: "text" returns markdown, "html" returns raw HTML, "json" returns structured scraper data, "summary" returns a model-written summary and requires the "firecrawl" service.
     * - Can optionally capture a screenshot of each page.
     * - Handles bot protection automatically; no proxy or rendering configuration is needed.
     *
     * @example
     * ```typescript
     * const result = await agent.scrapeUrl({
     *   url: ``,
     * });
     * ```
     */
    scrapeUrl(step: ScrapeUrlStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<ScrapeUrlStepOutput>>;
    /**
     * Scrape data from a single X (Twitter) post by URL.
     *
     * @remarks
     * - Returns structured post data (text, html, optional json/screenshot/metadata).
     * - Optionally saves the text content to a variable.
     *
     * @example
     * ```typescript
     * const result = await agent.scrapeXPost({
     *   url: ``,
     * });
     * ```
     */
    scrapeXPost(step: ScrapeXPostStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<ScrapeXPostStepOutput>>;
    /**
     * Scrape public profile data from an X (Twitter) account by URL.
     *
     * @remarks
     * - Returns structured profile data.
     * - Optionally saves the result to a variable.
     *
     * @example
     * ```typescript
     * const result = await agent.scrapeXProfile({
     *   url: ``,
     * });
     * ```
     */
    scrapeXProfile(step: ScrapeXProfileStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<ScrapeXProfileStepOutput>>;
    /**
     * Capture a screenshot of a web page as a PNG image.
     *
     * @remarks
     * - Takes a viewport or full-page screenshot of the given URL.
     * - Returns a CDN-hosted PNG image URL.
     * - Viewport mode captures only the visible area; fullPage captures the entire scrollable page.
     * - You can customize viewport width/height, add a delay, or wait for a CSS selector before capturing.
     *
     * @example
     * ```typescript
     * const result = await agent.screenshotUrl({
     *   url: ``,
     * });
     * ```
     */
    screenshotUrl(step: ScreenshotUrlStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<ScreenshotUrlStepOutput>>;
    /**
     * Search for emails in the connected Gmail account using a Gmail search query. To list recent inbox emails, pass an empty query string.
     *
     * @remarks
     * - Requires a Google OAuth connection with Gmail readonly scope.
     * - Uses Gmail search syntax (e.g. "from:user@example.com", "subject:invoice", "is:unread").
     * - To list recent inbox emails, use an empty query string or "in:inbox".
     * - Returns up to 100 emails (default 5). The variable receives text or JSON depending on exportType.
     * - The direct execution output always returns structured email objects.
     *
     * @example
     * ```typescript
     * const result = await agent.searchGmailEmails({
     *   query: ``,
     *   exportType: "json",
     *   limit: ``,
     * });
     * ```
     */
    searchGmailEmails(step: SearchGmailEmailsStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<SearchGmailEmailsStepOutput>>;
    /**
     * Search the web using Google and return structured results.
     *
     * @remarks
     * - Defaults to us/english, but can optionally specify country and/or language.
     * - Defaults to any time, but can optionally specify last hour, last day, week, month, or year.
     * - Defaults to top 30 results, but can specify 1 to 100 results to return.
     *
     * @example
     * ```typescript
     * const result = await agent.searchGoogle({
     *   query: ``,
     *   exportType: "text",
     * });
     * ```
     */
    searchGoogle(step: SearchGoogleStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<SearchGoogleStepOutput>>;
    /**
     * Search for events in a Google Calendar by keyword, date range, or both.
     *
     * @remarks
     * - Requires a Google OAuth connection with Calendar events scope.
     * - Supports keyword search via "query" and date filtering via "timeMin"/"timeMax" (ISO 8601 format).
     * - Unlike "List Events" which only shows future events, this allows searching past events too.
     *
     * @example
     * ```typescript
     * const result = await agent.searchGoogleCalendarEvents({
     *   exportType: "json",
     * });
     * ```
     */
    searchGoogleCalendarEvents(step: SearchGoogleCalendarEventsStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<SearchGoogleCalendarEventsStepOutput>>;
    /**
     * Search for files in Google Drive by keyword.
     *
     * @remarks
     * - Requires a Google OAuth connection with Drive scope.
     * - Searches file content and names using Google Drive's fullText search.
     *
     * @example
     * ```typescript
     * const result = await agent.searchGoogleDrive({
     *   query: ``,
     *   exportType: "json",
     * });
     * ```
     */
    searchGoogleDrive(step: SearchGoogleDriveStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<SearchGoogleDriveStepOutput>>;
    /**
     * Search Google Images and return image results with URLs and metadata.
     *
     * @remarks
     * - Defaults to us/english, but can optionally specify country and/or language.
     * - Defaults to any time, but can optionally specify last hour, last day, week, month, or year.
     * - Defaults to top 30 results, but can specify 1 to 100 results to return.
     *
     * @example
     * ```typescript
     * const result = await agent.searchGoogleImages({
     *   query: ``,
     *   exportType: "text",
     * });
     * ```
     */
    searchGoogleImages(step: SearchGoogleImagesStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<SearchGoogleImagesStepOutput>>;
    /**
     * Search Google News for recent news articles matching a query.
     *
     * @remarks
     * - Defaults to top 30 results, but can specify 1 to 100 results to return.
     *
     * @example
     * ```typescript
     * const result = await agent.searchGoogleNews({
     *   text: ``,
     *   exportType: "text",
     * });
     * ```
     */
    searchGoogleNews(step: SearchGoogleNewsStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<SearchGoogleNewsStepOutput>>;
    /**
     * Fetch Google Trends data for a search term.
     *
     * @remarks
     * - date accepts shorthand ("now 1-H", "today 1-m", "today 5-y", etc.) or custom "yyyy-mm-dd yyyy-mm-dd" ranges.
     * - data_type controls the shape of returned data: TIMESERIES, GEO_MAP, GEO_MAP_0, RELATED_TOPICS, or RELATED_QUERIES.
     *
     * @example
     * ```typescript
     * const result = await agent.searchGoogleTrends({
     *   text: ``,
     *   hl: ``,
     *   geo: ``,
     *   data_type: "TIMESERIES",
     *   cat: ``,
     *   date: ``,
     *   ts: ``,
     * });
     * ```
     */
    searchGoogleTrends(step: SearchGoogleTrendsStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<SearchGoogleTrendsStepOutput>>;
    /**
     * Search the web using the Perplexity API and return structured results.
     *
     * @remarks
     * - Defaults to US results. Use countryCode (ISO code) to filter by country.
     * - Returns 10 results by default, configurable from 1 to 20.
     * - The variable receives text or JSON depending on exportType. The direct execution output always returns structured results.
     *
     * @example
     * ```typescript
     * const result = await agent.searchPerplexity({
     *   query: ``,
     *   exportType: "text",
     * });
     * ```
     */
    searchPerplexity(step: SearchPerplexityStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<SearchPerplexityStepOutput>>;
    /**
     * Search recent X (Twitter) posts matching a query.
     *
     * @remarks
     * - Searches only the past 7 days of posts.
     * - Query supports X API v2 search operators (up to 512 characters).
     * Available search operators in query:
     * | Operator         | Description                                      |
     * | -----------------| -------------------------------------------------|
     * | from:            | Posts from a specific user (e.g., from:elonmusk) |
     * | to:              | Posts sent to a specific user (e.g., to:NASA)    |
     * | @                | Mentions a user (e.g., @openai)                  |
     * | #                | Hashtag search (e.g., #AI)                       |
     * | is:retweet       | Filters retweets                                 |
     * | is:reply         | Filters replies                                  |
     * | has:media        | Posts containing media (images, videos, or GIFs) |
     * | has:links        | Posts containing URLs                            |
     * | lang:            | Filters by language (e.g., lang:en)              |
     * | -                | Excludes specific terms (e.g., -spam)            |
     * | ()               | Groups terms or operators (e.g., (AI OR ML))     |
     * | AND, OR, NOT     | Boolean logic for combining or excluding terms   |
     * Conjunction-Required Operators (must be combined with a standalone operator):
     * | Operator     | Description                                    |
     * | ------------ | -----------------------------------------------|
     * | has:media  | Posts containing media (images, videos, or GIFs) |
     * | has:links  | Posts containing URLs                            |
     * | is:retweet | Filters retweets                                 |
     * | is:reply   | Filters replies                                  |
     * For example, has:media alone is invalid, but #AI has:media is valid.
     *
     * @example
     * ```typescript
     * const result = await agent.searchXPosts({
     *   query: ``,
     *   scope: "recent",
     *   options: {},
     * });
     * ```
     */
    searchXPosts(step: SearchXPostsStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<SearchXPostsStepOutput>>;
    /**
     * Search for YouTube videos by keyword.
     *
     * @remarks
     * - Supports pagination (up to 5 pages) and country/language filters.
     * - Use the filter/filterType fields for YouTube search parameter (sp) filters.
     *
     * @example
     * ```typescript
     * const result = await agent.searchYoutube({
     *   query: ``,
     *   limitPages: ``,
     *   filter: ``,
     *   filterType: ``,
     * });
     * ```
     */
    searchYoutube(step: SearchYoutubeStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<SearchYoutubeStepOutput>>;
    /**
     * Retrieve trending videos on YouTube by category and region.
     *
     * @remarks
     * - Categories: "now" (trending now), "music", "gaming", "films".
     * - Supports country and language filtering.
     *
     * @example
     * ```typescript
     * const result = await agent.searchYoutubeTrends({
     *   bp: "now",
     *   hl: ``,
     *   gl: ``,
     * });
     * ```
     */
    searchYoutubeTrends(step: SearchYoutubeTrendsStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<SearchYoutubeTrendsStepOutput>>;
    /**
     * Send an email to one or more recipient addresses.
     *
     * @remarks
     * - Use the "to" field to send to one or more specific recipient email addresses directly. Allowed recipients depend on the sender: when the app sends from a domain it owns (a verified custom domain or its <slug>.madewithremy.com subdomain) any recipient is allowed; when it falls back to the shared Remy address, recipients must be verified app users or members of the app's organization. (v1 apps cannot use a direct "to" — they must resolve recipients via a connection.)
     * - Alternatively, recipient email addresses can be resolved from OAuth connections configured by the app creator via connectionId. The user running the workflow does not specify the recipient directly.
     * - Use "cc" and "bcc" to add visible / hidden recipients (a string or an array). They are subject to the same recipient rules as "to".
     * - "to" is optional only in the sense that recipients can come from elsewhere — omit it and supply "cc"/"bcc" for a hidden-list send, or omit all three and recipients are resolved from an OAuth connection. Naming nobody at all is an error.
     * - Bcc-only sends are supported: with no "to" or "cc", the To: header is addressed to the app's own sender address (the standard "undisclosed recipients" pattern) so recipients can't see each other. The returned "recipients" reflects that auto-filled address.
     * - Every recipient counts toward the app's daily outbound cap, including cc and bcc.
     * - The sender defaults automatically: v2 apps send from the app's own identity — its verified custom domain if set, else its platform subdomain (noreply@<slug>.madewithremy.com), else the default Remy address.
     * - Optionally set "from" to a custom handle, but ONLY if the app has a custom domain or subdomain: a bare handle ("support" → support@<app-domain>), a full "support@your-domain.com", or "Name <support@your-domain.com>". The domain must be one the app owns, or the step fails.
     * - If the body is a URL to a hosted HTML file on the CDN, the HTML is fetched and used as the email body.
     * - The body is interpreted automatically: if it already looks like HTML it is sent as HTML, otherwise it is rendered from Markdown. Every email is sent as multipart with a plain-text alternative auto-derived from the body (better deliverability).
     * - Set bodyType to override interpretation: "html" (send as-is), "markdown" (render to HTML), or "text" (plain text only, no HTML part). Default is "auto".
     * - Optionally set "text" to supply your own plain-text alternative instead of the auto-derived one.
     * - Use "attachments" to attach files by URL. Each entry is a URL string, or an object { url, filename?, contentType? } to control the attachment's displayed filename and MIME type.
     * - When generateHtml is enabled, the body text is converted to a styled HTML email using an AI model (implies an HTML body).
     * - Set replyTo to control the Reply-To address for replies.
     * - For threaded replies in a shared inbox, set inReplyTo (the Message-ID being replied to) and references (prior Message-IDs in the thread).
     * - connectionId can be a comma-separated list to send to multiple recipients.
     * - The special connectionId "trigger_email" uses the email address that triggered the workflow.
     *
     * @example
     * ```typescript
     * const result = await agent.sendEmail({
     *   subject: ``,
     *   body: ``,
     * });
     * ```
     */
    sendEmail(step: SendEmailStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<SendEmailStepOutput>>;
    /**
     * Send an existing draft from the connected Gmail account.
     *
     * @remarks
     * - Requires a Google OAuth connection with Gmail compose scope.
     * - The draft is sent and removed from the Drafts folder.
     * - Use the draft ID returned by the Create Gmail Draft or List Gmail Drafts steps.
     *
     * @example
     * ```typescript
     * const result = await agent.sendGmailDraft({
     *   draftId: ``,
     * });
     * ```
     */
    sendGmailDraft(step: SendGmailDraftStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<SendGmailDraftStepOutput>>;
    /**
     * Send an email from the connected Gmail account.
     *
     * @remarks
     * - Requires a Google OAuth connection with Gmail compose scope.
     * - messageType controls the body format: "plain" for plain text, "html" for raw HTML, "markdown" for auto-converted markdown.
     *
     * @example
     * ```typescript
     * const result = await agent.sendGmailMessage({
     *   to: ``,
     *   subject: ``,
     *   message: ``,
     *   messageType: "plain",
     * });
     * ```
     */
    sendGmailMessage(step: SendGmailMessageStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<SendGmailMessageStepOutput>>;
    /**
     * Send a direct message to a Slack user via a connected bot.
     *
     * @remarks
     * - The user is responsible for connecting their Slack workspace
     * - The recipient is identified by their Slack user ID
     * - Supports both simple text messages and Slack blocks messages
     * - Text messages can use limited markdown (slack-only formatting—e.g., headers are just rendered as bold)
     *
     * @example
     * ```typescript
     * const result = await agent.sendSlackDirectMessage({
     *   slackUserId: ``,
     *   messageType: "string",
     *   message: ``,
     * });
     * ```
     */
    sendSlackDirectMessage(step: SendSlackDirectMessageStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<SendSlackDirectMessageStepOutput>>;
    /**
     * Send an SMS or MMS message to a phone number configured via OAuth connection.
     *
     * @remarks
     * - User is responsible for configuring the connection to the number (MindStudio requires double opt-in to prevent spam)
     * - If mediaUrls are provided, the message is sent as MMS instead of SMS
     * - MMS supports up to 10 media URLs (images, video, audio, PDF) with a 5MB limit per file
     * - MMS is only supported on US and Canadian carriers; international numbers will receive SMS only (media silently dropped)
     *
     * @example
     * ```typescript
     * const result = await agent.sendSMS({
     *   body: ``,
     * });
     * ```
     */
    sendSMS(step: SendSMSStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<SendSMSStepOutput>>;
    /**
     * Mark one or more Gmail emails as read or unread.
     *
     * @remarks
     * - Requires a Google OAuth connection with Gmail modify scope.
     * - Accepts one or more message IDs as a comma-separated string or array.
     * - Set markAsRead to true to mark as read, false to mark as unread.
     *
     * @example
     * ```typescript
     * const result = await agent.setGmailReadStatus({
     *   messageIds: ``,
     *   markAsRead: false,
     * });
     * ```
     */
    setGmailReadStatus(step: SetGmailReadStatusStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<SetGmailReadStatusStepOutput>>;
    /**
     * Set the title of the agent run for the user's history
     *
     * @example
     * ```typescript
     * const result = await agent.setRunTitle({
     *   title: ``,
     * });
     * ```
     */
    setRunTitle(step: SetRunTitleStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<SetRunTitleStepOutput>>;
    /**
     * Explicitly set a variable to a given value.
     *
     * @remarks
     * - Useful for bootstrapping global variables or setting constants.
     * - The variable name and value both support variable interpolation.
     * - The type field is a UI hint only (controls input widget in the editor).
     *
     * @example
     * ```typescript
     * const result = await agent.setVariable({
     *   value: ``,
     * });
     * ```
     */
    setVariable(step: SetVariableStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<SetVariableStepOutput>>;
    /**
     * Edit a previously sent Telegram message. Use with the message ID returned by Send Telegram Message.
     *
     * @remarks
     * - Only text messages sent by the bot can be edited.
     * - The messageId is returned by the Send Telegram Message step.
     * - Common pattern: send a "Processing..." message, do work, then edit it with the result.
     *
     * @example
     * ```typescript
     * const result = await agent.telegramEditMessage({
     *   botToken: ``,
     *   chatId: ``,
     *   messageId: ``,
     *   text: ``,
     * });
     * ```
     */
    telegramEditMessage(step: TelegramEditMessageStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<TelegramEditMessageStepOutput>>;
    /**
     * Send a reply to a specific Telegram message. The reply will be visually threaded in the chat.
     *
     * @remarks
     * - Use the rawMessage.message_id from the incoming trigger variables to reply to the user's message.
     * - Especially useful in group chats where replies provide context.
     * - Returns the sent message ID, which can be used with Edit Telegram Message.
     *
     * @example
     * ```typescript
     * const result = await agent.telegramReplyToMessage({
     *   botToken: ``,
     *   chatId: ``,
     *   replyToMessageId: ``,
     *   text: ``,
     * });
     * ```
     */
    telegramReplyToMessage(step: TelegramReplyToMessageStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<TelegramReplyToMessageStepOutput>>;
    /**
     * Send an audio file to a Telegram chat as music or a voice note via a bot.
     *
     * @remarks
     * - "audio" mode sends as a standard audio file. "voice" mode sends as a voice message (re-uploads the file for large file support).
     *
     * @example
     * ```typescript
     * const result = await agent.telegramSendAudio({
     *   botToken: ``,
     *   chatId: ``,
     *   audioUrl: ``,
     *   mode: "audio",
     * });
     * ```
     */
    telegramSendAudio(step: TelegramSendAudioStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<TelegramSendAudioStepOutput>>;
    /**
     * Send a document/file to a Telegram chat via a bot.
     *
     * @example
     * ```typescript
     * const result = await agent.telegramSendFile({
     *   botToken: ``,
     *   chatId: ``,
     *   fileUrl: ``,
     * });
     * ```
     */
    telegramSendFile(step: TelegramSendFileStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<TelegramSendFileStepOutput>>;
    /**
     * Send an image to a Telegram chat via a bot.
     *
     * @example
     * ```typescript
     * const result = await agent.telegramSendImage({
     *   botToken: ``,
     *   chatId: ``,
     *   imageUrl: ``,
     * });
     * ```
     */
    telegramSendImage(step: TelegramSendImageStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<TelegramSendImageStepOutput>>;
    /**
     * Send a text message to a Telegram chat via a bot.
     *
     * @remarks
     * - Messages are sent using MarkdownV2 formatting. Special characters are auto-escaped.
     * - botToken format is "botId:token" — both parts are required.
     * - Returns the sent message ID, which can be used with Edit Telegram Message to update the message later.
     *
     * @example
     * ```typescript
     * const result = await agent.telegramSendMessage({
     *   botToken: ``,
     *   chatId: ``,
     *   text: ``,
     * });
     * ```
     */
    telegramSendMessage(step: TelegramSendMessageStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<TelegramSendMessageStepOutput>>;
    /**
     * Send a video to a Telegram chat via a bot.
     *
     * @example
     * ```typescript
     * const result = await agent.telegramSendVideo({
     *   botToken: ``,
     *   chatId: ``,
     *   videoUrl: ``,
     * });
     * ```
     */
    telegramSendVideo(step: TelegramSendVideoStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<TelegramSendVideoStepOutput>>;
    /**
     * Show the "typing..." indicator in a Telegram chat via a bot.
     *
     * @remarks
     * - The typing indicator automatically expires after a few seconds. Use this right before sending a message for a natural feel.
     *
     * @example
     * ```typescript
     * const result = await agent.telegramSetTyping({
     *   botToken: ``,
     *   chatId: ``,
     * });
     * ```
     */
    telegramSetTyping(step: TelegramSetTypingStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<TelegramSetTypingStepOutput>>;
    /**
     * Generate an audio file from provided text using a speech model.
     *
     * @remarks
     * - The text field contains the exact words to be spoken (not instructions).
     * - In foreground mode, the audio is displayed to the user. In background mode, the URL is saved to a variable.
     *
     * @example
     * ```typescript
     * const result = await agent.textToSpeech({
     *   text: ``,
     * });
     * ```
     */
    textToSpeech(step: TextToSpeechStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<TextToSpeechStepOutput>>;
    /**
     * Convert an audio file to text using a transcription model.
     *
     * @remarks
     * - The prompt field provides optional context to improve transcription accuracy (e.g. language, speaker names, domain).
     *
     * @example
     * ```typescript
     * const result = await agent.transcribeAudio({
     *   audioUrl: ``,
     *   prompt: ``,
     * });
     * ```
     */
    transcribeAudio(step: TranscribeAudioStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<TranscribeAudioStepOutput>>;
    /**
     * Trim an audio or video clip
     *
     * @example
     * ```typescript
     * const result = await agent.trimMedia({
     *   inputUrl: ``,
     * });
     * ```
     */
    trimMedia(step: TrimMediaStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<TrimMediaStepOutput>>;
    /**
     * Add or remove labels on Gmail messages, identified by message IDs or a search query.
     *
     * @remarks
     * - Requires a Google OAuth connection with Gmail modify scope.
     * - Provide either a query (Gmail search syntax) or explicit messageIds to target messages.
     * - Label IDs can be label names or Gmail label IDs — names are resolved automatically.
     *
     * @example
     * ```typescript
     * const result = await agent.updateGmailLabels({
     *   query: ``,
     *   messageIds: ``,
     *   addLabelIds: ``,
     *   removeLabelIds: ``,
     * });
     * ```
     */
    updateGmailLabels(step: UpdateGmailLabelsStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<UpdateGmailLabelsStepOutput>>;
    /**
     * Update an existing event on a Google Calendar. Only specified fields are changed.
     *
     * @remarks
     * - Requires a Google OAuth connection with Calendar events scope.
     * - Fetches the existing event first, then applies only the provided updates. Omitted fields are left unchanged.
     * - Attendees are specified as one email address per line, and replace the entire attendee list.
     *
     * @example
     * ```typescript
     * const result = await agent.updateGoogleCalendarEvent({
     *   eventId: ``,
     * });
     * ```
     */
    updateGoogleCalendarEvent(step: UpdateGoogleCalendarEventStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<UpdateGoogleCalendarEventStepOutput>>;
    /**
     * Update the contents of an existing Google Document.
     *
     * @remarks
     * - operationType controls how content is applied: "addToTop" prepends, "addToBottom" appends, "overwrite" replaces all content.
     * - textType determines how the text field is interpreted: "plain" for plain text, "html" for HTML markup, "markdown" for Markdown.
     *
     * @example
     * ```typescript
     * const result = await agent.updateGoogleDoc({
     *   documentId: ``,
     *   text: ``,
     *   textType: "plain",
     *   operationType: "addToTop",
     * });
     * ```
     */
    updateGoogleDoc(step: UpdateGoogleDocStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<UpdateGoogleDocStepOutput>>;
    /**
     * Update a Google Spreadsheet with new data.
     *
     * @remarks
     * - operationType controls how data is written: "addToBottom" appends rows, "overwrite" replaces all data, "range" writes to a specific cell range.
     * - Data should be provided as CSV in the text field.
     *
     * @example
     * ```typescript
     * const result = await agent.updateGoogleSheet({
     *   text: ``,
     *   spreadsheetId: ``,
     *   range: ``,
     *   operationType: "addToBottom",
     * });
     * ```
     */
    updateGoogleSheet(step: UpdateGoogleSheetStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<UpdateGoogleSheetStepOutput>>;
    /**
     * @deprecated Legacy v1 data sources. v2 apps should use `dataSources.defineDataSource()` from @mindstudio-ai/agent instead, which owns parsing, chunking, embedding and citations. Upload a file into an existing data source from a URL or raw text content.
     *
     * @remarks
     * - If "file" is a single URL, the file is downloaded from that URL and uploaded.
     * - If "file" is any other string, a .txt document is created from that content and uploaded.
     * - The block waits (polls) for processing to complete before transitioning, up to 5 minutes.
     * - Once processing finishes, vectors are loaded into Milvus so the data source is immediately queryable.
     * - Supported file types (when using a URL) are the same as the data source upload UI (PDF, DOCX, TXT, etc.).
     *
     * @example
     * ```typescript
     * const result = await agent.uploadDataSourceDocument({
     *   dataSourceId: ``,
     *   file: ``,
     *   fileName: ``,
     * });
     * ```
     */
    uploadDataSourceDocument(step: UploadDataSourceDocumentStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<UploadDataSourceDocumentStepOutput>>;
    /**
     * Increase the resolution of an image using AI upscaling.
     *
     * @remarks
     * - Output is re-hosted on the CDN as a PNG.
     *
     * @example
     * ```typescript
     * const result = await agent.upscaleImage({
     *   imageUrl: ``,
     *   targetResolution: "2k",
     *   engine: "standard",
     * });
     * ```
     */
    upscaleImage(step: UpscaleImageStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<UpscaleImageStepOutput>>;
    /**
     * Upscale a video file
     *
     * @example
     * ```typescript
     * const result = await agent.upscaleVideo({
     *   videoUrl: ``,
     *   targetResolution: "720p",
     *   engine: "standard",
     * });
     * ```
     */
    upscaleVideo(step: UpscaleVideoStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<UpscaleVideoStepOutput>>;
    /**
     * Send a message to an AI model and return the response, or echo a system message.
     *
     * @remarks
     * - Source "user" sends the message to an LLM and returns the model's response.
     * - Source "system" echoes the message content directly (no AI call).
     * - Mode "background" saves the result to a variable. Mode "foreground" streams it to the user (not available in direct execution).
     * - Structured output (JSON/CSV) can be enforced via structuredOutputType and structuredOutputExample.
     * - When executed inside a v2 app method (managed sandbox or local dev tunnel),
     * LLM token output can be streamed to the frontend in real time via an SSE
     * side-channel. The frontend opts in by passing { stream: true } to the method
     * invocation via @mindstudio-ai/interface. Tokens are published to Redis
     * pub/sub as they arrive and forwarded as SSE events on the invoke response.
     * The method code itself is unchanged — streaming is transparent to the
     * developer. See V2ExecutionService.ts and the invoke handler in V2Apps for
     * the server-side plumbing.
     *
     * @example
     * ```typescript
     * const result = await agent.generateText({
     *   message: ``,
     * });
     * ```
     */
    generateText(step: UserMessageStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<UserMessageStepOutput>>;
    /**
     * Swap faces in a video file
     *
     * @example
     * ```typescript
     * const result = await agent.videoFaceSwap({
     *   videoUrl: ``,
     *   faceImageUrl: ``,
     *   targetIndex: 0,
     *   engine: ``,
     * });
     * ```
     */
    videoFaceSwap(step: VideoFaceSwapStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<VideoFaceSwapStepOutput>>;
    /**
     * Remove or replace background from a video
     *
     * @example
     * ```typescript
     * const result = await agent.videoRemoveBackground({
     *   videoUrl: ``,
     *   newBackground: "transparent",
     *   engine: ``,
     * });
     * ```
     */
    videoRemoveBackground(step: VideoRemoveBackgroundStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<VideoRemoveBackgroundStepOutput>>;
    /**
     * Remove a watermark from a video
     *
     * @example
     * ```typescript
     * const result = await agent.videoRemoveWatermark({
     *   videoUrl: ``,
     *   engine: ``,
     * });
     * ```
     */
    videoRemoveWatermark(step: VideoRemoveWatermarkStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<VideoRemoveWatermarkStepOutput>>;
    /**
     * Overlay a watermark image onto another image.
     *
     * @remarks
     * - The watermark is placed at the specified corner with configurable padding and width.
     *
     * @example
     * ```typescript
     * const result = await agent.watermarkImage({
     *   imageUrl: ``,
     *   watermarkImageUrl: ``,
     *   corner: "top-left",
     *   paddingPx: 0,
     *   widthPx: 0,
     * });
     * ```
     */
    watermarkImage(step: WatermarkImageStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<WatermarkImageStepOutput>>;
    /**
     * Add an image watermark to a video
     *
     * @example
     * ```typescript
     * const result = await agent.watermarkVideo({
     *   videoUrl: ``,
     *   imageUrl: ``,
     *   corner: "top-left",
     *   paddingPx: 0,
     *   widthPx: 0,
     * });
     * ```
     */
    watermarkVideo(step: WatermarkVideoStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<WatermarkVideoStepOutput>>;
    /**
     * Ask a financial research question using You.com Finance Research and return the sourced response.
     *
     * @remarks
     * - Use this for financial questions such as company analysis, earnings, market research, filings, macroeconomics, and due diligence.
     * - researchEffort supports deep (default) or exhaustive.
     * - Finance Research returns the same response shape as Web Research, but searches a finance-optimized index.
     * - Use it for cited synthesis, not raw price feeds or structured time-series exports.
     *
     * @example
     * ```typescript
     * const result = await agent.youDotComFinanceResearch({
     *   input: ``,
     * });
     * ```
     */
    youDotComFinanceResearch(step: YouDotComFinanceResearchStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<YouDotComFinanceResearchStepOutput>>;
    /**
     * Fetch clean Markdown, HTML, or metadata for known URLs using the You.com Contents API.
     *
     * @remarks
     * - Use this step when you already know the URLs. Use Web Search with livecrawl when You.com should discover pages from a query.
     * - A single request supports up to 10 URLs.
     * - Request only the formats you need. Markdown is recommended for LLM consumption.
     * - Increase crawlTimeout for JavaScript-heavy pages, up to 60 seconds.
     * - Individual pages can partially fail; check each returned item before processing.
     *
     * @example
     * ```typescript
     * const result = await agent.youDotComGetPageContent({
     *   urls: [],
     * });
     * ```
     */
    youDotComGetPageContent(step: YouDotComGetPageContentStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<YouDotComGetPageContentStepOutput>>;
    /**
     * Fetch live news articles through the You.com Search API and return the full structured response.
     *
     * @remarks
     * - Defaults freshness to day for breaking or recent news.
     * - Use country and language together to monitor regional or non-English news.
     * - Use livecrawl: 'news' with livecrawlFormats: ['markdown'] when you need full article text.
     * - Use a custom freshness range like YYYY-MM-DDtoYYYY-MM-DD for historical news windows.
     *
     * @example
     * ```typescript
     * const result = await agent.youDotComLiveNews({
     *   query: ``,
     * });
     * ```
     */
    youDotComLiveNews(step: YouDotComLiveNewsStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<YouDotComLiveNewsStepOutput>>;
    /**
     * Ask a research question and return a grounded You.com Research API answer with sources.
     *
     * @remarks
     * - Use Web Search when you need raw URLs and snippets. Use Web Research when you want a synthesized answer with citations.
     * - researchEffort controls depth and latency: lite, standard, deep, or exhaustive. standard is a good default.
     * - sourceControl can restrict, exclude, or boost domains, and can apply freshness or country filters.
     * - includeDomains cannot be combined with excludeDomains or boostDomains.
     * - outputSchema returns structured output.content and is supported by standard, deep, and exhaustive, not lite.
     *
     * @example
     * ```typescript
     * const result = await agent.youDotComWebResearch({
     *   input: ``,
     * });
     * ```
     */
    youDotComWebResearch(step: YouDotComWebResearchStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<YouDotComWebResearchStepOutput>>;
    /**
     * Search the web and news using the You.com Search API and return the full structured response.
     *
     * @remarks
     * - Query supports You.com search operators:
     * | Operator | Description | Example |
     * | -------- | ----------- | ------- |
     * | site: | Search within a domain and its subdomains | site:uscourts.gov |
     * | filetype: | Search for a specific file type | filetype:pdf |
     * | + | Require the exact term after the operator | +GAAP |
     * | - | Exclude the exact term after the operator | -prs |
     * | AND | Require both expressions | guitar AND Fender |
     * | OR | Match either expression | guitar OR drum |
     * | NOT | Negate an expression | NOT site:uscourts.gov |
     * - Use livecrawl with livecrawlFormats: ['markdown'] when you need full page content instead of snippets.
     * - Use the Get Page Content step when you already know the URLs to fetch.
     * - Use freshness for recency: day, week, month, year, or YYYY-MM-DDtoYYYY-MM-DD.
     * - Use country (ISO 3166-1 alpha-2) and language (BCP 47) to focus results geographically or linguistically.
     * - includeDomains cannot be combined with excludeDomains or boostDomains.
     *
     * @example
     * ```typescript
     * const result = await agent.youDotComWebSearch({
     *   query: ``,
     * });
     * ```
     */
    youDotComWebSearch(step: YouDotComWebSearchStepInput, options?: StepExecutionOptions): Promise<StepExecutionResult<YouDotComWebSearchStepOutput>>;
}

/**
 * Error thrown when a MindStudio API request fails.
 *
 * Contains the HTTP status code, an error code from the API,
 * and any additional details returned in the response body.
 */
declare class MindStudioError extends Error {
    /** Machine-readable error code from the API (e.g. "invalid_step_config"). */
    readonly code: string;
    /** HTTP status code of the failed request. */
    readonly status: number;
    /** Raw error body from the API, if available. */
    readonly details?: unknown | undefined;
    readonly name = "MindStudioError";
    constructor(message: string, 
    /** Machine-readable error code from the API (e.g. "invalid_step_config"). */
    code: string, 
    /** HTTP status code of the failed request. */
    status: number, 
    /** Raw error body from the API, if available. */
    details?: unknown | undefined);
    toString(): string;
    toJSON(): Record<string, unknown>;
}

/**
 * AsyncLocalStorage-based request context for concurrent execution.
 *
 * When the sandbox wraps each handler call in `runWithContext()`, all SDK
 * reads (auth, db, callback token, base URL) pull from the request-scoped
 * store instead of process globals. This enables concurrent request
 * processing on persistent sandbox workers without identity leakage.
 *
 * Fully backwards compatible — when no ALS store is active, all getters
 * fall back to the existing global/env-based behavior.
 */

/**
 * Originating-session identity for method invocations triggered by a
 * conversational surface (a voice call's tool use, an agent-chat tool use).
 * Platform-resolved and guaranteed — never model- or client-supplied — so a
 * method can deterministically correlate back to the exact client session
 * that triggered it, including anonymous sessions (via `visitorId`).
 * Channel-discriminated so future surfaces extend without breaking.
 */
interface SessionContext {
    /**
     * Which surface invoked this method: `voice`/`agent` for conversational
     * tool calls (which carry their session/thread ids below), `web` for a
     * browser interface-session method call, `api` for an app-key or
     * platform-key call. `web`/`api` carry only `visitorId`. Absent entirely
     * on older platform versions.
     */
    channel: 'voice' | 'agent' | 'web' | 'api';
    /** Voice-session id — matches the browser voice client's `session.sessionId`. */
    voiceSessionId?: string;
    /** Agent-chat thread id. */
    threadId?: string;
    /** Stable visitor key — present for anonymous AND signed-in sessions. */
    visitorId?: string;
    /**
     * Voice transport: a browser session (`web`) or a phone call, by direction.
     * Use it to branch behavior that assumes a screen — on a phone call there
     * is none, so describe everything in speech. Absent for agent-chat sessions
     * and on older platform versions — treat absent as `web`.
     */
    medium?: 'web' | 'phone-in' | 'phone-out';
    /**
     * Phone sessions only: the call's numbers (`fromNumber` = who initiated,
     * `to` = who was dialed, in both directions). Context and routing only —
     * caller ID is trivially spoofable, so never treat it as identity: don't
     * gate roles on it or speak account specifics to an unverified caller.
     * In-call verification is the auth rail.
     */
    sip?: {
        to: string;
        fromNumber: string;
    };
}
/**
 * Per-request context provided by the sandbox execution service.
 * Contains everything the SDK needs to resolve auth, databases, and
 * API endpoints for a specific request.
 */
interface RequestContext {
    /** Hook/callback token for this request's auth. */
    callbackToken: string;
    /** API base URL for this request (e.g. from REMOTE_HOSTNAME). */
    remoteHostname?: string;
    /** Auth context: userId + role assignments for this request's user. */
    auth?: AppAuthContext;
    /** Database metadata for this request's app. */
    databases?: AppDatabase[];
    /** Auth table config (managed columns) for this request's app. */
    authConfig?: AuthTableConfig;
    /** Stream ID for SSE streaming in this request. */
    streamId?: string;
    /** Originating-session identity (voice/agent tool calls); absent otherwise. */
    session?: SessionContext;
}
/**
 * Get the current request context from AsyncLocalStorage, if any.
 * Returns undefined when not running inside `runWithContext()`.
 * @internal
 */
declare function getRequestContext(): RequestContext | undefined;
/**
 * Run an async function with a scoped request context. Inside `fn`, all
 * SDK reads (auth, db, callback token, base URL) pull from `ctx` instead
 * of process globals.
 *
 * This enables concurrent request processing — multiple `runWithContext()`
 * calls can execute in parallel without identity leakage.
 *
 * @example
 * ```ts
 * import { runWithContext } from '@mindstudio-ai/agent';
 *
 * await runWithContext({
 *   callbackToken: req.callbackToken,
 *   auth: req.auth,
 *   databases: req.databases,
 * }, async () => {
 *   // auth.userId returns this request's user, not the global one
 *   const user = await Users.get(auth.userId);
 * });
 * ```
 */
declare function runWithContext<T>(ctx: RequestContext, fn: () => T | Promise<T>): T | Promise<T>;

type MonacoSnippetFieldType = 'string' | 'number' | 'boolean' | 'array' | 'object' | string[];
type MonacoSnippetField = [name: string, type: MonacoSnippetFieldType];
interface MonacoSnippet {
    fields: MonacoSnippetField[];
    outputKeys: string[];
}
declare const monacoSnippets: Record<string, MonacoSnippet>;
declare const blockTypeAliases: Record<string, string>;

interface StepMetadata {
    stepType: string;
    description: string;
    usageNotes: string;
    inputSchema: Record<string, unknown>;
    outputSchema: Record<string, unknown> | null;
}
declare const stepMetadata: Record<string, StepMetadata>;

/** MindStudioAgent with all generated step methods. */
type MindStudioAgent = MindStudioAgent$1 & StepMethods;
/** {@inheritDoc MindStudioAgent} */
declare const MindStudioAgent: {
    new (options?: AgentOptions): MindStudioAgent;
};

declare const mindstudio: MindStudioAgent;

/**
 * Top-level `auth` namespace bound to the default singleton.
 *
 * Provides the current user's identity and roles. Requires context
 * hydration before use — call `await mindstudio.ensureContext()` or
 * perform any `db` operation first.
 *
 * @example
 * ```ts
 * import { auth, Roles } from '@mindstudio-ai/agent';
 *
 * auth.requireRole(Roles.admin);
 * const admins = auth.getUsersByRole(Roles.admin);
 * ```
 */
declare const auth: AuthContext;
/**
 * Top-level `db` namespace bound to the default singleton.
 *
 * Use `db.defineTable<T>(name)` to create typed collections. Table
 * definitions are lazy — no HTTP until you await a query. Context is
 * auto-hydrated on first query execution.
 *
 * @example
 * ```ts
 * import { db } from '@mindstudio-ai/agent';
 *
 * const Orders = db.defineTable<Order>('orders');
 * const active = await Orders.filter(o => o.status === 'active').take(10);
 * ```
 */
declare const db: Db;
/**
 * Top-level `files` namespace bound to the default singleton.
 *
 * Private-by-default file storage — the twin of `db`. Use
 * `files.defineStore(name)` at module scope, then `.put/.get/.list/.delete`.
 * `file.url` is a stable on-domain URL for the app frontend; `file.shareUrl()`
 * mints a signed link that works without a session.
 *
 * @example
 * ```ts
 * import { files } from '@mindstudio-ai/agent';
 *
 * const Uploads = files.defineStore('uploads');
 * const f = await Uploads.put(buffer, { contentType: 'application/pdf' });
 * ```
 */
declare const files: Files;
/**
 * Top-level `dataSources` namespace bound to the default singleton.
 *
 * Searchable document corpora. Declare one at module scope and import the
 * handle; the platform owns parsing, chunking, embedding and isolation.
 *
 * @example
 * ```ts
 * import { dataSources } from '@mindstudio-ai/agent';
 *
 * const Policies = dataSources.defineDataSource('policies');
 * const { results } = await Policies.search('what are the payment terms?');
 * ```
 */
declare const dataSources: DataSources;
/**
 * Top-level `voice` namespace bound to the default singleton.
 *
 * Telephony: outbound calls answered by this app's voice agent. See the
 * `voice` module docs for identity, limits, and compliance notes.
 *
 * @example
 * ```ts
 * import { voice } from '@mindstudio-ai/agent';
 *
 * await voice.call({ to: '+13105551234', assumeIdentity: true });
 * ```
 */
declare const voice: Voice;
/**
 * Originating-session identity for this invocation — set when the method was
 * triggered by a conversational surface (a voice call's tool use, an
 * agent-chat tool use), absent on plain API/web/cron invocations.
 *
 * Values are platform-resolved and guaranteed (never model- or
 * client-supplied), so they're safe to key on: `session.voiceSessionId`
 * matches the browser voice client's `session.sessionId`, and
 * `session.visitorId` correlates anonymous sessions. Properties read from the
 * per-request context, so they're always this request's values — check
 * `session.channel` to detect whether one is present.
 *
 * @example
 * ```ts
 * import { db, session } from '@mindstudio-ai/agent';
 *
 * export async function searchKnowledgeBase({ query }: { query: string }) {
 *   const results = await runSearch(query);
 *   if (session.voiceSessionId) {
 *     // Deterministic correlation back to the browser in this exact call.
 *     await ToolResults.insert({ sessionId: session.voiceSessionId, results });
 *   }
 *   return results;
 * }
 * ```
 */
declare const session: Readonly<Partial<SessionContext>>;
/**
 * Top-level `stream` function bound to the default singleton.
 *
 * Send a stream chunk to the caller via SSE. When the method was called
 * with `stream: true`, chunks arrive in real-time. When there is no active
 * stream, calls are silently ignored.
 *
 * @example
 * ```ts
 * import { stream } from '@mindstudio-ai/agent';
 *
 * await stream('Processing...');
 * await stream({ progress: 50 });
 * ```
 */
declare const stream: (data: string | Record<string, unknown>) => Promise<void>;
/**
 * Top-level `waitUntil` bound to the default singleton.
 *
 * Register background work so the platform keeps the sandbox alive until it
 * settles (bounded at ~30 minutes) and records an interruption in the request
 * log if the sandbox is torn down anyway. Failures are caught and logged —
 * they can never crash the sandbox. Use it around fire-and-forget chains:
 *
 * @example
 * ```ts
 * import { waitUntil } from '@mindstudio-ai/agent';
 *
 * waitUntil(enrichRecord(id).then((d) => Records.update(id, d)));
 * return { status: 'processing' };
 * ```
 */
declare const waitUntil: (promise: Promise<unknown>) => void;
/**
 * Resolve a user ID to display info (name, email, profile picture).
 * Bound to the default singleton.
 *
 * @example
 * ```ts
 * import { resolveUser } from '@mindstudio-ai/agent';
 *
 * const user = await resolveUser(order.requestedBy);
 * if (user) console.log(user.name, user.email);
 * ```
 */
declare const resolveUser: (userId: string) => Promise<ResolvedUser | null>;
/**
 * File a bug report or feature idea into this app's issue tracker.
 * Bound to the default singleton. Backend / managed-context only.
 *
 * @example
 * ```ts
 * import { reportIssue } from '@mindstudio-ai/agent';
 *
 * const { number } = await reportIssue({ title: 'Checkout fails', kind: 'bug' });
 * ```
 *
 * @see {@link MindStudioAgent.reportIssue}
 */
declare const reportIssue: (input: ReportIssueInput) => Promise<ReportedIssue>;
/**
 * Invalidate this app's prerendered snapshot(s) so crawlers get a fresh render
 * on their next visit. Bound to the default singleton. Backend / managed-context
 * only. Omit `paths` (or pass an empty array) to purge every snapshot.
 *
 * @example
 * ```ts
 * import { prerender } from '@mindstudio-ai/agent';
 *
 * await prerender.invalidate(['/u/abc']);
 * ```
 *
 * @see {@link MindStudioAgent.invalidatePrerender}
 */
declare const prerender: {
    invalidate: (paths?: string[]) => Promise<{
        purged: number | "all";
    }>;
};

export { type Accessor, type ActiveCampaignAddNoteStepInput, type ActiveCampaignAddNoteStepOutput, type ActiveCampaignCreateContactStepInput, type ActiveCampaignCreateContactStepOutput, type AddSubtitlesToVideoStepInput, type AddSubtitlesToVideoStepOutput, type AgentInfo, type AgentOptions, type AirtableCreateUpdateRecordStepInput, type AirtableCreateUpdateRecordStepOutput, type AirtableDeleteRecordStepInput, type AirtableDeleteRecordStepOutput, type AirtableGetRecordStepInput, type AirtableGetRecordStepOutput, type AirtableGetTableRecordsStepInput, type AirtableGetTableRecordsStepOutput, type AnalyzeImageStepInput, type AnalyzeImageStepOutput, type AnalyzeVideoStepInput, type AnalyzeVideoStepOutput, type AppAuthContext, type AppContextResult, type AppDatabase, type AppDatabaseColumnSchema, type AppDatabaseTable, type AppRoleAssignment, AuthContext, type AuthTableConfig, type BatchStepInput, type BatchStepResult, type Batchable, type CaptureThumbnailStepInput, type CaptureThumbnailStepOutput, type CheckAppRoleStepInput, type CheckAppRoleStepOutput, type CodaCreateUpdatePageStepInput, type CodaCreateUpdatePageStepOutput, type CodaCreateUpdateRowStepInput, type CodaCreateUpdateRowStepOutput, type CodaFindRowStepInput, type CodaFindRowStepOutput, type CodaGetPageStepInput, type CodaGetPageStepOutput, type CodaGetTableRowsStepInput, type CodaGetTableRowsStepOutput, type Connection, type ConnectorActionDetail, type ConnectorService, type ConvertPdfToImagesStepInput, type ConvertPdfToImagesStepOutput, type CreateDataSourceStepInput, type CreateDataSourceStepOutput, type CreateGmailDraftStepInput, type CreateGmailDraftStepOutput, type CreateGoogleCalendarEventStepInput, type CreateGoogleCalendarEventStepOutput, type CreateGoogleDocStepInput, type CreateGoogleDocStepOutput, type CreateGoogleSheetStepInput, type CreateGoogleSheetStepOutput, type Db, type DefineStoreOptions, type DefineTableOptions, type DeleteDataSourceDocumentStepInput, type DeleteDataSourceDocumentStepOutput, type DeleteDataSourceStepInput, type DeleteDataSourceStepOutput, type DeleteGmailEmailStepInput, type DeleteGmailEmailStepOutput, type DeleteGoogleCalendarEventStepInput, type DeleteGoogleCalendarEventStepOutput, type DeleteGoogleSheetRowsStepInput, type DeleteGoogleSheetRowsStepOutput, type DetectChangesStepInput, type DetectChangesStepOutput, type DetectPIIStepInput, type DetectPIIStepOutput, type DiscordEditMessageStepInput, type DiscordEditMessageStepOutput, type DiscordSendFollowUpStepInput, type DiscordSendFollowUpStepOutput, type DiscordSendMessageStepInput, type DiscordSendMessageStepOutput, type DownloadVideoStepInput, type DownloadVideoStepOutput, type EnhanceImageGenerationPromptStepInput, type EnhanceImageGenerationPromptStepOutput, type EnhanceVideoGenerationPromptStepInput, type EnhanceVideoGenerationPromptStepOutput, type EnrichPersonStepInput, type EnrichPersonStepOutput, type ExecuteStepBatchOptions, type ExecuteStepBatchResult, type ExtractAudioFromVideoStepInput, type ExtractAudioFromVideoStepOutput, type ExtractTextStepInput, type ExtractTextStepOutput, type FetchDataSourceDocumentStepInput, type FetchDataSourceDocumentStepOutput, type FetchGoogleDocStepInput, type FetchGoogleDocStepOutput, type FetchGoogleSheetStepInput, type FetchGoogleSheetStepOutput, type FetchSlackChannelHistoryStepInput, type FetchSlackChannelHistoryStepOutput, type FetchYoutubeCaptionsStepInput, type FetchYoutubeCaptionsStepOutput, type FetchYoutubeChannelStepInput, type FetchYoutubeChannelStepOutput, type FetchYoutubeCommentsStepInput, type FetchYoutubeCommentsStepOutput, type FetchYoutubeVideoStepInput, type FetchYoutubeVideoStepOutput, type FileAccess, type Files, type FromSchema, type Generate3dModelStepInput, type Generate3dModelStepOutput, type GenerateAssetStepInput, type GenerateAssetStepOutput, type GenerateChartStepInput, type GenerateChartStepOutput, type GenerateImageStepInput, type GenerateImageStepOutput, type GenerateLipsyncStepInput, type GenerateLipsyncStepOutput, type GenerateMusicStepInput, type GenerateMusicStepOutput, type GeneratePdfStepInput, type GeneratePdfStepOutput, type GenerateStaticVideoFromImageStepInput, type GenerateStaticVideoFromImageStepOutput, type GenerateTextStepInput, type GenerateTextStepOutput, type GenerateVideoStepInput, type GenerateVideoStepOutput, type GetGmailAttachmentsStepInput, type GetGmailAttachmentsStepOutput, type GetGmailDraftStepInput, type GetGmailDraftStepOutput, type GetGmailEmailStepInput, type GetGmailEmailStepOutput, type GetGmailUnreadCountStepInput, type GetGmailUnreadCountStepOutput, type GetGoogleCalendarEventStepInput, type GetGoogleCalendarEventStepOutput, type GetGoogleDriveFileStepInput, type GetGoogleDriveFileStepOutput, type GetGoogleSheetInfoStepInput, type GetGoogleSheetInfoStepOutput, type GetMediaMetadataStepInput, type GetMediaMetadataStepOutput, type HubspotCreateCompanyStepInput, type HubspotCreateCompanyStepOutput, type HubspotCreateContactStepInput, type HubspotCreateContactStepOutput, type HubspotGetCompanyStepInput, type HubspotGetCompanyStepOutput, type HubspotGetContactStepInput, type HubspotGetContactStepOutput, type HunterApiCompanyEnrichmentStepInput, type HunterApiCompanyEnrichmentStepOutput, type HunterApiDomainSearchStepInput, type HunterApiDomainSearchStepOutput, type HunterApiEmailFinderStepInput, type HunterApiEmailFinderStepOutput, type HunterApiEmailVerificationStepInput, type HunterApiEmailVerificationStepOutput, type HunterApiPersonEnrichmentStepInput, type HunterApiPersonEnrichmentStepOutput, type ImageFaceSwapStepInput, type ImageFaceSwapStepOutput, type ImageRemoveWatermarkStepInput, type ImageRemoveWatermarkStepOutput, type InsertVideoClipsStepInput, type InsertVideoClipsStepOutput, type Jewel, type JewelConfig, type JewelGradeContext, type JewelMethod, type JewelMethodInput, type JewelPairRecord, type JewelProposal, type JewelProposeOutcome, type JewelProposeResult, type JewelQueueItem, type JewelQueueResolution, type JewelQueueResolveResult, type JewelRunParams, type JewelVerdict, type JewelsApi, type JsonObjectSchema, type JsonSchema, type JsonSchemaTypeName, type ListAgentsResult, type ListDataSourcesStepInput, type ListDataSourcesStepOutput, type ListGmailDraftsStepInput, type ListGmailDraftsStepOutput, type ListGmailLabelsStepInput, type ListGmailLabelsStepOutput, type ListGoogleCalendarEventsStepInput, type ListGoogleCalendarEventsStepOutput, type ListGoogleDriveFilesStepInput, type ListGoogleDriveFilesStepOutput, type ListOptions, type ListRecentGmailEmailsStepInput, type ListRecentGmailEmailsStepOutput, type LogicStepInput, type LogicStepOutput, type MakeDotComRunScenarioStepInput, type MakeDotComRunScenarioStepOutput, type MergeAudioStepInput, type MergeAudioStepOutput, type MergeVideosStepInput, type MergeVideosStepOutput, type MeshyAnimateStepInput, type MeshyAnimateStepOutput, type MeshyImageTo3dStepInput, type MeshyImageTo3dStepOutput, type MeshyRemeshStepInput, type MeshyRemeshStepOutput, type MeshyRigStepInput, type MeshyRigStepOutput, type MeshyTextTo3dStepInput, type MeshyTextTo3dStepOutput, type MeshyTextureStepInput, type MeshyTextureStepOutput, MindStudioAgent, MindStudioError, type MindStudioModel, type MindStudioModelSummary, type MixAudioIntoVideoStepInput, type MixAudioIntoVideoStepOutput, type ModelType, type MonacoSnippet, type MonacoSnippetField, type MonacoSnippetFieldType, type MuteVideoStepInput, type MuteVideoStepOutput, type N8nRunNodeStepInput, type N8nRunNodeStepOutput, type NotionCreatePageStepInput, type NotionCreatePageStepOutput, type NotionUpdatePageStepInput, type NotionUpdatePageStepOutput, type PackagedWorkflow, type PackagedWorkflowInput, type PackagedWorkflowSignature, type ParticlePodcastsFindMentionsStepInput, type ParticlePodcastsFindMentionsStepOutput, type ParticlePodcastsGetEpisodeStepInput, type ParticlePodcastsGetEpisodeStepOutput, type ParticlePodcastsGetEpisodeTranscriptStepInput, type ParticlePodcastsGetEpisodeTranscriptStepOutput, type ParticlePodcastsSearchCompaniesStepInput, type ParticlePodcastsSearchCompaniesStepOutput, type ParticlePodcastsSearchDialogueStepInput, type ParticlePodcastsSearchDialogueStepOutput, type ParticlePodcastsSearchPodcastsStepInput, type ParticlePodcastsSearchPodcastsStepOutput, type PeopleSearchStepInput, type PeopleSearchStepOutput, type PostToLinkedInStepInput, type PostToLinkedInStepOutput, type PostToSlackChannelStepInput, type PostToSlackChannelStepOutput, type PostToXStepInput, type PostToXStepOutput, type PostToZapierStepInput, type PostToZapierStepOutput, type Predicate, type PushInput, type PutOptions, Query, type QueryAppDatabaseStepInput, type QueryAppDatabaseStepOutput, type QueryDataSourceStepInput, type QueryDataSourceStepOutput, type QueryExternalDatabaseStepInput, type QueryExternalDatabaseStepOutput, type RedactPIIStepInput, type RedactPIIStepOutput, type RemoveBackgroundFromImageStepInput, type RemoveBackgroundFromImageStepOutput, type ReplyToGmailEmailStepInput, type ReplyToGmailEmailStepOutput, type ReportIssueInput, type ReportedIssue, type RequestContext, type ResizeVideoStepInput, type ResizeVideoStepOutput, type ResolvedUser, Roles, type RunAgentOptions, type RunAgentResult, type RunFromConnectorRegistryStepInput, type RunFromConnectorRegistryStepOutput, type RunPackagedWorkflowStepInput, type RunPackagedWorkflowStepOutput, type RunTaskOptions, type RunTaskOptionsWithExample, type RunTaskOptionsWithSchema, type RunTaskResult, type SchemaValidationError, type ScrapeLinkedInCompanyStepInput, type ScrapeLinkedInCompanyStepOutput, type ScrapeLinkedInProfileStepInput, type ScrapeLinkedInProfileStepOutput, type ScrapeUrlStepInput, type ScrapeUrlStepOutput, type ScrapeXPostStepInput, type ScrapeXPostStepOutput, type ScrapeXProfileStepInput, type ScrapeXProfileStepOutput, type ScreenshotUrlStepInput, type ScreenshotUrlStepOutput, type SearchGmailEmailsStepInput, type SearchGmailEmailsStepOutput, type SearchGoogleCalendarEventsStepInput, type SearchGoogleCalendarEventsStepOutput, type SearchGoogleDriveStepInput, type SearchGoogleDriveStepOutput, type SearchGoogleImagesStepInput, type SearchGoogleImagesStepOutput, type SearchGoogleNewsStepInput, type SearchGoogleNewsStepOutput, type SearchGoogleStepInput, type SearchGoogleStepOutput, type SearchGoogleTrendsStepInput, type SearchGoogleTrendsStepOutput, type SearchPerplexityStepInput, type SearchPerplexityStepOutput, type SearchXPostsStepInput, type SearchXPostsStepOutput, type SearchYoutubeStepInput, type SearchYoutubeStepOutput, type SearchYoutubeTrendsStepInput, type SearchYoutubeTrendsStepOutput, type SendEmailStepInput, type SendEmailStepOutput, type SendGmailDraftStepInput, type SendGmailDraftStepOutput, type SendGmailMessageStepInput, type SendGmailMessageStepOutput, type SendSMSStepInput, type SendSMSStepOutput, type SendSlackDirectMessageStepInput, type SendSlackDirectMessageStepOutput, type SessionContext, type SetGmailReadStatusStepInput, type SetGmailReadStatusStepOutput, type SetRunTitleStepInput, type SetRunTitleStepOutput, type SetVariableStepInput, type SetVariableStepOutput, type StepCostEstimateEntry, type StepExecutionMeta, type StepExecutionOptions, type StepExecutionResult, type StepInputMap, type StepLogEvent, type StepMetadata, type StepMethods, type StepName, type StepOutputMap, Store, type StoredFile, type SystemFields, Table, type TaskEvent, type TaskToolCall, type TaskToolConfig, type TaskUsage, type TelegramEditMessageStepInput, type TelegramEditMessageStepOutput, type TelegramReplyToMessageStepInput, type TelegramReplyToMessageStepOutput, type TelegramSendAudioStepInput, type TelegramSendAudioStepOutput, type TelegramSendFileStepInput, type TelegramSendFileStepOutput, type TelegramSendImageStepInput, type TelegramSendImageStepOutput, type TelegramSendMessageStepInput, type TelegramSendMessageStepOutput, type TelegramSendVideoStepInput, type TelegramSendVideoStepOutput, type TelegramSetTypingStepInput, type TelegramSetTypingStepOutput, type TextToSpeechStepInput, type TextToSpeechStepOutput, type TranscribeAudioStepInput, type TranscribeAudioStepOutput, type TrimMediaStepInput, type TrimMediaStepOutput, type UpdateGmailLabelsStepInput, type UpdateGmailLabelsStepOutput, type UpdateGoogleCalendarEventStepInput, type UpdateGoogleCalendarEventStepOutput, type UpdateGoogleDocStepInput, type UpdateGoogleDocStepOutput, type UpdateGoogleSheetStepInput, type UpdateGoogleSheetStepOutput, type UpdateInput, type UploadDataSourceDocumentStepInput, type UploadDataSourceDocumentStepOutput, type UploadFileResult, type UploadToken, type UpscaleImageStepInput, type UpscaleImageStepOutput, type UpscaleVideoStepInput, type UpscaleVideoStepOutput, type User, type UserInfoResult, type UserMessageStepInput, type UserMessageStepOutput, type VideoFaceSwapStepInput, type VideoFaceSwapStepOutput, type VideoRemoveBackgroundStepInput, type VideoRemoveBackgroundStepOutput, type VideoRemoveWatermarkStepInput, type VideoRemoveWatermarkStepOutput, type Voice, type VoiceCallResult, type WatermarkImageStepInput, type WatermarkImageStepOutput, type WatermarkVideoStepInput, type WatermarkVideoStepOutput, type YouDotComFinanceResearchStepInput, type YouDotComFinanceResearchStepOutput, type YouDotComGetPageContentStepInput, type YouDotComGetPageContentStepOutput, type YouDotComLiveNewsStepInput, type YouDotComLiveNewsStepOutput, type YouDotComWebResearchStepInput, type YouDotComWebResearchStepOutput, type YouDotComWebSearchStepInput, type YouDotComWebSearchStepOutput, auth, blockTypeAliases, dataSources, db, mindstudio as default, defineJewel, files, getRequestContext, mindstudio, monacoSnippets, prerender, reportIssue, resolveUser, runWithContext, session, stepMetadata, stream, voice, waitUntil };
