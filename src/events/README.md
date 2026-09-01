# events — Server→Client Realtime

Publish to named channels from backend code; clients holding a **grant** receive the payloads instantly over a platform-held SSE stream. No polling, no sandbox held open while nothing happens.

## Quick start

```ts
import { auth, events } from '@mindstudio-ai/agent';

// 1. The subscribe door is one of YOUR methods — do your auth, then mint:
export async function watchJobs() {
  auth.requireRole('operator');
  return await events.grant(`jobs:${auth.userId}`); // { token, expiresAt, ttlSeconds }
}

// 2. Anything can publish — a method, a cron, a webhook handler:
export async function enqueueJob(input: { operator: string }) {
  const job = await Jobs.insert({ ...input, status: 'queued' });
  await events.publish(`jobs:${input.operator}`, { type: 'job', id: job.id });
  return job;
}
```

An external client needs no SDK:

```
GET https://{app-host}/_/events
Authorization: Bearer <token from your method>
Accept: text/event-stream

data: {"channel":"jobs:usr_1","data":{"type":"job","id":"j_9"},"ts":1756700000000}
data: {"type":"grant_expired"}        ← re-mint through your method and reconnect
: keepalive                            ← comment frames; skip them
```

## API

### `events.publish(channels, data): Promise<{ delivered: number }>`

One call, up to 500 channels — fan out to a whole audience at once:

```ts
const members = await RoomMembers.where({ roomId });
await events.publish(
  members.map((m) => `user:${m.userId}`),
  { type: 'message', roomId, msg },
);
```

`delivered` is the live subscriber count across the published channels; `0` means nobody is listening right now, which is normal, not an error. Payloads cap at 32k serialized characters — publish ids, let the client fetch. Throws `MindStudioError` on invalid input.

### `events.grant(channels, { ttlSeconds? }): Promise<{ token, expiresAt, ttlSeconds }>`

Mints a subscribe token for an **explicit list** of channels (up to 100, exact names — letters, digits, `: _ - .`, no wildcards). The grant is the entire subscribe-side authorization: whoever holds it receives those channels. Do your checks first. For anonymous visitors `auth.userId` is null — key their channels on `session.visitorId` instead, or `user:null` becomes one channel shared by every anonymous user.

`ttlSeconds` (clamped to 60–3600, default 900) is the stream's lifetime **and** your revocation window: at expiry the stream closes and the client re-mints through your method, which re-runs your checks.

## The rules that matter

- **A channel is an audience, and a method decides who is in it.** Never put two users' data on one channel.
- **Prefer per-user channels + publish-time fan-out** for membership-gated audiences (chat, notifications, queues) — removing someone stops their events immediately. Reserve shared channels for genuinely broadcast content (a ticker, a live blog), where revocation-at-TTL is fine.
- **Events are nudges, at-most-once.** Nothing is buffered or replayed. Subscribe for speed, reconcile for truth: fetch current state when the stream opens.
- **Environments never cross.** Publishes and grants are scoped to the execution's world (live / preview / dev) automatically — a dev-session publish cannot reach live subscribers.
