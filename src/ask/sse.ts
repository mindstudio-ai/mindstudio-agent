/**
 * SSE client for the platform's agent chat endpoint.
 *
 * Simplified version of remy's streaming client — no input streaming,
 * no partial JSON parsing, no session persistence. Just the bare bones:
 * send messages + tools, parse SSE events, yield typed results.
 */

import type { Message, ToolDefinition, StreamEvent } from './types.js';

/**
 * Stream a single LLM turn via the platform's agent chat endpoint.
 *
 * Yields events as they arrive: text chunks, tool_use requests, and
 * a final done/error event. Ignores thinking and tool_input_delta
 * events since we don't need streaming UX for tool inputs.
 */
export async function* streamChat(params: {
  baseUrl: string;
  apiKey: string;
  system: string;
  messages: Message[];
  tools: ToolDefinition[];
}): AsyncGenerator<StreamEvent> {
  const { baseUrl, apiKey, ...body } = params;
  const url = `${baseUrl}/_internal/v2/agent/sdk/chat`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
  } catch (err: any) {
    yield { type: 'error', error: `Network error: ${err.message}` };
    return;
  }

  if (!res.ok) {
    let errorMessage = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body.error) errorMessage = body.error;
      if (body.errorMessage) errorMessage = body.errorMessage;
    } catch {}
    yield { type: 'error', error: errorMessage };
    return;
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      try {
        const event = JSON.parse(line.slice(6));
        // Only yield events we care about
        if (
          event.type === 'text' ||
          event.type === 'tool_use' ||
          event.type === 'done' ||
          event.type === 'error'
        ) {
          yield event as StreamEvent;
        }
      } catch {
        // Skip malformed SSE lines
      }
    }
  }

  // Flush remaining buffer
  if (buffer.startsWith('data: ')) {
    try {
      const event = JSON.parse(buffer.slice(6));
      if (
        event.type === 'text' ||
        event.type === 'tool_use' ||
        event.type === 'done' ||
        event.type === 'error'
      ) {
        yield event as StreamEvent;
      }
    } catch {}
  }
}
