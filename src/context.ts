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

// AsyncLocalStorage: available in Node.js, no-op in browsers.
// Dynamic import avoids top-level node:async_hooks reference that crashes browsers.
interface AlsLike {
  getStore(): RequestContext | undefined;
  run(store: RequestContext, fn: () => unknown): unknown;
}

const noopAls: AlsLike = {
  getStore: () => undefined,
  run: (_store: RequestContext, fn: () => unknown) => fn(),
};

let als: AlsLike = noopAls;

// Synchronous init: if we're in Node.js, load AsyncLocalStorage immediately.
// The top-level await on a dynamic import resolves before any user code runs.
try {
  if (typeof process !== 'undefined' && process.versions?.node) {
    const mod = await import('node:async_hooks');
    als = new mod.AsyncLocalStorage() as AlsLike;
  }
} catch {
  // Not available — als stays as noopAls
}

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
  return als.run(ctx, fn) as T | Promise<T>;
}
