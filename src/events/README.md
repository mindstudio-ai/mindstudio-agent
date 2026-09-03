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

data: {"id":"<publish-id>","channel":"jobs:usr_1","ts":1756700000000,"data":{"type":"job","id":"j_9"}}
data: {"type":"grant_expired"}        ← re-mint through your method and reconnect
data: {"type":"events_dropped","count":12,"ts":…} ← you fell behind; refetch state
: keepalive                            ← comment frames; skip them
```

If the grant was minted with `publish` channels, the same token also publishes —
batched, no method invoke per event:

```
POST https://{app-host}/_/events
Authorization: Bearer <token from your method>
Content-Type: application/json

{ "events": [ { "channels": "canvas:room1", "data": { "kind": "cursor", "x": 12, "y": 40, "seq": 991 } } ] }

→ { "accepted": 1 }
```

## API

### `events.publish(channels, data): Promise<{ delivered: number; id: string }>`

One call, up to 500 channels — fan out to a whole audience at once:

```ts
const members = await RoomMembers.where({ roomId });
await events.publish(
  members.map((m) => `user:${m.userId}`),
  { type: 'message', roomId, msg },
);
```

`delivered` is the live subscriber count across the published channels; `0` means nobody is listening right now, which is normal, not an error. `id` is the platform-stamped publish id — the same id arrives on every delivered frame (consumer dedupe key: `id` + `channel`), so it correlates your logs with `remy-admin events tail`. Payloads cap at `MAX_EVENT_PAYLOAD_CHARS` (256k) serialized characters, checked in the SDK before the network call, so oversize throws synchronously — if a publish carries data rather than ids, publish before you commit the write it announces (or check against the exported cap first). High-rate paths should publish ids and let the client fetch regardless. Throws `MindStudioError` on invalid input.

### `events.grant(channels, { ttlSeconds?, publish? }): Promise<{ token, expiresAt, ttlSeconds }>`

Mints a client token for an **explicit list** of channels (up to 100, exact names — letters, digits, `: _ - .`, no wildcards). The grant is the entire client-side authorization: whoever holds it receives those channels, and may publish ephemeral events on any channels named in `publish` (up to 20). Do your checks first. For anonymous visitors `auth.userId` is null — key their channels on `session.visitorId` instead, or `user:null` becomes one channel shared by every anonymous user.

`publish` is the fast path for cursors, typing, and live strokes: the frontend calls `sub.publish(...)` (from `events.connect`) and the platform fans out with no method invoke per signal. Scope it like the browser-held credential it is — the holder can inject events into those channels until the TTL. Client events cap at 8k serialized, ≤100 per batch, 30 batches/sec per grant; on any failure they are dropped, never retried. Durable state still goes through a method — signal ephemerally, commit through code.

`ttlSeconds` (clamped to 60–3600, default 900) is the stream's lifetime **and** your revocation window: at expiry the stream closes and the client re-mints through your method, which re-runs your checks.

## The rules that matter

- **A channel is an audience, and a method decides who is in it.** Never put two users' data on one channel.
- **Prefer per-user channels + publish-time fan-out** for membership-gated audiences (chat, notifications, queues) — removing someone stops their events immediately. Reserve shared channels for genuinely broadcast content (a ticker, a live blog), where revocation-at-TTL is fine.
- **Events are nudges, at-most-once.** Nothing is buffered or replayed. Subscribe for speed, reconcile for truth: fetch current state when the stream opens.
- **Environments never cross.** Publishes and grants are scoped to the execution's world (live / preview / dev) automatically — a dev-session publish cannot reach live subscribers.
