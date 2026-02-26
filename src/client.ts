import { request, type HttpClientConfig } from './http.js';
import { MindStudioError } from './errors.js';
import type {
  AgentOptions,
  StepExecutionOptions,
  StepExecutionResult,
} from './types.js';

const DEFAULT_BASE_URL = 'https://v1.mindstudio-api.com';

/**
 * Client for the MindStudio direct step execution API.
 *
 * Create an instance and call typed step methods directly:
 *
 * ```ts
 * const agent = new MindStudioAgent({ apiKey: "your-key" });
 * const result = await agent.generateImage({ prompt: "a sunset", mode: "background" });
 * console.log(result.output.imageUrl);
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
 */
export class MindStudioAgent {
  /** @internal */
  readonly _httpConfig: HttpClientConfig;

  constructor(options: AgentOptions = {}) {
    const token = resolveToken(options.apiKey);
    const baseUrl =
      options.baseUrl ??
      process.env.MINDSTUDIO_BASE_URL ??
      process.env.REMOTE_HOSTNAME ??
      DEFAULT_BASE_URL;

    this._httpConfig = { baseUrl, token };
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

    return {
      output: data.output as TOutput,
      outputUrl: data.outputUrl,
      appId: headers.get('x-mindstudio-app-id') ?? '',
      threadId: headers.get('x-mindstudio-thread-id') ?? '',
    };
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

function resolveToken(provided?: string): string {
  if (provided) return provided;
  if (process.env.MINDSTUDIO_API_KEY) return process.env.MINDSTUDIO_API_KEY;
  if (process.env.CALLBACK_TOKEN) return process.env.CALLBACK_TOKEN;
  throw new MindStudioError(
    'No API key provided. Pass `apiKey` to the MindStudioAgent constructor, ' +
      'or set the MINDSTUDIO_API_KEY environment variable.',
    'missing_api_key',
    401,
  );
}
