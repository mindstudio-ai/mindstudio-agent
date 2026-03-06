import { MindStudioError } from './errors.js';
import type { RateLimiter } from './rate-limit.js';

export interface HttpClientConfig {
  baseUrl: string;
  token: string;
  rateLimiter: RateLimiter;
  maxRetries: number;
  agentName?: string;
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
  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.token}`,
    'Content-Type': 'application/json',
    'User-Agent': '@mindstudio-ai/agent',
  };
  if (config.agentName) {
    headers['X-Agent-Name'] = config.agentName;
  }

  const res = await fetch(url, {
    method,
    headers,
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
    const errorBody = await res.json().catch(() => ({}));
    throw new MindStudioError(
      (errorBody as Record<string, string>).message ||
        `${res.status} ${res.statusText}`,
      (errorBody as Record<string, string>).code || 'api_error',
      res.status,
      errorBody,
    );
  }

  const data = (await res.json()) as T;
  return { data, headers: res.headers };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
