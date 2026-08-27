import { request, type HttpClientConfig } from './http.js';
import { MindStudioError } from './errors.js';
import { getRequestContext } from './context.js';
import {
  executeDbBatchOverWs,
  DbWsTransportError,
  isReadOnlySql,
} from './db-ws.js';
import { RateLimiter, type AuthType } from './rate-limit.js';
import { loadConfig, type MindStudioConfig } from './config.js';
import { AuthContext } from './auth/index.js';
import {
  createDb,
  Table,
  RawQuery,
  validateRawSql,
  resolveDatabase,
  type Batchable,
  type Db,
  type DefineTableOptions,
  type TableConfig,
} from './db/index.js';
import { serializeParam } from './db/sql.js';
import { createFiles, type Files } from './files/index.js';
import type { Store } from './files/store.js';
import type {
  JewelsApi,
  JewelProposeResult,
  JewelQueueItem,
  JewelQueueResolveResult,
} from './jewel/index.js';
import { createDataSources, type DataSources } from './datasources/index.js';
import { createVoice, type Voice } from './voice/index.js';
import { createAnalytics, type Analytics } from './analytics/index.js';
import {
  buildTaskRequestBody,
  runTaskPoll,
  runTaskStream,
  type RunTaskOptions,
  type RunTaskOptionsWithExample,
  type RunTaskOptionsWithSchema,
  type RunTaskResult,
} from './task/index.js';
import { runTaskLocal, TURN_UNAVAILABLE_CODE } from './task/local.js';
import {
  validateAgainstSchema,
  type JsonObjectSchema,
  type FromSchema,
} from './task/schema.js';
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
  ReportIssueInput,
  ReportedIssue,
  AppContextResult,
  BatchStepInput,
  BatchStepResult,
  ExecuteStepBatchOptions,
  ExecuteStepBatchResult,
  PackagedWorkflow,
} from './types.js';

const DEFAULT_BASE_URL = 'https://v1.mindstudio-api.com';
const DEFAULT_MAX_RETRIES = 3;

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

  /** @internal Cached Files namespace instance (lazy; no context hydration needed). */
  private _files: Files | undefined;
  private _dataSources: DataSources | undefined;
  private _voice: Voice | undefined;
  private _analytics: Analytics | undefined;

  /** @internal Auth type — 'internal' for CALLBACK_TOKEN (managed mode), 'apiKey' otherwise. */
  private _authType: AuthType;

  /** @internal Usage source sent on step executions (from MINDSTUDIO_REQUEST_SOURCE).
   *  Only set for api-key (CLI) auth so in-app/managed runtime is unaffected. */
  private _requestSource: string | undefined;

  /**
   * @internal Resolve the current auth token. Checks ALS request context
   * first, then CALLBACK_TOKEN env var, then static config token.
   */
  private get _token(): string {
    const rctx = getRequestContext();
    if (rctx?.callbackToken) return rctx.callbackToken;
    if (this._authType === 'internal' && process.env.CALLBACK_TOKEN) {
      return process.env.CALLBACK_TOKEN;
    }
    return this._httpConfig.token;
  }

  /**
   * @internal HTTP config with ALS-aware baseUrl and token resolution.
   * Used instead of `_httpConfig` at all `request()` call sites.
   */
  private get _currentHttpConfig(): HttpClientConfig {
    const rctx = getRequestContext();
    if (rctx?.remoteHostname) {
      return {
        ...this._httpConfig,
        baseUrl: rctx.remoteHostname,
        token: this._token,
      };
    }
    return this._httpConfig;
  }

  /**
   * @internal Stream ID with ALS-aware resolution.
   */
  private get _currentStreamId(): string | undefined {
    return getRequestContext()?.streamId ?? this._streamId;
  }

  /**
   * @internal Get resolved app context from ALS or instance cache.
   */
  private _getContext(): AppContextResult | undefined {
    const rctx = getRequestContext();
    if (rctx?.auth && rctx?.databases) {
      return {
        auth: rctx.auth,
        databases: rctx.databases,
        authConfig: rctx.authConfig,
      };
    }
    return this._context;
  }

  constructor(options: AgentOptions = {}) {
    const config = loadConfig();
    const { token, authType } = resolveToken(options.apiKey, config);
    const rctx = getRequestContext();
    const baseUrl =
      options.baseUrl ??
      rctx?.remoteHostname ??
      process.env.MINDSTUDIO_BASE_URL ??
      process.env.REMOTE_HOSTNAME ??
      config.baseUrl ??
      DEFAULT_BASE_URL;

    this._reuseThreadId =
      options.reuseThreadId ??
      /^(true|1)$/i.test(process.env.MINDSTUDIO_REUSE_THREAD_ID ?? '');

    this._appId = options.appId ?? process.env.MINDSTUDIO_APP_ID ?? undefined;

    this._authType = authType;

    // Build-time attribution: the Remy builder sandbox sets
    // MINDSTUDIO_REQUEST_SOURCE=v2-agent-build. Only honor it for api-key (CLI)
    // auth so in-app/managed runtime (internal auth) keeps its own source.
    this._requestSource =
      authType === 'apiKey'
        ? process.env.MINDSTUDIO_REQUEST_SOURCE || undefined
        : undefined;

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
        options as StepExecutionOptions & {
          onLog: (event: StepLogEvent) => void;
        },
      );
    }

    const threadId =
      options?.threadId ??
      (this._reuseThreadId && !getRequestContext()
        ? this._threadId
        : undefined);

    // 1. POST to async endpoint — returns immediately with a poll token
    const { data: asyncData, headers } = await request<{
      executionToken: string;
      appId?: string;
      threadId?: string;
    }>(this._currentHttpConfig, 'POST', `/steps/${stepType}/execute-async`, {
      step,
      ...(options?.appId != null && { appId: options.appId }),
      ...(threadId != null && { threadId }),
      ...(this._currentStreamId != null && { streamId: this._currentStreamId }),
      ...((options?.requestSource ?? this._requestSource) != null && {
        requestSource: options?.requestSource ?? this._requestSource,
      }),
      ...assetStoreBody(options?.store),
    });

    // Capture rate limit from initial POST headers
    const remaining = headers.get('x-ratelimit-remaining');

    // Thread reuse + appId capture from initial response
    const returnedThreadId = asyncData.threadId ?? '';
    if (this._reuseThreadId && returnedThreadId && !getRequestContext()) {
      this._threadId = returnedThreadId;
    }
    if (!this._appId && asyncData.appId && !getRequestContext()) {
      this._appId = asyncData.appId;
    }

    // 2. Poll with backoff until complete
    const pollUrl = `${this._currentHttpConfig.baseUrl}/developer/v2/steps/${stepType}/execute-async/poll/${asyncData.executionToken}`;
    let pollDelay = 100;

    while (true) {
      await sleep(pollDelay);
      pollDelay = Math.min(pollDelay * 2, 5000);

      const res = await fetch(pollUrl, {
        headers: { 'User-Agent': '@mindstudio-ai/agent' },
      });

      // Retry silently on transient server errors
      if (res.status === 502 || res.status === 503 || res.status === 504)
        continue;

      if (res.status === 404) {
        throw new MindStudioError(
          `[${stepType}] Execution token expired.`,
          'poll_token_expired',
          404,
        );
      }

      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}));
        throw new MindStudioError(
          (errorBody as Record<string, string>).message ??
            (errorBody as Record<string, string>).error ??
            `[${stepType}] Poll failed: ${res.status} ${res.statusText}`,
          (errorBody as Record<string, string>).code ?? 'poll_error',
          res.status,
          errorBody,
        );
      }

      const poll = (await res.json()) as {
        status: 'pending' | 'complete' | 'error';
        output?: TOutput;
        outputUrl?: string;
        billingCost?: number;
        billingEvents?: Array<Record<string, unknown>>;
        appId?: string;
        threadId?: string;
        error?: string;
      };

      if (poll.status === 'pending') continue;

      if (poll.status === 'error') {
        throw new MindStudioError(
          `[${stepType}] ${poll.error ?? 'Step execution failed.'}`,
          'step_error',
          500,
        );
      }

      // 3. Resolve output — same S3 logic as before
      let output: TOutput;
      if (poll.output != null) {
        output = poll.output;
      } else if (poll.outputUrl) {
        const s3Res = await fetch(poll.outputUrl);
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

      // 4. Build result — same shape as before
      return {
        ...(output as object),
        $appId: poll.appId ?? asyncData.appId ?? '',
        $threadId: poll.threadId ?? returnedThreadId,
        $rateLimitRemaining:
          remaining != null ? parseInt(remaining, 10) : undefined,
        $billingCost: poll.billingCost,
        $billingEvents: poll.billingEvents,
      } as StepExecutionResult<TOutput>;
    }
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
      options.threadId ??
      (this._reuseThreadId && !getRequestContext()
        ? this._threadId
        : undefined);

    const url = `${this._currentHttpConfig.baseUrl}/developer/v2/steps/${stepType}/execute`;
    const body = {
      step,
      ...(options.appId != null && { appId: options.appId }),
      ...(threadId != null && { threadId }),
      ...(this._currentStreamId != null && { streamId: this._currentStreamId }),
      ...((options.requestSource ?? this._requestSource) != null && {
        requestSource: options.requestSource ?? this._requestSource,
      }),
      ...assetStoreBody(options.store),
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
            message = JSON.stringify(
              body.error ?? body.message ?? body.details,
            );
          }
          if (body.code) code = body.code as string;
        } catch {
          const stripped = text
            .replace(/<[^>]*>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          if (stripped) message = stripped.slice(0, 200);
        }
      } catch {}
      throw new MindStudioError(
        `[${stepType}] ${message}`,
        code,
        res.status,
        details,
      );
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
      const returnedThreadId = headers.get('x-mindstudio-thread-id') ?? '';
      if (this._reuseThreadId && returnedThreadId && !getRequestContext()) {
        this._threadId = returnedThreadId;
      }

      const returnedAppId = headers.get('x-mindstudio-app-id');
      if (!this._appId && returnedAppId && !getRequestContext()) {
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
      options?.threadId ??
      (this._reuseThreadId && !getRequestContext()
        ? this._threadId
        : undefined);

    // 1. POST to async endpoint — returns immediately with a poll token
    const { data: asyncData } = await request<{
      batchToken: string;
      threadId?: string;
    }>(this._currentHttpConfig, 'POST', '/steps/execute-batch-async', {
      steps: steps.map((s) => ({
        ...s,
        stepType: resolveStepType(s.stepType),
      })),
      ...(options?.appId != null && { appId: options.appId }),
      ...(threadId != null && { threadId }),
      ...(this._requestSource != null && {
        requestSource: this._requestSource,
      }),
      ...assetStoreBody(options?.store),
    });

    const pollUrl = `${this._currentHttpConfig.baseUrl}/developer/v2/steps/execute-batch-async/poll/${asyncData.batchToken}`;

    // 2. Poll with backoff until complete
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
          'Batch poll token not found or expired.',
          'poll_token_expired',
          404,
        );
      }

      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}));
        throw new MindStudioError(
          (errorBody as Record<string, string>).message ??
            (errorBody as Record<string, string>).error ??
            `Batch poll failed: ${res.status} ${res.statusText}`,
          (errorBody as Record<string, string>).code ?? 'poll_error',
          res.status,
          errorBody,
        );
      }

      const poll = (await res.json()) as {
        status: 'pending' | 'complete' | 'error';
        totalSteps?: number;
        completedSteps?: number;
        results?: Array<{
          stepType: string;
          output?: Record<string, unknown>;
          outputUrl?: string;
          billingCost?: number;
          error?: string;
        }>;
        totalBillingCost?: number;
        appId?: string;
        threadId?: string;
        error?: string;
      };

      if (poll.status === 'pending') {
        if (
          options?.onProgress &&
          poll.totalSteps != null &&
          poll.completedSteps != null
        ) {
          options.onProgress(poll.completedSteps, poll.totalSteps);
        }
        continue;
      }

      if (poll.status === 'error') {
        throw new MindStudioError(
          poll.error ?? 'Batch execution failed.',
          'batch_execution_error',
          500,
        );
      }

      // 3. Resolve S3 outputs in parallel
      const results: BatchStepResult[] = await Promise.all(
        poll.results!.map(async (r) => {
          if (r.output != null) {
            return {
              stepType: r.stepType,
              output: r.output,
              billingCost: r.billingCost,
              error: r.error,
            };
          }
          if (r.outputUrl) {
            const s3Res = await fetch(r.outputUrl);
            if (!s3Res.ok) {
              return {
                stepType: r.stepType,
                error: `Failed to fetch output from S3: ${s3Res.status} ${s3Res.statusText}`,
              };
            }
            const envelope = (await s3Res.json()) as {
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

      // 4. Thread reuse
      const resultThreadId = poll.threadId ?? asyncData.threadId;
      if (this._reuseThreadId && resultThreadId && !getRequestContext()) {
        this._threadId = resultThreadId;
      }

      return {
        results,
        totalBillingCost: poll.totalBillingCost,
        appId: poll.appId,
        threadId: resultThreadId,
      };
    }
  }

  /**
   * Run a task agent — a multi-step tool-use loop that composes SDK actions
   * to produce structured output. The model receives the prompt and tools,
   * calls actions as needed, and returns structured JSON.
   *
   * Tools can be SDK actions, your own app's methods, and/or inline functions
   * defined right in your code, in any combination. App methods run as the
   * user who invoked the method that started the task, with their roles.
   * Function tools run in this process — a thrown error is fed back to the
   * model as tool output, and there are no `defaults` (close over what you
   * need instead).
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
   *     {
   *       name: 'checkExisting',
   *       description: 'Look up whether we already track this restaurant.',
   *       inputSchema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
   *       execute: async (input) => Restaurants.findByName(String(input.name)),
   *     },
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
  async runTask<const S extends JsonObjectSchema>(
    options: RunTaskOptionsWithSchema<S>,
  ): Promise<RunTaskResult<FromSchema<S>>>;
  async runTask<T = unknown>(
    options: RunTaskOptionsWithExample,
  ): Promise<RunTaskResult<T>>;
  async runTask(options: RunTaskOptions): Promise<RunTaskResult<unknown>> {
    // Register the whole task with the platform's background-work hook (when
    // present): a fire-and-forget task keeps its sandbox alive for the loop's
    // duration and gets an interruption annotation if the pod is torn down.
    // Awaited callers are unaffected — the registration settles with the
    // task. The hook gets a silenced branch so the caller's promise keeps its
    // real rejection.
    const taskPromise = this._runTaskInner(options);
    const hook = (globalThis as Record<string, unknown>).__msWaitUntil;
    if (typeof hook === 'function') {
      try {
        hook(taskPromise.catch(() => {}));
      } catch {}
    }
    return taskPromise;
  }

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
  waitUntil(promise: Promise<unknown>): void {
    // Attaching this catch also marks the caller's promise as handled, so an
    // unhandled rejection can never escape background work registered here.
    const caught = Promise.resolve(promise).catch((err) => {
      console.error(
        '[waitUntil] Background work failed:',
        err instanceof Error ? (err.stack ?? err.message) : String(err),
      );
    });
    const hook = (globalThis as Record<string, unknown>).__msWaitUntil;
    if (typeof hook === 'function') {
      try {
        hook(caught);
      } catch {
        // Never let a broken host hook affect the caller.
      }
    }
  }

  private async _runTaskInner<T = unknown>(
    options: RunTaskOptions,
  ): Promise<RunTaskResult<T>> {
    // The loop runs here, in the caller's process, with the API as a per-turn
    // transport — that's what lets tasks survive platform deploys (see
    // src/task/local.ts). Tool dispatch closes over `this` so step tools get
    // the full executeStep treatment (S3 output resolution, thread handling).
    const httpConfig = this._currentHttpConfig;
    try {
      return await runTaskLocal<T>(
        {
          httpConfig,
          executeStepTool: async (stepType, input) => {
            try {
              const result = await this.executeStep(stepType, input, {
                requestSource: 'v2-task',
              });
              // Un-flatten: the model wants the step's output object, not the
              // SDK's $-prefixed execution metadata.
              const output: Record<string, unknown> = {};
              let billingCost = 0;
              for (const [key, value] of Object.entries(
                result as unknown as Record<string, unknown>,
              )) {
                if (key === '$billingCost' && typeof value === 'number') {
                  billingCost = value;
                }
                if (!key.startsWith('$')) {
                  output[key] = value;
                }
              }
              return { output, billingCost, isError: false };
            } catch (err) {
              return {
                output: {
                  error:
                    err instanceof Error
                      ? err.message
                      : 'Step execution failed',
                },
                billingCost: 0,
                isError: true,
              };
            }
          },
          executeMethodTool: async (methodId, input) => {
            try {
              // maxRetries: 0 — method executions have side effects, so a
              // transport-level retry could run the method twice. Failures go
              // back to the model, which decides whether to try again.
              const { data } = await request<{
                output?: unknown;
                error?: string;
              }>(
                { ...httpConfig, maxRetries: 0 },
                'POST',
                '/task/invoke-method',
                {
                  methodId,
                  input,
                },
              );
              if (data.error) {
                return {
                  output: { error: data.error },
                  billingCost: 0,
                  isError: true,
                };
              }
              return {
                output: data.output ?? null,
                billingCost: 0,
                isError: false,
              };
            } catch (err) {
              return {
                output: {
                  error:
                    err instanceof Error
                      ? err.message
                      : 'Method execution failed',
                },
                billingCost: 0,
                isError: true,
              };
            }
          },
        },
        options,
      );
    } catch (err) {
      // Server predates the turn endpoint (or self-hosted, not yet upgraded) —
      // fall back to the legacy server-side whole-task loop.
      if (
        err instanceof MindStudioError &&
        err.code === TURN_UNAVAILABLE_CODE
      ) {
        // The legacy loop runs server-side and cannot call back into this
        // process — refuse rather than silently drop the function tools.
        if (
          options.tools.some((t) => typeof t === 'object' && 'execute' in t)
        ) {
          throw new MindStudioError(
            '[task] This server does not support the per-turn task endpoint required for function tools.',
            'task_function_tools_unsupported',
            404,
          );
        }
        const body = buildTaskRequestBody(options);
        const result = options.onEvent
          ? await runTaskStream<T>(httpConfig, body, options.onEvent)
          : await runTaskPoll<T>(httpConfig, body);
        if (options.outputSchema) {
          // The legacy server prompts with a synthesized example and can't
          // run repair turns — the schema contract is enforced here instead:
          // one shot, validated client-side, throw on mismatch.
          const errors = result.parsedSuccessfully
            ? validateAgainstSchema(result.output, options.outputSchema)
            : [{ path: '$', message: 'output was not valid JSON' }];
          if (errors.length > 0) {
            throw new MindStudioError(
              '[task] Output did not conform to outputSchema (legacy task route, no repair turns).',
              'task_output_schema_mismatch',
              422,
              {
                outputRaw: result.outputRaw,
                errors,
                turns: result.turns,
                usage: result.usage,
                toolCalls: result.toolCalls,
              },
            );
          }
        }
        return result;
      }
      throw err;
    }
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
      this._currentHttpConfig,
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
      this._currentHttpConfig,
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
    }>(this._currentHttpConfig, 'POST', '/agents/run', {
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
    const pollUrl = `${this._currentHttpConfig.baseUrl}/developer/v2/agents/run/poll/${token}`;

    // Poll until complete or error
    while (true) {
      await sleep(pollInterval);

      const res = await fetch(pollUrl, {
        headers: { 'User-Agent': '@mindstudio-ai/agent' },
      });

      // Retry silently on transient server errors
      if (res.status === 502 || res.status === 503 || res.status === 504)
        continue;

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
    return request<T>(this._currentHttpConfig, method, path, body);
  }

  // -------------------------------------------------------------------------
  // Helper methods — models
  // -------------------------------------------------------------------------

  /** List all available AI models. */
  async listModels(): Promise<{ models: MindStudioModel[] }> {
    const { data } = await request<{ models: MindStudioModel[] }>(
      this._currentHttpConfig,
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
      this._currentHttpConfig,
      'GET',
      `/helpers/models/${modelType}`,
    );
    return data;
  }

  /** List all available AI models (summary). Returns only id, name, type, and tags. */
  async listModelsSummary(): Promise<{ models: MindStudioModelSummary[] }> {
    const { data } = await request<{ models: MindStudioModelSummary[] }>(
      this._currentHttpConfig,
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
      this._currentHttpConfig,
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
      this._currentHttpConfig,
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
      this._currentHttpConfig,
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
      this._currentHttpConfig,
      'GET',
      `/helpers/connectors/${serviceId}/${actionId}`,
    );
    return data;
  }

  /** List OAuth connections for the organization. These are authenticated third-party service links. */
  async listConnections(): Promise<{ connections: Connection[] }> {
    const { data } = await request<{ connections: Connection[] }>(
      this._currentHttpConfig,
      'GET',
      '/helpers/connections',
    );
    return data;
  }

  /** List packaged workflows available to the organization. */
  async listPackagedWorkflows(): Promise<{
    packagedWorkflows: PackagedWorkflow[];
  }> {
    const { data } = await request<{ packagedWorkflows: PackagedWorkflow[] }>(
      this._currentHttpConfig,
      'GET',
      '/helpers/packaged-workflows',
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
    }>(this._currentHttpConfig, 'POST', '/helpers/step-cost-estimate', {
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
    const streamId = this._currentStreamId;
    if (!streamId) return;

    const url = `${this._currentHttpConfig.baseUrl}/_internal/v2/stream-chunk`;

    const body =
      typeof data === 'string'
        ? { streamId, type: 'token', text: data }
        : { streamId, type: 'data', data };

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
    // ALS mode — read from request-scoped context
    const rctx = getRequestContext();
    if (rctx?.auth) {
      return new AuthContext(rctx.auth);
    }

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
    // ALS mode — always use lazy proxy (context comes from request store)
    if (getRequestContext()) {
      return this._createLazyDb();
    }

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
    // ALS mode — context comes from the request store, no fetch needed
    if (this._getContext()) return;

    // Already hydrated on instance — nothing to do
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
    // Skip when running in ALS mode — context comes from the request store
    if (getRequestContext()) return;

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
  get files(): Files {
    return (this._files ??= createFiles(this._filesRequest.bind(this)));
  }

  /**
   * The `analytics` namespace — read the app's own traffic + event analytics
   * (auto-tracked pageviews, `analytics.track()` events). One general
   * `query()` (metrics × dimensions × filters × time) plus `live()`,
   * `sources()`, `map()`, `aiSources()`, `crawlers.*`. See {@link Analytics}
   * for the lifetime-rollup vs 90-day-events split.
   *
   * @example
   * ```ts
   * const top = await agent.analytics.query({
   *   metrics: ['pageviews', 'visitors'],
   *   dimensions: ['path'],
   *   dateRange: 'all',
   * });
   * ```
   */
  get analytics(): Analytics {
    return (this._analytics ??= createAnalytics(
      this._analyticsRequest.bind(this),
    ));
  }

  /**
   * Jewel surfaces: arrival-shaped triggers (`propose`) and the app-native
   * approval queue (`queue.list` / `queue.resolve`). See {@link JewelsApi}.
   */
  get jewels(): JewelsApi {
    return {
      propose: (methodId, subject, opts) => {
        if (!methodId || typeof methodId !== 'string') {
          throw new MindStudioError(
            'methodId is required',
            'missing_method_id',
            400,
          );
        }
        return this._jewelsRequest<JewelProposeResult>('propose', {
          methodId,
          subject,
          ...(opts?.idempotencyKey !== undefined && {
            idempotencyKey: opts.idempotencyKey,
          }),
        });
      },
      queue: {
        list: (opts) =>
          this._jewelsRequest<{ items: JewelQueueItem[] }>('queue/list', {
            ...(opts?.methodId !== undefined && { methodId: opts.methodId }),
            ...(opts?.limit !== undefined && { limit: opts.limit }),
          }),
        resolve: (itemId, opts) =>
          this._jewelsRequest<JewelQueueResolveResult>('queue/resolve', {
            itemId,
            action: opts.action,
            ...(opts.input !== undefined && { input: opts.input }),
          }),
      },
    };
  }

  /**
   * Raw hook-token call shared by the jewels surfaces (mirrors reportIssue).
   * No retries: propose holds the request for the jewel run and is idempotent
   * by key anyway; resolve applies a method and must never double-fire.
   */
  private async _jewelsRequest<T>(
    path: string,
    body: Record<string, unknown>,
  ): Promise<T> {
    // Backend/managed contexts only — the app identity comes from the
    // execution's hook token.
    const rctx = getRequestContext();
    if (this._authType !== 'internal' && !rctx?.callbackToken) {
      throw new MindStudioError(
        `jewels.${path.replace('/', '.')} requires an app execution context (hook token) — it cannot be called with an API key.`,
        'jewels_requires_app_context',
        400,
      );
    }

    const url = `${this._currentHttpConfig.baseUrl}/_internal/v2/jewels/${path}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this._token,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      let code = 'jewels_error';
      let message = `jewels.${path.replace('/', '.')} failed: ${res.status} ${res.statusText}`;
      let details: unknown;
      try {
        const errBody = (await res.json()) as Record<string, unknown>;
        details = errBody;
        if (typeof errBody.errorString === 'string') code = errBody.errorString;
        message =
          (typeof errBody.errorMessage === 'string' && errBody.errorMessage) ||
          (typeof errBody.errorString === 'string' && errBody.errorString) ||
          message;
      } catch {
        // Non-JSON body — keep the defaults.
      }
      throw new MindStudioError(message, code, res.status, details);
    }

    return (await res.json()) as T;
  }

  /**
   * Searchable document corpora.
   *
   * @example
   * ```ts
   * const Policies = agent.dataSources.defineDataSource('policies');
   * const { results } = await Policies.search('what are the payment terms?');
   * ```
   */
  get dataSources(): DataSources {
    return (this._dataSources ??= createDataSources(
      this._dataSourcesRequest.bind(this),
    ));
  }

  /**
   * Telephony: outbound calls answered by this app's voice agent.
   *
   * @example
   * ```ts
   * await agent.voice.call({ to: '+13105551234', assumeIdentity: true });
   * ```
   */
  get voice(): Voice {
    return (this._voice ??= createVoice(this._voiceRequest.bind(this)));
  }

  /**
   * @internal Transport for the `files` namespace — POST /_internal/v2/files/<op>
   * with the raw hook token (mirrors `_executeDbBatch`).
   */
  private async _filesRequest(op: string, body: unknown): Promise<any> {
    return this._brokeredRequest('files', op, body, {
      fallbackMessage: 'File operation failed',
      fallbackCode: 'file_error',
    });
  }

  /**
   * @internal Transport for the `dataSources` namespace —
   * POST /_internal/v2/datasources/<op> with the raw hook token.
   */
  private async _dataSourcesRequest(op: string, body: unknown): Promise<any> {
    return this._brokeredRequest('datasources', op, body, {
      fallbackMessage: 'Data source operation failed',
      fallbackCode: 'data_source_error',
    });
  }

  /**
   * @internal Transport for the `voice` namespace —
   * POST /_internal/v2/voice/<op> with the raw hook token.
   */
  private async _voiceRequest(op: string, body: unknown): Promise<any> {
    return this._brokeredRequest('voice', op, body, {
      fallbackMessage: 'Voice operation failed',
      fallbackCode: 'voice_error',
    });
  }

  /**
   * @internal Transport for the `analytics` namespace —
   * POST /_internal/v2/analytics/<op> with the raw hook token.
   *
   * Retries a single 429 after a short jittered backoff: analytics reads are
   * idempotent and a 429 means the read never executed, so one retry lets a
   * momentary burst (a page's fan-out racing a live poller) self-heal instead
   * of surfacing as empty data. Deliberately single-shot and scoped to this
   * namespace — the other brokered transports keep their semantics.
   */
  private async _analyticsRequest(op: string, body: unknown): Promise<any> {
    const call = () =>
      this._brokeredRequest('analytics', op, body, {
        fallbackMessage: 'Analytics read failed',
        fallbackCode: 'analytics_error',
      });
    try {
      return await call();
    } catch (err) {
      if (err instanceof MindStudioError && err.status === 429) {
        await new Promise((resolve) =>
          setTimeout(resolve, 750 + Math.random() * 750),
        );
        return call();
      }
      throw err;
    }
  }

  /**
   * @internal Shared shape for the brokered `/_internal/v2/<ns>/<op>` data
   * planes. Factored out rather than copied per namespace so error handling
   * can't drift between them.
   */
  private async _brokeredRequest(
    namespace: string,
    op: string,
    body: unknown,
    errors: { fallbackMessage: string; fallbackCode: string },
  ): Promise<any> {
    const url = `${this._currentHttpConfig.baseUrl}/_internal/v2/${namespace}/${op}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this._token,
      },
      body: JSON.stringify(body),
    });
    if (res.status === 204) {
      return undefined;
    }
    const text = await res.text();
    let json: any;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        // non-JSON body — leave json undefined
      }
    }
    if (!res.ok) {
      const rawMsg =
        json?.errorMessage ??
        (typeof json?.error === 'string' ? json.error : json?.error?.message);
      const message =
        typeof rawMsg === 'string'
          ? rawMsg
          : `${errors.fallbackMessage}: ${res.status} ${res.statusText}`;
      const code = json?.errorString ?? json?.code ?? errors.fallbackCode;
      throw new MindStudioError(message, code, res.status);
    }
    return json;
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
    // Prefer the persistent DB WebSocket when the sandbox injected DB_WS_URL.
    // On a WS-transport failure fall back to the fetch below — but only when
    // the retry is provably safe. A frame that was never sent (open failure,
    // send throw, payload too big) never executed and always retries. A frame
    // that WAS sent (socket dropped / reply timed out) may have executed
    // server-side with only the response lost: re-running it is fine for
    // reads, but for a batch containing writes it would double-apply — so
    // that case surfaces as `db_transport_interrupted` instead of silently
    // re-running. A real query error surfaces as before (the query ran).
    const dbWsUrl =
      typeof process !== 'undefined' ? process.env?.DB_WS_URL : undefined;
    if (dbWsUrl) {
      try {
        return await executeDbBatchOverWs(
          dbWsUrl,
          this._token,
          databaseId,
          queries,
        );
      } catch (err) {
        if (!(err instanceof DbWsTransportError)) {
          throw err;
        }
        if (err.sent && queries.some((q) => !isReadOnlySql(q.sql))) {
          throw new MindStudioError(
            '[db] Connection was interrupted after this query was sent; ' +
              'because it contains a write, it was not automatically retried ' +
              '(the write may or may not have been applied). Verify the ' +
              'current state before re-running it.',
            'db_transport_interrupted',
            503,
          );
        }
        // The persistent DB socket failed for this batch — fall back to the
        // fetch path below (results are still correct, just a slower per-call
        // round trip). Surfaced so a degraded socket is visible rather than
        // silently costing latency on every query.
        console.warn(
          `[mindstudio] db: WebSocket transport unavailable (${err.message}); using HTTP for this query.`,
        );
      }
    }

    const url = `${this._currentHttpConfig.baseUrl}/_internal/v2/db/query`;

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
            message = JSON.stringify(
              body.error ?? body.message ?? body.details,
            );
          }
          if (body.code) code = body.code as string;
        } catch {
          // Not JSON — use raw text if it's informative
          if (text && text.length < 500) message = text;
        }
      } catch {
        // Couldn't read response body at all
      }

      throw new MindStudioError(`[db] ${message}`, code, res.status);
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
      const url = `${this._currentHttpConfig.baseUrl}/_internal/v2/auth/sync-user`;
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
            const ctx = agent._getContext()!;
            const ac = ctx.authConfig;
            if (ac && ac.table === name && !tableConfig.managedColumns) {
              tableConfig.managedColumns = ac.columns;
              if (ac.columns.roles) {
                tableConfig.syncRoles = agent._syncRoles.bind(agent);
              }
            }

            const databases = ctx.databases;
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

            // Backfill column schema for deserialization (JSON, boolean, user-type handling)
            if (tableConfig.columns.length === 0 && targetDb) {
              const tableSchema = targetDb.tables.find((t) => t.name === name);
              if (tableSchema) {
                tableConfig.columns = tableSchema.schema;
              }
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

      userRef: (id: string) =>
        id.startsWith('@@user@@') ? id.slice('@@user@@'.length) : id,

      // Raw SQL — validate synchronously; database resolution needs context,
      // so it happens inside the executeBatch closure at execution time
      // (the same deferral lazy defineTable uses).
      sql: (<T = Record<string, unknown>>(
        query: string,
        params?: unknown[],
        options?: { database?: string },
      ) => {
        validateRawSql(query);
        return new RawQuery<T[]>(
          '',
          async (queries) => {
            await agent.ensureContext();
            const database = resolveDatabase(
              agent._getContext()!.databases,
              options?.database,
            );
            return agent._executeDbBatch(database.id, queries);
          },
          { sql: query, params: params?.map(serializeParam) },
        );
      }) as Db['sql'],

      // Batch needs context — hydrate first, then delegate to real db
      batch: ((...queries: Batchable<unknown>[]) => {
        return (async () => {
          await agent.ensureContext();
          const resolvedDb =
            agent._db ??
            createDb(
              agent._getContext()!.databases,
              agent._executeDbBatch.bind(agent),
              agent._getContext()!.authConfig,
              agent._syncRoles.bind(agent),
            );
          return resolvedDb.batch(...queries);
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
  async resolveUsers(userIds: string[]): Promise<{ users: ResolvedUser[] }> {
    const { data } = await request<{ users: ResolvedUser[] }>(
      this._currentHttpConfig,
      'POST',
      '/helpers/resolve-users',
      { userIds },
    );
    return data;
  }

  // -------------------------------------------------------------------------
  // Issue reporting
  // -------------------------------------------------------------------------

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
  async reportIssue(input: ReportIssueInput): Promise<ReportedIssue> {
    const title = input.title?.trim();
    if (!title) {
      throw new MindStudioError('title is required', 'missing_title', 400);
    }

    // Raw hook-token call (mirrors _executeDbBatch) — deliberately NOT routed
    // through request(), which auto-retries 429; a rate_limited response must
    // surface immediately as a typed error, not be silently retried.
    const url = `${this._currentHttpConfig.baseUrl}/_internal/v2/report-issue`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this._token,
      },
      body: JSON.stringify({
        title,
        ...(input.body !== undefined && { body: input.body }),
        ...(input.kind !== undefined && { kind: input.kind }),
        ...(input.reporter !== undefined && { reporter: input.reporter }),
      }),
    });

    if (!res.ok) {
      // Platform error envelope: { code, errorString, errorMessage }.
      // Map errorString -> MindStudioError.code so app code can switch on it
      // (e.g. err.code === 'rate_limited').
      let code = 'report_issue_error';
      let message = `Report issue failed: ${res.status} ${res.statusText}`;
      let details: unknown;
      try {
        const body = (await res.json()) as Record<string, unknown>;
        details = body;
        if (typeof body.errorString === 'string') code = body.errorString;
        message =
          (typeof body.errorMessage === 'string' && body.errorMessage) ||
          (typeof body.errorString === 'string' && body.errorString) ||
          message;
      } catch {
        // Non-JSON body — keep the defaults.
      }
      throw new MindStudioError(message, code, res.status, details);
    }

    const data = (await res.json()) as { issue: ReportedIssue };
    return data.issue;
  }

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
  async invalidatePrerender(
    paths?: string[],
  ): Promise<{ purged: number | 'all' }> {
    const url = `${this._currentHttpConfig.baseUrl}/_internal/v2/prerender/invalidate`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this._token,
      },
      body: JSON.stringify(paths && paths.length ? { paths } : {}),
    });

    if (!res.ok) {
      let code = 'prerender_invalidate_error';
      let message = `Prerender invalidation failed: ${res.status} ${res.statusText}`;
      let details: unknown;
      try {
        const body = (await res.json()) as Record<string, unknown>;
        details = body;
        if (typeof body.errorString === 'string') code = body.errorString;
        message =
          (typeof body.errorMessage === 'string' && body.errorMessage) ||
          (typeof body.errorString === 'string' && body.errorString) ||
          message;
      } catch {
        // Non-JSON body — keep the defaults.
      }
      throw new MindStudioError(message, code, res.status, details);
    }

    return (await res.json()) as { purged: number | 'all' };
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
      this._currentHttpConfig,
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
    await request(this._currentHttpConfig, 'POST', '/account/change-name', {
      name: displayName,
    });
  }

  /** Update the profile picture of the authenticated user/agent. */
  async changeProfilePicture(url: string): Promise<void> {
    await request(
      this._currentHttpConfig,
      'POST',
      '/account/change-profile-picture',
      {
        url,
      },
    );
  }

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
  async uploadFile(
    content: Buffer | Uint8Array,
    options: { extension: string; type?: string; filename?: string },
  ): Promise<UploadFileResult> {
    const filename = options.filename ?? `upload.${options.extension}`;
    const { data } = await request<{
      name: string;
      path: string;
      publicUrl?: string;
      url: string;
      fields: Record<string, string>;
    }>(this._currentHttpConfig, 'POST', '/account/upload', { filename });

    const form = new FormData();
    for (const [k, v] of Object.entries(data.fields)) form.append(k, v);
    const buf = content.buffer.slice(
      content.byteOffset,
      content.byteOffset + content.byteLength,
    ) as ArrayBuffer;
    const fileBlob = new Blob(
      [buf],
      options.type ? { type: options.type } : undefined,
    );
    form.append('file', fileBlob, filename);

    const res = await fetch(data.url, { method: 'POST', body: form });
    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      throw new MindStudioError(
        `Upload failed: ${res.status} ${res.statusText}${
          errorText
            ? ` — ${errorText
                .replace(/<[^>]*>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim()
                .slice(0, 200)}`
            : ''
        }`,
        'upload_error',
        res.status,
        errorText || undefined,
      );
    }
    if (!data.publicUrl) {
      throw new MindStudioError(
        'Upload succeeded but server did not return a public URL.',
        'missing_public_url',
        500,
      );
    }
    return { url: data.publicUrl };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Attach generated step methods to the prototype
import { applyStepMethods } from './generated/steps.js';
import { stepMetadata } from './generated/metadata.js';
applyStepMethods(MindStudioAgent);

/**
 * Serialize a `StepExecutionOptions.store` handle into the request body. Both
 * the name and the access level travel: access is pinned at `defineStore()`, so
 * sending it keeps a generated asset's visibility identical to everything else
 * in that store. Returns an empty object when no store was given, so the caller
 * can spread it unconditionally.
 */
function assetStoreBody(store?: Store): { assetStore?: object } {
  return store
    ? { assetStore: { store: store.name, access: store.access } }
    : {};
}

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
  // ALS request context takes highest priority — when running inside
  // runWithContext(), the request-scoped token must be used.
  const rctx = getRequestContext();
  if (rctx?.callbackToken)
    return { token: rctx.callbackToken, authType: 'internal' };
  // CALLBACK_TOKEN takes priority — when running inside the MindStudio
  // sandbox, the hook token must be used regardless of other auth sources.
  if (process.env.CALLBACK_TOKEN)
    return { token: process.env.CALLBACK_TOKEN, authType: 'internal' };
  if (provided) return { token: provided, authType: 'apiKey' };
  if (process.env.MINDSTUDIO_API_KEY)
    return { token: process.env.MINDSTUDIO_API_KEY, authType: 'apiKey' };
  if (config?.apiKey) return { token: config.apiKey, authType: 'apiKey' };
  throw new MindStudioError(
    'No API key provided. Run `mindstudio login`, pass `apiKey` to the ' +
      'constructor, or set the MINDSTUDIO_API_KEY environment variable.',
    'missing_api_key',
    401,
  );
}
