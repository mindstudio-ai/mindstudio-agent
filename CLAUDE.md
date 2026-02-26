# @mindstudio-ai/agent

TypeScript SDK for MindStudio's direct step execution API. Every method and type is auto-generated from the OpenAPI spec.

## Project structure

```
src/
  index.ts              # Package entry point — re-exports everything
  client.ts             # MindStudioAgent class (hand-written, stable)
  http.ts               # Thin fetch() wrapper, no deps
  errors.ts             # MindStudioError class
  types.ts              # AgentOptions, StepExecutionOptions, StepExecutionResult<T>
  generated/            # AUTO-GENERATED — do not edit by hand
    types.ts            # 121 step input/output interfaces, StepName union, StepInputMap/StepOutputMap
    steps.ts            # Module augmentation adding typed methods to MindStudioAgent
    helpers.ts          # Module augmentation for listModels, listConnectors, etc.
scripts/
  codegen.ts            # Fetches OpenAPI spec → generates src/generated/*
```

## Key commands

- `npm run build` — build with tsup (ESM only, outputs dist/)
- `npm run dev` — watch mode
- `npm run codegen` — regenerate types from the API (defaults to localhost:3129)
- `npm run codegen -- --url https://v1.mindstudio-api.com` — codegen against prod
- `npm run codegen -- --file path/to/openapi.json` — codegen from a local file
- `npm run typecheck` — tsc --noEmit

## Architecture notes

- **Zero runtime dependencies.** Uses built-in `fetch` (Node >= 18).
- **ESM only.** `"type": "module"` in package.json.
- **Module augmentation pattern.** Generated code adds typed methods to `MindStudioAgent` via `declare module "../client.js"` and attaches them to the prototype at import time via `applyStepMethods()` / `applyHelperMethods()`. This keeps hand-written and generated code cleanly separated.
- **Auth resolution order:** constructor `apiKey` → `MINDSTUDIO_API_KEY` env → `CALLBACK_TOKEN` env (managed mode).
- **Base URL resolution order:** constructor `baseUrl` → `MINDSTUDIO_BASE_URL` env → `REMOTE_HOSTNAME` env (managed mode) → `https://v1.mindstudio-api.com`.
- All 121 step endpoints follow the same pattern: `POST /developer/v2/steps/{stepType}/execute` with `{ step, appId?, threadId? }` body.
- The `appId` and `threadId` are returned in response headers (`x-mindstudio-app-id`, `x-mindstudio-thread-id`).

## Codegen details

The codegen script (`scripts/codegen.ts`) is a custom ~580-line generator, not a generic OpenAPI codegen tool. It understands the specific uniform structure of this API:

1. Fetches the OpenAPI spec from the API
2. For each `/steps/{stepType}/execute` path: extracts the `step` property schema (input) and `output` property schema (output)
3. Converts JSON Schema → TypeScript (handles objects, arrays, enums, `anyOf`, `type: ["string", "null"]`, `$ref`)
4. Generates JSDoc from operation `summary` + `description`
5. Unresolvable `$ref` (only in Slack endpoint) → `unknown`

Generated files are committed to git so consumers get types without needing a running API.

## Code style

- Prettier: single quotes, trailing commas, 80 char width, 2-space indent
- Strict TypeScript
