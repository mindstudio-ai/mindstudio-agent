# stream — Real-Time SSE Output

The `stream` function sends arbitrary chunks to the caller in real-time via Server-Sent Events. When a method is invoked with `stream: true`, each `stream()` call delivers an SSE event to the caller instantly — no need to wait for the function to finish.

When there is no active stream (the caller didn't request streaming), calls are silently ignored. This means you can add streaming to any function without breaking non-streaming callers.

## Quick start

```ts
import { stream } from '@mindstudio-ai/agent';

export const processItems = async (input: { items: string[] }) => {
  for (const item of input.items) {
    const result = await doWork(item);
    await stream(`Processed ${item}`);
  }
  return { done: true };
};
```

## API

### `stream(text: string): Promise<void>`

Send a text chunk. Delivered as `{ type: 'token', text: '...' }` on the SSE connection.

```ts
await stream('Processing step 1...');
await stream('Almost done...');
```

### `stream(data: Record<string, unknown>): Promise<void>`

Send structured data. Delivered as `{ type: 'data', data: {...} }` on the SSE connection.

```ts
await stream({ progress: 50, currentItem: 'abc' });
await stream({ status: 'complete', results: [1, 2, 3] });
```

## What the caller sees

Each `stream()` call produces one SSE event:

```
data: {"streamId":"...","type":"token","text":"Processing step 1..."}

data: {"streamId":"...","type":"data","data":{"progress":50}}

data: {"streamId":"...","type":"done","output":{"done":true}}
```

The final `done` event is sent automatically when the function returns.

## Common patterns

### Progress reporting

```ts
export const importData = async (input: { rows: any[] }) => {
  const total = input.rows.length;

  for (let i = 0; i < total; i++) {
    await processRow(input.rows[i]);
    await stream({ progress: Math.round(((i + 1) / total) * 100) });
  }

  return { imported: total };
};
```

### Streaming LLM-style token output

```ts
export const summarize = async (input: { text: string }) => {
  const chunks = await generateInChunks(input.text);
  let full = '';

  for (const chunk of chunks) {
    full += chunk;
    await stream(chunk);
  }

  return { summary: full };
};
```

### Mixed text and structured data

```ts
export const analyzePortfolio = async (input: { tickers: string[] }) => {
  const results = [];

  for (const ticker of input.tickers) {
    await stream(`Analyzing ${ticker}...`);
    const analysis = await analyze(ticker);
    results.push(analysis);
    await stream({ ticker, analysis });
  }

  return { results };
};
```

## How it works

1. The caller invokes a method with `stream: true` — the API generates a `streamId` and opens an SSE connection.
2. The `streamId` propagates through the execution stack and arrives as the `STREAM_ID` environment variable inside the sandbox.
3. The SDK reads `STREAM_ID` at startup and stores it on the agent instance.
4. Each `stream()` call POSTs the chunk to `/_internal/v2/stream-chunk` with the `streamId`.
5. The API publishes the chunk via Redis pub/sub, and the SSE handler writes it to the caller's open connection.
6. When the function returns, the API sends a final `done` event and closes the SSE connection.

## Error handling

Stream chunk delivery is best-effort. If a chunk fails to send (network issue, connection closed), a warning is logged to stderr but no error is thrown. This prevents streaming failures from interrupting function execution.

## No-op when not streaming

When `STREAM_ID` is not set (the caller didn't request streaming), `stream()` returns immediately without making any HTTP calls. You don't need to check whether streaming is active — just call `stream()` and it does the right thing.
