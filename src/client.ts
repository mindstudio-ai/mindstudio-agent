import { request, type HttpClientConfig } from './http.js';
import { MindStudioError } from './errors.js';
import { RateLimiter, type AuthType } from './rate-limit.js';
import { loadConfig, type MindStudioConfig } from './config.js';
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

    this._httpConfig = {
      baseUrl,
      token,
      rateLimiter: new RateLimiter(authType),
      maxRetries: options.maxRetries ?? DEFAULT_MAX_RETRIES,
    };
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
