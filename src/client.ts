import { request, type HttpClientConfig } from './http.js';
import { MindStudioError } from './errors.js';
import { RateLimiter, type AuthType } from './rate-limit.js';
import type {
  AgentOptions,
  StepExecutionOptions,
  StepExecutionResult,
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
 * 3. `CALLBACK_TOKEN` environment variable (auto-set inside MindStudio custom functions)
 *
 * Base URL is resolved in order:
 * 1. `baseUrl` passed to the constructor
 * 2. `MINDSTUDIO_BASE_URL` environment variable
 * 3. `REMOTE_HOSTNAME` environment variable (auto-set inside MindStudio custom functions)
 * 4. `https://v1.mindstudio-api.com` (production default)
 *
 * Rate limiting is handled automatically:
 * - Concurrent requests are queued to stay within server limits
 * - 429 responses are retried automatically using the `Retry-After` header
 * - Internal (hook) tokens are capped at 500 calls per execution
 */
export class MindStudioAgent {
  /** @internal */
  readonly _httpConfig: HttpClientConfig;

  constructor(options: AgentOptions = {}) {
    const { token, authType } = resolveToken(options.apiKey);
    const baseUrl =
      options.baseUrl ??
      process.env.MINDSTUDIO_BASE_URL ??
      process.env.REMOTE_HOSTNAME ??
      DEFAULT_BASE_URL;

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
    const { data, headers } = await request<{
      output?: TOutput;
      outputUrl?: string;
    }>(this._httpConfig, 'POST', `/steps/${stepType}/execute`, {
      step,
      ...(options?.appId != null && { appId: options.appId }),
      ...(options?.threadId != null && { threadId: options.threadId }),
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

    const remaining = headers.get('x-ratelimit-remaining');

    return {
      ...(output as object),
      $appId: headers.get('x-mindstudio-app-id') ?? '',
      $threadId: headers.get('x-mindstudio-thread-id') ?? '',
      $rateLimitRemaining:
        remaining != null ? parseInt(remaining, 10) : undefined,
    } as StepExecutionResult<TOutput>;
  }

  /** @internal Used by generated helper methods. */
  _request<T>(method: 'GET' | 'POST', path: string, body?: unknown) {
    return request<T>(this._httpConfig, method, path, body);
  }
}

// Attach generated methods to the prototype
import { applyStepMethods } from './generated/steps.js';
import { applyHelperMethods } from './generated/helpers.js';
applyStepMethods(MindStudioAgent);
applyHelperMethods(MindStudioAgent);

function resolveToken(provided?: string): {
  token: string;
  authType: AuthType;
} {
  if (provided) return { token: provided, authType: 'apiKey' };
  if (process.env.MINDSTUDIO_API_KEY)
    return { token: process.env.MINDSTUDIO_API_KEY, authType: 'apiKey' };
  if (process.env.CALLBACK_TOKEN)
    return { token: process.env.CALLBACK_TOKEN, authType: 'internal' };
  throw new MindStudioError(
    'No API key provided. Pass `apiKey` to the MindStudioAgent constructor, ' +
      'or set the MINDSTUDIO_API_KEY environment variable.',
    'missing_api_key',
    401,
  );
}
