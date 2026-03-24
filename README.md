# @mindstudio-ai/agent

Every AI model. Every integration. One SDK.

[MindStudio](https://mindstudio.ai) gives you direct access to 200+ AI models and [1,000+ integrations](https://github.com/mindstudio-ai/mscr) — no separate API keys, no setup, no friction. This package is the developer toolkit: a TypeScript SDK, CLI, and MCP server that puts the entire platform at your fingertips.

Generate text, images, video, and audio. Scrape the web. Search Google. Post to Slack. Read from Airtable. Send emails. Process media. Run any of 850+ connector actions across third-party services. All with one API key, fully typed, and ready to use from code, the command line, or any MCP-compatible AI agent.

## Install

### CLI / MCP (standalone binary)

No dependencies required — downloads a standalone binary:

**macOS / Linux:**
```bash
curl -fsSL https://msagent.ai/install.sh | bash
mindstudio login
```

**Windows (PowerShell):**
```
irm https://msagent.ai/install.ps1 | iex
mindstudio login
```

To update, run the same command again. To uninstall, `rm /usr/local/bin/mindstudio` (macOS/Linux) or delete `%USERPROFILE%\.mindstudio\bin\mindstudio.exe` (Windows).

### SDK (npm)

```bash
npm install @mindstudio-ai/agent
```

Requires Node.js 18+. Also installs the CLI as `mindstudio`.

## Quick start

### TypeScript

```typescript
import { MindStudioAgent } from '@mindstudio-ai/agent';

const agent = new MindStudioAgent({ apiKey: 'your-api-key' });

// Generate text with any AI model — OpenAI, Anthropic, Google, and more
const { content } = await agent.generateText({
  message: 'Summarize this article: ...',
});

// Generate an image
const { imageUrl } = await agent.generateImage({
  prompt: 'A mountain landscape at sunset',
});

// Search Google
const { results } = await agent.searchGoogle({
  query: 'TypeScript best practices',
  exportType: 'json',
});
```

Every method is fully typed — your editor will autocomplete parameters, show enum options, and infer the output shape. Results are returned flat for easy destructuring.

### CLI

```bash
# Authenticate (opens browser, saves key locally)
mindstudio login

# Execute with named flags
mindstudio generate-image --prompt "A mountain landscape at sunset"

# Or with JSON input (JSON5-tolerant)
mindstudio generate-image '{prompt: "A mountain landscape at sunset"}'

# Extract a single output field
mindstudio generate-image --prompt "A sunset" --output-key imageUrl

# List all available methods
mindstudio list

# Show details about a method
mindstudio info generate-image

# Pipe input from another command
echo '{"query": "TypeScript best practices"}' | mindstudio search-google
```

Steps stream real-time progress when run from a terminal:

```
$ mindstudio generate-image --prompt "A mountain landscape at sunset"
  ⟡ Generating image with DALL·E 3...
  ⟡ Image generated successfully
{"imageUrl":"https://...","$billingCost":5000000}
```

For AI agents, use `--json-logs` to get structured debug logs on stderr:

```bash
mindstudio generate-image --prompt "a cat" --json-logs
# stderr: {"type":"log","value":"Generating image with DALL·E 3...","tag":"Generate Image","ts":1774270499100}
# stderr: {"type":"log","value":"Image generated successfully","tag":"Generate Image","ts":1774270502300}
# stdout: {"imageUrl":"https://...","$billingCost":5000000}
```

Run via `npx` without installing:

```bash
npx @mindstudio-ai/agent generate-text --message "Hello"
```

### MCP server

**Claude Code** (one-time setup):
```bash
claude mcp add mindstudio -- mindstudio mcp
```

That's it — Claude Code will discover the MCP server on next launch. Auth is picked up from `mindstudio login` automatically.

**Other MCP clients** (Cursor, VS Code, Windsurf, etc.) — add to your config:

```json
{
  "mcpServers": {
    "mindstudio": {
      "command": "mindstudio",
      "args": ["mcp"],
      "env": {
        "MINDSTUDIO_API_KEY": "your-api-key"
      }
    }
  }
}
```

**With npx** (no install needed):
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

Every action is exposed as an MCP tool with full JSON Schema definitions — your AI agent can discover and call any of them directly.

## Ask — built-in SDK assistant

Not sure which action to use? Need a model ID? Want working code for a specific integration? Ask the SDK directly:

```bash
mindstudio ask "generate an image with FLUX"
mindstudio ask "what models support vision?"
mindstudio ask "how do I send a Slack message with an attachment?"
mindstudio ask "what's the difference between generateText and userMessage?"
```

The `ask` command runs a built-in agent that has full knowledge of every action, model, and connector in the platform. It resolves real model IDs, looks up config options, and returns complete, copy-paste-ready TypeScript code — no placeholders.

Pipe context in from other commands:

```bash
echo "I need to connect to HubSpot and create a contact" | mindstudio ask
```

**For AI agents:** Shell out to `mindstudio ask "..."` from any agent (Remy, Claude Code, custom agents) to get SDK expertise on demand. The response is clean markdown on stdout, ready to parse. Or use the `ask` MCP tool directly if connected via MCP.

**Example questions:**
- `"what actions are available for image generation?"` — discovery
- `"give me TypeScript code to generate an image with DALL-E 3"` — resolution with real model IDs and config
- `"what connectors could I configure?"` — OAuth service discovery
- `"how do I use runFromConnectorRegistry to post to Slack?"` — connector action details
- `"what are the config options for the flux-max-2 model?"` — model specs

## Authentication

The fastest way to get started:

```bash
mindstudio login
```

Opens your browser, authenticates with MindStudio, and saves your API key to `~/.mindstudio/config.json`. All subsequent usage picks it up automatically.

You can also authenticate via environment variable or constructor:

```typescript
// Pass directly
const agent = new MindStudioAgent({ apiKey: 'your-api-key' });

// Or set the environment variable
// MINDSTUDIO_API_KEY=your-api-key
const agent = new MindStudioAgent();
```

One API key is all you need. MindStudio routes to the correct AI provider (OpenAI, Google, Anthropic, Meta, xAI, DeepSeek, etc.) server-side — no separate provider keys required.

Other auth commands:

```bash
mindstudio whoami    # Check current auth status
mindstudio logout    # Clear stored credentials
```

Resolution order: `CALLBACK_TOKEN` env (always takes priority in managed mode) > constructor `apiKey` > `MINDSTUDIO_API_KEY` env > `~/.mindstudio/config.json`.

## 200+ AI models

Direct access to models from every major provider — all through a single API key, billed at cost with no markups.

```typescript
// Browse available models
const { models } = await agent.listModelsSummary();

// Filter by type
const { models: imageModels } = await agent.listModelsSummaryByType('image_generation');

// Use a specific model
const { models: chatModels } = await agent.listModelsByType('llm_chat');
const gemini = chatModels.find(m => m.name.includes('Gemini'));

const { content } = await agent.generateText({
  message: 'Hello',
  modelOverride: {
    model: gemini.id,
    temperature: 0.7,
    maxResponseTokens: 1024,
  },
});
```

Model types: `llm_chat`, `image_generation`, `video_generation`, `video_analysis`, `text_to_speech`, `vision`, `transcription`.

## 1,000+ integrations

850+ connector actions from the open-source [MindStudio Connector Registry (MSCR)](https://github.com/mindstudio-ai/mscr) — across services like ActiveCampaign, Airtable, Apollo, Canva, ElevenLabs, MailChimp, Notion, and more — alongside 140+ built-in actions for AI, media, web, and data processing.

```typescript
// Browse connectors and their actions
const { services } = await agent.listConnectors();
const { action } = await agent.getConnectorAction('slack', 'slack/send-message');

// Check which services are connected in your org
const { connections } = await agent.listConnections();

// Execute a connector action
const result = await agent.runFromConnectorRegistry({
  serviceId: 'slack',
  actionId: 'slack/send-message',
  connectionId: 'your-connection-id',
  // ... action-specific fields from getConnectorAction()
});
```

Connectors require the user to connect to the third-party service in MindStudio before use. Use `listConnections()` to check what's available.

## Built-in actions

Every action has a dedicated typed method. A few highlights:

| Method | Description |
| --- | --- |
| `generateText()` | Send a message to any AI model |
| `generateImage()` | Generate an image from a prompt |
| `generateVideo()` | Generate a video from a prompt |
| `generateAsset()` | Generate an HTML/PDF/PNG/video asset |
| `analyzeImage()` | Analyze an image with a vision model |
| `textToSpeech()` | Convert text to speech |
| `transcribeAudio()` | Transcribe audio to text |
| `scrapeUrl()` | Scrape a web page |
| `searchGoogle()` | Search Google |
| `httpRequest()` | Make an HTTP request |
| `sendEmail()` | Send an email |
| `postToSlackChannel()` | Post to a Slack channel |
| `runPackagedWorkflow()` | Run another MindStudio workflow |

...and 130+ more for Google Docs/Sheets/Calendar, YouTube, LinkedIn, HubSpot, Airtable, Notion, Coda, Telegram, media processing, PII detection, and more.

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

`runAgent()` uses async polling internally — it submits the run, then polls until complete or failed. The poll interval defaults to 1 second and can be configured with `pollIntervalMs`.

## Batch execution

Execute multiple steps in parallel in a single request. All steps run server-side in parallel — results come back in the same order as the input. Individual failures don't affect other steps.

```typescript
const { results, totalBillingCost } = await agent.executeStepBatch([
  { stepType: 'generateImage', step: { prompt: 'A mountain landscape' } },
  { stepType: 'textToSpeech', step: { text: 'Welcome to the app' } },
  { stepType: 'searchGoogle', step: { query: 'TypeScript best practices' } },
]);

// Each result has: stepType, output?, billingCost?, error?
for (const r of results) {
  if (r.error) {
    console.error(`${r.stepType} failed: ${r.error}`);
  } else {
    console.log(`${r.stepType}:`, r.output);
  }
}
```

Maximum 50 steps per batch. Supports `appId` and `threadId` options for thread context.

From the CLI:

```bash
# Inline JSON array
mindstudio batch '[
  {"stepType": "generateImage", "step": {"prompt": "a sunset"}},
  {"stepType": "searchGoogle", "step": {"query": "cats"}}
]'

# Piped from a file
cat steps.json | mindstudio batch

# Strip metadata
mindstudio batch --no-meta '[...]'
```

Run `mindstudio batch` with no arguments for full usage help.

## Thread persistence

Steps execute within threads. Pass `$threadId` and `$appId` from a previous call to maintain state:

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

For scripts where all calls should share a single thread:

```typescript
const agent = new MindStudioAgent({ reuseThreadId: true });

// Or set MINDSTUDIO_REUSE_THREAD_ID=true

await agent.generateText({ message: 'My name is Alice' }); // creates a thread
await agent.generateText({ message: 'What is my name?' }); // reuses it automatically
```

## Managed databases and auth

When running inside a MindStudio app (managed mode), the SDK provides `db`, `auth`, and `resolveUser` for working with the app's managed SQLite databases and role-based access control. These are available as top-level imports:

```typescript
import { db, auth, Roles, resolveUser, User } from '@mindstudio-ai/agent';

// Define a typed table
const Orders = db.defineTable<Order>('orders');

// Query with a chainable API
const pending = await Orders
  .filter(o => o.status === 'pending')
  .sortBy(o => o.createdAt)
  .reverse()
  .take(20);

// Write
const order = await Orders.push({ item: 'Laptop', amount: 999, status: 'pending' });
await Orders.update(order.id, { status: 'approved' });

// Role-based access control
auth.requireRole(Roles.admin);
const admins = auth.getUsersByRole(Roles.admin);

// Resolve user display info
const user = await resolveUser(order.requestedBy);
```

See `src/db/README.md` and `src/auth/README.md` for the full API reference.

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

  // App ID for managed database/auth context (managed mode only)
  // Or set MINDSTUDIO_APP_ID env var. Auto-detected in sandbox.
  appId: 'your-app-id',
});
```

## Rate limiting

Handled automatically:

- **Concurrency queue** — requests beyond the server's concurrent limit are queued and proceed as slots open up
- **Auto-retry on 429** — rate-limited responses are retried using the `Retry-After` header (default: 3 retries, configurable via `maxRetries`)
- **Call cap** — internal tokens are capped at 500 calls per execution

Every result includes `$rateLimitRemaining` so you can throttle proactively.

## Billing

Every result includes optional billing metadata:

```typescript
const result = await agent.generateImage({ prompt: 'A sunset' });
console.log(result.$billingCost);   // cost in credits for this call
console.log(result.$billingEvents); // itemized billing events
```

## Error handling

```typescript
import { MindStudioAgent, MindStudioError } from '@mindstudio-ai/agent';

try {
  await agent.generateImage({ prompt: '...' });
} catch (err) {
  if (err instanceof MindStudioError) {
    console.error(err.message); // Human-readable message
    console.error(err.code);    // "invalid_step_config", "api_error", "call_cap_exceeded", etc.
    console.error(err.status);  // HTTP status (400, 401, 429, etc.)
    console.error(err.details); // Raw API error body
  }
}
```

## Low-level access

For step types not yet in the generated methods:

```typescript
const result = await agent.executeStep('someNewStep', { param1: 'value' });
```

## Types

All input/output types are exported:

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
  BatchStepInput,
  BatchStepResult,
  ExecuteStepBatchOptions,
  ExecuteStepBatchResult,
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
  ask "<question>"                   Ask about actions, models, connectors
  login                            Authenticate with MindStudio (opens browser)
  logout                           Clear stored credentials
  whoami                           Show current authentication status
  <method> [json | --flags]        Execute a step method
  exec <method> [json | --flags]   Execute a step method (same as above)
  batch [json]                     Execute multiple steps in parallel
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

The package includes a built-in [MCP](https://modelcontextprotocol.io) (Model Context Protocol) server. It exposes every action, helper, and agent tool — so any MCP-compatible AI agent (Claude Code, Cursor, Windsurf, VS Code Copilot, etc.) can discover and use the full platform.

Start manually:

```bash
mindstudio mcp
```

Or configure your MCP client (standalone binary or npx):

```json
{
  "mcpServers": {
    "mindstudio": {
      "command": "mindstudio",
      "args": ["mcp"],
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

Full JSON Schema definitions for every step's input and output. Useful for building your own tooling, code generators, or integrations.

## License

MIT
