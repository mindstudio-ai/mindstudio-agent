/**
 * Reference docs section — placed in the middle of the system prompt
 * (bulk content available for lookup).
 *
 * All sections wrapped in XML tags per Anthropic guidance.
 */

export interface ReferenceData {
  modelsSummary: string;
  connections: string;
  connectorServices: string;
  llmsContent: string;
}

export function buildReferenceDocs(data: ReferenceData): string {
  return `<sdk_reference>
  <quick_reference>
  Auth is always pre-configured. Use the \`mindstudio\` singleton for actions: \`import { mindstudio } from '@mindstudio-ai/agent'\`. Use \`db\`, \`auth\`, \`Roles\`, \`stream\` as direct named imports. Do NOT use \`new MindStudioAgent()\` in code examples for MindStudio apps — the singleton handles auth automatically.
  Calling convention: \`const result = await mindstudio.methodName({ ...input })\`
  Results are flat: output fields + \`$appId\`, \`$threadId\`, \`$billingCost\` metadata.
  Thread persistence: pass \`{ threadId: result.$threadId, appId: result.$appId }\` as second arg.
  All 200+ models accessed through one API key — MindStudio routes to the provider server-side.

  Execution visibility (\`onLog\`):
  - **All step methods** (generateImage, generateText, searchGoogle, etc.) accept an \`onLog\` callback in the OPTIONS object (second argument). This enables SSE streaming with real-time progress during execution. Example: \`await mindstudio.generateImage({ prompt: '...' }, { onLog: (event) => console.log(event.tag, event.value) })\`. The event has \`{ value: string, tag: string, ts: number }\`. It works on ANY step method.
  - **Task agents** use \`onEvent\` (on the options object itself, not a second arg) for streaming events during the tool-use loop.

  \`stream()\` — pushing updates to the frontend:
  \`stream()\` sends real-time SSE events from server-side method code to the frontend. Two distinct behaviors depending on what you pass:
  - \`stream('text')\` → sent as a \`token\` event. The frontend's \`onToken\` callback receives the **accumulated** text (not a delta — each call contains the full text so far). Use for streaming text output progressively.
  - \`stream({ ... })\` → sent as a \`data\` event. The frontend receives this via a separate \`onStreamData\` handler (NOT \`onToken\`). Use for structured progress updates, status changes, URLs, etc.
  These are fundamentally different event types. Do NOT mix them up — \`stream({ status: 'done' })\` will NOT appear in \`onToken\`, and \`stream('Processing...')\` will NOT appear in \`onStreamData\`.
  \`stream()\` is silently ignored when there is no active SSE connection (CLI, background jobs) — always safe to include unconditionally.

  Progress for long-running operations:
  For any step that takes more than a few seconds (video generation, image generation, audio generation, lipsync, upscaling, etc.), ALWAYS use \`onLog\` combined with \`stream()\` to keep the user informed. This is the standard pattern, not optional:
  \`\`\`typescript
  import { mindstudio, stream } from '@mindstudio-ai/agent';

  // Send structured progress updates (frontend reads via onStreamData)
  await stream({ status: 'generating_video', message: 'Starting video generation...' });
  const { videoUrl } = await mindstudio.generateVideo({
    prompt: '...',
  }, {
    onLog: (event) => stream({ status: 'progress', message: event.value }),
  });
  await stream({ status: 'complete', videoUrl });
  \`\`\`
  Without this pattern, long-running operations appear to hang with no feedback to the user.

  Prompt caching and cost: Anthropic prompt caching is enabled automatically on every LLM call. There is NO SDK toggle, no opt-in flag, no configuration — it cannot be enabled or disabled. The platform marks the static portion of each request (system prompt + tool descriptions + leading conversation history) for caching, and subsequent calls within the 5-minute TTL read from cache at roughly 10% of full input cost. The \`$billingCost\` returned on every step result is the post-cache amount. In multi-turn chatbot / RAG / tool-use loops, expect 40-60% of input tokens to be served from cache after the first turn. NEVER tell a user "MindStudio doesn't support prompt caching" or "the SDK doesn't expose caching" — both are wrong. Caching is on, automatic, and already discounted. The SDK does not currently surface per-call cache hit/miss counts (no \`$cacheReadTokens\` field today), but the discount IS being applied. Real cost levers for chat/RAG/tool-using agents, in priority order: (1) trim tool descriptions — JSON tool schemas are larger than people expect and add to every turn, (2) cap conversation history by turn count or token budget with summarization on overflow (single biggest variable cost driver in multi-turn chat), (3) pre-filter large contexts via embedding retrieval before passing to the expensive model rather than dumping a whole library in the prompt, (4) shorten the system prompt — every K saved is one K not in the cache footprint either. Do NOT recommend "enabling prompt caching" as a cost-reduction strategy; it's already on and the savings are already in \`$billingCost\`.

  Database queries (Query, Mutation) support both \`await\` and \`.then()/.catch()\` — use standard try/catch with await or chain \`.catch()\` directly.

  Filter predicates and bindings: Filters compile to SQL when the predicate uses field comparisons, &&/||, .includes(), null checks, and boolean fields with literal values. Predicates that reference outer-scope variables (e.g. \`o => o.companyId === input.companyId\`) cannot be compiled — JavaScript closures aren't inspectable from outside the function — so they fall back to JS and scan the whole table. For filters on tables that may grow, ALWAYS use the explicit-bindings form so the filter compiles to SQL: \`Investments.filter((i, $) => i.companyId === $.companyId, { companyId: input.companyId })\`. The second predicate parameter (any name — \`$\`, \`vars\`, \`b\`) signals that bindings are in play; the third argument provides the values. Supported on filter, findOne, count, some, every, removeAll. Bound array → \`$.ids.includes(o.field)\` compiles to IN; bound string → \`o.field.includes($.text)\` compiles to LIKE. Missing keys fall back to JS — the SDK does not substitute NULL. ALWAYS include an inline code comment when you write the bindings form so downstream coding agents don't "simplify" the bindings argument away, e.g. \`{ companyId: input.companyId } // bindings: lifts closure var so filter compiles to SQL\`.

  Auth + DB identity: When an app has auth enabled, the authenticated user IS a row in the app's users table. \`auth.userId\` is the row's \`id\` — do NOT add a separate \`userId\` column. Access user data with \`Users.get(auth.userId)\`. The platform creates the user row on first login and manages the \`email\`, \`phone\`, and \`roles\` columns automatically. IMPORTANT: The platform only populates the mapped auth columns (email, phone, roles) when creating the row — all other columns will be null until the developer's code sets them. Non-auth columns on the user table should be typed as optional (e.g. \`username?: string\`) and null-checked before use.

  User-typed columns: The \`User\` type is just \`string\` at runtime. Write plain UUIDs to user-typed columns — do NOT add a \`@@user@@\` prefix manually and do NOT use \`as any\`. The SDK adds and strips the prefix automatically on read/write. If TypeScript complains about assigning a plain string to a \`User\` field, use \`db.userRef(id)\` to type-cast cleanly. Reads always return bare UUIDs; use \`resolveUser(id)\` when you need display info (name, email, avatar). Never do your own prefix handling — it will fight the SDK and cause double-prefixing or orphan refs. The \`@@user@@\` prefix is only visible in storage if you bypass the SDK with raw SQL; app code should never see or produce it.

  Task agents: For multi-step tasks requiring autonomous tool use, use \`runTask()\`. Provide a prompt, input, SDK action names as tools (with optional default overrides), a \`structuredOutputExample\`, and a model. The platform runs a tool-use loop and returns structured output. Tools can include any SDK action — e.g. \`['searchGoogle', 'fetchUrl', { method: 'generateImage', defaults: { imageModelOverride: { model: 'seedream-4.5' } } }]\`. Supports SSE streaming via \`onEvent\` callback.

  Reporting bugs / ideas (\`reportIssue\`): For building an in-app "Report a bug" or feedback feature, use \`mindstudio.reportIssue({ title, body?, kind?, reporter? })\` (also importable directly as \`reportIssue\`). It files an issue into the app's issue tracker — visible to the app's team in the dashboard and pickup-able by the Remy agent. Backend only: wire it as frontend UI → app backend method → \`reportIssue\` (a browser can't call it; it uses the app's hook token, and the app id is derived server-side). \`kind\` is \`'bug'\` (default) or \`'idea'\`. \`reporter\` is a free-form display label (a name, email, or ticket id) — NOT an identity check and not tied to a user; pass the current user's email if you have it, or omit for anonymous. It returns the created issue — show \`result.number\` to confirm "Reported as #42". Rate limited per app (20/min): catch \`MindStudioError\` with \`code === 'rate_limited'\` and show a graceful "try again shortly" message, and debounce the submit button (every call creates a new issue — no dedupe).

  Table options: \`db.defineTable<T>(name, { unique, defaults })\`.
  - \`unique: [['email'], ['userId', 'orgId']]\` — declares unique constraints (SDK communicates to platform, enables upsert).
  - \`defaults: { status: 'pending' }\` — client-side defaults applied in push() and upsert().
  - \`Table.upsert(conflictKey, data)\` — INSERT ... ON CONFLICT ... DO UPDATE. Conflict key must match a declared unique constraint. Returns created or updated row.
  </quick_reference>

  <model_overrides>
  Actions that use AI models accept a model override object. Each model has its own config options (dimensions, seed, etc.) defined in its \`inputs\` array. The \`inputs[].variable\` values are the keys for the \`config\` object:

  \`\`\`typescript
  import { mindstudio } from '@mindstudio-ai/agent';

  await mindstudio.generateImage({
    prompt: 'a sunset',
    imageModelOverride: {
      model: 'flux-pro-2',
      config: {
        width: 1024,
        height: 768,
        seed: 42,
      }
    }
  });
  \`\`\`

  Call listModels with details=true to discover the available config options for a model. The \`inputs\` array in the response defines what config keys are valid, their types, defaults, and constraints.
  </model_overrides>

  <actions>
  ${data.llmsContent}
  </actions>

  <models>
  ${data.modelsSummary}
  </models>

  <oauth_connections>
  ${data.connections}
  </oauth_connections>

  <connector_services>
  OAuth connector services from the MindStudio Connector Registry. Each service has multiple actions (850+ total). Use the getConnectorDetails tool to drill into a service's actions and get input fields. Connector actions are executed via the \`runFromConnectorRegistry\` SDK action and require the user to have an OAuth connection set up for that service.

  ${data.connectorServices}
  </connector_services>
</sdk_reference>`;
}
