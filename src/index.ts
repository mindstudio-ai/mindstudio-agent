import { MindStudioAgent as _MindStudioAgent } from './client.js';
import type { StepMethods } from './generated/steps.js';
import type { AgentOptions, ReportIssueInput } from './types.js';
import type { AuthContext as _AuthContext } from './auth/index.js';
import type { Db as _Db } from './db/index.js';
import type { Files as _Files } from './files/index.js';
import type { DataSources as _DataSources } from './datasources/index.js';
import type { Voice as _Voice } from './voice/index.js';
import type { Analytics as _Analytics } from './analytics/index.js';

/** MindStudioAgent with all generated step methods. */
export type MindStudioAgent = _MindStudioAgent & StepMethods;

/** {@inheritDoc MindStudioAgent} */
export const MindStudioAgent = _MindStudioAgent as unknown as {
  new (options?: AgentOptions): MindStudioAgent;
};

export { MindStudioError } from './errors.js';
export { AuthContext, Roles } from './auth/index.js';
export { runWithContext, getRequestContext } from './context.js';
export type { RequestContext, SessionContext } from './context.js';
import {
  getRequestContext,
  type SessionContext as _SessionContext,
} from './context.js';
export type {
  Db,
  DefineTableOptions,
  Table,
  Query,
  RawQuery,
  Batchable,
  Predicate,
  Accessor,
  PushInput,
  UpdateInput,
  SystemFields,
  AggregateSelect,
  AggregateTerm,
  AggregateRow,
} from './db/index.js';
export { defineJewel } from './jewel/index.js';
export type {
  Jewel,
  JewelConfig,
  JewelMethod,
  JewelMethodInput,
  JewelProposal,
  JewelVerdict,
  JewelGradeContext,
  JewelRunParams,
  JewelPairRecord,
  JewelsApi,
  JewelProposeOutcome,
  JewelProposeResult,
  JewelQueueItem,
  JewelQueueResolution,
  JewelQueueResolveResult,
} from './jewel/index.js';
export type {
  Files,
  DefineStoreOptions,
  Store,
  StoredFile,
  UploadToken,
  FileAccess,
  PutOptions,
  ListOptions,
} from './files/index.js';
export type {
  AgentOptions,
  StepExecutionOptions,
  StepExecutionResult,
  StepExecutionMeta,
  StepLogEvent,
  User,
  ResolvedUser,
  ReportIssueInput,
  ReportedIssue,
  AgentInfo,
  ListAgentsResult,
  UserInfoResult,
  RunAgentOptions,
  RunAgentResult,
  MindStudioModel,
  MindStudioModelSummary,
  ModelType,
  ConnectorService,
  ConnectorActionDetail,
  Connection,
  StepCostEstimateEntry,
  UploadFileResult,
  AppRoleAssignment,
  AppAuthContext,
  AppDatabaseColumnSchema,
  AppDatabaseTable,
  AppDatabase,
  AppContextResult,
  AuthTableConfig,
  BatchStepInput,
  BatchStepResult,
  ExecuteStepBatchOptions,
  ExecuteStepBatchResult,
  PackagedWorkflow,
  PackagedWorkflowInput,
  PackagedWorkflowSignature,
} from './types.js';
export type {
  TaskToolConfig,
  RunTaskOptions,
  RunTaskOptionsWithExample,
  RunTaskOptionsWithSchema,
  RunTaskResult,
  TaskEvent,
  TaskUsage,
  TaskToolCall,
  JsonSchema,
  JsonObjectSchema,
  JsonSchemaTypeName,
  FromSchema,
  SchemaValidationError,
} from './task/index.js';
export type { Voice, VoiceCallResult } from './voice/index.js';
export type {
  Analytics,
  AnalyticsMetric,
  AnalyticsDimension,
  AnalyticsFilterOp,
  AnalyticsFilter,
  AnalyticsGranularity,
  AnalyticsDateRange,
  AnalyticsQuerySpec,
  AnalyticsQueryResultRow,
  AnalyticsQueryResponse,
  AnalyticsReadOptions,
  LiveNow,
  TopSource,
  MapPoint,
  AiSourceVendor,
  CrawlerOverview,
  CrawlerBucket,
  CrawlerHit,
} from './analytics/index.js';

// Re-export all generated types
export * from './generated/types.js';
export type { StepMethods } from './generated/steps.js';
export {
  monacoSnippets,
  blockTypeAliases,
  type MonacoSnippet,
  type MonacoSnippetField,
  type MonacoSnippetFieldType,
} from './generated/snippets.js';
export { stepMetadata, type StepMetadata } from './generated/metadata.js';

// ---------------------------------------------------------------------------
// Lazy default singleton
// ---------------------------------------------------------------------------

/**
 * Lazy default instance — created on first property access.
 * Uses env/config auth, so no constructor args needed.
 *
 * ```ts
 * import { mindstudio } from '@mindstudio-ai/agent';
 * const { imageUrl } = await mindstudio.generateImage({ prompt: 'a sunset' });
 * ```
 */
let _default: MindStudioAgent;
export const mindstudio: MindStudioAgent = new Proxy({} as MindStudioAgent, {
  get(_, prop, receiver) {
    _default ??= new MindStudioAgent();
    const value = Reflect.get(_default, prop, _default);
    return typeof value === 'function' ? value.bind(_default) : value;
  },
});

export default mindstudio;

// ---------------------------------------------------------------------------
// Top-level auth and db — bound to the lazy singleton
// ---------------------------------------------------------------------------
//
// These provide the ergonomic import style matching the sketch's
// `import { db, auth, Roles } from '@mindstudio/app'`:
//
// ```ts
// import { db, auth, Roles } from '@mindstudio-ai/agent';
//
// const Orders = db.defineTable<Order>('orders');
// auth.requireRole(Roles.admin);
// ```
//
// Under the hood they proxy to `mindstudio.db` and `mindstudio.auth`.
// The mindstudio singleton is lazily created on first access, so these
// are safe to reference at module scope.

/**
 * Top-level `auth` namespace bound to the default singleton.
 *
 * Provides the current user's identity and roles. Requires context
 * hydration before use — call `await mindstudio.ensureContext()` or
 * perform any `db` operation first.
 *
 * @example
 * ```ts
 * import { auth, Roles } from '@mindstudio-ai/agent';
 *
 * auth.requireRole(Roles.admin);
 * const admins = auth.getUsersByRole(Roles.admin);
 * ```
 */
export const auth: _AuthContext = new Proxy({} as _AuthContext, {
  get(_, prop) {
    const target = mindstudio.auth;
    const value = Reflect.get(target, prop, target);
    return typeof value === 'function' ? value.bind(target) : value;
  },
});

/**
 * Top-level `db` namespace bound to the default singleton.
 *
 * Use `db.defineTable<T>(name)` to create typed collections. Table
 * definitions are lazy — no HTTP until you await a query. Context is
 * auto-hydrated on first query execution.
 *
 * @example
 * ```ts
 * import { db } from '@mindstudio-ai/agent';
 *
 * const Orders = db.defineTable<Order>('orders');
 * const active = await Orders.filter(o => o.status === 'active').take(10);
 * ```
 */
export const db: _Db = new Proxy({} as _Db, {
  get(_, prop) {
    const target = mindstudio.db;
    const value = Reflect.get(target, prop, target);
    return typeof value === 'function' ? value.bind(target) : value;
  },
});

/**
 * Top-level `files` namespace bound to the default singleton.
 *
 * Private-by-default file storage — the twin of `db`. Use
 * `files.defineStore(name)` at module scope, then `.put/.get/.list/.delete`.
 * `file.url` is a stable on-domain URL for the app frontend; `file.shareUrl()`
 * mints a signed link that works without a session.
 *
 * @example
 * ```ts
 * import { files } from '@mindstudio-ai/agent';
 *
 * const Uploads = files.defineStore('uploads');
 * const f = await Uploads.put(buffer, { contentType: 'application/pdf' });
 * ```
 */
export const files: _Files = new Proxy({} as _Files, {
  get(_, prop) {
    const target = mindstudio.files;
    const value = Reflect.get(target, prop, target);
    return typeof value === 'function' ? value.bind(target) : value;
  },
});

/**
 * Top-level `dataSources` namespace bound to the default singleton.
 *
 * Searchable document corpora. Declare one at module scope and import the
 * handle; the platform owns parsing, chunking, embedding and isolation.
 *
 * @example
 * ```ts
 * import { dataSources } from '@mindstudio-ai/agent';
 *
 * const Policies = dataSources.defineDataSource('policies');
 * const { results } = await Policies.search('what are the payment terms?');
 * ```
 */
export const dataSources: _DataSources = new Proxy({} as _DataSources, {
  get(_, prop) {
    const target = mindstudio.dataSources;
    const value = Reflect.get(target, prop, target);
    return typeof value === 'function' ? value.bind(target) : value;
  },
});

/**
 * Top-level `voice` namespace bound to the default singleton.
 *
 * Telephony: outbound calls answered by this app's voice agent. See the
 * `voice` module docs for identity, limits, and compliance notes.
 *
 * @example
 * ```ts
 * import { voice } from '@mindstudio-ai/agent';
 *
 * await voice.call({ to: '+13105551234', assumeIdentity: true });
 * ```
 */
export const voice: _Voice = new Proxy({} as _Voice, {
  get(_, prop) {
    const target = mindstudio.voice;
    const value = Reflect.get(target, prop, target);
    return typeof value === 'function' ? value.bind(target) : value;
  },
});

/**
 * Top-level `analytics` namespace bound to the default singleton.
 *
 * Read the app's own traffic + event analytics from method code. Queries
 * touching at most one dimension with `is` filters read a lifetime rollup;
 * cross-dimension / `is_not` / `contains` reads scan 90-day raw events —
 * `meta.source` and `meta.clamped` report which. See the `analytics` module
 * docs.
 *
 * @example
 * ```ts
 * import { analytics } from '@mindstudio-ai/agent';
 *
 * const top = await analytics.query({
 *   metrics: ['pageviews', 'visitors'],
 *   dimensions: ['path'],
 *   dateRange: 'all',
 * });
 * ```
 */
export const analytics: _Analytics = new Proxy({} as _Analytics, {
  get(_, prop) {
    const target = mindstudio.analytics;
    const value = Reflect.get(target, prop, target);
    return typeof value === 'function' ? value.bind(target) : value;
  },
});

/**
 * Originating-session identity for this invocation — set when the method was
 * triggered by a conversational surface (a voice call's tool use, an
 * agent-chat tool use), absent on plain API/web/cron invocations.
 *
 * Values are platform-resolved and guaranteed (never model- or
 * client-supplied), so they're safe to key on: `session.voiceSessionId`
 * matches the browser voice client's `session.sessionId`, and
 * `session.visitorId` correlates anonymous sessions. Properties read from the
 * per-request context, so they're always this request's values — check
 * `session.channel` to detect whether one is present.
 *
 * @example
 * ```ts
 * import { db, session } from '@mindstudio-ai/agent';
 *
 * export async function searchKnowledgeBase({ query }: { query: string }) {
 *   const results = await runSearch(query);
 *   if (session.voiceSessionId) {
 *     // Deterministic correlation back to the browser in this exact call.
 *     await ToolResults.insert({ sessionId: session.voiceSessionId, results });
 *   }
 *   return results;
 * }
 * ```
 */
export const session: Readonly<Partial<_SessionContext>> = new Proxy(
  {} as Partial<_SessionContext>,
  {
    get(_, prop) {
      const ctx = getRequestContext();
      return ctx?.session?.[prop as keyof _SessionContext];
    },
  },
);

/**
 * Top-level `stream` function bound to the default singleton.
 *
 * Send a stream chunk to the caller via SSE. When the method was called
 * with `stream: true`, chunks arrive in real-time. When there is no active
 * stream, calls are silently ignored.
 *
 * @example
 * ```ts
 * import { stream } from '@mindstudio-ai/agent';
 *
 * await stream('Processing...');
 * await stream({ progress: 50 });
 * ```
 */
export const stream = (data: string | Record<string, unknown>) =>
  mindstudio.stream(data);

/**
 * Top-level `waitUntil` bound to the default singleton.
 *
 * Register background work so the platform keeps the sandbox alive until it
 * settles (bounded at ~30 minutes) and records an interruption in the request
 * log if the sandbox is torn down anyway. Failures are caught and logged —
 * they can never crash the sandbox. Use it around fire-and-forget chains:
 *
 * @example
 * ```ts
 * import { waitUntil } from '@mindstudio-ai/agent';
 *
 * waitUntil(enrichRecord(id).then((d) => Records.update(id, d)));
 * return { status: 'processing' };
 * ```
 */
export const waitUntil = (promise: Promise<unknown>) =>
  mindstudio.waitUntil(promise);

/**
 * Resolve a user ID to display info (name, email, profile picture).
 * Bound to the default singleton.
 *
 * @example
 * ```ts
 * import { resolveUser } from '@mindstudio-ai/agent';
 *
 * const user = await resolveUser(order.requestedBy);
 * if (user) console.log(user.name, user.email);
 * ```
 */
export const resolveUser = (userId: string) => mindstudio.resolveUser(userId);

/**
 * File a bug report or feature idea into this app's issue tracker.
 * Bound to the default singleton. Backend / managed-context only.
 *
 * @example
 * ```ts
 * import { reportIssue } from '@mindstudio-ai/agent';
 *
 * const { number } = await reportIssue({ title: 'Checkout fails', kind: 'bug' });
 * ```
 *
 * @see {@link MindStudioAgent.reportIssue}
 */
export const reportIssue = (input: ReportIssueInput) =>
  mindstudio.reportIssue(input);

/**
 * Invalidate this app's prerendered snapshot(s) so crawlers get a fresh render
 * on their next visit. Bound to the default singleton. Backend / managed-context
 * only. Omit `paths` (or pass an empty array) to purge every snapshot.
 *
 * @example
 * ```ts
 * import { prerender } from '@mindstudio-ai/agent';
 *
 * await prerender.invalidate(['/u/abc']);
 * ```
 *
 * @see {@link MindStudioAgent.invalidatePrerender}
 */
export const prerender = {
  invalidate: (paths?: string[]) => mindstudio.invalidatePrerender(paths),
};
