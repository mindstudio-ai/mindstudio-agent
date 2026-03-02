# @mindstudio-ai/agent

TypeScript SDK, CLI, and MCP server for executing [MindStudio](https://mindstudio.ai) workflow steps directly.

Call any of MindStudio's 120+ built-in actions — AI models, image/video generation, web scraping, integrations, and more — with fully typed inputs and outputs. Use from TypeScript, the command line, or any MCP-compatible AI agent.

## Install

```bash
npm install @mindstudio-ai/agent
```

Requires Node.js 18+.

## Quick start

### TypeScript

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

### CLI

```bash
# Authenticate (opens browser, saves key locally)
mindstudio login

# Execute a step with named flags
mindstudio generate-image --prompt "A mountain landscape at sunset"

# Or with JSON input (JSON5-tolerant: unquoted keys, single quotes, trailing commas)
mindstudio generate-image '{prompt: "A mountain landscape at sunset"}'

# Just the image URL, no metadata
mindstudio generate-image --prompt "A sunset" --output-key imageUrl

# List all available methods
mindstudio list

# Show details about a method
mindstudio info generate-image

# Pipe input from another command
echo '{"query": "TypeScript best practices"}' | mindstudio search-google
```

Run via `npx` without installing globally:

```bash
npx @mindstudio-ai/agent generate-text --message "Hello"
```

### MCP server

Add to your MCP client config (Claude Code, Cursor, VS Code, etc.):

```json
{
  "mcpServers": {
    "mindstudio": {
      "command": "npx",
      "args": ["-y", "@mindstudio-ai/agent", "mcp"],
      "env": {
        "MINDSTUDIO_API_KEY": "your-api-key"
      }
    }
  }
}
```

All 120+ step methods are exposed as MCP tools with full JSON Schema input definitions, so your AI agent can discover and call them directly. The MCP server also exposes `listAgents` and `runAgent` tools for running pre-built agents.

## Authentication

The fastest way to authenticate is the interactive login:

```bash
mindstudio login
```

This opens your browser, authenticates with MindStudio, and saves your API key to `~/.mindstudio/config.json`. All subsequent CLI and SDK usage will pick it up automatically.

You can also authenticate via environment variable or constructor parameter:

```typescript
// Pass directly
const agent = new MindStudioAgent({ apiKey: 'your-api-key' });

// Or set the environment variable
// MINDSTUDIO_API_KEY=your-api-key
const agent = new MindStudioAgent();
```

MindStudio routes to the correct AI provider (OpenAI, Google, Anthropic, etc.) server-side — you do not need separate provider API keys.

Other auth commands:

```bash
# Check current auth status and verify credentials
mindstudio whoami

# Clear stored credentials
mindstudio logout
```

Resolution order: constructor `apiKey` > `MINDSTUDIO_API_KEY` env > `~/.mindstudio/config.json` > `CALLBACK_TOKEN` env.

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

## Billing

Every result includes optional billing metadata:

```typescript
const result = await agent.generateImage({ prompt: 'A sunset' });
console.log(result.$billingCost);   // cost in credits for this call
console.log(result.$billingEvents); // itemized billing events
```

These fields are `undefined` when the server does not return billing headers.

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

## Running pre-built agents

List and run the pre-built agents in your MindStudio organization:

```typescript
// List all agents in your org
const { apps } = await agent.listAgents();
for (const app of apps) {
  console.log(app.name, app.id);
}

// Run an agent and wait for the result
const result = await agent.runAgent({
  appId: 'your-agent-id',
  variables: { query: 'Summarize the latest news' },
});
console.log(result.result);

// Run a specific workflow with version override
const result = await agent.runAgent({
  appId: 'your-agent-id',
  variables: { topic: 'AI' },
  workflow: 'research',
  version: 'draft',
});
```

`runAgent()` always uses async mode internally — it submits the run, then polls for the result until it completes or fails. The poll interval defaults to 1 second and can be configured with `pollIntervalMs`.

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
  // API key (or set MINDSTUDIO_API_KEY env var, or run `mindstudio login`)
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
  AgentInfo,
  ListAgentsResult,
  RunAgentOptions,
  RunAgentResult,
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

## CLI reference

```
Usage: mindstudio <command | method> [options]

Commands:
  login                            Authenticate with MindStudio (opens browser)
  logout                           Clear stored credentials
  whoami                           Show current authentication status
  <method> [json | --flags]        Execute a step method
  exec <method> [json | --flags]   Execute a step method (same as above)
  list [--json]                    List available methods
  info <method>                    Show method details (params, types, output)
  agents [--json]                  List pre-built agents in your organization
  run <appId> [json | --flags]     Run a pre-built agent and wait for result
  mcp                              Start MCP server (JSON-RPC over stdio)

Options:
  --api-key <key>          API key (or set MINDSTUDIO_API_KEY env)
  --base-url <url>         API base URL
  --app-id <id>            App ID for thread context
  --thread-id <id>         Thread ID for state persistence
  --output-key <key>       Extract a single field from the result
  --no-meta                Strip $-prefixed metadata from output
  --workflow <name>        Workflow to execute (run command)
  --version <ver>          App version override, e.g. "draft" (run command)
  --json                   Output as JSON (list/agents only)
  --help                   Show help
```

Method names use kebab-case on the CLI (`generate-image`), though camelCase (`generateImage`) is also accepted. Typos get a "did you mean?" suggestion. Parameter flags are also kebab-case (`--video-url` for `videoUrl`).

Input can be provided as:
- **Named flags**: `--prompt "a sunset" --mode "background"`
- **JSON argument**: `'{"prompt": "a sunset"}'` (JSON5-tolerant: unquoted keys, single quotes, trailing commas)
- **Piped stdin**: `echo '{"prompt": "a sunset"}' | mindstudio generate-image`

Values are auto-coerced: `--font-size 12` becomes a number, `--enabled true` becomes a boolean.

Output can be shaped with `--output-key` (extract a single field as raw text) and `--no-meta` (strip `$`-prefixed metadata):

```bash
# Just the URL, ready to pipe
mindstudio generate-image --prompt "a cat" --output-key imageUrl

# Clean JSON without metadata
mindstudio generate-text --message "hello" --no-meta
```

Running pre-built agents from the CLI:

```bash
# List agents in your organization
mindstudio agents

# Run an agent with input variables
mindstudio run <appId> --query "Summarize the latest news"

# Run with JSON input
mindstudio run <appId> '{"query": "hello", "topic": "AI"}'

# Run a specific workflow
mindstudio run <appId> --query "hello" --workflow research

# Extract just the result text
mindstudio run <appId> --query "hello" --output-key result
```

Thread persistence across CLI calls:

```bash
# First call — capture the thread/app IDs from the JSON output
result=$(mindstudio generate-text --message "My name is Alice")

# Subsequent calls — pass them back
mindstudio generate-text --message "What is my name?" \
  --thread-id $(echo $result | jq -r '."$threadId"') \
  --app-id $(echo $result | jq -r '."$appId"')
```

## MCP server

The package includes a built-in [MCP](https://modelcontextprotocol.io) (Model Context Protocol) server. It exposes all step methods and helpers as tools, so any MCP-compatible AI agent (Claude Code, Cursor, Windsurf, VS Code Copilot, etc.) can discover and call them.

Start manually:

```bash
mindstudio mcp
```

Or configure your MCP client:

```json
{
  "mcpServers": {
    "mindstudio": {
      "command": "npx",
      "args": ["-y", "@mindstudio-ai/agent", "mcp"],
      "env": {
        "MINDSTUDIO_API_KEY": "your-api-key"
      }
    }
  }
}
```

The MCP server:
- Uses stdio transport (JSON-RPC 2.0)
- Creates one agent per session with automatic thread reuse
- Returns structured JSON results for each tool call
- Has zero additional dependencies

## LLM documentation

An `llms.txt` file ships with the package for AI agent consumption:

```
node_modules/@mindstudio-ai/agent/llms.txt
```

It contains a compact, complete reference of all methods with their required parameters and output keys — optimized for LLM context windows.

## OpenAPI spec

The raw OpenAPI spec that this SDK is generated from is available at:

```
https://v1.mindstudio-api.com/developer/v2/steps/openapi.json
```

This contains full JSON Schema definitions for every step's input and output, descriptions, and usage notes. Useful if you want to build your own tooling, code generators, or integrations.

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
