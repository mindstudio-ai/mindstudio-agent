import { MindStudioAgent as _MindStudioAgent } from './client.js';
import type { StepMethods } from './generated/steps.js';
import type { AgentOptions, ReportIssueInput } from './types.js';
import type { AuthContext as _AuthContext } from './auth/index.js';
import type { Db as _Db } from './db/index.js';
import type { Files as _Files } from './files/index.js';
import type { DataSources as _DataSources } from './datasources/index.js';

/** MindStudioAgent with all generated step methods. */
export type MindStudioAgent = _MindStudioAgent & StepMethods;

/** {@inheritDoc MindStudioAgent} */
export const MindStudioAgent = _MindStudioAgent as unknown as {
  new (options?: AgentOptions): MindStudioAgent;
};

export { MindStudioError } from './errors.js';
export { AuthContext, Roles } from './auth/index.js';
export { runWithContext, getRequestContext } from './context.js';
export type { RequestContext } from './context.js';
export type { Db, DefineTableOptions, Table, Query, Predicate, Accessor, PushInput, UpdateInput, SystemFields } from './db/index.js';
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
  RunTaskResult,
  TaskEvent,
  TaskUsage,
  TaskToolCall,
} from './task/index.js';

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
export {
  stepMetadata,
  type StepMetadata,
} from './generated/metadata.js';

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
export const mindstudio: MindStudioAgent = new Proxy(
  {} as MindStudioAgent,
  {
    get(_, prop, receiver) {
      _default ??= new MindStudioAgent();
      const value = Reflect.get(_default, prop, _default);
      return typeof value === 'function' ? value.bind(_default) : value;
    },
  },
);

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
export const auth: _AuthContext = new Proxy(
  {} as _AuthContext,
  {
    get(_, prop) {
      const target = mindstudio.auth;
      const value = Reflect.get(target, prop, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  },
);

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
export const db: _Db = new Proxy(
  {} as _Db,
  {
    get(_, prop) {
      const target = mindstudio.db;
      const value = Reflect.get(target, prop, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  },
);

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
export const files: _Files = new Proxy(
  {} as _Files,
  {
    get(_, prop) {
      const target = mindstudio.files;
      const value = Reflect.get(target, prop, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  },
);

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
export const dataSources: _DataSources = new Proxy(
  {} as _DataSources,
  {
    get(_, prop) {
      const target = mindstudio.dataSources;
      const value = Reflect.get(target, prop, target);
      return typeof value === 'function' ? value.bind(target) : value;
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
