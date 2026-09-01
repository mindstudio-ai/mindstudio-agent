/**
 * The `events` namespace — server→client realtime.
 *
 * `publish()` pushes a payload to named channels; any client holding a grant
 * that names one of those channels receives it instantly over a
 * platform-held SSE stream. `grant()` mints that subscribe token — call it
 * from a method AFTER your own authorization checks, because the grant is the
 * entire subscribe-side authorization: the platform delivers to whoever holds
 * it, no questions asked.
 *
 * ```ts
 * import { auth, events } from '@mindstudio-ai/agent';
 *
 * // The subscribe door is one of your own methods:
 * export async function watchJobs() {
 *   auth.requireRole('operator');
 *   return await events.grant(`jobs:${auth.userId}`); // { token, expiresAt, ttlSeconds }
 * }
 *
 * // Anything can publish — another method, a cron, a webhook handler:
 * export async function enqueueJob(input: { operator: string }) {
 *   const job = await Jobs.insert({ ...input, status: 'queued' });
 *   await events.publish(`jobs:${input.operator}`, { type: 'job', id: job.id });
 *   return job;
 * }
 * ```
 *
 * **A channel is an audience, and a method decides who is in it.** Never put
 * two users' data on one channel — the channel is the unit of authorization.
 * For membership-gated audiences (chat rooms, notifications), use per-user
 * channels and fan out at publish time (`events.publish(members.map(...))`) —
 * removing someone then stops their events immediately. Reserve shared
 * channels for genuinely broadcast content. For anonymous visitors,
 * `auth.userId` is null — key their channels on `session.visitorId` instead,
 * or `user:null` becomes one channel shared by every anonymous user.
 *
 * **Events are nudges, at-most-once.** Nothing is buffered for a
 * disconnected client and nothing is replayed on connect — subscribe for
 * speed, reconcile for truth (fetch current state when the stream opens).
 *
 * Environment isolation is automatic: publishes and grants are scoped to the
 * execution's world (live / preview / dev), so a dev-session publish can
 * never reach a live subscriber.
 */

/** @internal Transport provided by the client (POST /_internal/v2/app-events/<op>). */
export type EventsTransport = (op: string, body: unknown) => Promise<any>;

export interface EventGrantOptions {
  /**
   * Grant lifetime in seconds — also the stream lifetime and the
   * authorization staleness budget. The platform clamps to [60, 3600]
   * (default 900): at expiry the stream closes and the client re-mints
   * through your method, which re-runs your checks. A user whose access you
   * revoke keeps receiving for at most this long.
   */
  ttlSeconds?: number;
}

export interface EventGrantResult {
  /** Bearer token for `GET /_/events` (`Accept: text/event-stream`). */
  token: string;
  /** Milliseconds since epoch; the stream closes at this instant. */
  expiresAt: number;
  /** The clamped lifetime actually applied. */
  ttlSeconds: number;
}

export interface Events {
  /**
   * Publish a payload to one or many channels — one call, up to 500 channels,
   * so fanning out to every member of a room is a single request.
   *
   * Returns how many live subscriber connections were counted across the
   * published channels (a connection matching several of them counts once per
   * channel). `delivered: 0` is not an error — it means nobody is listening
   * right now, which is normal for a nudge.
   *
   * Payloads are capped at 32k serialized characters: publish ids and let the
   * client fetch, not documents.
   *
   * @throws MindStudioError on invalid channels, an oversize payload, or a
   *   platform failure. Unlike `stream()`, publishing is an explicit act and
   *   failures are not swallowed.
   */
  publish(
    channels: string | string[],
    data: unknown,
  ): Promise<{ delivered: number }>;

  /**
   * Mint a subscribe token for an explicit list of channels (up to 100, exact
   * names — letters, digits, `: _ - .`, no wildcards). Do your authorization
   * first; whoever holds the returned token WILL receive those channels'
   * events for its lifetime.
   *
   * Return the result from your method (`return await events.grant(...)`);
   * the client passes `result.token` to the events stream (the frontend SDK's
   * `getToken`, or `Authorization: Bearer` on `GET /_/events` for an external
   * client).
   */
  grant(
    channels: string | string[],
    options?: EventGrantOptions,
  ): Promise<EventGrantResult>;
}

/** @internal Factory used by the client; import the `events` singleton instead. */
export function createEvents(call: EventsTransport): Events {
  return {
    publish(channels, data) {
      return call('publish', { channels, data });
    },
    grant(channels, options) {
      return call('grant', { channels, ttlSeconds: options?.ttlSeconds });
    },
  };
}
