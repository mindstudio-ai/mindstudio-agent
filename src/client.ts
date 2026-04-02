import { request, type HttpClientConfig } from './http.js';
import { MindStudioError } from './errors.js';
import { RateLimiter, type AuthType } from './rate-limit.js';
import { loadConfig, type MindStudioConfig } from './config.js';
import { AuthContext } from './auth/index.js';
import { createDb, Table, type Db, type DefineTableOptions, type TableConfig } from './db/index.js';
import type {
  AgentOptions,
  StepExecutionOptions,
  StepExecutionResult,
  StepLogEvent,
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
  ResolvedUser,
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
export class MindStudioAgent {
  /** @internal */
  readonly _httpConfig: HttpClientConfig;
  /** @internal */
  private _reuseThreadId: boolean;
  /** @internal */
  private _threadId: string | undefined;

  /** @internal Stream ID for SSE token streaming. Set by sandbox via STREAM_ID env var. */
  private _streamId: string | undefined;

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

  /**
   * @internal Resolve the current auth token. For internal (CALLBACK_TOKEN)
   * auth, re-reads the env var each time so that long-lived singleton
   * instances pick up token rotations from the host process.
   */
  private get _token(): string {
    if (this._authType === 'internal' && process.env.CALLBACK_TOKEN) {
      return process.env.CALLBACK_TOKEN;
    }
    return this._httpConfig.token;
  }

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

    this._streamId = process.env.STREAM_ID ?? undefined;
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
    // Streaming path — when onLog is set, use SSE to get real-time debug logs
    if (options?.onLog) {
      return this._executeStepStreaming<TOutput>(
        stepType,
        step,
        options as StepExecutionOptions & { onLog: (event: StepLogEvent) => void },
      );
    }

    const threadId =
      options?.threadId ?? (this._reuseThreadId ? this._threadId : undefined);

    const { data, headers } = await request<{
      output?: TOutput;
      outputUrl?: string;
    }>(this._httpConfig, 'POST', `/steps/${stepType}/execute`, {
      step,
      ...(options?.appId != null && { appId: options.appId }),
      ...(threadId != null && { threadId }),
      ...(this._streamId != null && { streamId: this._streamId }),
    });

    let output: TOutput;
    if (data.output != null) {
      output = data.output;
    } else if (data.outputUrl) {
      const res = await fetch(data.outputUrl);
      if (!res.ok) {
        throw new MindStudioError(
          `Failed to fetch ${stepType} output from S3: ${res.status} ${res.statusText}`,
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
   * @internal Streaming step execution — sends `Accept: text/event-stream`
   * and parses SSE events for real-time debug logs.
   */
  private async _executeStepStreaming<TOutput = unknown>(
    stepType: string,
    step: Record<string, unknown>,
    options: StepExecutionOptions & { onLog: (event: StepLogEvent) => void },
  ): Promise<StepExecutionResult<TOutput>> {
    const threadId =
      options.threadId ?? (this._reuseThreadId ? this._threadId : undefined);

    const url = `${this._httpConfig.baseUrl}/developer/v2/steps/${stepType}/execute`;
    const body = {
      step,
      ...(options.appId != null && { appId: options.appId }),
      ...(threadId != null && { threadId }),
      ...(this._streamId != null && { streamId: this._streamId }),
    };

    await this._httpConfig.rateLimiter.acquire();

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this._token}`,
          'Content-Type': 'application/json',
          'User-Agent': '@mindstudio-ai/agent',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      this._httpConfig.rateLimiter.release();
      throw err;
    }

    this._httpConfig.rateLimiter.updateFromHeaders(res.headers);

    if (!res.ok) {
      this._httpConfig.rateLimiter.release();
      let message = `${res.status} ${res.statusText}`;
      let code = 'api_error';
      let details: unknown;
      try {
        const text = await res.text();
        try {
          const body = JSON.parse(text) as Record<string, unknown>;
          details = body;
          const errMsg =
            (typeof body.error === 'string' ? body.error : undefined) ??
            (typeof body.message === 'string' ? body.message : undefined) ??
            (typeof body.details === 'string' ? body.details : undefined);
          if (errMsg) message = errMsg;
          else if (body.error || body.message || body.details) {
            message = JSON.stringify(body.error ?? body.message ?? body.details);
          }
          if (body.code) code = body.code as string;
        } catch {
          const stripped = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
          if (stripped) message = stripped.slice(0, 200);
        }
      } catch {}
      throw new MindStudioError(`[${stepType}] ${message}`, code, res.status, details);
    }

    // Capture headers from the initial response (same as non-streaming path)
    const headers = res.headers;

    try {
      // Parse SSE stream
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let doneEvent: {
        output?: TOutput;
        outputUrl?: string;
        billingCost?: number;
        billingEvents?: Array<Record<string, unknown>>;
      } | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6)) as Record<string, unknown>;

            if (event.type === 'log') {
              options.onLog({
                value: event.value as string,
                tag: event.tag as string,
                ts: event.ts as number,
              });
            } else if (event.type === 'done') {
              doneEvent = {
                output: event.output as TOutput | undefined,
                outputUrl: event.outputUrl as string | undefined,
                billingCost: event.billingCost as number | undefined,
                billingEvents: event.billingEvents as
                  | Array<Record<string, unknown>>
                  | undefined,
              };
            } else if (event.type === 'error') {
              throw new MindStudioError(
                `[${stepType}] ${(event.error as string) || 'Step execution failed'}`,
                'step_error',
                500,
              );
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
          const event = JSON.parse(buffer.slice(6)) as Record<string, unknown>;
          if (event.type === 'done') {
            doneEvent = {
              output: event.output as TOutput | undefined,
              outputUrl: event.outputUrl as string | undefined,
              billingCost: event.billingCost as number | undefined,
              billingEvents: event.billingEvents as
                | Array<Record<string, unknown>>
                | undefined,
            };
          } else if (event.type === 'error') {
            throw new MindStudioError(
              (event.error as string) || 'Step execution failed',
              'step_error',
              500,
            );
          } else if (event.type === 'log') {
            options.onLog({
              value: event.value as string,
              tag: event.tag as string,
              ts: event.ts as number,
            });
          }
        } catch (err) {
          if (err instanceof MindStudioError) throw err;
        }
      }

      if (!doneEvent) {
        throw new MindStudioError(
          `[${stepType}] Stream ended unexpectedly without completing. The step execution may have been interrupted.`,
          'stream_error',
          500,
        );
      }

      // Resolve output — same logic as non-streaming path
      let output: TOutput;
      if (doneEvent.output != null) {
        output = doneEvent.output;
      } else if (doneEvent.outputUrl) {
        const s3Res = await fetch(doneEvent.outputUrl);
        if (!s3Res.ok) {
          throw new MindStudioError(
            `Failed to fetch ${stepType} output from S3: ${s3Res.status} ${s3Res.statusText}`,
            'output_fetch_error',
            s3Res.status,
          );
        }
        const envelope = (await s3Res.json()) as { value: TOutput };
        output = envelope.value;
      } else {
        output = undefined as TOutput;
      }

      // Process headers — same as non-streaming path
      const returnedThreadId =
        headers.get('x-mindstudio-thread-id') ?? '';
      if (this._reuseThreadId && returnedThreadId) {
        this._threadId = returnedThreadId;
      }

      const returnedAppId = headers.get('x-mindstudio-app-id');
      if (!this._appId && returnedAppId) {
        this._appId = returnedAppId;
      }

      const remaining = headers.get('x-ratelimit-remaining');

      return {
        ...(output as object),
        $appId: headers.get('x-mindstudio-app-id') ?? '',
        $threadId: returnedThreadId,
        $rateLimitRemaining:
          remaining != null ? parseInt(remaining, 10) : undefined,
        $billingCost: doneEvent.billingCost,
        $billingEvents: doneEvent.billingEvents,
      } as StepExecutionResult<TOutput>;
    } finally {
      this._httpConfig.rateLimiter.release();
    }
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
      steps: steps.map((s) => ({ ...s, stepType: resolveStepType(s.stepType) })),
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
        const errorBody = await res.json().catch(() => ({}));
        throw new MindStudioError(
          (errorBody as Record<string, string>).message ??
            (errorBody as Record<string, string>).error ??
            `Poll request failed: ${res.status} ${res.statusText}`,
          (errorBody as Record<string, string>).code ?? 'poll_error',
          res.status,
          errorBody,
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
      step: { type: resolveStepType(stepType), ...step },
      ...options,
    });
    return data;
  }

  // -------------------------------------------------------------------------
  // Streaming
  // -------------------------------------------------------------------------

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
  stream = async (data: string | Record<string, unknown>): Promise<void> => {
    if (!this._streamId) return;

    const url = `${this._httpConfig.baseUrl}/_internal/v2/stream-chunk`;

    const body =
      typeof data === 'string'
        ? { streamId: this._streamId, type: 'token', text: data }
        : { streamId: this._streamId, type: 'data', data };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this._token,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      // Best-effort — don't throw on stream failures, just warn
      const text = await res.text().catch(() => '');
      console.warn(`[mindstudio] stream chunk failed: ${res.status} ${text}`);
    }
  };

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
    // In sandbox mode, re-read globalThis.ai.auth on every access so that
    // persistent workers pick up fresh identity on each method invocation.
    // The platform sets globalThis.ai before each call.
    if (this._authType === 'internal') {
      const ai = (globalThis as Record<string, unknown>).ai as
        | { auth?: AppContextResult['auth'] }
        | undefined;
      if (ai?.auth) {
        return new AuthContext(ai.auth);
      }
    }

    if (!this._auth) {
      // Try sandbox hydration lazily — global.ai may have been set after
      // the constructor ran (e.g. ESM imports hoist before inline code)
      this._trySandboxHydration();
    }
    if (!this._auth) {
      throw new MindStudioError(
        'Auth context not loaded. Call `await agent.ensureContext()` first, or perform any db operation (which auto-loads context).',
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
    if (!this._db) {
      // Try sandbox hydration lazily — global.ai may have been set after
      // the constructor ran (e.g. ESM imports hoist before inline code)
      this._trySandboxHydration();
    }
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
   * In managed mode (CALLBACK_TOKEN), the platform resolves the app from
   * the token — no appId needed. With an API key, appId is required.
   */
  private async _hydrateContext(): Promise<void> {
    if (!this._appId && this._authType !== 'internal') {
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
      this._executeDbBatch.bind(this),
      context.authConfig,
      this._syncRoles.bind(this),
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
      | {
          auth?: AppContextResult['auth'];
          databases?: AppContextResult['databases'];
          authConfig?: AppContextResult['authConfig'];
        }
      | undefined;

    if (ai?.auth && ai?.databases) {
      this._applyContext({
        auth: ai.auth,
        databases: ai.databases,
        authConfig: ai.authConfig,
      });
    }
  }

  /**
   * @internal Execute a batch of SQL queries against a managed database.
   * Used as the `executeBatch` callback for Table/Query instances.
   *
   * Calls `POST /_internal/v2/db/query` directly with the hook token
   * (raw, no Bearer prefix). All queries run on a single SQLite connection,
   * enabling RETURNING clauses and multi-statement batches.
   */
  private async _executeDbBatch(
    databaseId: string,
    queries: { sql: string; params?: unknown[] }[],
  ): Promise<{ rows: unknown[]; changes: number }[]> {
    const url = `${this._httpConfig.baseUrl}/_internal/v2/db/query`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this._token,
      },
      body: JSON.stringify({ databaseId, queries }),
    });

    if (!res.ok) {
      let message = `Database query failed: ${res.status} ${res.statusText}`;
      let code = 'db_query_error';

      try {
        const text = await res.text();
        try {
          // Try parsing as JSON — API may return { error, code, message, details }
          const body = JSON.parse(text) as Record<string, unknown>;
          // Accept various error shapes the API might use
          const errMsg =
            (typeof body.error === 'string' ? body.error : undefined) ??
            (typeof body.message === 'string' ? body.message : undefined) ??
            (typeof body.details === 'string' ? body.details : undefined);
          if (errMsg) message = errMsg;
          else if (body.error || body.message || body.details) {
            message = JSON.stringify(body.error ?? body.message ?? body.details);
          }
          if (body.code) code = body.code as string;
        } catch {
          // Not JSON — use raw text if it's informative
          if (text && text.length < 500) message = text;
        }
      } catch {
        // Couldn't read response body at all
      }

      throw new MindStudioError(
        `[db] ${message}`,
        code,
        res.status,
      );
    }

    const data = (await res.json()) as {
      results: { rows: unknown[]; changes: number }[];
    };
    return data.results;
  }

  /**
   * @internal Sync a user's roles to the platform after a successful
   * auth table write. Calls POST /_internal/v2/auth/sync-user.
   * Fire-and-forget: errors are caught and logged, never propagated.
   */
  private async _syncRoles(userId: string, roles: unknown): Promise<void> {
    try {
      const url = `${this._httpConfig.baseUrl}/_internal/v2/auth/sync-user`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: this._token,
        },
        body: JSON.stringify({
          appId: this._appId,
          userId,
          roles,
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.warn(
          `[mindstudio] Role sync failed for user ${userId} (${res.status}${text ? ': ' + text.slice(0, 100) : ''}). ` +
            'Roles were saved to the database but may not be reflected in auth.hasRole() until the next successful write.',
        );
      }
    } catch (err) {
      console.warn(
        `[mindstudio] Role sync failed for user ${userId}: network error. ` +
          'Roles were saved to the database but may not be reflected in auth.hasRole() until the next successful write.',
      );
    }
  }

  /**
   * @internal Create a lazy Db proxy that auto-hydrates context.
   *
   * defineTable() returns Table instances immediately (no async needed).
   * But the Table's executeBatch callback is wrapped to call ensureContext()
   * before the first query, so context is fetched lazily.
   */
  private _createLazyDb(): Db {
    const agent = this;

    return {
      defineTable<T>(name: string, options?: DefineTableOptions) {
        // Lazy table — context hasn't been fetched yet, so executeBatch
        // calls ensureContext() first, then delegates to the real endpoint.
        const databaseHint = options?.database;

        const tableConfig: TableConfig = {
          databaseId: '',
          tableName: name,
          columns: [],
          unique: options?.unique as string[][] | undefined,
          defaults: options?.defaults as Record<string, unknown> | undefined,
          executeBatch: async (queries) => {
            await agent.ensureContext();

            // Retroactively set managed columns + role sync once context is available
            const ac = agent._context!.authConfig;
            if (ac && ac.table === name && !tableConfig.managedColumns) {
              tableConfig.managedColumns = ac.columns;
              if (ac.columns.roles) {
                tableConfig.syncRoles = agent._syncRoles.bind(agent);
              }
            }

            const databases = agent._context!.databases;
            let targetDb;

            if (databaseHint) {
              targetDb = databases.find(
                (d) => d.id === databaseHint || d.name === databaseHint,
              );
            } else {
              targetDb = databases.find((d) =>
                d.tables.some((t) => t.name === name),
              );
            }

            const databaseId = targetDb?.id ?? databases[0]?.id ?? '';
            return agent._executeDbBatch(databaseId, queries);
          },
        };

        return new Table<T>(tableConfig);
      },

      // Time helpers work without context
      now: () => Date.now(),
      days: (n: number) => n * 86_400_000,
      hours: (n: number) => n * 3_600_000,
      minutes: (n: number) => n * 60_000,
      ago: (ms: number) => Date.now() - ms,
      fromNow: (ms: number) => Date.now() + ms,

      // Batch needs context — hydrate first, then delegate to real db
      batch: ((...queries: PromiseLike<unknown>[]) => {
        return (async () => {
          await agent.ensureContext();
          return agent._db!.batch(...queries);
        })();
      }) as Db['batch'],
    };
  }

  // -------------------------------------------------------------------------
  // Helper methods — user resolution
  // -------------------------------------------------------------------------

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
  async resolveUser(userId: string): Promise<ResolvedUser | null> {
    const { users } = await this.resolveUsers([userId]);
    return users[0] ?? null;
  }

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
  async resolveUsers(
    userIds: string[],
  ): Promise<{ users: ResolvedUser[] }> {
    const { data } = await request<{ users: ResolvedUser[] }>(
      this._httpConfig,
      'POST',
      '/helpers/resolve-users',
      { userIds },
    );
    return data;
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
   * When called with a CALLBACK_TOKEN (managed mode), `appId` is optional —
   * the platform resolves the app from the token. With an API key, `appId`
   * is required.
   *
   * ```ts
   * const ctx = await agent.getAppContext('your-app-id');
   * console.log(ctx.auth.roleAssignments, ctx.databases);
   * ```
   */
  async getAppContext(appId?: string): Promise<AppContextResult> {
    const query = appId ? `?appId=${encodeURIComponent(appId)}` : '';
    const { data } = await request<AppContextResult>(
      this._httpConfig,
      'GET',
      `/helpers/app-context${query}`,
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
      const errorBody = await res.json().catch(() => ({}));
      throw new MindStudioError(
        (errorBody as Record<string, string>).message ??
          (errorBody as Record<string, string>).error ??
          `Upload failed: ${res.status} ${res.statusText}`,
        (errorBody as Record<string, string>).code ?? 'upload_error',
        res.status,
        errorBody,
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
import { stepMetadata } from './generated/metadata.js';
applyStepMethods(MindStudioAgent);

/** Resolve a public method name (which may be an alias) to the real API step type. */
function resolveStepType(name: string): string {
  const meta = (stepMetadata as Record<string, { stepType: string }>)[name];
  return meta ? meta.stepType : name;
}

function resolveToken(
  provided?: string,
  config?: MindStudioConfig,
): {
  token: string;
  authType: AuthType;
} {
  // CALLBACK_TOKEN takes priority — when running inside the MindStudio
  // sandbox, the hook token must be used regardless of other auth sources.
  if (process.env.CALLBACK_TOKEN)
    return { token: process.env.CALLBACK_TOKEN, authType: 'internal' };
  if (provided) return { token: provided, authType: 'apiKey' };
  if (process.env.MINDSTUDIO_API_KEY)
    return { token: process.env.MINDSTUDIO_API_KEY, authType: 'apiKey' };
  if (config?.apiKey)
    return { token: config.apiKey, authType: 'apiKey' };
  throw new MindStudioError(
    'No API key provided. Run `mindstudio login`, pass `apiKey` to the ' +
      'constructor, or set the MINDSTUDIO_API_KEY environment variable.',
    'missing_api_key',
    401,
  );
}
