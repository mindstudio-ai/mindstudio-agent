/**
 * AsyncLocalStorage-based request context for concurrent execution.
 *
 * When the sandbox wraps each handler call in `runWithContext()`, all SDK
 * reads (auth, db, callback token, base URL) pull from the request-scoped
 * store instead of process globals. This enables concurrent request
 * processing on persistent sandbox workers without identity leakage.
 *
 * Fully backwards compatible — when no ALS store is active, all getters
 * fall back to the existing global/env-based behavior.
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import type { AppAuthContext, AppDatabase, AuthTableConfig } from './types.js';

/**
 * Per-request context provided by the sandbox execution service.
 * Contains everything the SDK needs to resolve auth, databases, and
 * API endpoints for a specific request.
 */
export interface RequestContext {
  /** Hook/callback token for this request's auth. */
  callbackToken: string;
  /** API base URL for this request (e.g. from REMOTE_HOSTNAME). */
  remoteHostname?: string;
  /** Auth context: userId + role assignments for this request's user. */
  auth?: AppAuthContext;
  /** Database metadata for this request's app. */
  databases?: AppDatabase[];
  /** Auth table config (managed columns) for this request's app. */
  authConfig?: AuthTableConfig;
  /** Stream ID for SSE streaming in this request. */
  streamId?: string;
}

const als = new AsyncLocalStorage<RequestContext>();

/**
 * Get the current request context from AsyncLocalStorage, if any.
 * Returns undefined when not running inside `runWithContext()`.
 * @internal
 */
export function getRequestContext(): RequestContext | undefined {
  return als.getStore();
}

/**
 * Run an async function with a scoped request context. Inside `fn`, all
 * SDK reads (auth, db, callback token, base URL) pull from `ctx` instead
 * of process globals.
 *
 * This enables concurrent request processing — multiple `runWithContext()`
 * calls can execute in parallel without identity leakage.
 *
 * @example
 * ```ts
 * import { runWithContext } from '@mindstudio-ai/agent';
 *
 * await runWithContext({
 *   callbackToken: req.callbackToken,
 *   auth: req.auth,
 *   databases: req.databases,
 * }, async () => {
 *   // auth.userId returns this request's user, not the global one
 *   const user = await Users.get(auth.userId);
 * });
 * ```
 */
export function runWithContext<T>(
  ctx: RequestContext,
  fn: () => T | Promise<T>,
): T | Promise<T> {
  return als.run(ctx, fn);
}
