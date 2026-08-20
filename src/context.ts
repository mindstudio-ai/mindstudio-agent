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
 * Originating-session identity for method invocations triggered by a
 * conversational surface (a voice call's tool use, an agent-chat tool use).
 * Platform-resolved and guaranteed — never model- or client-supplied — so a
 * method can deterministically correlate back to the exact client session
 * that triggered it, including anonymous sessions (via `visitorId`).
 * Channel-discriminated so future surfaces extend without breaking.
 */
export interface SessionContext {
  /**
   * Which surface invoked this method: `voice`/`agent` for conversational
   * tool calls (which carry their session/thread ids below), `web` for a
   * browser interface-session method call, `api` for an app-key or
   * platform-key call. `web`/`api` carry only `visitorId`. Absent entirely
   * on older platform versions.
   */
  channel: 'voice' | 'agent' | 'web' | 'api';
  /** Voice-session id — matches the browser voice client's `session.sessionId`. */
  voiceSessionId?: string;
  /** Agent-chat thread id. */
  threadId?: string;
  /** Stable visitor key — present for anonymous AND signed-in sessions. */
  visitorId?: string;
  /**
   * Voice transport: a browser session (`web`) or a phone call, by direction.
   * Use it to branch behavior that assumes a screen — on a phone call there
   * is none, so describe everything in speech. Absent for agent-chat sessions
   * and on older platform versions — treat absent as `web`.
   */
  medium?: 'web' | 'phone-in' | 'phone-out';
  /**
   * Phone sessions only: the call's numbers (`fromNumber` = who initiated,
   * `to` = who was dialed, in both directions). Context and routing only —
   * caller ID is trivially spoofable, so never treat it as identity: don't
   * gate roles on it or speak account specifics to an unverified caller.
   * In-call verification is the auth rail.
   */
  sip?: { to: string; fromNumber: string };
}

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
  /** Originating-session identity (voice/agent tool calls); absent otherwise. */
  session?: SessionContext;
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
