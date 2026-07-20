/**
 * DB-over-WebSocket transport (sandbox only).
 *
 * When the sandbox injects `DB_WS_URL`, DB batches run over a single persistent,
 * multiplexed WebSocket to youai-api instead of a fresh cross-country `fetch`
 * per call (one handshake, no CF-per-call). Decoupled from the execute
 * transport — this is a dedicated sandbox→api socket.
 *
 * One connection per process, shared across concurrent invocations, so auth is
 * PER-FRAME (each frame carries that invocation's hook token):
 *   sandbox -> api : { t: 'db', id, token, databaseId, queries }
 *   api -> sandbox : { t: 'db-result', id, results }        (success)
 *                    { t: 'db-result', id, error: {...} }   (query error)
 *
 * Transport failures (can't connect, dropped socket, timeout, send failure)
 * throw `DbWsTransportError` so the caller falls back to `fetch`. A query-error
 * frame throws a `MindStudioError` and is NOT retried over fetch (the query
 * already ran — re-running could double-apply a write).
 *
 * Uses the global `WebSocket` (Node 22+/browsers) via `globalThis` so there's no
 * new dependency and no DOM lib requirement.
 */
import { MindStudioError } from './errors.js';

const WS_REQUEST_TIMEOUT_MS = 300_000;
const WS_OPEN_TIMEOUT_MS = 5_000;
const WS_OPEN = 1; // WebSocket.OPEN
// Conservative cap below the socket server's 1MB maxPayload — a frame over this
// falls back to fetch (which allows more) rather than tripping the server limit
// and dropping the shared connection. Char length (cheap, slightly conservative
// vs. bytes for multibyte content).
const WS_MAX_FRAME_CHARS = 900_000;

/** Thrown on a WS-transport failure so the caller can fall back to fetch. */
export class DbWsTransportError extends Error {
  override readonly name = 'DbWsTransportError';
}

interface SqlResult {
  rows: unknown[];
  changes: number;
}

interface Pending {
  resolve: (results: SqlResult[]) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

let socket: any = null;
let opening: Promise<any> | null = null;
let idCounter = 0;
const pending = new Map<number, Pending>();

function getOrOpen(url: string): Promise<any> {
  if (socket && socket.readyState === WS_OPEN) {
    return Promise.resolve(socket);
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

  opening = new Promise<any>((resolve, reject) => {
    let ws: any;
    const fail = (err: Error) => {
      clearTimeout(openTimer);
      if (socket === ws) {
        socket = null;
      }
      opening = null;
      for (const [, p] of pending) {
        clearTimeout(p.timer);
        p.reject(err);
      }
      pending.clear();
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
      ws = new WebSocketCtor(url);
    } catch (err: any) {
      fail(new DbWsTransportError(err?.message || 'ws construct failed'));
      return;
    }

    ws.onopen = () => {
      clearTimeout(openTimer);
      socket = ws;
      opening = null;
      resolve(ws);
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
      if (!msg || msg.t !== 'db-result' || msg.id == null) {
        return;
      }
      const p = pending.get(msg.id);
      if (!p) {
        return;
      }
      clearTimeout(p.timer);
      pending.delete(msg.id);
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
    };
    ws.onerror = () => fail(new DbWsTransportError('ws error'));
    ws.onclose = () => fail(new DbWsTransportError('ws closed'));
  });

  return opening;
}

export async function executeDbBatchOverWs(
  url: string,
  token: string,
  databaseId: string,
  queries: { sql: string; params?: unknown[] }[],
): Promise<SqlResult[]> {
  const id = ++idCounter;
  const frame = JSON.stringify({ t: 'db', id, token, databaseId, queries });
  // Too big for the socket server's maxPayload — fall back to fetch rather than
  // sending (a rejected frame would drop the shared connection for everyone).
  if (frame.length > WS_MAX_FRAME_CHARS) {
    throw new DbWsTransportError('payload too large for ws');
  }

  const ws = await getOrOpen(url);

  return await new Promise<SqlResult[]>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new DbWsTransportError('ws execute timed out'));
    }, WS_REQUEST_TIMEOUT_MS);
    pending.set(id, { resolve, reject, timer });
    try {
      ws.send(frame);
    } catch (err: any) {
      clearTimeout(timer);
      pending.delete(id);
      reject(
        new DbWsTransportError(`ws send failed: ${err?.message || 'unknown'}`),
      );
    }
  });
}
