import { MindStudioError } from './errors.js';

export interface HttpClientConfig {
  baseUrl: string;
  token: string;
}

export async function request<T>(
  config: HttpClientConfig,
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
): Promise<{ data: T; headers: Headers }> {
  const url = `${config.baseUrl}/developer/v2${path}`;

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json',
      'User-Agent': '@mindstudio-ai/agent',
    },
    body: body != null ? JSON.stringify(body) : undefined,
  });

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
