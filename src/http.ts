import { MindStudioError } from './errors.js';
import type { RateLimiter } from './rate-limit.js';

export interface HttpClientConfig {
  baseUrl: string;
  token: string;
  rateLimiter: RateLimiter;
  maxRetries: number;
}

export async function request<T>(
  config: HttpClientConfig,
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
): Promise<{ data: T; headers: Headers }> {
  const url = `${config.baseUrl}/developer/v2${path}`;

  await config.rateLimiter.acquire();

  try {
    return await requestWithRetry<T>(config, method, url, body, 0);
  } finally {
    config.rateLimiter.release();
  }
}

async function requestWithRetry<T>(
  config: HttpClientConfig,
  method: string,
  url: string,
  body: unknown,
  attempt: number,
): Promise<{ data: T; headers: Headers }> {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json',
      'User-Agent': '@mindstudio-ai/agent',
    },
    body: body != null ? JSON.stringify(body) : undefined,
  });

  // Update rate limiter with latest server-reported limits
  config.rateLimiter.updateFromHeaders(res.headers);

  if (res.status === 429 && attempt < config.maxRetries) {
    const retryAfter = res.headers.get('retry-after');
    const waitMs = retryAfter ? parseFloat(retryAfter) * 1000 : 1000;
    await sleep(waitMs);
    return requestWithRetry<T>(config, method, url, body, attempt + 1);
  }

  if (!res.ok) {
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
        if (text && text.length < 500) message = text;
      }
    } catch {
      // Couldn't read response body
    }

    throw new MindStudioError(message, code, res.status, details);
  }

  const data = (await res.json()) as T;
  return { data, headers: res.headers };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
