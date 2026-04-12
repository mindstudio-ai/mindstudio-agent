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

  Debug logging: Any step method accepts an \`onLog\` callback in the second argument (options) for real-time debug logs during execution: \`await mindstudio.generateImage({ prompt: '...' }, { onLog: (e) => console.log(e.value) })\`. For task agents, use the \`onEvent\` callback instead. These are the programmatic equivalents of the CLI's stderr logging.

  Streaming: \`stream()\` is a separate function for sending SSE chunks to the frontend — it is NOT an option you pass to step methods. Streaming is automatic when the sandbox sets STREAM_ID. Import as \`import { stream } from '@mindstudio-ai/agent'\` and call \`await stream('Processing...')\` or \`await stream({ progress: 50 })\`. When there's no active stream, calls are silently ignored.

  Database queries (Query, Mutation) support both \`await\` and \`.then()/.catch()\` — use standard try/catch with await or chain \`.catch()\` directly.

  Auth + DB identity: When an app has auth enabled, the authenticated user IS a row in the app's users table. \`auth.userId\` is the row's \`id\` — do NOT add a separate \`userId\` column. Access user data with \`Users.get(auth.userId)\`. The platform creates the user row on first login and manages the \`email\`, \`phone\`, and \`roles\` columns automatically. IMPORTANT: The platform only populates the mapped auth columns (email, phone, roles) when creating the row — all other columns will be null until the developer's code sets them. Non-auth columns on the user table should be typed as optional (e.g. \`username?: string\`) and null-checked before use.

  Task agents: For multi-step tasks requiring autonomous tool use, use \`runTask()\`. Provide a prompt, input, SDK action names as tools (with optional default overrides), a \`structuredOutputExample\`, and a model. The platform runs a tool-use loop and returns structured output. Tools can include any SDK action — e.g. \`['searchGoogle', 'fetchUrl', { method: 'generateImage', defaults: { imageModelOverride: { model: 'seedream-4.5' } } }]\`. Supports SSE streaming via \`onEvent\` callback.

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
