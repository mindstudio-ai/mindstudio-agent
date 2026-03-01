# @mindstudio-ai/agent

TypeScript SDK for executing [MindStudio](https://mindstudio.ai) workflow steps directly.

Call any of MindStudio's 120+ built-in actions — AI models, image/video generation, web scraping, integrations, and more — with fully typed inputs and outputs.

## Install

```bash
npm install @mindstudio-ai/agent
```

Requires Node.js 18+.

## Quick start

```typescript
import { MindStudioAgent } from '@mindstudio-ai/agent';

const agent = new MindStudioAgent({ apiKey: 'your-api-key' });

// Generate text with an AI model
const { content } = await agent.generateText({
  message: 'Summarize this article: ...',
});
console.log(content);

// Generate an image
const { imageUrl } = await agent.generateImage({
  prompt: 'A mountain landscape at sunset',
});
console.log(imageUrl);

// Search Google
const { results } = await agent.searchGoogle({
  query: 'TypeScript best practices',
  exportType: 'json',
});
console.log(results);
```

Every method is fully typed — your editor will autocomplete available parameters, show enum options, and infer the output shape. Results are returned flat for easy destructuring.

## Authentication

The SDK supports two authentication modes:

**API Key** — for external apps, scripts, and CLI usage:

```typescript
// Pass directly
const agent = new MindStudioAgent({ apiKey: 'your-api-key' });

// Or set the environment variable
// MINDSTUDIO_API_KEY=your-api-key
const agent = new MindStudioAgent();
```

**Managed mode** — automatically available inside MindStudio custom functions:

```typescript
// Inside a MindStudio custom function, auth and base URL are automatic
// (CALLBACK_TOKEN and REMOTE_HOSTNAME are set by the runtime)
const agent = new MindStudioAgent();
```

Resolution order: constructor `apiKey` > `MINDSTUDIO_API_KEY` env > `CALLBACK_TOKEN` env.

## Thread persistence

Steps execute within threads. Pass `$threadId` and `$appId` from a previous call to maintain state across calls:

```typescript
const r1 = await agent.generateText({
  message: 'My name is Alice',
});

// The model remembers the conversation
const r2 = await agent.generateText(
  { message: 'What is my name?' },
  { threadId: r1.$threadId, appId: r1.$appId },
);
```

### Automatic thread reuse

For local debugging or scripts where you want all calls to share a single thread (similar to how MindStudio custom function sandboxes work), enable `reuseThreadId`:

```typescript
const agent = new MindStudioAgent({ reuseThreadId: true });

// Or set the environment variable
// MINDSTUDIO_REUSE_THREAD_ID=true

await agent.generateText({ message: 'My name is Alice' }); // creates a thread
await agent.generateText({ message: 'What is my name?' }); // reuses the same thread automatically
```

The thread ID from the first response is captured and sent with all subsequent calls. You can still override it per-call by passing an explicit `threadId` in the options.

## Rate limiting

Rate limiting is handled automatically:

- **Concurrency queue** — requests beyond the server's concurrent limit are queued and proceed as slots open up (10 for internal tokens, 20 for API keys)
- **Auto-retry on 429** — rate-limited responses are retried automatically using the `Retry-After` header (default: 3 retries, configurable via `maxRetries`)
- **Call cap** — internal tokens are capped at 500 calls per execution; the SDK throws `MindStudioError` with code `call_cap_exceeded` rather than sending requests that will fail

Every result includes `$rateLimitRemaining` so you can throttle proactively:

```typescript
const result = await agent.generateText({ message: 'Hello' });
console.log(result.$rateLimitRemaining); // calls remaining in window
```

## Available steps

Every step has a dedicated typed method. A few highlights:

| Method | Description |
| --- | --- |
| `generateText()` | Send a message to an AI model |
| `generateImage()` | Generate an image from a text prompt |
| `generateVideo()` | Generate a video from a text prompt |
| `generateAsset()` | Generate an HTML/PDF/PNG/video asset |
| `analyzeImage()` | Analyze an image with a vision model |
| `textToSpeech()` | Convert text to speech |
| `transcribeAudio()` | Transcribe audio to text |
| `scrapeUrl()` | Scrape a web page |
| `searchGoogle()` | Search Google |
| `httpRequest()` | Make an HTTP request |
| `sendEmail()` | Send an email |
| `postToSlackChannel()` | Post to a Slack channel |
| `runWorkflow()` | Run another MindStudio workflow |

...and 100+ more for Google Docs/Sheets/Calendar, YouTube, LinkedIn, HubSpot, Airtable, Notion, Coda, Telegram, media processing, PII detection, and more.

All methods show full documentation in your editor's IntelliSense — hover any method to see usage notes, parameter descriptions, and enum options.

## Helpers

```typescript
// List all available AI models
const { models } = await agent.listModels();

// Filter by type
const { models: chatModels } = await agent.listModelsByType('llm_chat');

// List available connector services
const { services } = await agent.listConnectors();
```

## Configuration

```typescript
const agent = new MindStudioAgent({
  // API key (or set MINDSTUDIO_API_KEY env var)
  apiKey: 'your-api-key',

  // Base URL (or set MINDSTUDIO_BASE_URL env var)
  // Defaults to https://v1.mindstudio-api.com
  baseUrl: 'http://localhost:3129',

  // Max retries on 429 rate limit responses (default: 3)
  maxRetries: 5,

  // Auto-reuse the first returned thread ID for all subsequent calls (default: false)
  // Or set MINDSTUDIO_REUSE_THREAD_ID=true env var
  reuseThreadId: true,
});
```

## Low-level access

For step types not yet in the generated methods, use `executeStep()` directly:

```typescript
const result = await agent.executeStep('someNewStep', {
  param1: 'value',
});
```

## Types

All input/output types are exported for use in your own code:

```typescript
import type {
  GenerateImageStepInput,
  GenerateImageStepOutput,
  GenerateTextStepInput,
  StepName,
  StepInputMap,
  StepOutputMap,
} from '@mindstudio-ai/agent';
```

`StepName` is a union of all available step type names. `StepInputMap` and `StepOutputMap` map step names to their input/output types, useful for building generic utilities.

## Snippets

A `monacoSnippets` object is exported with field metadata and output keys for every method:

```typescript
import { monacoSnippets } from '@mindstudio-ai/agent';

monacoSnippets.generateText;
// {
//   fields: [["message", "string"]],
//   outputKeys: ["content"]
// }
```

For the 2 renamed step types, both the alias and original name appear as keys. A `blockTypeAliases` map is also exported for reverse-mapping:

```typescript
import { blockTypeAliases } from '@mindstudio-ai/agent';
// { userMessage: "generateText", generatePdf: "generateAsset" }
```

## LLM documentation

An `llms.txt` file ships with the package for AI agent consumption:

```
node_modules/@mindstudio-ai/agent/llms.txt
```

It contains a compact, complete reference of all methods with their required parameters and output keys — optimized for LLM context windows.

## Error handling

```typescript
import { MindStudioAgent, MindStudioError } from '@mindstudio-ai/agent';

try {
  await agent.generateImage({ prompt: '...' });
} catch (err) {
  if (err instanceof MindStudioError) {
    console.error(err.message); // Human-readable message
    console.error(err.code);    // Machine-readable code (e.g. "invalid_step_config")
    console.error(err.status);  // HTTP status (e.g. 400)
    console.error(err.details); // Raw API error body
  }
}
```

## License

MIT
