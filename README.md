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

// Generate an image
const { imageUrl } = await agent.generateImage({
  prompt: 'A mountain landscape at sunset',
  mode: 'background',
});
console.log(imageUrl);

// Send a message to an AI model
const { content } = await agent.userMessage({
  message: 'Summarize this article: ...',
  source: 'user',
});
console.log(content);

// Search Google
const { results } = await agent.searchGoogle({
  query: 'TypeScript best practices 2025',
  exportType: 'json',
});
console.log(results);
```

Every method is fully typed — your editor will autocomplete available parameters, show enum options, and infer the output shape.

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
const r1 = await agent.userMessage({
  message: 'My name is Alice',
  source: 'user',
});

// The model remembers the conversation
const r2 = await agent.userMessage(
  { message: 'What is my name?', source: 'user' },
  { threadId: r1.$threadId, appId: r1.$appId },
);
```

## Available steps

Every step has a dedicated typed method. A few highlights:

| Method | Description |
| --- | --- |
| `userMessage()` | Send a message to an AI model |
| `generateImage()` | Generate an image from a text prompt |
| `generateVideo()` | Generate a video from a text prompt |
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
  UserMessageStepInput,
  StepName,
  StepInputMap,
  StepOutputMap,
} from '@mindstudio-ai/agent';
```

`StepName` is a union of all available step type names. `StepInputMap` and `StepOutputMap` map step names to their input/output types, which is useful for building generic utilities.

## Error handling

```typescript
import { MindStudioAgent, MindStudioError } from '@mindstudio-ai/agent';

try {
  await agent.generateImage({ prompt: '...', mode: 'background' });
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
