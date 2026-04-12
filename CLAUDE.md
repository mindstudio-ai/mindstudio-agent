# @mindstudio-ai/agent

TypeScript SDK for MindStudio's direct step execution API. Methods and types are auto-generated from the OpenAPI spec at build time.

## Project structure

```
src/
  index.ts              # Package entry — merges generated interfaces onto MindStudioAgent, re-exports, top-level db/auth/Roles
  client.ts             # MindStudioAgent class (hand-written, stable) — includes db/auth getters + ensureContext
  auth/
    index.ts            # AuthContext class (role checking) + Roles proxy
    README.md           # Auth namespace docs + usage examples
  db/
    index.ts            # createDb() factory + Db interface + time helpers (now, days, hours, minutes, ago, fromNow)
    table.ts            # Table<T> class — typed collection API (get, filter, push, update, remove, etc.)
    query.ts            # Query<T> class — lazy chainable builder (PromiseLike<T[]>), SQL/JS dual execution
    mutation.ts         # Mutation<T> class — lazy write operation (PromiseLike<T>), batchable via db.batch()
    predicate.ts        # Predicate compiler — arrow fn toString() → SQL WHERE clause (tokenizer + recursive descent)
    sql.ts              # SQL string builders (SELECT, INSERT, UPDATE, UPSERT, DELETE) + value escaping + row deserialization
    types.ts            # Internal types (Predicate, Accessor, TableConfig, SystemFields, PushInput, UpdateInput)
    README.md           # DB namespace docs — architecture, API reference, execution strategy
  task/
    index.ts            # runTask() — poll + SSE modes, tool mapping, alias resolution
    types.ts            # RunTaskOptions, RunTaskResult, TaskEvent, TaskUsage, TaskToolConfig
  config.ts             # Config file read/write for ~/.mindstudio/config.json (login persistence)
  cli.ts                # CLI entry point (bin script) — login, exec, list, agents, run, mcp commands
  mcp.ts                # Minimal MCP server (JSON-RPC 2.0 over stdio, zero deps)
  http.ts               # Fetch wrapper with concurrency queuing and 429 retry
  errors.ts             # MindStudioError class
  types.ts              # AgentOptions, StepExecutionOptions, StepExecutionResult, StepExecutionMeta, User, app context types, batch types
  rate-limit.ts         # Concurrency semaphore + call cap tracking
  generated/            # AUTO-GENERATED at build time — do not edit by hand
    types.ts            # Step input/output interfaces, StepName union, StepInputMap/StepOutputMap
    steps.ts            # StepMethods interface + applyStepMethods() runtime attachment
    helpers.ts          # HelperMethods interface + applyHelperMethods() runtime attachment (models, connectors, connections)
    snippets.ts         # monacoSnippets object (fields, output keys) + blockTypeAliases
    metadata.ts         # stepMetadata — full JSON schemas + descriptions for CLI/MCP
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

## CLI & MCP

The package ships a CLI binary (`mindstudio`) and a built-in MCP server for AI agent consumption.

- `mindstudio login` — device auth flow: opens browser, polls, saves API key to `~/.mindstudio/config.json`
- `mindstudio logout` — clears stored credentials
- `mindstudio whoami` — shows current auth source (flag, env, config file, or managed mode)
- `mindstudio exec <method> '<json>'` — execute a step method, JSON output to stdout
- `mindstudio list [--json] [--summary]` — list available methods (`--summary` for compact `{method: description}` JSON, `--json` for full schemas)
- `mindstudio agents [--json]` — list pre-built agents in the organization
- `mindstudio run <appId> [json | --flags]` — run a pre-built agent (async poll, returns result)
- `mindstudio batch [json]` — execute multiple steps in parallel (`POST /developer/v2/steps/execute-batch`). Input is a JSON array of `{ stepType, step }` objects (max 50). Supports `--app-id`, `--thread-id`, `--no-meta`. Input via arg or stdin pipe.
- `mindstudio mcp` — start MCP server (JSON-RPC 2.0 over stdio)
- Auth via `mindstudio login`, `--api-key` flag, or `MINDSTUDIO_API_KEY` env var
- MCP server creates one agent per session with `reuseThreadId: true`
- CLI supports `--app-id` and `--thread-id` for thread persistence across calls
- Both CLI and MCP consume `src/generated/metadata.ts` for method schemas and descriptions
- MCP exposes `listSteps` (compact discovery), `listAgents`, `runAgent`, `executeBatch`, and all helper methods (`listModels`, `listModelsByType`, `listModelsSummary`, `listModelsSummaryByType`, `listConnectors`, `getConnector`, `getConnectorAction`, `listConnections`, `estimateStepCost`) as tools alongside all step methods
- `tsup.config.ts` uses an array of two configs: library build (dts, sourcemap) + CLI build (shebang, no dts)

## Architecture notes

- **Zero runtime dependencies.** Uses built-in `fetch` (Node >= 18).
- **ESM only.** `"type": "module"` in package.json.
- **Type merging pattern.** Generated code exports `StepMethods` and `HelperMethods` interfaces. `index.ts` merges them onto `MindStudioAgent` via `export type MindStudioAgent = _MindStudioAgent & StepMethods & HelperMethods` + constructor retyping. Runtime methods are attached to the prototype via `applyStepMethods()` / `applyHelperMethods()`.
- **Flat results.** `StepExecutionResult<T> = T & StepExecutionMeta`. Output properties are spread at the top level. Metadata uses `$` prefix (`$appId`, `$threadId`, `$rateLimitRemaining`, `$billingCost`, `$billingEvents`).
- **S3 output resolution.** When the API returns `outputUrl` instead of inline `output`, the SDK auto-fetches the S3 JSON (`{ value: ... }`) and unwraps it transparently.
- **Streaming debug logs.** `StepExecutionOptions.onLog` enables SSE streaming from the step execution endpoint. When set, the SDK sends `Accept: text/event-stream`, parses log/done/error events, fires callbacks for log events, and resolves the promise on done. The CLI automatically enables streaming on TTY — log events render to stderr while the result goes to stdout.
- **Auth resolution order:** `CALLBACK_TOKEN` env (managed mode, always takes priority) → constructor `apiKey` → `MINDSTUDIO_API_KEY` env → `~/.mindstudio/config.json`.
- **Base URL resolution order:** constructor `baseUrl` → `MINDSTUDIO_BASE_URL` env → `REMOTE_HOSTNAME` env (managed mode) → `~/.mindstudio/config.json` → `https://v1.mindstudio-api.com`.
- **Config file** (`src/config.ts`): reads/writes `~/.mindstudio/config.json` with `{ apiKey?, baseUrl?, _updateCheck? }`. Used by `client.ts` for auth resolution and by `cli.ts` for login/logout/whoami commands. Device auth flow uses `GET /developer/v2/request-auth-url` and `POST /developer/v2/poll-auth-url`.
- **Update checker** (in `cli.ts`): non-blocking check against npm registry (`https://registry.npmjs.org/@mindstudio-ai/agent/latest`) on every CLI invocation (except `mcp` and `login`). Result cached in config `_updateCheck` for 1 hour. Prints a notice to stderr if a newer version is available.
- **Thread reuse:** constructor `reuseThreadId` → `MINDSTUDIO_REUSE_THREAD_ID` env (`"true"` / `"1"`). When enabled, the thread ID from the first API response is stored on the instance and automatically sent with all subsequent `executeStep` calls (unless an explicit `threadId` is passed in options).
- All step endpoints follow the pattern: `POST /developer/v2/steps/{stepType}/execute` with `{ step, appId?, threadId? }` body.
- `appId` and `threadId` are returned in response headers (`x-mindstudio-app-id`, `x-mindstudio-thread-id`).
- **Helper methods** are generated in `src/generated/helpers.ts` and attached to the prototype at runtime. They cover:
  - `listModels()` / `listModelsByType(modelType)` — `GET /developer/v2/helpers/models[/{modelType}]`
  - `listModelsSummary()` / `listModelsSummaryByType(modelType)` — `GET /developer/v2/helpers/models-summary[/{modelType}]` (lightweight: id, name, type, tags)
  - `listConnectors()` / `getConnector(serviceId)` — `GET /developer/v2/helpers/connectors[/{serviceId}]`
  - `getConnectorAction(serviceId, actionId)` — `GET /developer/v2/helpers/connectors/{serviceId}/{actionId}` (full action config with input fields)
  - `listConnections()` — `GET /developer/v2/helpers/connections` (authenticated, returns OAuth connection IDs for use with connector actions)
  - Connectors are sourced from the open-source [MindStudio Connector Registry (MSCR)](https://github.com/mindstudio-ai/mscr) with 850+ connector actions across third-party services. Connector actions are executed via the `runFromConnectorRegistry` step and require the user to connect to the third-party service in MindStudio first.
  - `estimateStepCost(stepType, step?, options?)` — `POST /developer/v2/helpers/step-cost-estimate` (returns `{ costType?, estimates? }` with per-event pricing info)
- **Agent methods** (`listAgents`, `runAgent`) are hand-written on `MindStudioAgent` (not generated). `listAgents()` calls `GET /developer/v2/agents/load`. `runAgent()` posts to `POST /developer/v2/agents/run` with `async: true`, then polls `GET /developer/v2/agents/run/poll/:callbackToken` until complete/error. Poll requests bypass the rate limiter (no auth needed, token is the secret). Default poll interval is 1s, configurable via `pollIntervalMs`.
- **Batch execution** (`executeStepBatch`) is hand-written on `MindStudioAgent`. POSTs to `POST /developer/v2/steps/execute-batch` with `{ steps: [{ stepType, step }], appId?, threadId? }`. Max 50 steps per batch. Steps run in parallel server-side. Results come back in input order. Individual failures don't affect other steps. S3 output URLs are resolved in parallel. Returns `{ results: BatchStepResult[], totalBillingCost?, appId?, threadId? }`. Types: `BatchStepInput`, `BatchStepResult`, `ExecuteStepBatchOptions`, `ExecuteStepBatchResult`.
- **Task agents** (`runTask`) are hand-written on `MindStudioAgent`. POSTs to `POST /developer/v2/task` which runs a multi-step tool-use loop server-side. The model receives the developer's prompt and a set of SDK actions as tools, calls them as needed, and produces structured JSON output matching a `structuredOutputExample`. Two modes: async poll (default, same backoff pattern as batch) and SSE streaming (when `onEvent` provided). Tools are SDK method names with optional default overrides — aliases are resolved via `resolveStepType()`. Types: `RunTaskOptions`, `RunTaskResult`, `TaskEvent`, `TaskUsage`, `TaskToolConfig`. Implementation in `src/task/`.
- **CLI command help** — commands that require arguments (`batch`, `run-agent`, `upload`, `estimate-cost`, `change-name`, `change-profile-picture`, `info`, and the catch-all action runner) display rich usage help via `usageBlock()` when called without required args, instead of terse error messages.

## `db`, `auth`, and `resolveUser` (apps v2)

The SDK exposes `db`, `auth`, `Roles`, and `resolveUser` for MindStudio's managed SQLite databases, role-based access control, and user resolution. All are available as top-level imports (bound to the lazy singleton) and as instance properties.

See `src/db/README.md` and `src/auth/README.md` for full API references with examples.

### Imports

```typescript
import { mindstudio, db, auth, Roles, resolveUser, User } from '@mindstudio-ai/agent';
```

For step execution (actions), use the `mindstudio` singleton: `await mindstudio.generateImage(...)`, `await mindstudio.runTask(...)`. `db` and `auth` are proxies bound to the same singleton. `Roles` is a standalone string proxy. `resolveUser` is a convenience wrapper. `User` is a branded string type for user ID columns. `new MindStudioAgent()` is only needed for external usage with a custom API key.

### Defining tables

Tables are TypeScript interfaces + a `db.defineTable()` call. Define them at module scope — `defineTable()` is lazy (no HTTP until queries execute).

```typescript
import { db, User } from '@mindstudio-ai/agent';

interface PurchaseOrder {
  // System fields — required in the interface, managed by platform
  id: string;
  createdAt: number;
  updatedAt: number;
  lastUpdatedBy: string;

  // Your fields
  vendorId: string;
  requestedBy: User;
  totalAmountCents: number;
  status: 'pending_approval' | 'approved' | 'active' | 'rejected' | 'closed';
  lineItems: LineItem[];      // nested objects stored as JSON
  notes?: string;             // optional fields are nullable columns
}

export const PurchaseOrders = db.defineTable<PurchaseOrder>('purchase_orders');
```

System columns (`id`, `createdAt`, `updatedAt`, `lastUpdatedBy`) must be in the interface but are auto-managed — excluded from `push()` and `update()` inputs.

For apps with multiple databases: `db.defineTable<T>('name', { database: 'db-name-or-id' })`.

#### Table options

```typescript
const Users = db.defineTable<User>('users', {
  unique: [['email']],                    // unique constraint on email
  defaults: { role: 'member' },           // applied client-side in push()/upsert()
});

// Compound unique constraint
const Memberships = db.defineTable<Membership>('memberships', {
  unique: [['userId', 'orgId']],
});
```

- `unique` — array of column groups. Each entry is a `string[]` of column names that together must be unique. The SDK sends these to the platform which creates SQLite `UNIQUE` indexes idempotently. Required for `upsert()`.
- `defaults` — default values for columns, applied client-side in `push()` and `upsert()`. Explicit values override defaults.

### Reading data

All read methods return lazy `Query` objects — nothing executes until `await`. Every read method (including `get()`, `findOne()`, `count()`, etc.) is batchable via `db.batch()`.

```typescript
// Get by ID
const order = await PurchaseOrders.get(orderId);

// Get all rows
const allOrders = await PurchaseOrders.toArray();

// Filter — compiles to SQL WHERE when possible
const active = await PurchaseOrders.filter(o => o.status === 'active');

// Chain operations (lazy until await)
const recentPending = await PurchaseOrders
  .filter(o => o.status === 'pending_approval')
  .sortBy(o => o.createdAt)
  .reverse()
  .take(50);

// Find one
const order = await PurchaseOrders.findOne(o => o.vendorId === vendorId);

// Aggregations
const total = await PurchaseOrders.count();
const pendingCount = await PurchaseOrders.count(o => o.status === 'pending_approval');
const hasActive = await PurchaseOrders.some(o => o.status === 'active');
const allClosed = await PurchaseOrders.every(o => o.status === 'closed');
const empty = await PurchaseOrders.isEmpty();
const cheapest = await PurchaseOrders.min(o => o.totalAmountCents);
const biggest = await PurchaseOrders.max(o => o.totalAmountCents);

// Grouping
const byStatus = await PurchaseOrders.groupBy(o => o.status);
// Map { 'pending_approval' => [...], 'approved' => [...] }

// Pagination
const page2 = await PurchaseOrders.sortBy(o => o.createdAt).reverse().skip(50).take(50);
```

**Filter predicates** that compile to SQL (efficient): field comparisons (`===`, `!==`, `<`, `>`, `<=`, `>=`), null checks, `&&`/`||`, `!`, `.includes()` for IN/LIKE, boolean fields. Anything else falls back to JS (works correctly, just scans all rows).

### Writing data

```typescript
// Insert — system fields auto-populated, returns created row
const po = await PurchaseOrders.push({
  vendorId: vendor.id,
  requestedBy: auth.userId,
  totalAmountCents: 50000,
  status: 'pending_approval',
  lineItems: [{ description: 'Laptops', amountCents: 50000, quantity: 5 }],
});
console.log(po.id, po.createdAt); // system fields populated

// Insert multiple
const orders = await PurchaseOrders.push([item1, item2, item3]);

// Partial update — returns updated row
await PurchaseOrders.update(po.id, { status: 'approved' });

// Upsert — insert or update on conflict (requires unique constraint)
const user = await Users.upsert('email', {
  email: 'alice@example.com',
  name: 'Alice',
  role: 'admin',
});
// → INSERT ... ON CONFLICT(email) DO UPDATE SET name=..., role=... RETURNING *

// Delete — remove() returns { deleted: boolean }, clear() returns count
const { deleted } = await PurchaseOrders.remove(po.id);
const removed = await PurchaseOrders.removeAll(o => o.status === 'rejected');
const cleared = await PurchaseOrders.clear();
```

Write methods throw `MindStudioError` on failure: `push()` throws `insert_failed` if the insert returns no row, `update()` throws `row_not_found` (404) if the ID doesn't exist, `upsert()` throws `missing_conflict_key` if the conflict column is missing from the data.

### Batching reads and writes

`db.batch()` executes multiple operations in a single round trip. Accepts both `Query` (reads) and `Mutation` (writes) objects. Operations execute in order on a single SQLite connection — writes are visible to subsequent reads in the same batch.

```typescript
// Mixed reads and writes — one HTTP call
const [, newOrder, pending] = await db.batch(
  PurchaseOrders.update(existingId, { status: 'approved' }),
  PurchaseOrders.push({ vendorId: 'v1', status: 'pending_approval', ... }),
  PurchaseOrders.filter(o => o.status === 'pending_approval').take(10),
);

// Bulk updates — N updates in one round trip
const items = await Items.filter(i => i.categoryId === oldCategoryId);
await db.batch(
  ...items.map(item => Items.update(item.id, { categoryId: newCategoryId })),
);
```

### Time helpers

All timestamps are unix ms. Use `db` helpers for readable time math:

```typescript
db.now()                          // current unix timestamp (ms)
db.days(n) / db.hours(n) / db.minutes(n)  // duration in ms
db.ago(db.days(2))                // 2 days ago as unix timestamp
db.fromNow(db.hours(48))         // 48 hours from now
db.ago(db.days(7) + db.hours(12)) // 7.5 days ago (composable)
```

### Auth and roles

```typescript
import { auth, Roles } from '@mindstudio-ai/agent';

// Current user (null if unauthenticated)
const userId = auth.userId;         // string | null
const myRoles = auth.roles;         // readonly string[]

// Check roles (OR logic — true if user has ANY of the listed roles)
if (auth.hasRole(Roles.admin, Roles.approver)) { ... }

// Gate access — throws 401 if no user, 403 if user lacks all listed roles
auth.requireRole(Roles.admin);

// Look up users by role
const reviewers = auth.getUsersByRole(Roles.grc);
```

`Roles` is a proxy: `Roles.admin === "admin"`. Any property works.

### Resolving users

The `User` type is a branded string (UUID). When you need display info:

```typescript
import { resolveUser } from '@mindstudio-ai/agent';

const user = await resolveUser(order.requestedBy);
// { id, name, email?, profilePictureUrl? } or null

// Batch resolution (max 100)
const { users } = await agent.resolveUsers(['user-1', 'user-2']);
```

### Context resolution

`db` and `auth` require app context (role assignments + database metadata):

- **Inside MindStudio sandbox** (CALLBACK_TOKEN auth): automatic — context resolved from token or `globalThis.ai` globals.
- **Outside sandbox** (API key): `GET /developer/v2/helpers/app-context?appId={appId}`, cached for instance lifetime. `appId` resolved from constructor → `MINDSTUDIO_APP_ID` env → auto-detected from first `executeStep` response header.
- `db` operations auto-hydrate on first query. `auth` is sync — in sandbox it's automatic; outside, call `await agent.ensureContext()` first or use after any `db` operation.

### Internal implementation details

- **Predicate compilation** (`src/db/predicate.ts`): parses `fn.toString()` → tokenizer → recursive descent parser → SQL WHERE. Falls back to JS for unrecognized patterns.
- **SQL generation** (`src/db/sql.ts`): uses `parameterize: false` on `queryAppDatabase` step, builds fully-formed SQL with inline escaped values. SQLite escaping (single quotes doubled). System columns stripped from writes. `@@user@@` prefix added/stripped for user-type columns.
- **Query execution** (`src/db/query.ts`): `Query<T, TResult>` is immutable and lazy (implements `PromiseLike<TResult>`). The second type parameter defaults to `T[]` but changes for terminal methods (e.g., `first()` → `Query<T, T | null>`, `count()` → `Query<T, number>`). Terminal methods use a `postProcess` transform applied after row deserialization. All Query objects are batchable via `db.batch()` (except `every()` which stays async). Tries SQL fast path; if any predicate fails to compile, entire chain falls back to JS array operations on all rows.
- **Mutation execution** (`src/db/mutation.ts`): `Mutation<T>` is lazy (implements `PromiseLike<T>`). Write methods (`push`, `update`, `upsert`, `remove`, `removeAll`, `clear`) return Mutations instead of Promises. When awaited standalone, behavior is identical. When passed to `db.batch()`, SQL is bundled into a single round trip. `removeAll` with JS-fallback predicates creates a non-batchable Mutation (works standalone, throws in `db.batch()`).
- **Unique constraints**: Declared via `defineTable({ unique: [['email']] })`. Stored in `TableConfig.unique`. Schema sync (creating SQLite UNIQUE indexes) is handled by a separate platform service — the SDK only uses the declaration for `upsert()` validation (conflict keys must match a declared constraint) and generating `ON CONFLICT` SQL.
- **Defaults**: Declared via `defineTable({ defaults: { status: 'pending' } })`. Applied client-side in `push()` and `upsert()` — spread before user data so explicit values override.
- **`db.batch()` supports reads and writes** (`src/db/index.ts`): accepts both `Query` and `Mutation` objects. A single Mutation may produce multiple SQL statements (e.g. `push([a, b, c])` = 3 INSERTs). The batch groups by databaseId, flattens all SQL, executes, then slices results back to their operations. Write ordering is preserved — statements execute sequentially on a single SQLite connection.

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
3. **src/generated/helpers.ts** — `HelperMethods` interface + `applyHelperMethods()` for models, models-summary, connectors, connector actions, and connections endpoints
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
