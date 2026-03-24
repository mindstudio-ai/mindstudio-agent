import { MindStudioAgent as _MindStudioAgent } from './client.js';
import type { StepMethods } from './generated/steps.js';
import type { AgentOptions } from './types.js';
import type { AuthContext as _AuthContext } from './auth/index.js';
import type { Db as _Db } from './db/index.js';

/** MindStudioAgent with all generated step methods. */
export type MindStudioAgent = _MindStudioAgent & StepMethods;

/** {@inheritDoc MindStudioAgent} */
export const MindStudioAgent = _MindStudioAgent as unknown as {
  new (options?: AgentOptions): MindStudioAgent;
};

export { MindStudioError } from './errors.js';
export { AuthContext, Roles } from './auth/index.js';
export type { Db, DefineTableOptions, Table, Query, Predicate, Accessor, PushInput, UpdateInput, SystemFields } from './db/index.js';
export type {
  AgentOptions,
  StepExecutionOptions,
  StepExecutionResult,
  StepExecutionMeta,
  StepLogEvent,
  User,
  ResolvedUser,
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
  BatchStepInput,
  BatchStepResult,
  ExecuteStepBatchOptions,
  ExecuteStepBatchResult,
} from './types.js';

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
