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

/** Result of a step execution call. */
export interface StepExecutionResult<TOutput = unknown> {
  /** The step's output data. */
  output: TOutput;

  /**
   * Signed URL to fetch the output from S3.
   * Present only when the output was too large to inline in the response body.
   */
  outputUrl?: string;

  /** The app ID used for this execution. Pass to subsequent calls to reuse. */
  appId: string;

  /** The thread ID used for this execution. Pass to subsequent calls to maintain state. */
  threadId: string;
}
