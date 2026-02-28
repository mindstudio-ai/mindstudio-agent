import { MindStudioError } from './errors.js';

export type AuthType = 'internal' | 'apiKey';

const DEFAULTS: Record<AuthType, { concurrency: number; callCap: number }> = {
  internal: { concurrency: 10, callCap: 500 },
  apiKey: { concurrency: 20, callCap: Infinity },
};

export class RateLimiter {
  private inflight = 0;
  private concurrencyLimit: number;
  private callCount = 0;
  private callCap: number;
  private queue: Array<() => void> = [];

  constructor(readonly authType: AuthType) {
    this.concurrencyLimit = DEFAULTS[authType].concurrency;
    this.callCap = DEFAULTS[authType].callCap;
  }

  /** Acquire a slot. Resolves when a concurrent slot is available. */
  async acquire(): Promise<void> {
    if (this.callCount >= this.callCap) {
      throw new MindStudioError(
        `Call cap reached (${this.callCap} calls). ` +
          'Internal tokens are limited to 500 calls per execution.',
        'call_cap_exceeded',
        429,
      );
    }

    if (this.inflight < this.concurrencyLimit) {
      this.inflight++;
      this.callCount++;
      return;
    }

    return new Promise<void>((resolve) => {
      this.queue.push(() => {
        this.inflight++;
        this.callCount++;
        resolve();
      });
    });
  }

  /** Release a slot and let the next queued request proceed. */
  release(): void {
    this.inflight--;
    const next = this.queue.shift();
    if (next) next();
  }

  /** Update limits from response headers. */
  updateFromHeaders(headers: Headers): void {
    const concurrency = headers.get('x-ratelimit-concurrency-limit');
    if (concurrency) {
      this.concurrencyLimit = parseInt(concurrency, 10);
    }
    const limit = headers.get('x-ratelimit-limit');
    if (limit && this.authType === 'internal') {
      this.callCap = parseInt(limit, 10);
    }
  }

  /** Read current rate limit state from response headers. */
  static parseHeaders(headers: Headers): {
    remaining: number | undefined;
    concurrencyRemaining: number | undefined;
  } {
    const remaining = headers.get('x-ratelimit-remaining');
    const concurrencyRemaining = headers.get(
      'x-ratelimit-concurrency-remaining',
    );
    return {
      remaining: remaining != null ? parseInt(remaining, 10) : undefined,
      concurrencyRemaining:
        concurrencyRemaining != null
          ? parseInt(concurrencyRemaining, 10)
          : undefined,
    };
  }
}
