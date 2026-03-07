import { request, type HttpClientConfig } from './http.js';
import { MindStudioError } from './errors.js';
import { RateLimiter, type AuthType } from './rate-limit.js';
import { loadConfig, type MindStudioConfig } from './config.js';
import type {
  AgentOptions,
  StepExecutionOptions,
  StepExecutionResult,
  ListAgentsResult,
  RunAgentOptions,
  RunAgentResult,
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

  /** @internal Used by generated helper methods. */
  _request<T>(method: 'GET' | 'POST', path: string, body?: unknown) {
    return request<T>(this._httpConfig, method, path, body);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Attach generated methods to the prototype
import { applyStepMethods } from './generated/steps.js';
import { applyHelperMethods } from './generated/helpers.js';
applyStepMethods(MindStudioAgent);
applyHelperMethods(MindStudioAgent);

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
