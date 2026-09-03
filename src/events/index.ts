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

import { MindStudioError } from '../errors.js';

/** @internal Transport provided by the client (POST /_internal/v2/app-events/<op>). */
export type EventsTransport = (op: string, body: unknown) => Promise<any>;

/**
 * Serialized payload cap per publish, mirroring the platform's (which stays
 * authoritative). Exported so code whose publish carries data can check the
 * size BEFORE committing the write the publish announces — an oversize
 * payload discovered after the commit means the write landed and the
 * broadcast didn't. A publish that carries only ids can never hit this.
 */
export const MAX_EVENT_PAYLOAD_CHARS = 256_000;

export interface EventGrantOptions {
  /**
   * Grant lifetime in seconds — also the stream lifetime and the
   * authorization staleness budget. The platform clamps to [60, 3600]
   * (default 900): at expiry the stream closes and the client re-mints
   * through your method, which re-runs your checks. A user whose access you
   * revoke keeps receiving for at most this long.
   */
  ttlSeconds?: number;
  /**
   * Channels the holder may PUBLISH on (up to 20) — the client-direct
   * ephemeral path for cursors, typing, live strokes: the frontend calls
   * `sub.publish(...)` (or an external client `POST`s `/_/events`) and events
   * fan out with no method invoke per signal. Treat it like the browser-held
   * credential it is: whoever holds the token can inject events into these
   * channels until the TTL, so grant only channels this client should speak
   * on. Client events are capped small (8k serialized) and rate-boxed per
   * grant — they are signals, not documents.
   */
  publish?: string | string[];
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
   * right now, which is normal for a nudge. Also returns the platform-stamped
   * publish `id` — the same id arrives on every delivered frame (dedupe key
   * for consumers is id+channel), so it correlates your logs with
   * `remy-admin events tail`.
   *
   * Payloads are capped at `MAX_EVENT_PAYLOAD_CHARS` serialized characters,
   * checked here before anything touches the network — so an oversize payload
   * throws synchronously and shows up in local testing. If a publish carries
   * data (not just ids), publish before you commit the write it announces, or
   * check the size against the exported cap first: an oversize failure after
   * the commit means the write landed and no other client heard about it.
   * High-rate paths should publish ids and let the client fetch regardless.
   *
   * @throws MindStudioError on invalid channels, an oversize payload, or a
   *   platform failure. Unlike `stream()`, publishing is an explicit act and
   *   failures are not swallowed.
   */
  publish(
    channels: string | string[],
    data: unknown,
  ): Promise<{ delivered: number; id: string }>;

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
      // Pre-flight the size check so the data-dependent failure mode is
      // synchronous and local. The platform re-validates authoritatively.
      let serialized: string | undefined;
      try {
        serialized = JSON.stringify(data);
      } catch {
        throw new MindStudioError(
          'data must be JSON-serializable.',
          'invalid_payload',
          400,
        );
      }
      if (
        serialized !== undefined &&
        serialized.length > MAX_EVENT_PAYLOAD_CHARS
      ) {
        throw new MindStudioError(
          `data exceeds ${MAX_EVENT_PAYLOAD_CHARS} serialized characters. ` +
            `Publish an id and let the client fetch.`,
          'payload_too_large',
          400,
        );
      }
      return call('publish', { channels, data });
    },
    grant(channels, options) {
      return call('grant', {
        channels,
        ttlSeconds: options?.ttlSeconds,
        publish: options?.publish,
      });
    },
  };
}
