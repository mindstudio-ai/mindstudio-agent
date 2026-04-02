/**
 * Error thrown when a MindStudio API request fails.
 *
 * Contains the HTTP status code, an error code from the API,
 * and any additional details returned in the response body.
 */
export class MindStudioError extends Error {
  override readonly name = 'MindStudioError';

  constructor(
    message: string,
    /** Machine-readable error code from the API (e.g. "invalid_step_config"). */
    public readonly code: string,
    /** HTTP status code of the failed request. */
    public readonly status: number,
    /** Raw error body from the API, if available. */
    public readonly details?: unknown,
  ) {
    super(message);
  }

  override toString(): string {
    return `MindStudioError [${this.code}] (${this.status}): ${this.message}`;
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      status: this.status,
      ...(this.details != null && { details: this.details }),
    };
  }
}
