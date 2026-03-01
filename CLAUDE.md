# @mindstudio-ai/agent

TypeScript SDK for MindStudio's direct step execution API. Methods and types are auto-generated from the OpenAPI spec at build time.

## Project structure

```
src/
  index.ts              # Package entry — merges generated interfaces onto MindStudioAgent, re-exports
  client.ts             # MindStudioAgent class (hand-written, stable)
  http.ts               # Fetch wrapper with concurrency queuing and 429 retry
  errors.ts             # MindStudioError class
  types.ts              # AgentOptions, StepExecutionOptions, StepExecutionResult, StepExecutionMeta
  rate-limit.ts         # Concurrency semaphore + call cap tracking
  generated/            # AUTO-GENERATED at build time — do not edit by hand
    types.ts            # Step input/output interfaces, StepName union, StepInputMap/StepOutputMap
    steps.ts            # StepMethods interface + applyStepMethods() runtime attachment
    helpers.ts          # HelperMethods interface + applyHelperMethods() runtime attachment
    snippets.ts         # monacoSnippets object (fields, output keys) + blockTypeAliases
scripts/
  codegen.ts            # Fetches OpenAPI spec → generates src/generated/* + llms.txt
llms.txt                # Generated — compact LLM-friendly reference of all methods
examples/
  demo.ts               # Simple test script
  package.json           # Uses file:.. dependency for local testing
```

## Key commands

- `npm run build` — codegen (from prod API) + tsup build (ESM only, outputs dist/)
- `npm run build:local` — same but codegen from `http://localhost:3129`
- `npm run dev` — tsup watch mode (does NOT re-run codegen)
- `npm run codegen` — regenerate types only (defaults to prod)
- `npm run codegen -- --file path/to/openapi.json` — codegen from a local file
- `npm run typecheck` — tsc --noEmit

`prepare` and `prepublishOnly` both run `build:local`.

## Architecture notes

- **Zero runtime dependencies.** Uses built-in `fetch` (Node >= 18).
- **ESM only.** `"type": "module"` in package.json.
- **Type merging pattern.** Generated code exports `StepMethods` and `HelperMethods` interfaces. `index.ts` merges them onto `MindStudioAgent` via `export type MindStudioAgent = _MindStudioAgent & StepMethods & HelperMethods` + constructor retyping. Runtime methods are attached to the prototype via `applyStepMethods()` / `applyHelperMethods()`.
- **Flat results.** `StepExecutionResult<T> = T & StepExecutionMeta`. Output properties are spread at the top level. Metadata uses `$` prefix (`$appId`, `$threadId`, `$rateLimitRemaining`).
- **S3 output resolution.** When the API returns `outputUrl` instead of inline `output`, the SDK auto-fetches the S3 JSON (`{ value: ... }`) and unwraps it transparently.
- **Auth resolution order:** constructor `apiKey` → `MINDSTUDIO_API_KEY` env → `CALLBACK_TOKEN` env (managed mode).
- **Base URL resolution order:** constructor `baseUrl` → `MINDSTUDIO_BASE_URL` env → `REMOTE_HOSTNAME` env (managed mode) → `https://v1.mindstudio-api.com`.
- **Thread reuse:** constructor `reuseThreadId` → `MINDSTUDIO_REUSE_THREAD_ID` env (`"true"` / `"1"`). When enabled, the thread ID from the first API response is stored on the instance and automatically sent with all subsequent `executeStep` calls (unless an explicit `threadId` is passed in options).
- All step endpoints follow the pattern: `POST /developer/v2/steps/{stepType}/execute` with `{ step, appId?, threadId? }` body.
- `appId` and `threadId` are returned in response headers (`x-mindstudio-app-id`, `x-mindstudio-thread-id`).

## Rate limiting

- **Concurrency queue** (`src/rate-limit.ts`): semaphore pattern, initial limits based on auth type (10 internal / 20 API key), dynamically adjusted from `x-ratelimit-concurrency-limit` response headers.
- **Auto-retry on 429** (`src/http.ts`): respects `Retry-After` header, configurable `maxRetries` (default 3).
- **Call cap for internal tokens**: 500 calls max, throws `MindStudioError` with code `call_cap_exceeded` when exceeded.

## Method renames

Some internal step names are renamed for the public API. Renames are defined in `METHOD_ALIASES` at the top of `scripts/codegen.ts`:

```typescript
const METHOD_ALIASES: Record<string, string> = {
  generateText: 'userMessage',
  generateAsset: 'generatePdf',
};
```

When a step has a rename, the original name is removed from `StepMethods` and the prototype. Only the renamed version is exposed. `monacoSnippets` includes both keys (alias and original) as duplicate entries. `blockTypeAliases` maps alias method name → original step type name for reverse-mapping.

## Codegen details

`scripts/codegen.ts` is a custom generator. It produces:

1. **src/generated/types.ts** — input/output interfaces from JSON Schema, `StepName` union, `StepInputMap`/`StepOutputMap`, type aliases for renamed steps
2. **src/generated/steps.ts** — `StepMethods` interface with JSDoc (`description` as main line, `x-usage-notes` as `@remarks`, snippet as `@example`), `applyStepMethods()` for runtime
3. **src/generated/helpers.ts** — `HelperMethods` interface + `applyHelperMethods()` for models/connectors endpoints
4. **src/generated/snippets.ts** — `monacoSnippets` object with fields (required params + types) and output keys, plus `blockTypeAliases` for renamed steps
5. **llms.txt** — compact LLM reference with full typed input/output shapes, categorized by integration

The OpenAPI spec provides `description` (one-line summary) and `x-usage-notes` (bullet-pointed usage details) separately per operation. Both are used for IntelliSense and llms.txt.

Generated files + llms.txt are gitignored. `npm run build` runs codegen then tsup. `prepare` runs `build:local`, so `npm install` from git auto-generates everything against the local API.

## Testing

- `examples/` directory has a simple test project using `file:..` dependency
- Run `cd examples && npm run demo` to test against the API
- No re-install needed after building — `file:..` links directly to parent dist/

## Code style

- Prettier: single quotes, trailing commas, 80 char width, 2-space indent
- Strict TypeScript
