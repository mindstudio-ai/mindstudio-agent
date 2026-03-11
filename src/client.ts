import { request, type HttpClientConfig } from './http.js';
import { MindStudioError } from './errors.js';
import { RateLimiter, type AuthType } from './rate-limit.js';
import { loadConfig, type MindStudioConfig } from './config.js';
import { AuthContext } from './auth/index.js';
import { createDb, Table, type Db, type DefineTableOptions } from './db/index.js';
import type {
  AgentOptions,
  StepExecutionOptions,
  StepExecutionResult,
  ListAgentsResult,
  UserInfoResult,
  RunAgentOptions,
  RunAgentResult,
  MindStudioModel,
  MindStudioModelSummary,
  ModelType,
  ConnectorService,
  ConnectorActionDetail,
  Connection,
  StepCostEstimateEntry,
  UploadFileResult,
  AppContextResult,
  BatchStepInput,
  BatchStepResult,
  ExecuteStepBatchOptions,
  ExecuteStepBatchResult,
} from './types.js';

const DEFAULT_BASE_URL = 'https://v1.mindstudio-api.com';
const DEFAULT_MAX_RETRIES = 3;

/**
 * Client for the MindStudio direct step execution API.
 *
 * Create an instance and call typed step methods directly:
 *
 * ```ts
 * const agent = new MindStudioAgent({ apiKey: "your-key" });
 * const { imageUrl } = await agent.generateImage({ prompt: "a sunset", mode: "background" });
 * console.log(imageUrl);
 * ```
 *
 * Authentication is resolved in order:
 * 1. `apiKey` passed to the constructor
 * 2. `MINDSTUDIO_API_KEY` environment variable
 * 3. `~/.mindstudio/config.json` (set via `mindstudio login`)
 * 4. `CALLBACK_TOKEN` environment variable (auto-set inside MindStudio custom functions)
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
export class MindStudioAgent {
  /** @internal */
  readonly _httpConfig: HttpClientConfig;
  /** @internal */
  private _reuseThreadId: boolean;
  /** @internal */
  private _threadId: string | undefined;

  // ---- App context (db + auth) ----

  /**
   * @internal App ID for context resolution. Resolved from:
   * constructor appId → MINDSTUDIO_APP_ID env → sandbox globals →
   * auto-detected from first executeStep response header.
   */
  private _appId: string | undefined;

  /**
   * @internal Cached app context (auth + databases). Populated by
   * ensureContext() and cached for the lifetime of the instance.
   */
  private _context: AppContextResult | undefined;

  /**
   * @internal Deduplication promise for ensureContext(). Ensures only one
   * context fetch is in-flight at a time, even if multiple db/auth
   * operations trigger it concurrently.
   */
  private _contextPromise: Promise<void> | undefined;

  /** @internal Cached AuthContext instance, created during context hydration. */
  private _auth: AuthContext | undefined;

  /** @internal Cached Db namespace instance, created during context hydration. */
  private _db: Db | undefined;

  /** @internal Auth type — 'internal' for CALLBACK_TOKEN (managed mode), 'apiKey' otherwise. */
  private _authType: AuthType;

  constructor(options: AgentOptions = {}) {
    const config = loadConfig();
    const { token, authType } = resolveToken(options.apiKey, config);
    const baseUrl =
      options.baseUrl ??
      process.env.MINDSTUDIO_BASE_URL ??
      process.env.REMOTE_HOSTNAME ??
      config.baseUrl ??
      DEFAULT_BASE_URL;

    this._reuseThreadId =
      options.reuseThreadId ??
      /^(true|1)$/i.test(process.env.MINDSTUDIO_REUSE_THREAD_ID ?? '');

    this._appId =
      options.appId ?? process.env.MINDSTUDIO_APP_ID ?? undefined;

    this._authType = authType;

    this._httpConfig = {
      baseUrl,
      token,
      rateLimiter: new RateLimiter(authType),
      maxRetries: options.maxRetries ?? DEFAULT_MAX_RETRIES,
    };

    // Sandbox fast path: if running inside MindStudio (CALLBACK_TOKEN auth),
    // try to hydrate context synchronously from globals. The platform
    // pre-populates `ai.auth` and `ai.databases` before the script runs.
    if (authType === 'internal') {
      this._trySandboxHydration();
    }
  }

  /**
   * Execute any step by its type name. This is the low-level method that all
   * typed step methods delegate to. Use it as an escape hatch for step types
   * not yet covered by the generated methods.
   *
   * ```ts
   * const result = await agent.executeStep("generateImage", { prompt: "hello", mode: "background" });
   * ```
   */
  async executeStep<TOutput = unknown>(
    stepType: string,
    step: Record<string, unknown>,
    options?: StepExecutionOptions,
  ): Promise<StepExecutionResult<TOutput>> {
    const threadId =
      options?.threadId ?? (this._reuseThreadId ? this._threadId : undefined);

    const { data, headers } = await request<{
      output?: TOutput;
      outputUrl?: string;
    }>(this._httpConfig, 'POST', `/steps/${stepType}/execute`, {
      step,
      ...(options?.appId != null && { appId: options.appId }),
      ...(threadId != null && { threadId }),
    });

    let output: TOutput;
    if (data.output != null) {
      output = data.output;
    } else if (data.outputUrl) {
      const res = await fetch(data.outputUrl);
      if (!res.ok) {
        throw new MindStudioError(
          `Failed to fetch output from S3: ${res.status} ${res.statusText}`,
          'output_fetch_error',
          res.status,
        );
      }
      const envelope = (await res.json()) as { value: TOutput };
      output = envelope.value;
    } else {
      output = undefined as TOutput;
    }

    const returnedThreadId = headers.get('x-mindstudio-thread-id') ?? '';
    if (this._reuseThreadId && returnedThreadId) {
      this._threadId = returnedThreadId;
    }

    // Auto-capture appId from response headers for zero-config db/auth.
    // If no explicit appId was set, store the one from the first API response
    // so that subsequent ensureContext() calls can use it.
    const returnedAppId = headers.get('x-mindstudio-app-id');
    if (!this._appId && returnedAppId) {
      this._appId = returnedAppId;
    }

    const remaining = headers.get('x-ratelimit-remaining');
    const billingCost = headers.get('x-mindstudio-billing-cost');
    const billingEvents = headers.get('x-mindstudio-billing-events');

    return {
      ...(output as object),
      $appId: headers.get('x-mindstudio-app-id') ?? '',
      $threadId: returnedThreadId,
      $rateLimitRemaining:
        remaining != null ? parseInt(remaining, 10) : undefined,
      $billingCost:
        billingCost != null ? parseFloat(billingCost) : undefined,
      $billingEvents:
        billingEvents != null
          ? (JSON.parse(billingEvents) as Array<Record<string, unknown>>)
          : undefined,
    } as StepExecutionResult<TOutput>;
  }

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
  async executeStepBatch(
    steps: BatchStepInput[],
    options?: ExecuteStepBatchOptions,
  ): Promise<ExecuteStepBatchResult> {
    const threadId =
      options?.threadId ?? (this._reuseThreadId ? this._threadId : undefined);

    const { data } = await request<{
      results: Array<{
        stepType: string;
        output?: Record<string, unknown>;
        outputUrl?: string;
        billingCost?: number;
        error?: string;
      }>;
      totalBillingCost?: number;
      appId?: string;
      threadId?: string;
    }>(this._httpConfig, 'POST', '/steps/execute-batch', {
      steps,
      ...(options?.appId != null && { appId: options.appId }),
      ...(threadId != null && { threadId }),
    });

    // Resolve S3 outputs in parallel
    const results: BatchStepResult[] = await Promise.all(
      data.results.map(async (r) => {
        if (r.output != null) {
          return {
            stepType: r.stepType,
            output: r.output,
            billingCost: r.billingCost,
            error: r.error,
          };
        }
        if (r.outputUrl) {
          const res = await fetch(r.outputUrl);
          if (!res.ok) {
            return {
              stepType: r.stepType,
              error: `Failed to fetch output from S3: ${res.status} ${res.statusText}`,
            };
          }
          const envelope = (await res.json()) as {
            value: Record<string, unknown>;
          };
          return {
            stepType: r.stepType,
            output: envelope.value,
            billingCost: r.billingCost,
          };
        }
        return {
          stepType: r.stepType,
          billingCost: r.billingCost,
          error: r.error,
        };
      }),
    );

    if (this._reuseThreadId && data.threadId) {
      this._threadId = data.threadId;
    }

    return {
      results,
      totalBillingCost: data.totalBillingCost,
      appId: data.appId,
      threadId: data.threadId,
    };
  }

  /**
   * Get the authenticated user's identity and organization info.
   *
   * ```ts
   * const info = await agent.getUserInfo();
   * console.log(info.displayName, info.organizationName);
   * ```
   */
  async getUserInfo(): Promise<UserInfoResult> {
    const { data } = await request<UserInfoResult>(
      this._httpConfig,
      'GET',
      '/account/userinfo',
    );
    return data;
  }

  /**
   * List all pre-built agents in the organization.
   *
   * ```ts
   * const { apps } = await agent.listAgents();
   * for (const app of apps) console.log(app.name, app.id);
   * ```
   */
  async listAgents(): Promise<ListAgentsResult> {
    const { data } = await request<ListAgentsResult>(
      this._httpConfig,
      'GET',
      '/agents/load',
    );
    return data;
  }

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
  async runAgent(options: RunAgentOptions): Promise<RunAgentResult> {
    const pollInterval = options.pollIntervalMs ?? 1000;

    const { data } = await request<{
      success: boolean;
      threadId: string;
      callbackToken: string;
    }>(this._httpConfig, 'POST', '/agents/run', {
      appId: options.appId,
      async: true,
      ...(options.variables != null && { variables: options.variables }),
      ...(options.workflow != null && { workflow: options.workflow }),
      ...(options.version != null && { version: options.version }),
      ...(options.includeBillingCost != null && {
        includeBillingCost: options.includeBillingCost,
      }),
      ...(options.metadata != null && { metadata: options.metadata }),
    });

    const token = data.callbackToken;
    const pollUrl = `${this._httpConfig.baseUrl}/developer/v2/agents/run/poll/${token}`;

    // Poll until complete or error
    while (true) {
      await sleep(pollInterval);

      const res = await fetch(pollUrl, {
        headers: { 'User-Agent': '@mindstudio-ai/agent' },
      });

      if (res.status === 404) {
        throw new MindStudioError(
          'Poll token not found or expired.',
          'poll_token_expired',
          404,
        );
      }

      if (!res.ok) {
        throw new MindStudioError(
          `Poll request failed: ${res.status} ${res.statusText}`,
          'poll_error',
          res.status,
        );
      }

      const poll = (await res.json()) as {
        status: 'pending' | 'complete' | 'error';
        result?: RunAgentResult;
        error?: string;
      };

      if (poll.status === 'pending') continue;

      if (poll.status === 'error') {
        throw new MindStudioError(
          poll.error ?? 'Agent run failed.',
          'agent_run_error',
          500,
        );
      }

      return poll.result!;
    }
  }

  /** @internal Used by generated action methods. */
  _request<T>(method: 'GET' | 'POST', path: string, body?: unknown) {
    return request<T>(this._httpConfig, method, path, body);
  }

  // -------------------------------------------------------------------------
  // Helper methods — models
  // -------------------------------------------------------------------------

  /** List all available AI models. */
  async listModels(): Promise<{ models: MindStudioModel[] }> {
    const { data } = await request<{ models: MindStudioModel[] }>(
      this._httpConfig,
      'GET',
      '/helpers/models',
    );
    return data;
  }

  /** List AI models filtered by type. */
  async listModelsByType(
    modelType: ModelType,
  ): Promise<{ models: MindStudioModel[] }> {
    const { data } = await request<{ models: MindStudioModel[] }>(
      this._httpConfig,
      'GET',
      `/helpers/models/${modelType}`,
    );
    return data;
  }

  /** List all available AI models (summary). Returns only id, name, type, and tags. */
  async listModelsSummary(): Promise<{ models: MindStudioModelSummary[] }> {
    const { data } = await request<{ models: MindStudioModelSummary[] }>(
      this._httpConfig,
      'GET',
      '/helpers/models-summary',
    );
    return data;
  }

  /** List AI models (summary) filtered by type. */
  async listModelsSummaryByType(
    modelType: ModelType,
  ): Promise<{ models: MindStudioModelSummary[] }> {
    const { data } = await request<{ models: MindStudioModelSummary[] }>(
      this._httpConfig,
      'GET',
      `/helpers/models-summary/${modelType}`,
    );
    return data;
  }

  // -------------------------------------------------------------------------
  // Helper methods — OAuth connectors & connections
  // -------------------------------------------------------------------------

  /**
   * List available OAuth connector services (Slack, Google, HubSpot, etc.).
   *
   * These are third-party integrations from the MindStudio Connector Registry.
   * For most tasks, use actions directly instead.
   */
  async listConnectors(): Promise<{ services: ConnectorService[] }> {
    const { data } = await request<{ services: ConnectorService[] }>(
      this._httpConfig,
      'GET',
      '/helpers/connectors',
    );
    return data;
  }

  /** Get details for a single OAuth connector service. */
  async getConnector(
    serviceId: string,
  ): Promise<{ service: ConnectorService }> {
    const { data } = await request<{ service: ConnectorService }>(
      this._httpConfig,
      'GET',
      `/helpers/connectors/${serviceId}`,
    );
    return data;
  }

  /** Get the full configuration for an OAuth connector action, including input fields. */
  async getConnectorAction(
    serviceId: string,
    actionId: string,
  ): Promise<{ action: ConnectorActionDetail }> {
    const { data } = await request<{ action: ConnectorActionDetail }>(
      this._httpConfig,
      'GET',
      `/helpers/connectors/${serviceId}/${actionId}`,
    );
    return data;
  }

  /** List OAuth connections for the organization. These are authenticated third-party service links. */
  async listConnections(): Promise<{ connections: Connection[] }> {
    const { data } = await request<{ connections: Connection[] }>(
      this._httpConfig,
      'GET',
      '/helpers/connections',
    );
    return data;
  }

  // -------------------------------------------------------------------------
  // Helper methods — cost estimation
  // -------------------------------------------------------------------------

  /** Estimate the cost of executing an action before running it. */
  async estimateStepCost(
    stepType: string,
    step?: Record<string, unknown>,
    options?: { appId?: string; workflowId?: string },
  ): Promise<{ costType?: string; estimates?: StepCostEstimateEntry[] }> {
    const { data } = await request<{
      costType?: string;
      estimates?: StepCostEstimateEntry[];
    }>(this._httpConfig, 'POST', '/helpers/step-cost-estimate', {
      step: { type: stepType, ...step },
      ...options,
    });
    return data;
  }

  // -------------------------------------------------------------------------
  // db + auth namespaces
  // -------------------------------------------------------------------------

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
  get auth(): AuthContext {
    if (!this._auth) {
      throw new MindStudioError(
        'Auth context not yet loaded. Call `await agent.ensureContext()` ' +
          'or perform any db operation first (which auto-hydrates context). ' +
          'Inside the MindStudio sandbox, context is loaded automatically.',
        'context_not_loaded',
        400,
      );
    }
    return this._auth;
  }

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
  get db(): Db {
    if (this._db) return this._db;

    // Return a lazy Db proxy that auto-hydrates context on first use.
    // defineTable() itself is synchronous (it just stores the table name),
    // but the Table methods are all async and will trigger ensureContext().
    return this._createLazyDb();
  }

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
  async ensureContext(): Promise<void> {
    // Already hydrated — nothing to do
    if (this._context) return;

    // Deduplicate concurrent calls: if a fetch is already in-flight,
    // all callers await the same promise
    if (!this._contextPromise) {
      this._contextPromise = this._hydrateContext();
    }

    await this._contextPromise;
  }

  /**
   * @internal Fetch and cache app context, then create auth + db instances.
   *
   * In managed mode (CALLBACK_TOKEN), if no appId is available, we make
   * a lightweight executeStep call to auto-detect it from response headers
   * before fetching context. This avoids requiring users to manually set
   * appId in the sandbox environment.
   */
  private async _hydrateContext(): Promise<void> {
    // If no appId yet and we're in managed mode, auto-detect it by making
    // a lightweight step call. The platform resolves the app from the
    // CALLBACK_TOKEN and returns the appId in response headers.
    if (!this._appId && this._authType === 'internal') {
      try {
        await this.executeStep('setVariable', { value: '' });
      } catch {
        // Ignore errors — we just need the headers for appId auto-detect
      }
    }

    if (!this._appId) {
      throw new MindStudioError(
        'No app ID available for context resolution. Pass `appId` to the ' +
          'constructor, set the MINDSTUDIO_APP_ID environment variable, or ' +
          'make a step execution call first (which auto-detects the app ID).',
        'missing_app_id',
        400,
      );
    }

    const context = await this.getAppContext(this._appId);
    this._applyContext(context);
  }

  /**
   * @internal Apply a resolved context object — creates AuthContext and Db.
   * Used by both the HTTP path and sandbox hydration.
   */
  private _applyContext(context: AppContextResult): void {
    this._context = context;
    this._auth = new AuthContext(context.auth);
    this._db = createDb(
      context.databases,
      this._executeDbQuery.bind(this),
    );
  }

  /**
   * @internal Try to hydrate context synchronously from sandbox globals.
   * Called in the constructor when CALLBACK_TOKEN auth is detected.
   *
   * The MindStudio sandbox pre-populates `globalThis.ai` with:
   * - `ai.auth`: { userId, roleAssignments[] }
   * - `ai.databases`: [{ id, name, tables[] }]
   */
  private _trySandboxHydration(): void {
    const ai = (globalThis as Record<string, unknown>).ai as
      | { auth?: AppContextResult['auth']; databases?: AppContextResult['databases'] }
      | undefined;

    if (ai?.auth && ai?.databases) {
      this._applyContext({
        auth: ai.auth,
        databases: ai.databases,
      });
    }
  }

  /**
   * @internal Execute a SQL query against a managed database.
   * Used as the `executeQuery` callback for Table instances.
   *
   * Calls the `queryAppDatabase` step with `parameterize: false`
   * (the SDK builds fully-formed SQL with escaped inline values).
   */
  private async _executeDbQuery(
    databaseId: string,
    sql: string,
  ): Promise<{ rows: unknown[]; changes: number }> {
    const result = await this.executeStep<{
      rows: unknown[];
      changes: number;
    }>('queryAppDatabase', {
      databaseId,
      sql,
      parameterize: false,
    });

    return { rows: result.rows ?? [], changes: result.changes ?? 0 };
  }

  /**
   * @internal Create a lazy Db proxy that auto-hydrates context.
   *
   * defineTable() returns Table instances immediately (no async needed).
   * But the Table's executeQuery callback is wrapped to call ensureContext()
   * before the first query, so context is fetched lazily.
   */
  private _createLazyDb(): Db {
    const agent = this;

    return {
      defineTable<T>(name: string, options?: DefineTableOptions) {
        // We can't resolve the table schema yet (context hasn't been
        // fetched), so we create a "lazy" table whose executeQuery
        // callback calls ensureContext() before running. After hydration,
        // the real Db (agent._db) exists with full schema info, and we
        // delegate to it for the actual query execution.
        //
        // The columns array starts empty here — this is fine because no
        // actual data flows through this Table's columns. The executeQuery
        // callback below redirects through the fully-configured real Db
        // after hydration, which has the correct column schema for
        // user-type prefix handling and JSON parsing.

        const databaseHint = options?.database;

        return new Table<T>({
          databaseId: '',
          tableName: name,
          columns: [],
          executeQuery: async (sql: string) => {
            await agent.ensureContext();
            // After hydration, the real Db has full database metadata.
            // Look up the databaseId for this table, respecting the
            // database hint if one was provided.
            const databases = agent._context!.databases;
            let targetDb;

            if (databaseHint) {
              // Explicit database specified — match by name or ID
              targetDb = databases.find(
                (d) => d.id === databaseHint || d.name === databaseHint,
              );
            } else {
              // Auto-resolve: find the database containing this table
              targetDb = databases.find((d) =>
                d.tables.some((t) => t.name === name),
              );
            }

            const databaseId = targetDb?.id ?? databases[0]?.id ?? '';
            return agent._executeDbQuery(databaseId, sql);
          },
        });
      },

      // Time helpers work without context
      now: () => Date.now(),
      days: (n: number) => n * 86_400_000,
      hours: (n: number) => n * 3_600_000,
      minutes: (n: number) => n * 60_000,
      ago: (ms: number) => Date.now() - ms,
      fromNow: (ms: number) => Date.now() + ms,
    };
  }

  // -------------------------------------------------------------------------
  // App context
  // -------------------------------------------------------------------------

  /**
   * Get auth and database context for an app.
   *
   * Returns role assignments and managed database schemas. Useful for
   * hydrating `auth` and `db` namespaces when running outside the sandbox.
   *
   * ```ts
   * const ctx = await agent.getAppContext('your-app-id');
   * console.log(ctx.auth.roleAssignments, ctx.databases);
   * ```
   */
  async getAppContext(appId: string): Promise<AppContextResult> {
    const { data } = await request<AppContextResult>(
      this._httpConfig,
      'GET',
      `/helpers/app-context?appId=${encodeURIComponent(appId)}`,
    );
    return data;
  }

  // -------------------------------------------------------------------------
  // Account methods
  // -------------------------------------------------------------------------

  /** Update the display name of the authenticated user/agent. */
  async changeName(displayName: string): Promise<void> {
    await request(this._httpConfig, 'POST', '/account/change-name', {
      name: displayName,
    });
  }

  /** Update the profile picture of the authenticated user/agent. */
  async changeProfilePicture(url: string): Promise<void> {
    await request(this._httpConfig, 'POST', '/account/change-profile-picture', {
      url,
    });
  }

  /**
   * Upload a file to the MindStudio CDN.
   *
   * Gets a signed upload URL, PUTs the file content, and returns the
   * permanent public URL.
   */
  async uploadFile(
    content: Buffer | Uint8Array,
    options: { extension: string; type?: string },
  ): Promise<UploadFileResult> {
    const { data } = await request<{ uploadUrl: string; url: string }>(
      this._httpConfig,
      'POST',
      '/account/upload',
      {
        extension: options.extension,
        ...(options.type != null && { type: options.type }),
      },
    );
    const buf = content.buffer.slice(
      content.byteOffset,
      content.byteOffset + content.byteLength,
    ) as ArrayBuffer;
    const res = await fetch(data.uploadUrl, {
      method: 'PUT',
      body: buf,
      headers: options.type ? { 'Content-Type': options.type } : {},
    });
    if (!res.ok) {
      throw new MindStudioError(
        `Upload failed: ${res.status} ${res.statusText}`,
        'upload_error',
        res.status,
      );
    }
    return { url: data.url };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Attach generated step methods to the prototype
import { applyStepMethods } from './generated/steps.js';
applyStepMethods(MindStudioAgent);

function resolveToken(
  provided?: string,
  config?: MindStudioConfig,
): {
  token: string;
  authType: AuthType;
} {
  if (provided) return { token: provided, authType: 'apiKey' };
  if (process.env.MINDSTUDIO_API_KEY)
    return { token: process.env.MINDSTUDIO_API_KEY, authType: 'apiKey' };
  if (config?.apiKey)
    return { token: config.apiKey, authType: 'apiKey' };
  if (process.env.CALLBACK_TOKEN)
    return { token: process.env.CALLBACK_TOKEN, authType: 'internal' };
  throw new MindStudioError(
    'No API key provided. Run `mindstudio login`, pass `apiKey` to the ' +
      'constructor, or set the MINDSTUDIO_API_KEY environment variable.',
    'missing_api_key',
    401,
  );
}
