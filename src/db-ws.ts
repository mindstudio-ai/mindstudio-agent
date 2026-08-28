/**
 * DB-over-WebSocket transport.
 *
 * When `DB_WS_URL` is set, DB batches run over a single persistent, multiplexed
 * WebSocket to youai-api instead of a fresh cross-country `fetch` per call (one
 * handshake, no CF-per-call). Decoupled from the execute transport — this is a
 * dedicated socket.
 *
 * One connection per process, shared across concurrent invocations, so auth is
 * PER-FRAME (each frame carries that invocation's hook token):
 *   sandbox -> api : { t: 'db', id, token, databaseId, queries }
 *   api -> sandbox : { t: 'db-ack', id }                     (receipt)
 *                    { t: 'db-result', id, results }         (success)
 *                    { t: 'db-result', id, error: {...} }    (query error)
 *
 * A payload too large for one frame is split, in either direction:
 *   { t: 'db-chunk', id, seq, data } … { t: 'db-end', id }
 * The pieces are slices of the JSON text of the frame that would otherwise have
 * been sent whole, so a reassembled stream parses into exactly the same object
 * as the single-frame form. Chunking is only used against a server that echoed
 * the `ms-db-v2` subprotocol; against anything older this file behaves exactly
 * as it did before, including falling back to `fetch` for oversized frames.
 *
 * Transport failures (can't connect, dropped socket, no receipt, silence) throw
 * `DbWsTransportError` so the caller falls back to `fetch`. A query-error frame
 * throws a `MindStudioError` and is NOT retried over fetch (the query already
 * ran — re-running could double-apply a write).
 *
 * Uses the global `WebSocket` (Node 22+/browsers) via `globalThis` so there's no
 * new dependency and no DOM lib requirement.
 */
import { MindStudioError } from './errors.js';

/**
 * Subprotocol offered at connect. A server that understands chunking echoes it
 * back; anything else (including an older api pod mid-deploy) echoes the first
 * protocol offered instead, which is how we detect the difference with no round
 * trip.
 */
const DB_WS_SUBPROTOCOL = 'ms-db-v2';

/**
 * How long to wait for `db-ack` before treating the request as lost.
 *
 * This replaces a 300-second duration timeout as the primary failure signal, and
 * that swap is the point. Under the old scheme a request whose reply never came
 * back cost five minutes before falling back to HTTP — and because the socket
 * stayed open, the NEXT wave of queries paid it again. RPT-1181 was one
 * invocation paying it twice: 604s.
 */
const WS_ACK_TIMEOUT_MS = 20_000;

/**
 * How long to wait with NO frames at all for a request already acknowledged.
 *
 * Bounds silence, not duration: every `db-chunk` resets it, so an arbitrarily
 * large result transfers for as long as it needs provided bytes keep arriving.
 * Generous because between the ack and the first chunk sits the actual query,
 * and a slow query is not a broken transport. (A `db-progress` heartbeat during
 * execution would let this drop to ~60s; not needed yet.)
 */
const WS_IDLE_TIMEOUT_MS = 300_000;

const WS_OPEN_TIMEOUT_MS = 5_000;
const WS_OPEN = 1; // WebSocket.OPEN

/** Slice size for outbound chunking. Mirrors the server's `WS_CHUNK_CHARS`. */
const WS_CHUNK_CHARS = 256 * 1024;

/**
 * Frame ceiling for a LEGACY (non-chunking) server only.
 *
 * Conservative cap below the socket server's 1MB maxPayload — a frame over this
 * falls back to fetch (which allows more) rather than tripping the server limit
 * and dropping the shared connection for every concurrent invocation in this
 * process. Char length, which is cheap and slightly conservative versus bytes
 * for multibyte content. Against a chunking server there is no ceiling.
 */
const WS_MAX_FRAME_CHARS = 900_000;

/**
 * Thrown on a WS-transport failure so the caller can fall back to fetch.
 *
 * `sent` records whether the request was fully handed to the socket before the
 * failure. It decides whether a fetch retry is safe: an UNSENT request provably
 * never executed and always retries transparently; a SENT one may have executed
 * server-side with only the response lost — re-running a batch that contains
 * writes would double-apply them, so the caller only retries sent requests when
 * every statement is a read.
 *
 * For a chunked request `sent` only becomes true once `db-end` is away, so a
 * large write that fails partway through its own upload is provably unsent and
 * retries cleanly. That case used to skip the socket entirely.
 */
export class DbWsTransportError extends Error {
  override readonly name = 'DbWsTransportError';
  constructor(
    message: string,
    public readonly sent: boolean = false,
  ) {
    super(message);
  }
}

/**
 * Whether a statement is definitely read-only, for the retry decision above.
 * Deliberately conservative: only unambiguous read prefixes count — anything
 * else (including `WITH …`, which can head an INSERT) is treated as a write,
 * because the cost of misclassifying a write as a read is a double-apply.
 */
export function isReadOnlySql(sql: string): boolean {
  const head = sql.trimStart().slice(0, 8).toUpperCase();
  return (
    head.startsWith('SELECT') ||
    head.startsWith('PRAGMA') ||
    head.startsWith('EXPLAIN')
  );
}

interface SqlResult {
  rows: unknown[];
  changes: number;
}

interface Pending {
  resolve: (results: SqlResult[]) => void;
  reject: (err: Error) => void;
  /** Ack deadline, then the silence deadline once acked. */
  timer: ReturnType<typeof setTimeout> | null;
  acked: boolean;
}

/**
 * Everything scoped to ONE socket.
 *
 * `pending` used to be module-level while the socket was a module slot, so an
 * old socket's failure handler iterated the map and rejected frames belonging to
 * a NEW socket. Latent before; reachable the moment a timeout replaces the
 * socket (which it now does), so the map lives with its connection.
 */
interface Conn {
  ws: any;
  pending: Map<number, Pending>;
  /** Server echoed `ms-db-v2`, so chunking is available in both directions. */
  chunked: boolean;
  /** Reassembly buffers for inbound chunk streams, keyed by request id. */
  inbound: Map<number, string[]>;
  /**
   * Whether this server has ever sent an ack.
   *
   * The ack deadline only applies once we have seen one, so a new SDK talking to
   * an api pod that predates `db-ack` behaves exactly as it did before instead
   * of failing every request after 20s. The first request on a fresh socket
   * therefore relies on the silence deadline alone; every one after it gets the
   * fast check.
   */
  acksSeen: boolean;
  /** No longer accepting new requests; closes once `pending` drains. */
  retired: boolean;
}

let conn: Conn | null = null;
let opening: Promise<Conn> | null = null;
let idCounter = 0;

function clearPendingTimer(p: Pending): void {
  if (p.timer !== null) {
    clearTimeout(p.timer);
    p.timer = null;
  }
}

/** Drop a settled request and close the socket if it was retired and is now idle. */
function forget(self: Conn, id: number): void {
  self.pending.delete(id);
  self.inbound.delete(id);
  if (self.retired && self.pending.size === 0) {
    try {
      self.ws.close();
    } catch {
      // ignore
    }
  }
}

/**
 * Stop routing NEW requests to this socket, so the next batch opens a fresh one.
 *
 * Called when a request times out. A socket that has swallowed one request has
 * disproved itself, and leaving it in service is what turned a single 300s stall
 * into 604s: every subsequent wave preferred the same dead socket and paid the
 * timeout again.
 *
 * Deliberately does NOT close it while other requests are still in flight.
 * Closing would reject them all as `sent`, which for a batch containing writes
 * means a `db_transport_interrupted` for work that may well have been fine. They
 * keep their own deadlines and the socket closes behind the last of them.
 */
function retire(self: Conn, reason: string): void {
  if (self.retired) {
    return;
  }
  self.retired = true;
  if (conn === self) {
    conn = null;
  }
  try {
    console.warn(
      `[mindstudio] db: retiring WebSocket after ${reason}; next query reconnects.`,
    );
  } catch {
    // ignore
  }
  if (self.pending.size === 0) {
    try {
      self.ws.close();
    } catch {
      // ignore
    }
  }
}

function armIdleTimer(self: Conn, id: number, p: Pending): void {
  clearPendingTimer(p);
  p.timer = setTimeout(() => {
    forget(self, id);
    retire(self, 'a reply went silent');
    // The request went out and the reply stopped coming — the server may still
    // have executed it. SENT, like a socket drop.
    p.reject(new DbWsTransportError('ws reply went silent', true));
  }, WS_IDLE_TIMEOUT_MS);
}

/** Resolve or reject the pending entry for a completed `db-result` payload. */
function deliver(self: Conn, msg: any): void {
  const p = self.pending.get(msg.id);
  if (!p) {
    return;
  }
  clearPendingTimer(p);
  forget(self, msg.id);
  if (msg.error) {
    // A real query error — surface it; do NOT fall back to fetch.
    p.reject(
      new MindStudioError(
        `[db] ${msg.error.message || 'Database query failed'}`,
        msg.error.code || 'db_query_error',
        400,
        msg.error,
      ),
    );
  } else {
    p.resolve(msg.results as SqlResult[]);
  }
}

function failTransport(self: Conn, id: number, err: DbWsTransportError): void {
  const p = self.pending.get(id);
  if (!p) {
    return;
  }
  clearPendingTimer(p);
  forget(self, id);
  p.reject(err);
}

function getOrOpen(url: string, token: string): Promise<Conn> {
  if (conn && !conn.retired && conn.ws.readyState === WS_OPEN) {
    return Promise.resolve(conn);
  }
  if (opening) {
    return opening;
  }

  const WebSocketCtor = (globalThis as { WebSocket?: any }).WebSocket;
  if (!WebSocketCtor) {
    return Promise.reject(
      new DbWsTransportError('global WebSocket unavailable'),
    );
  }

  opening = new Promise<Conn>((resolve, reject) => {
    let ws: any;
    let self: Conn | null = null;

    const fail = (err: Error) => {
      clearTimeout(openTimer);
      if (self) {
        self.retired = true;
        if (conn === self) {
          conn = null;
        }
        // Every entry in `pending` was registered AFTER its frames were handed
        // to an OPEN socket, so a socket failure rejects them as SENT — the
        // server may have executed them with only the response lost. The caller
        // decides retryability from that flag.
        for (const [, p] of self.pending) {
          clearPendingTimer(p);
          p.reject(new DbWsTransportError(err.message, true));
        }
        self.pending.clear();
        self.inbound.clear();
      }
      opening = null;
      reject(err); // no-op if already resolved
    };

    const openTimer = setTimeout(() => {
      try {
        ws?.close();
      } catch {
        // ignore
      }
      fail(new DbWsTransportError('ws open timed out'));
    }, WS_OPEN_TIMEOUT_MS);

    try {
      // The connect-time token is a coarse gate on the server side (the socket
      // outlives this invocation and every frame carries its own token), so
      // whichever invocation happens to open the socket supplies it.
      ws = new WebSocketCtor(url, ['auth', token, DB_WS_SUBPROTOCOL]);
    } catch (err: any) {
      fail(new DbWsTransportError(err?.message || 'ws construct failed'));
      return;
    }

    self = {
      ws,
      pending: new Map(),
      chunked: false,
      inbound: new Map(),
      acksSeen: false,
      retired: false,
    };
    const c = self;

    ws.onopen = () => {
      clearTimeout(openTimer);
      c.chunked = ws.protocol === DB_WS_SUBPROTOCOL;
      conn = c;
      opening = null;
      resolve(c);
    };

    ws.onmessage = (ev: any) => {
      let msg: any;
      try {
        msg = JSON.parse(
          typeof ev.data === 'string' ? ev.data : String(ev.data),
        );
      } catch {
        return;
      }
      if (!msg || msg.id == null) {
        return;
      }

      if (msg.t === 'db-ack') {
        c.acksSeen = true;
        const p = c.pending.get(msg.id);
        if (p && !p.acked) {
          // Receipt confirmed. From here the bound is on silence rather than
          // duration, so neither a large transfer nor a slow query is racing a
          // clock it can lose to.
          p.acked = true;
          armIdleTimer(c, msg.id, p);
        }
        return;
      }

      if (msg.t === 'db-chunk') {
        const p = c.pending.get(msg.id);
        if (!p || typeof msg.data !== 'string') {
          return;
        }
        const parts = c.inbound.get(msg.id);
        if (parts) {
          parts.push(msg.data);
        } else {
          c.inbound.set(msg.id, [msg.data]);
        }
        // Forward progress — reset the silence deadline.
        armIdleTimer(c, msg.id, p);
        return;
      }

      if (msg.t === 'db-end') {
        const parts = c.inbound.get(msg.id);
        if (!parts) {
          return;
        }
        c.inbound.delete(msg.id);
        let assembled: any;
        try {
          // Concatenation is exact even where a slice split a surrogate pair:
          // `JSON.stringify` emits a lone surrogate as `\udXXX` and `JSON.parse`
          // restores it, so the pieces rejoin character-for-character.
          assembled = JSON.parse(parts.join(''));
        } catch {
          failTransport(
            c,
            msg.id,
            new DbWsTransportError('chunked reply did not parse', true),
          );
          return;
        }
        deliver(c, assembled);
        return;
      }

      if (msg.t === 'db-result') {
        deliver(c, msg);
      }
    };

    ws.onerror = () => fail(new DbWsTransportError('ws error'));
    ws.onclose = () => fail(new DbWsTransportError('ws closed'));
  });

  return opening;
}

/** Frames for one outbound request: whole, or chunked below the frame ceiling. */
function* outboundFrames(id: number, json: string): Generator<string> {
  if (json.length <= WS_CHUNK_CHARS) {
    yield json;
    return;
  }
  let seq = 0;
  for (let offset = 0; offset < json.length; offset += WS_CHUNK_CHARS) {
    yield JSON.stringify({
      t: 'db-chunk',
      id,
      seq: seq++,
      data: json.slice(offset, offset + WS_CHUNK_CHARS),
    });
  }
  yield JSON.stringify({ t: 'db-end', id });
}

export async function executeDbBatchOverWs(
  url: string,
  token: string,
  databaseId: string,
  queries: { sql: string; params?: unknown[] }[],
): Promise<SqlResult[]> {
  const id = ++idCounter;
  const frame = JSON.stringify({ t: 'db', id, token, databaseId, queries });

  const self = await getOrOpen(url, token);

  // A legacy server cannot take chunks, and a frame over its maxPayload would
  // drop the shared connection for everyone — so fall back to fetch instead of
  // sending, exactly as before.
  if (!self.chunked && frame.length > WS_MAX_FRAME_CHARS) {
    throw new DbWsTransportError('payload too large for ws');
  }

  return await new Promise<SqlResult[]>((resolve, reject) => {
    const pending: Pending = { resolve, reject, timer: null, acked: false };

    if (self.acksSeen) {
      pending.timer = setTimeout(() => {
        forget(self, id);
        retire(self, 'a request went unacknowledged');
        reject(new DbWsTransportError('ws ack timed out', true));
      }, WS_ACK_TIMEOUT_MS);
    } else {
      armIdleTimer(self, id, pending);
    }

    self.pending.set(id, pending);

    // `complete` stays false until the LAST frame is away, and that is what
    // `sent` reports: a multi-frame request the server never saw the end of
    // provably did not execute, so it is safe to retry over HTTP even when it
    // contains writes.
    let started = false;
    let complete = false;
    try {
      for (const out of outboundFrames(id, frame)) {
        self.ws.send(out);
        started = true;
      }
      complete = true;
    } catch (err: any) {
      clearPendingTimer(pending);
      forget(self, id);
      if (started) {
        // We left a partial stream on the wire. Retire so no further requests
        // ride this socket; the server discards partial streams when it closes.
        retire(self, 'a partial request upload failed');
      }
      reject(
        new DbWsTransportError(
          `ws send failed: ${err?.message || 'unknown'}`,
          complete,
        ),
      );
    }
  });
}
