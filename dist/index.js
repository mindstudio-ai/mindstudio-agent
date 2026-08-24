// src/errors.ts
var MindStudioError = class extends Error {
  constructor(message, code, status, details) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
  name = "MindStudioError";
  toString() {
    return `MindStudioError [${this.code}] (${this.status}): ${this.message}`;
  }
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      status: this.status,
      ...this.details != null && { details: this.details }
    };
  }
};

// src/http.ts
async function request(config, method, path, body) {
  const url = `${config.baseUrl}/developer/v2${path}`;
  await config.rateLimiter.acquire();
  try {
    return await requestWithRetry(config, method, url, body, 0);
  } finally {
    config.rateLimiter.release();
  }
}
async function requestWithRetry(config, method, url, body, attempt) {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
      "User-Agent": "@mindstudio-ai/agent"
    },
    body: body != null ? JSON.stringify(body) : void 0
  });
  config.rateLimiter.updateFromHeaders(res.headers);
  if (attempt < config.maxRetries && (res.status === 429 || res.status === 502 || res.status === 503 || res.status === 504)) {
    const retryAfter = res.headers.get("retry-after");
    const waitMs = retryAfter ? parseFloat(retryAfter) * 1e3 : Math.min(1e3 * Math.pow(2, attempt), 1e4);
    await sleep(waitMs);
    return requestWithRetry(config, method, url, body, attempt + 1);
  }
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    let code = "api_error";
    let details;
    try {
      const text = await res.text();
      try {
        const body2 = JSON.parse(text);
        details = body2;
        const errMsg = (typeof body2.errorMessage === "string" ? body2.errorMessage : void 0) ?? (typeof body2.errorString === "string" ? body2.errorString : void 0) ?? (typeof body2.error === "string" ? body2.error : void 0) ?? (typeof body2.message === "string" ? body2.message : void 0) ?? (typeof body2.details === "string" ? body2.details : void 0);
        if (errMsg) message = errMsg;
        else if (body2.error || body2.message || body2.details) {
          message = JSON.stringify(body2.error ?? body2.message ?? body2.details);
        }
        if (body2.code) code = String(body2.code);
        else if (typeof body2.errorString === "string") code = body2.errorString;
      } catch {
        if (text) {
          const stripped = text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
          if (stripped) message = stripped.slice(0, 200);
        }
      }
    } catch {
    }
    throw new MindStudioError(message, code, res.status, details);
  }
  const data = await res.json();
  return { data, headers: res.headers };
}
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// src/context.ts
var noopAls = {
  getStore: () => void 0,
  run: (_store, fn) => fn()
};
var als = noopAls;
try {
  if (typeof process !== "undefined" && process.versions?.node) {
    const mod = await import("async_hooks");
    als = new mod.AsyncLocalStorage();
  }
} catch {
}
function getRequestContext() {
  return als.getStore();
}
function runWithContext(ctx, fn) {
  return als.run(ctx, fn);
}

// src/db-ws.ts
var WS_REQUEST_TIMEOUT_MS = 3e5;
var WS_OPEN_TIMEOUT_MS = 5e3;
var WS_OPEN = 1;
var WS_MAX_FRAME_CHARS = 9e5;
var DbWsTransportError = class extends Error {
  constructor(message, sent = false) {
    super(message);
    this.sent = sent;
  }
  name = "DbWsTransportError";
};
function isReadOnlySql(sql) {
  const head = sql.trimStart().slice(0, 8).toUpperCase();
  return head.startsWith("SELECT") || head.startsWith("PRAGMA") || head.startsWith("EXPLAIN");
}
var socket = null;
var opening = null;
var idCounter = 0;
var pending = /* @__PURE__ */ new Map();
function getOrOpen(url) {
  if (socket && socket.readyState === WS_OPEN) {
    return Promise.resolve(socket);
  }
  if (opening) {
    return opening;
  }
  const WebSocketCtor = globalThis.WebSocket;
  if (!WebSocketCtor) {
    return Promise.reject(
      new DbWsTransportError("global WebSocket unavailable")
    );
  }
  opening = new Promise((resolve, reject) => {
    let ws;
    const fail = (err) => {
      clearTimeout(openTimer);
      if (socket === ws) {
        socket = null;
      }
      opening = null;
      for (const [, p] of pending) {
        clearTimeout(p.timer);
        p.reject(new DbWsTransportError(err.message, true));
      }
      pending.clear();
      reject(err);
    };
    const openTimer = setTimeout(() => {
      try {
        ws?.close();
      } catch {
      }
      fail(new DbWsTransportError("ws open timed out"));
    }, WS_OPEN_TIMEOUT_MS);
    try {
      ws = new WebSocketCtor(url);
    } catch (err) {
      fail(new DbWsTransportError(err?.message || "ws construct failed"));
      return;
    }
    ws.onopen = () => {
      clearTimeout(openTimer);
      socket = ws;
      opening = null;
      resolve(ws);
    };
    ws.onmessage = (ev) => {
      let msg;
      try {
        msg = JSON.parse(
          typeof ev.data === "string" ? ev.data : String(ev.data)
        );
      } catch {
        return;
      }
      if (!msg || msg.t !== "db-result" || msg.id == null) {
        return;
      }
      const p = pending.get(msg.id);
      if (!p) {
        return;
      }
      clearTimeout(p.timer);
      pending.delete(msg.id);
      if (msg.error) {
        p.reject(
          new MindStudioError(
            `[db] ${msg.error.message || "Database query failed"}`,
            msg.error.code || "db_query_error",
            400,
            msg.error
          )
        );
      } else {
        p.resolve(msg.results);
      }
    };
    ws.onerror = () => fail(new DbWsTransportError("ws error"));
    ws.onclose = () => fail(new DbWsTransportError("ws closed"));
  });
  return opening;
}
async function executeDbBatchOverWs(url, token, databaseId, queries) {
  const id = ++idCounter;
  const frame = JSON.stringify({ t: "db", id, token, databaseId, queries });
  if (frame.length > WS_MAX_FRAME_CHARS) {
    throw new DbWsTransportError("payload too large for ws");
  }
  const ws = await getOrOpen(url);
  return await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new DbWsTransportError("ws execute timed out", true));
    }, WS_REQUEST_TIMEOUT_MS);
    pending.set(id, { resolve, reject, timer });
    try {
      ws.send(frame);
    } catch (err) {
      clearTimeout(timer);
      pending.delete(id);
      reject(
        new DbWsTransportError(
          `ws send failed: ${err?.message || "unknown"}`,
          false
        )
      );
    }
  });
}

// src/rate-limit.ts
var DEFAULTS = {
  internal: { concurrency: 10, callCap: 500 },
  apiKey: { concurrency: 20, callCap: Infinity }
};
var RateLimiter = class {
  constructor(authType) {
    this.authType = authType;
    this.concurrencyLimit = DEFAULTS[authType].concurrency;
    this.callCap = DEFAULTS[authType].callCap;
  }
  inflight = 0;
  concurrencyLimit;
  callCount = 0;
  callCap;
  queue = [];
  /** Acquire a slot. Resolves when a concurrent slot is available. */
  async acquire() {
    if (this.callCount >= this.callCap) {
      throw new MindStudioError(
        `Call cap exceeded (${this.callCap} calls per execution). Reduce the number of API calls or use executeStepBatch() to combine multiple steps.`,
        "call_cap_exceeded",
        429
      );
    }
    if (this.inflight < this.concurrencyLimit) {
      this.inflight++;
      this.callCount++;
      return;
    }
    return new Promise((resolve) => {
      this.queue.push(() => {
        this.inflight++;
        this.callCount++;
        resolve();
      });
    });
  }
  /** Release a slot and let the next queued request proceed. */
  release() {
    this.inflight--;
    const next = this.queue.shift();
    if (next) next();
  }
  /** Update limits from response headers. */
  updateFromHeaders(headers) {
    const concurrency = headers.get("x-ratelimit-concurrency-limit");
    if (concurrency) {
      this.concurrencyLimit = parseInt(concurrency, 10);
    }
    const limit = headers.get("x-ratelimit-limit");
    if (limit && this.authType === "internal") {
      this.callCap = parseInt(limit, 10);
    }
  }
  /** Read current rate limit state from response headers. */
  static parseHeaders(headers) {
    const remaining = headers.get("x-ratelimit-remaining");
    const concurrencyRemaining = headers.get(
      "x-ratelimit-concurrency-remaining"
    );
    return {
      remaining: remaining != null ? parseInt(remaining, 10) : void 0,
      concurrencyRemaining: concurrencyRemaining != null ? parseInt(concurrencyRemaining, 10) : void 0
    };
  }
};

// src/config.ts
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";
function configPaths() {
  const dir = join(homedir(), ".mindstudio");
  return { dir, file: join(dir, "config.json") };
}
function loadConfig() {
  try {
    const raw = readFileSync(configPaths().file, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

// src/auth/index.ts
var AuthContext = class {
  /** The current user's ID, or null for unauthenticated users. */
  userId;
  /** The current user's roles in this app. */
  roles;
  /** All role assignments for this app (all users, all roles). */
  _roleAssignments;
  constructor(ctx) {
    this.userId = ctx.userId;
    this._roleAssignments = ctx.roleAssignments;
    this.roles = ctx.roleAssignments.filter((a) => a.userId === ctx.userId).map((a) => a.roleName);
  }
  /**
   * Check if the current user has **any** of the given roles.
   * Returns true if at least one matches.
   *
   * @example
   * ```ts
   * if (auth.hasRole(Roles.admin, Roles.approver)) {
   *   // user is an admin OR an approver
   * }
   * ```
   */
  hasRole(...roles) {
    return roles.some((r) => this.roles.includes(r));
  }
  /**
   * Require the current user to have at least one of the given roles.
   * Throws a `MindStudioError` with code `'forbidden'` and status 403
   * if the user lacks all of the specified roles.
   *
   * Use this at the top of route handlers to gate access.
   *
   * @example
   * ```ts
   * auth.requireRole(Roles.admin);
   * // code below only runs if user is an admin
   * ```
   */
  requireRole(...roles) {
    if (this.userId == null) {
      throw new MindStudioError(
        "No authenticated user",
        "unauthenticated",
        401
      );
    }
    if (!this.hasRole(...roles)) {
      throw new MindStudioError(
        `User has role(s) [${this.roles.join(", ") || "none"}] but requires one of: [${roles.join(", ")}]`,
        "forbidden",
        403
      );
    }
  }
  /**
   * Get all user IDs that have the given role in this app.
   * Synchronous — scans the preloaded role assignments.
   *
   * @example
   * ```ts
   * const reviewers = auth.getUsersByRole(Roles.reviewer);
   * // ['user-id-1', 'user-id-2', ...]
   * ```
   */
  getUsersByRole(role) {
    return this._roleAssignments.filter((a) => a.roleName === role).map((a) => a.userId);
  }
};
var Roles = new Proxy(
  {},
  {
    get(_, prop) {
      if (typeof prop === "string") return prop;
      return void 0;
    }
  }
);

// src/db/sql.ts
function serializeParam(val) {
  if (val === null || val === void 0) return null;
  if (typeof val === "boolean") return val ? 1 : 0;
  if (typeof val === "number" || typeof val === "string") return val;
  return JSON.stringify(val);
}
function serializeColumnParam(val, columnName, columns) {
  const col = columns.find((c) => c.name === columnName);
  if (col?.type === "user" && typeof val === "string") {
    return val.startsWith(USER_PREFIX) ? val : `${USER_PREFIX}${val}`;
  }
  return serializeParam(val);
}
function escapeValue(val) {
  if (val === null || val === void 0) return "NULL";
  if (typeof val === "boolean") return val ? "1" : "0";
  if (typeof val === "number") return String(val);
  if (typeof val === "string") return `'${val.replace(/'/g, "''")}'`;
  const json = JSON.stringify(val);
  return `'${json.replace(/'/g, "''")}'`;
}
var USER_PREFIX = "@@user@@";
function deserializeRow(row, columns) {
  if (row == null) return row;
  const result = {};
  for (const [key, value] of Object.entries(row)) {
    const col = columns.find((c) => c.name === key);
    if (typeof value === "string" && value.startsWith(USER_PREFIX)) {
      result[key] = value.slice(USER_PREFIX.length);
    } else if (col?.type === "json" && typeof value === "string") {
      try {
        result[key] = JSON.parse(value);
      } catch {
        result[key] = value;
      }
    } else if (col?.type === "boolean" && typeof value === "number") {
      result[key] = value !== 0;
    } else if (col?.type === "number" && typeof value === "string") {
      const num = Number(value);
      result[key] = Number.isNaN(num) ? value : num;
    } else if (!col && typeof value === "string" && (value[0] === "[" || value[0] === "{")) {
      try {
        result[key] = JSON.parse(value);
      } catch {
        result[key] = value;
      }
    } else {
      result[key] = value;
    }
  }
  return result;
}
function buildSelect(table, options = {}) {
  let sql = `SELECT * FROM ${table}`;
  const params = [];
  if (options.where) {
    sql += ` WHERE ${options.where}`;
    if (options.whereParams) params.push(...options.whereParams);
  }
  if (options.orderBy) sql += ` ORDER BY ${options.orderBy}${options.desc ? " DESC" : " ASC"}`;
  if (options.limit != null) sql += ` LIMIT ${options.limit}`;
  if (options.offset != null) sql += ` OFFSET ${options.offset}`;
  return { sql, params: params.length > 0 ? params : void 0 };
}
function buildExists(table, where, whereParams, negate) {
  const inner = where ? `SELECT 1 FROM ${table} WHERE ${where}` : `SELECT 1 FROM ${table}`;
  const fn = negate ? "NOT EXISTS" : "EXISTS";
  return { sql: `SELECT ${fn}(${inner}) as result`, params: whereParams?.length ? whereParams : void 0 };
}
function buildInsert(table, data, columns) {
  const filtered = stripSystemColumns(data);
  const keys = Object.keys(filtered);
  const placeholders = keys.map(() => "?").join(", ");
  const params = keys.map((k) => serializeColumnParam(filtered[k], k, columns));
  return {
    sql: `INSERT INTO ${table} (${keys.join(", ")}) VALUES (${placeholders}) RETURNING *`,
    params
  };
}
function buildUpdate(table, id, data, columns) {
  const filtered = stripSystemColumns(data);
  const keys = Object.keys(filtered);
  const assignments = keys.map((k) => `${k} = ?`).join(", ");
  const params = [
    ...keys.map((k) => serializeColumnParam(filtered[k], k, columns)),
    id
    // for WHERE id = ?
  ];
  return {
    sql: `UPDATE ${table} SET ${assignments} WHERE id = ? RETURNING *`,
    params
  };
}
function buildUpsert(table, data, conflictColumns, columns) {
  const filtered = stripSystemColumns(data);
  const keys = Object.keys(filtered);
  const placeholders = keys.map(() => "?").join(", ");
  const params = keys.map(
    (k) => serializeColumnParam(filtered[k], k, columns)
  );
  const updateKeys = keys.filter((k) => !conflictColumns.includes(k));
  const conflict = conflictColumns.join(", ");
  const sql = updateKeys.length > 0 ? `INSERT INTO ${table} (${keys.join(", ")}) VALUES (${placeholders}) ON CONFLICT(${conflict}) DO UPDATE SET ${updateKeys.map((k) => `${k} = excluded.${k}`).join(", ")} RETURNING *` : `INSERT INTO ${table} (${keys.join(", ")}) VALUES (${placeholders}) ON CONFLICT(${conflict}) DO NOTHING RETURNING *`;
  return { sql, params };
}
function buildDelete(table, where, whereParams) {
  let sql = `DELETE FROM ${table}`;
  if (where) sql += ` WHERE ${where}`;
  return { sql, params: whereParams?.length ? whereParams : void 0 };
}
var SYSTEM_COLUMNS = /* @__PURE__ */ new Set([
  "id",
  "created_at",
  "createdAt",
  "updated_at",
  "updatedAt",
  "last_updated_by",
  "lastUpdatedBy"
]);
function stripSystemColumns(data) {
  const result = {};
  for (const [key, value] of Object.entries(data)) {
    if (!SYSTEM_COLUMNS.has(key)) {
      result[key] = value;
    }
  }
  return result;
}

// src/db/predicate.ts
function compilePredicate(fn, bindings) {
  try {
    const source = fn.toString();
    const names = extractParamNames(source);
    if (!names) return { type: "js", fn, reason: "could not extract parameter name" };
    const body = extractBody(source);
    if (!body) return { type: "js", fn, reason: "could not extract function body" };
    const tokens = tokenize(body);
    if (tokens.length === 0) return { type: "js", fn, reason: "empty token stream" };
    const parser = new Parser(tokens, names.row, names.bindings, bindings, fn);
    const ast = parser.parseExpression();
    if (!ast) return { type: "js", fn, reason: "could not parse expression" };
    if (parser.pos < tokens.length) return { type: "js", fn, reason: "unexpected tokens after expression" };
    const where = compileNode(ast);
    if (!where) return { type: "js", fn, reason: "could not compile to SQL" };
    return { type: "sql", where };
  } catch (err) {
    return { type: "js", fn, reason: `compilation error: ${err?.message || "unknown"}` };
  }
}
function extractParamNames(source) {
  const arrowIdx = source.indexOf("=>");
  if (arrowIdx === -1) return null;
  let paramList = source.slice(0, arrowIdx).trim();
  if (paramList.startsWith("(") && paramList.endsWith(")")) {
    paramList = paramList.slice(1, -1).trim();
  }
  if (paramList.length === 0) return null;
  const parts = splitParams(paramList);
  if (parts.length === 0 || parts.length > 2) return null;
  const row = stripTypeAnnotation(parts[0]);
  if (!row) return null;
  if (parts.length === 1) return { row };
  const bindings = stripTypeAnnotation(parts[1]);
  if (!bindings) return null;
  return { row, bindings };
}
function splitParams(input) {
  const parts = [];
  let depth = 0;
  let current = "";
  for (const ch of input) {
    if (ch === "<" || ch === "(") depth++;
    else if (ch === ">" || ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}
function stripTypeAnnotation(part) {
  const colonIdx = part.indexOf(":");
  const name = (colonIdx === -1 ? part : part.slice(0, colonIdx)).trim();
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name) ? name : null;
}
function extractBody(source) {
  const arrowIdx = source.indexOf("=>");
  if (arrowIdx === -1) return null;
  let body = source.slice(arrowIdx + 2).trim();
  if (body.startsWith("{")) {
    const match = body.match(/^\{\s*return\s+([\s\S]+?)\s*;?\s*\}$/);
    if (!match) return null;
    body = match[1];
  }
  return body.trim() || null;
}
function tokenize(expr) {
  const tokens = [];
  let i = 0;
  while (i < expr.length) {
    const ch = expr[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === "'" || ch === '"') {
      const quote = ch;
      let str = "";
      i++;
      while (i < expr.length && expr[i] !== quote) {
        if (expr[i] === "\\") {
          i++;
          if (i < expr.length) str += expr[i];
        } else {
          str += expr[i];
        }
        i++;
      }
      if (i >= expr.length) return [];
      i++;
      tokens.push({ type: "string", value: str });
      continue;
    }
    if (ch === "`") return [];
    if (/[0-9]/.test(ch) || ch === "-" && i + 1 < expr.length && /[0-9]/.test(expr[i + 1])) {
      let num = ch;
      i++;
      while (i < expr.length && /[0-9.]/.test(expr[i])) {
        num += expr[i];
        i++;
      }
      tokens.push({ type: "number", value: num });
      continue;
    }
    if (expr.slice(i, i + 3) === "===" || expr.slice(i, i + 3) === "!==") {
      tokens.push({ type: "operator", value: expr.slice(i, i + 3) });
      i += 3;
      continue;
    }
    if (expr.slice(i, i + 2) === "==" || expr.slice(i, i + 2) === "!=" || expr.slice(i, i + 2) === "<=" || expr.slice(i, i + 2) === ">=" || expr.slice(i, i + 2) === "&&" || expr.slice(i, i + 2) === "||") {
      tokens.push({ type: "operator", value: expr.slice(i, i + 2) });
      i += 2;
      continue;
    }
    if (ch === "!" || ch === "<" || ch === ">") {
      tokens.push({ type: "operator", value: ch });
      i++;
      continue;
    }
    if (ch === ".") {
      tokens.push({ type: "dot", value: "." });
      i++;
      continue;
    }
    if (ch === "(") {
      tokens.push({ type: "lparen", value: "(" });
      i++;
      continue;
    }
    if (ch === ")") {
      tokens.push({ type: "rparen", value: ")" });
      i++;
      continue;
    }
    if (ch === "[") {
      tokens.push({ type: "lbracket", value: "[" });
      i++;
      continue;
    }
    if (ch === "]") {
      tokens.push({ type: "rbracket", value: "]" });
      i++;
      continue;
    }
    if (ch === ",") {
      tokens.push({ type: "comma", value: "," });
      i++;
      continue;
    }
    if (/[a-zA-Z_$]/.test(ch)) {
      let ident = ch;
      i++;
      while (i < expr.length && /[a-zA-Z0-9_$]/.test(expr[i])) {
        ident += expr[i];
        i++;
      }
      tokens.push({ type: "identifier", value: ident });
      continue;
    }
    return [];
  }
  return tokens;
}
var Parser = class {
  constructor(tokens, paramName, bindingsName, bindingsValue, originalFn) {
    this.tokens = tokens;
    this.paramName = paramName;
    this.bindingsName = bindingsName;
    this.bindingsValue = bindingsValue;
    this.originalFn = originalFn;
  }
  pos = 0;
  /** Peek at the current token without consuming it. */
  peek() {
    return this.tokens[this.pos];
  }
  /** Consume the current token and advance. */
  advance() {
    return this.tokens[this.pos++];
  }
  /** Check if the current token matches an expected type and value. */
  match(type, value) {
    const t = this.peek();
    if (!t) return false;
    if (t.type !== type) return false;
    if (value !== void 0 && t.value !== value) return false;
    return true;
  }
  /** Consume a token if it matches, otherwise return false. */
  eat(type, value) {
    if (this.match(type, value)) {
      this.advance();
      return true;
    }
    return false;
  }
  // --- Grammar rules ---
  /** Entry point: parse a full expression. */
  parseExpression() {
    return this.parseOr();
  }
  /** or_expr → and_expr ( '||' and_expr )* */
  parseOr() {
    let left = this.parseAnd();
    if (!left) return null;
    while (this.match("operator", "||")) {
      this.advance();
      const right = this.parseAnd();
      if (!right) return null;
      left = { kind: "logical", operator: "OR", left, right };
    }
    return left;
  }
  /** and_expr → not_expr ( '&&' not_expr )* */
  parseAnd() {
    let left = this.parseNot();
    if (!left) return null;
    while (this.match("operator", "&&")) {
      this.advance();
      const right = this.parseNot();
      if (!right) return null;
      left = { kind: "logical", operator: "AND", left, right };
    }
    return left;
  }
  /** not_expr → '!' not_expr | primary */
  parseNot() {
    if (this.match("operator", "!")) {
      this.advance();
      if (this.match("lparen")) {
        this.advance();
        const inner2 = this.parseExpression();
        if (!inner2) return null;
        if (!this.eat("rparen")) return null;
        return { kind: "not", operand: inner2 };
      }
      const inner = this.parsePrimary();
      if (!inner) return null;
      if (inner.kind === "booleanField") {
        return { ...inner, negated: !inner.negated };
      }
      return { kind: "not", operand: inner };
    }
    return this.parsePrimary();
  }
  /**
   * primary → field_comparison | null_check | includes_expr | paren_expr | boolean_field
   *
   * This is the workhorse — handles the different patterns that can appear
   * as atomic expressions within a larger &&/|| combination.
   */
  parsePrimary() {
    if (this.match("lparen")) {
      this.advance();
      const inner = this.parseExpression();
      if (!inner) return null;
      if (!this.eat("rparen")) return null;
      return inner;
    }
    if (this.match("lbracket")) {
      return this.parseArrayIncludes();
    }
    if (this.match("identifier", this.paramName)) {
      return this.parseFieldExpression();
    }
    if (this.bindingsName && this.match("identifier", this.bindingsName)) {
      return this.parseBindingsArrayIncludes();
    }
    if (this.match("identifier")) {
      return this.parseNonParamExpression();
    }
    return null;
  }
  /**
   * Parse an expression that starts with the parameter name (e.g. `o.field`).
   *
   * Could be:
   * - `o.field === value` (comparison)
   * - `o.field != null` (null check)
   * - `o.field.includes('text')` (LIKE)
   * - `o.field` alone (boolean field check)
   */
  parseFieldExpression() {
    this.advance();
    const field = this.parseFieldPath();
    if (!field) return null;
    const next = this.peek();
    if (next?.type === "dot" && this.lookAheadForIncludes()) {
      return this.parseFieldIncludes(field);
    }
    if (next?.type === "operator" && isComparisonOp(next.value)) {
      return this.parseComparison(field);
    }
    return { kind: "booleanField", field, negated: false };
  }
  /**
   * Parse a dot-separated field path after the parameter name.
   * `o.status` → `"status"`, `o.address.city` → `"json_extract(address, '$.city')"`.
   */
  parseFieldPath() {
    if (!this.eat("dot")) return null;
    if (!this.match("identifier")) return null;
    const parts = [this.advance().value];
    while (this.match("dot") && this.tokens[this.pos + 1]?.type === "identifier") {
      if (this.tokens[this.pos + 2]?.type === "lparen") break;
      this.advance();
      parts.push(this.advance().value);
    }
    if (parts.length === 1) {
      return parts[0];
    }
    const root = parts[0];
    const jsonPath = "$." + parts.slice(1).join(".");
    return `json_extract(${root}, '${jsonPath}')`;
  }
  /**
   * Parse a comparison: `field OP value`.
   * The field has already been parsed; we need the operator and right-hand value.
   */
  parseComparison(field) {
    const opToken = this.advance();
    const jsOp = opToken.value;
    const value = this.parseValue();
    if (value === PARSE_FAILED) return null;
    if (value === null || value === void 0) {
      if (jsOp === "===" || jsOp === "==") {
        return { kind: "nullCheck", field, isNull: true };
      }
      if (jsOp === "!==" || jsOp === "!=") {
        return { kind: "nullCheck", field, isNull: false };
      }
      return null;
    }
    const sqlOp = JS_TO_SQL_OP[jsOp];
    if (!sqlOp) return null;
    return { kind: "comparison", field, operator: sqlOp, value };
  }
  /**
   * Parse `o.field.includes('text')` → LIKE expression.
   * The field name has already been parsed.
   */
  parseFieldIncludes(field) {
    this.advance();
    this.advance();
    if (!this.eat("lparen")) return null;
    const value = this.parseValue();
    if (value === PARSE_FAILED || typeof value !== "string") return null;
    if (!this.eat("rparen")) return null;
    const escaped = value.replace(/%/g, "\\%").replace(/_/g, "\\_");
    return { kind: "like", field, pattern: `%${escaped}%` };
  }
  /**
   * Parse `['a', 'b', 'c'].includes(o.field)` → IN expression.
   * The opening bracket has been peeked but not consumed.
   */
  parseArrayIncludes() {
    this.advance();
    const values = [];
    while (!this.match("rbracket")) {
      if (values.length > 0) {
        if (!this.eat("comma")) return null;
      }
      const val = this.parseValue();
      if (val === PARSE_FAILED) return null;
      values.push(val);
    }
    this.advance();
    if (!this.eat("dot")) return null;
    if (!this.match("identifier", "includes")) return null;
    this.advance();
    if (!this.eat("lparen")) return null;
    if (!this.match("identifier", this.paramName)) return null;
    this.advance();
    const field = this.parseFieldPath();
    if (!field) return null;
    if (!this.eat("rparen")) return null;
    return { kind: "in", field, values };
  }
  /**
   * Parse an expression that starts with an identifier that is NOT the
   * parameter name. This could be:
   * - A keyword literal: `true`, `false`, `null`, `undefined`
   * - A closure variable used in a comparison (handled by backtracking)
   */
  parseNonParamExpression() {
    const ident = this.peek().value;
    if (ident === "true" || ident === "false") return null;
    return null;
  }
  /**
   * Parse `$.ids.includes(o.field)` → IN expression with resolved values.
   * The bindings identifier has been peeked but not consumed.
   *
   * Falls back (returns null) if the resolved bindings value isn't an array,
   * or if the path doesn't exist on the bindings object.
   */
  parseBindingsArrayIncludes() {
    const bound = this.tryResolveBindingsValue();
    if (bound === PARSE_FAILED) return null;
    if (!Array.isArray(bound)) return null;
    if (!this.eat("dot")) return null;
    if (!this.match("identifier", "includes")) return null;
    this.advance();
    if (!this.eat("lparen")) return null;
    if (!this.match("identifier", this.paramName)) return null;
    this.advance();
    const field = this.parseFieldPath();
    if (!field) return null;
    if (!this.eat("rparen")) return null;
    return { kind: "in", field, values: bound };
  }
  /**
   * If the current token is the bindings parameter name, walk a dotted path
   * (`$.foo.bar`) and resolve the value from the bindings object. Returns
   * the resolved value or `PARSE_FAILED`.
   *
   * Stops walking before a method call (e.g. doesn't consume `.includes` in
   * `$.ids.includes(...)`) so the caller can dispatch on what follows.
   *
   * Restores `pos` on failure so callers can fall through cleanly.
   */
  tryResolveBindingsValue() {
    if (!this.bindingsName) return PARSE_FAILED;
    if (!this.match("identifier", this.bindingsName)) return PARSE_FAILED;
    if (this.bindingsValue == null) return PARSE_FAILED;
    const startPos = this.pos;
    this.advance();
    const path = [];
    while (this.match("dot") && this.tokens[this.pos + 1]?.type === "identifier") {
      if (this.tokens[this.pos + 2]?.type === "lparen") break;
      this.advance();
      path.push(this.advance().value);
    }
    if (path.length === 0) {
      this.pos = startPos;
      return PARSE_FAILED;
    }
    let value = this.bindingsValue;
    for (const key of path) {
      if (value == null || typeof value !== "object") {
        this.pos = startPos;
        return PARSE_FAILED;
      }
      value = value[key];
    }
    if (value === void 0) {
      this.pos = startPos;
      return PARSE_FAILED;
    }
    return value;
  }
  /**
   * Parse a literal value or closure variable reference.
   *
   * Returns the parsed value, or PARSE_FAILED if parsing fails.
   * Returns `null` or `undefined` for those keyword literals.
   */
  parseValue() {
    const t = this.peek();
    if (!t) return PARSE_FAILED;
    if (t.type === "string") {
      this.advance();
      return t.value;
    }
    if (t.type === "number") {
      this.advance();
      return Number(t.value);
    }
    if (t.type === "identifier") {
      if (t.value === "true") {
        this.advance();
        return true;
      }
      if (t.value === "false") {
        this.advance();
        return false;
      }
      if (t.value === "null") {
        this.advance();
        return null;
      }
      if (t.value === "undefined") {
        this.advance();
        return void 0;
      }
      if (this.bindingsName && t.value === this.bindingsName) {
        const bound = this.tryResolveBindingsValue();
        if (bound !== PARSE_FAILED) return bound;
      }
      return this.resolveClosureVariable();
    }
    if (t.type === "operator" && t.value === "-") {
      this.advance();
      const next = this.peek();
      if (next?.type === "number") {
        this.advance();
        return -Number(next.value);
      }
      return PARSE_FAILED;
    }
    return PARSE_FAILED;
  }
  /**
   * Attempt to resolve a closure variable's value.
   *
   * This handles the common pattern:
   * ```ts
   * const userId = auth.userId;
   * orders.filter(o => o.requestedBy === userId)
   * ```
   *
   * Closure variable resolution is fundamentally limited in JavaScript —
   * we can't access another function's closure scope from outside without
   * `eval`. The `===` operator can't be overridden via Proxy or
   * Symbol.toPrimitive, so we can't intercept comparisons.
   *
   * For now, this falls back to JS execution. The predicate still works
   * correctly — it just scans all rows instead of generating SQL.
   * This is the most common reason for JS fallback in practice, since
   * almost every real-world filter references a variable like `userId`.
   *
   * A future improvement could accept an explicit `vars` argument:
   * ```ts
   * orders.filter(o => o.requestedBy === $userId, { $userId: auth.userId })
   * ```
   */
  resolveClosureVariable() {
    this.advance();
    while (this.match("dot") && this.tokens[this.pos + 1]?.type === "identifier") {
      this.advance();
      this.advance();
    }
    return PARSE_FAILED;
  }
  /**
   * Look ahead to check if the next tokens form `.includes(`.
   * Used to disambiguate `o.field.includes(...)` from `o.field.nested`.
   */
  lookAheadForIncludes() {
    return this.tokens[this.pos]?.type === "dot" && this.tokens[this.pos + 1]?.type === "identifier" && this.tokens[this.pos + 1]?.value === "includes" && this.tokens[this.pos + 2]?.type === "lparen";
  }
};
function compileNode(node) {
  switch (node.kind) {
    case "comparison":
      return `${node.field} ${node.operator} ${escapeValue(node.value)}`;
    case "nullCheck":
      return `${node.field} ${node.isNull ? "IS NULL" : "IS NOT NULL"}`;
    case "in": {
      if (node.values.length === 0) return "0";
      const vals = node.values.map(escapeValue).join(", ");
      return `${node.field} IN (${vals})`;
    }
    case "like":
      return `${node.field} LIKE ${escapeValue(node.pattern)}`;
    case "booleanField":
      return node.negated ? `${node.field} = 0` : `${node.field} = 1`;
    case "logical": {
      const left = compileNode(node.left);
      const right = compileNode(node.right);
      if (!left || !right) return null;
      return `(${left} ${node.operator} ${right})`;
    }
    case "not": {
      const inner = compileNode(node.operand);
      if (!inner) return null;
      return `NOT (${inner})`;
    }
    default:
      return null;
  }
}
var JS_TO_SQL_OP = {
  "===": "=",
  "==": "=",
  "!==": "!=",
  "!=": "!=",
  "<": "<",
  ">": ">",
  "<=": "<=",
  ">=": ">="
};
var PARSE_FAILED = /* @__PURE__ */ Symbol("PARSE_FAILED");
function isComparisonOp(value) {
  return value in JS_TO_SQL_OP;
}

// src/db/query.ts
var Query = class _Query {
  _predicates;
  _sortAccessor;
  _reversed;
  _limit;
  _offset;
  _config;
  /** @internal Pre-compiled WHERE clause (bypasses predicate compiler). Used by Table.get(). */
  _rawWhere;
  _rawWhereParams;
  /** @internal Post-process transform applied after row deserialization. */
  _postProcess;
  constructor(config, options) {
    this._config = config;
    this._predicates = options?.predicates ?? [];
    this._sortAccessor = options?.sortAccessor;
    this._reversed = options?.reversed ?? false;
    this._limit = options?.limit;
    this._offset = options?.offset;
    this._postProcess = options?.postProcess;
    this._rawWhere = options?.rawWhere;
    this._rawWhereParams = options?.rawWhereParams;
  }
  _clone(overrides) {
    return new _Query(this._config, {
      predicates: overrides.predicates ?? this._predicates,
      sortAccessor: overrides.sortAccessor ?? this._sortAccessor,
      reversed: overrides.reversed ?? this._reversed,
      limit: overrides.limit ?? this._limit,
      offset: overrides.offset ?? this._offset,
      postProcess: overrides.postProcess,
      rawWhere: this._rawWhere,
      rawWhereParams: this._rawWhereParams
    });
  }
  filter(predicate, bindings) {
    return this._clone({
      predicates: [...this._predicates, { fn: predicate, bindings }]
    });
  }
  sortBy(accessor) {
    return this._clone({ sortAccessor: accessor });
  }
  reverse() {
    return this._clone({ reversed: !this._reversed });
  }
  take(n) {
    return this._clone({ limit: n });
  }
  skip(n) {
    return this._clone({ offset: n });
  }
  // -------------------------------------------------------------------------
  // Terminal methods
  // -------------------------------------------------------------------------
  first() {
    return this._clone({
      limit: 1,
      postProcess: (rows) => rows[0] ?? null
    });
  }
  last() {
    return this._clone({
      limit: 1,
      reversed: !this._reversed,
      postProcess: (rows) => rows[0] ?? null
    });
  }
  count() {
    return this._clone({
      postProcess: (rows) => rows.length
    });
  }
  some() {
    return this._clone({
      limit: 1,
      postProcess: (rows) => rows.length > 0
    });
  }
  async every() {
    const compiled = this._compilePredicates();
    if (compiled.allSql && compiled.sqlWhere) {
      const query = buildExists(
        this._config.tableName,
        `NOT (${compiled.sqlWhere})`,
        void 0,
        true
      );
      const results = await this._config.executeBatch([query]);
      const row = results[0]?.rows[0];
      return row?.result === 1;
    }
    if (this._predicates.length === 0) return true;
    const allRows = await this._fetchAllRows();
    return allRows.every(
      (row) => this._predicates.every((p) => p.fn(row, p.bindings))
    );
  }
  min(accessor) {
    return this.sortBy(accessor).first();
  }
  max(accessor) {
    return this.sortBy(accessor).reverse().first();
  }
  groupBy(accessor) {
    return this._clone({
      postProcess: (rows) => {
        const map = /* @__PURE__ */ new Map();
        for (const row of rows) {
          const key = accessor(row);
          const group = map.get(key);
          if (group) group.push(row);
          else map.set(key, [row]);
        }
        return map;
      }
    });
  }
  // -------------------------------------------------------------------------
  // Batch compilation — used by db.batch() to extract SQL without executing
  // -------------------------------------------------------------------------
  /**
   * @internal Compile this query into a SqlQuery for batch execution.
   *
   * Returns the compiled SQL query (if all predicates compile to SQL),
   * or null (if JS fallback is needed). In the fallback case, a bare
   * `SELECT *` is returned as `fallbackQuery` so the batch can fetch
   * all rows and this query can filter them in JS post-fetch.
   */
  _compile() {
    if (this._rawWhere) {
      const query = buildSelect(this._config.tableName, {
        where: this._rawWhere,
        whereParams: this._rawWhereParams,
        orderBy: void 0,
        limit: this._limit,
        offset: this._offset
      });
      return { type: "query", query, fallbackQuery: null, config: this._config, postProcess: this._postProcess };
    }
    const compiled = this._compilePredicates();
    const sortField = this._sortAccessor ? extractFieldName(this._sortAccessor) : void 0;
    if (compiled.allSql) {
      const query = buildSelect(this._config.tableName, {
        where: compiled.sqlWhere || void 0,
        orderBy: sortField ?? void 0,
        desc: this._reversed,
        limit: this._limit,
        offset: this._offset
      });
      return { type: "query", query, fallbackQuery: null, config: this._config, postProcess: this._postProcess };
    }
    const fallbackQuery = buildSelect(this._config.tableName);
    return {
      type: "query",
      query: null,
      fallbackQuery,
      config: this._config,
      predicates: this._predicates,
      sortAccessor: this._sortAccessor,
      reversed: this._reversed,
      limit: this._limit,
      offset: this._offset,
      postProcess: this._postProcess
    };
  }
  /**
   * @internal Process raw SQL results into typed rows. Used by db.batch()
   * after executing the compiled query.
   *
   * For SQL-compiled queries: just deserialize the rows.
   * For JS-fallback queries: filter, sort, and slice in JS.
   */
  static _processResults(result, compiled) {
    const rows = result.rows.map(
      (row) => deserializeRow(
        row,
        compiled.config.columns
      )
    );
    if (compiled.query) {
      return compiled.postProcess ? compiled.postProcess(rows) : rows;
    }
    let filtered = compiled.predicates ? rows.filter((row) => compiled.predicates.every((p) => p.fn(row, p.bindings))) : rows;
    if (compiled.sortAccessor) {
      const accessor = compiled.sortAccessor;
      const reversed = compiled.reversed ?? false;
      filtered.sort((a, b) => {
        const aVal = accessor(a);
        const bVal = accessor(b);
        if (aVal < bVal) return reversed ? 1 : -1;
        if (aVal > bVal) return reversed ? -1 : 1;
        return 0;
      });
    }
    if (compiled.offset != null || compiled.limit != null) {
      const start = compiled.offset ?? 0;
      const end = compiled.limit != null ? start + compiled.limit : void 0;
      filtered = filtered.slice(start, end);
    }
    return compiled.postProcess ? compiled.postProcess(filtered) : filtered;
  }
  // -------------------------------------------------------------------------
  // PromiseLike
  // -------------------------------------------------------------------------
  then(onfulfilled, onrejected) {
    const promise = this._execute().then(
      (rows) => this._postProcess ? this._postProcess(rows) : rows
    );
    return promise.then(onfulfilled, onrejected);
  }
  catch(onrejected) {
    return this.then(void 0, onrejected);
  }
  // -------------------------------------------------------------------------
  // Execution internals
  // -------------------------------------------------------------------------
  async _execute() {
    if (this._rawWhere) {
      const query = buildSelect(this._config.tableName, {
        where: this._rawWhere,
        whereParams: this._rawWhereParams,
        limit: this._limit,
        offset: this._offset
      });
      const results = await this._config.executeBatch([query]);
      return results[0].rows.map(
        (row) => deserializeRow(
          row,
          this._config.columns
        )
      );
    }
    const compiled = this._compilePredicates();
    if (compiled.allSql) {
      const sortField = this._sortAccessor ? extractFieldName(this._sortAccessor) : void 0;
      const query = buildSelect(this._config.tableName, {
        where: compiled.sqlWhere || void 0,
        orderBy: sortField ?? void 0,
        desc: this._reversed,
        limit: this._limit,
        offset: this._offset
      });
      const results = await this._config.executeBatch([query]);
      return results[0].rows.map(
        (row) => deserializeRow(
          row,
          this._config.columns
        )
      );
    }
    let rows = await this._fetchAndFilterInJs(compiled);
    if (this._sortAccessor) {
      const accessor = this._sortAccessor;
      rows.sort((a, b) => {
        const aVal = accessor(a);
        const bVal = accessor(b);
        if (aVal < bVal) return this._reversed ? 1 : -1;
        if (aVal > bVal) return this._reversed ? -1 : 1;
        return 0;
      });
    }
    if (this._offset != null || this._limit != null) {
      const start = this._offset ?? 0;
      const end = this._limit != null ? start + this._limit : void 0;
      rows = rows.slice(start, end);
    }
    return rows;
  }
  _compilePredicates() {
    if (this._predicates.length === 0) {
      return { allSql: true, sqlWhere: "", compiled: [] };
    }
    const compiled = this._predicates.map((p) => compilePredicate(p.fn, p.bindings));
    const allSql = compiled.every((c) => c.type === "sql");
    let sqlWhere = "";
    if (allSql) {
      sqlWhere = compiled.map((c) => c.where).join(" AND ");
    }
    return { allSql, sqlWhere, compiled };
  }
  async _fetchAndFilterInJs(compiled) {
    const allRows = await this._fetchAllRows();
    const jsFallbacks = compiled.compiled.filter((c) => c.type === "js");
    if (jsFallbacks.length > 0) {
      const reasons = jsFallbacks.map((c) => c.type === "js" ? c.reason : void 0).filter(Boolean);
      const reasonSuffix = reasons.length > 0 ? ` (${reasons.join("; ")})` : "";
      console.warn(
        `[mindstudio] Filter on '${this._config.tableName}' could not be compiled to SQL${reasonSuffix} \u2014 scanning ${allRows.length} rows in JS`
      );
    }
    return allRows.filter(
      (row) => this._predicates.every((p) => p.fn(row, p.bindings))
    );
  }
  async _fetchAllRows() {
    const query = buildSelect(this._config.tableName);
    const results = await this._config.executeBatch([query]);
    return results[0].rows.map(
      (row) => deserializeRow(row, this._config.columns)
    );
  }
};
function extractFieldName(accessor) {
  const source = accessor.toString();
  const match = source.match(
    /^\s*\(?([a-zA-Z_$][a-zA-Z0-9_$]*)\)?\s*=>\s*\1\.([a-zA-Z_$][a-zA-Z0-9_$]*)\s*$/
  );
  return match?.[2] ?? null;
}

// src/db/mutation.ts
var Mutation = class _Mutation {
  /** @internal */
  _config;
  /** @internal */
  _queries;
  /** @internal */
  _processResult;
  /** @internal Non-batchable executor for complex mutations (e.g. removeAll JS fallback). */
  _executor;
  constructor(config, queries, processResult) {
    this._config = config;
    this._queries = queries;
    this._processResult = processResult;
    this._executor = void 0;
  }
  /**
   * Create a non-batchable mutation that wraps an async executor.
   * Used for operations that require multi-step execution (e.g. removeAll
   * with a JS-fallback predicate: fetch all rows → filter → delete).
   *
   * Works fine when awaited standalone. Throws if passed to db.batch().
   *
   * @internal
   */
  static fromExecutor(config, executor) {
    const m = new _Mutation(config, [], () => void 0);
    Object.defineProperty(m, "_executor", { value: executor });
    return m;
  }
  // -------------------------------------------------------------------------
  // PromiseLike — executes on await
  // -------------------------------------------------------------------------
  then(onfulfilled, onrejected) {
    return this._execute().then(onfulfilled, onrejected);
  }
  catch(onrejected) {
    return this._execute().catch(onrejected);
  }
  // -------------------------------------------------------------------------
  // Batch compilation — used by db.batch()
  // -------------------------------------------------------------------------
  /**
   * @internal Compile this mutation into SQL for batch execution.
   * Returns the queries and a result processor.
   *
   * Throws if this is a non-batchable mutation (created via fromExecutor).
   */
  _compile() {
    if (this._executor) {
      throw new MindStudioError(
        "This operation cannot be batched (e.g. removeAll with a JS-fallback predicate). Await it separately instead of passing to db.batch().",
        "not_batchable",
        400
      );
    }
    return {
      type: "mutation",
      queries: this._queries,
      config: this._config,
      processResult: this._processResult
    };
  }
  /**
   * @internal Process raw SQL results into the typed result.
   * Used by db.batch() after executing the compiled queries.
   */
  static _processResults(results, compiled) {
    return compiled.processResult(results);
  }
  // -------------------------------------------------------------------------
  // Execution
  // -------------------------------------------------------------------------
  async _execute() {
    if (this._executor) {
      return this._executor();
    }
    const results = await this._config.executeBatch(this._queries);
    return this._processResult(results);
  }
};

// src/db/table.ts
var Table = class {
  /** @internal */
  _config;
  constructor(config) {
    this._config = config;
  }
  // -------------------------------------------------------------------------
  // Reads — all return batchable Query objects (lazy until awaited)
  // -------------------------------------------------------------------------
  /** Get a single row by ID. Returns null if not found. */
  get(id) {
    return new Query(this._config, {
      rawWhere: "id = ?",
      rawWhereParams: [id],
      limit: 1,
      postProcess: (rows) => rows[0] ?? null
    });
  }
  findOne(predicate, bindings) {
    return this.filter(predicate, bindings).first();
  }
  count(predicate, bindings) {
    if (predicate) return this.filter(predicate, bindings).count();
    return this.toArray().count();
  }
  some(predicate, bindings) {
    return this.filter(predicate, bindings).some();
  }
  async every(predicate, bindings) {
    return this.filter(predicate, bindings).every();
  }
  /** True if the table has zero rows. */
  async isEmpty() {
    const query = buildExists(this._config.tableName, void 0, void 0, true);
    const results = await this._config.executeBatch([query]);
    const row = results[0]?.rows[0];
    return row?.result === 1;
  }
  /** Row with the minimum value for a field, or null if table is empty. */
  min(accessor) {
    return this.sortBy(accessor).first();
  }
  /** Row with the maximum value for a field, or null if table is empty. */
  max(accessor) {
    return this.sortBy(accessor).reverse().first();
  }
  /** Group rows by a field. Returns a Map. */
  groupBy(accessor) {
    return new Query(this._config).groupBy(accessor);
  }
  /** Get all rows as an array. */
  toArray() {
    return new Query(this._config);
  }
  filter(predicate, bindings) {
    return new Query(this._config).filter(predicate, bindings);
  }
  /** Sort rows by a field. Returns a chainable Query. */
  sortBy(accessor) {
    return new Query(this._config).sortBy(accessor);
  }
  push(data) {
    const isArray = Array.isArray(data);
    const items = (isArray ? data : [data]).map(
      (item) => this._config.defaults ? { ...this._config.defaults, ...item } : item
    );
    for (const item of items) {
      this._checkManagedColumns(item);
    }
    const queries = items.map(
      (item) => buildInsert(
        this._config.tableName,
        item,
        this._config.columns
      )
    );
    return new Mutation(this._config, queries, (results) => {
      const rows = results.map((r) => {
        if (r.rows.length > 0) {
          return deserializeRow(
            r.rows[0],
            this._config.columns
          );
        }
        throw new MindStudioError(
          `Insert into '${this._config.tableName}' succeeded but returned no row. This may indicate a constraint violation.`,
          "insert_failed",
          500
        );
      });
      const result = isArray ? rows : rows[0];
      this._syncRolesIfNeeded(
        items,
        result,
        isArray
      );
      return result;
    });
  }
  /**
   * Update a row by ID. Only the provided fields are changed.
   * Returns the updated row via `UPDATE ... RETURNING *`.
   */
  update(id, data) {
    this._checkManagedColumns(data);
    const query = buildUpdate(
      this._config.tableName,
      id,
      data,
      this._config.columns
    );
    return new Mutation(this._config, [query], (results) => {
      if (!results[0]?.rows[0]) {
        throw new MindStudioError(
          `Row not found: no row with ID '${id}' in table '${this._config.tableName}'`,
          "row_not_found",
          404
        );
      }
      const result = deserializeRow(
        results[0].rows[0],
        this._config.columns
      );
      this._syncRolesIfNeeded(
        [data],
        result,
        false
      );
      return result;
    });
  }
  remove(id) {
    const query = buildDelete(this._config.tableName, `id = ?`, [id]);
    return new Mutation(this._config, [query], (results) => ({
      deleted: results[0].changes > 0
    }));
  }
  removeAll(predicate, bindings) {
    const compiled = compilePredicate(predicate, bindings);
    if (compiled.type === "sql") {
      const query = buildDelete(this._config.tableName, compiled.where);
      return new Mutation(this._config, [query], (results) => results[0].changes);
    }
    return Mutation.fromExecutor(this._config, async () => {
      console.warn(
        `[mindstudio] removeAll predicate on ${this._config.tableName} could not be compiled to SQL \u2014 fetching all rows first`
      );
      const allQuery = buildSelect(this._config.tableName);
      const allResults = await this._config.executeBatch([allQuery]);
      const allRows = allResults[0].rows.map(
        (r) => deserializeRow(
          r,
          this._config.columns
        )
      );
      const matching = allRows.filter((row) => predicate(row, bindings));
      if (matching.length === 0) return 0;
      const deleteQueries = matching.filter((row) => row.id).map((row) => buildDelete(this._config.tableName, `id = ?`, [row.id]));
      if (deleteQueries.length > 0) {
        await this._config.executeBatch(deleteQueries);
      }
      return matching.length;
    });
  }
  clear() {
    const query = buildDelete(this._config.tableName);
    return new Mutation(this._config, [query], (results) => results[0].changes);
  }
  /**
   * Insert a row, or update it if a row with the same unique key already
   * exists. The conflict key must match a `unique` constraint declared in
   * defineTable options. Returns the created or updated row.
   *
   * Uses SQLite's `INSERT ... ON CONFLICT ... DO UPDATE SET ... RETURNING *`.
   *
   * @param conflictKey - Column name(s) that form the unique constraint.
   *   Pass a single string for single-column unique, or an array for compound.
   * @param data - Row data to insert (or update on conflict). Defaults apply.
   */
  upsert(conflictKey, data) {
    const conflictColumns = Array.isArray(conflictKey) ? conflictKey : [conflictKey];
    this._validateUniqueConstraint(conflictColumns);
    const withDefaults = this._config.defaults ? { ...this._config.defaults, ...data } : data;
    this._checkManagedColumns(withDefaults);
    for (const col of conflictColumns) {
      if (!(col in withDefaults)) {
        throw new MindStudioError(
          `Upsert on ${this._config.tableName} requires "${col}" in data (conflict key)`,
          "missing_conflict_key",
          400
        );
      }
    }
    const query = buildUpsert(
      this._config.tableName,
      withDefaults,
      conflictColumns,
      this._config.columns
    );
    return new Mutation(this._config, [query], (results) => {
      if (!results[0]?.rows[0]) {
        throw new MindStudioError(
          `Upsert into ${this._config.tableName} returned no row`,
          "upsert_failed",
          500
        );
      }
      const result = deserializeRow(
        results[0].rows[0],
        this._config.columns
      );
      this._syncRolesIfNeeded([withDefaults], result, false);
      return result;
    });
  }
  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------
  /** @internal Throw if data includes a platform-managed read-only column. */
  _checkManagedColumns(data) {
    const mc = this._config.managedColumns;
    if (!mc) return;
    const keys = Object.keys(data);
    for (const key of keys) {
      if (mc.email && key === mc.email || mc.phone && key === mc.phone || mc.apiKey && key === mc.apiKey) {
        const friendly = key === mc.email ? "email" : key === mc.phone ? "phone" : "API key";
        throw new MindStudioError(
          `Cannot write to "${key}" \u2014 this column is managed by auth. Use the auth API to change a user's ${friendly}.`,
          "managed_column_write",
          400
        );
      }
    }
  }
  /**
   * @internal Fire role sync for rows that wrote to the roles column.
   * Called inside processResult (runs after SQL execution in both
   * standalone and batch paths). Fire-and-forget.
   */
  _syncRolesIfNeeded(inputItems, result, isArray) {
    const rolesCol = this._config.managedColumns?.roles;
    const syncRoles = this._config.syncRoles;
    if (!rolesCol || !syncRoles) return;
    if (!inputItems.some((item) => rolesCol in item)) return;
    if (isArray) {
      for (const row of result) {
        if (row?.id) {
          syncRoles(row.id, row[rolesCol]).catch(() => {
          });
        }
      }
    } else {
      const row = result;
      if (row?.id) {
        syncRoles(row.id, row[rolesCol]).catch(() => {
        });
      }
    }
  }
  /** @internal Validate that the given columns match a declared unique constraint. */
  _validateUniqueConstraint(columns) {
    if (!this._config.unique?.length) {
      throw new MindStudioError(
        `Cannot upsert on ${this._config.tableName}: no unique constraints declared. Add unique: [[${columns.map((c) => `'${c}'`).join(", ")}]] to defineTable options.`,
        "no_unique_constraint",
        400
      );
    }
    const sorted = [...columns].sort().join(",");
    const match = this._config.unique.some(
      (u) => [...u].sort().join(",") === sorted
    );
    if (!match) {
      throw new MindStudioError(
        `Cannot upsert on (${columns.join(", ")}): no matching unique constraint declared on ${this._config.tableName}.`,
        "no_unique_constraint",
        400
      );
    }
  }
};

// src/db/index.ts
function createDb(databases, executeBatch, authConfig, syncRoles) {
  return {
    defineTable(name, options) {
      const resolved = resolveTable(databases, name, options?.database);
      const config = {
        databaseId: resolved.databaseId,
        tableName: name,
        columns: resolved.columns,
        unique: options?.unique,
        defaults: options?.defaults,
        managedColumns: authConfig?.table === name ? authConfig.columns : void 0,
        syncRoles: authConfig?.table === name && authConfig.columns.roles ? syncRoles : void 0,
        executeBatch: (queries) => executeBatch(resolved.databaseId, queries)
      };
      return new Table(config);
    },
    // --- Time helpers ---
    // Pure JS, no platform dependency. All timestamps are unix ms.
    now: () => Date.now(),
    days: (n) => n * 864e5,
    hours: (n) => n * 36e5,
    minutes: (n) => n * 6e4,
    ago: (ms) => Date.now() - ms,
    fromNow: (ms) => Date.now() + ms,
    // --- User references ---
    userRef: (id) => id.startsWith(USER_PREFIX) ? id.slice(USER_PREFIX.length) : id,
    // --- Batch execution ---
    batch: ((...operations) => {
      return (async () => {
        const compiled = operations.map((op) => {
          if (op instanceof Query) {
            return op._compile();
          }
          if (op instanceof Mutation) {
            return op._compile();
          }
          throw new MindStudioError(
            "db.batch() only accepts Query and Mutation objects (from .filter(), .update(), .push(), etc.)",
            "invalid_batch_operation",
            400
          );
        });
        const groups = /* @__PURE__ */ new Map();
        for (let i = 0; i < compiled.length; i++) {
          const c = compiled[i];
          const dbId = c.config.databaseId;
          if (!groups.has(dbId)) groups.set(dbId, []);
          if (c.type === "query") {
            const sqlQuery = c.query ?? c.fallbackQuery;
            groups.get(dbId).push({ opIndex: i, sqlQueries: [sqlQuery] });
          } else {
            groups.get(dbId).push({ opIndex: i, sqlQueries: c.queries });
          }
        }
        const opResults = /* @__PURE__ */ new Map();
        await Promise.all(
          Array.from(groups.entries()).map(async ([dbId, entries]) => {
            const flatQueries = [];
            const slices = [];
            for (const entry of entries) {
              slices.push({
                opIndex: entry.opIndex,
                start: flatQueries.length,
                count: entry.sqlQueries.length
              });
              flatQueries.push(...entry.sqlQueries);
            }
            const results = await executeBatch(dbId, flatQueries);
            for (const { opIndex, start, count } of slices) {
              opResults.set(opIndex, results.slice(start, start + count));
            }
          })
        );
        return compiled.map((c, i) => {
          const results = opResults.get(i);
          if (c.type === "query") {
            if (!c.query && c.predicates?.length) {
              console.warn(
                `[mindstudio] db.batch(): filter on '${c.config.tableName}' could not be compiled to SQL \u2014 processing in JS`
              );
            }
            return Query._processResults(results[0], c);
          } else {
            return Mutation._processResults(results, c);
          }
        });
      })();
    })
  };
}
function resolveTable(databases, tableName, databaseHint) {
  if (databases.length === 0) {
    throw new MindStudioError(
      `No databases found in app context. Make sure the app has at least one database configured.`,
      "no_databases",
      400
    );
  }
  if (databaseHint) {
    const targetDb = databases.find(
      (db2) => db2.id === databaseHint || db2.name === databaseHint
    );
    if (!targetDb) {
      const available = databases.map((db2) => db2.name || db2.id).join(", ");
      throw new MindStudioError(
        `Database "${databaseHint}" not found. Available databases: ${available}`,
        "database_not_found",
        400
      );
    }
    const table = targetDb.tables.find((t) => t.name === tableName);
    if (!table) {
      const available = targetDb.tables.map((t) => t.name).join(", ");
      throw new MindStudioError(
        `Table "${tableName}" not found in database "${databaseHint}". Available tables: ${available || "(none)"}`,
        "table_not_found",
        400
      );
    }
    return { databaseId: targetDb.id, columns: table.schema };
  }
  for (const db2 of databases) {
    const table = db2.tables.find((t) => t.name === tableName);
    if (table) {
      return {
        databaseId: db2.id,
        columns: table.schema
      };
    }
  }
  const availableTables = databases.flatMap((db2) => db2.tables.map((t) => t.name)).join(", ");
  throw new MindStudioError(
    `Table "${tableName}" not found in app databases. Available tables: ${availableTables || "(none)"}`,
    "table_not_found",
    400
  );
}

// src/files/store.ts
import { createHash, randomUUID } from "crypto";
function toBase64(content) {
  return Buffer.from(
    typeof content === "string" ? Buffer.from(content) : content
  ).toString("base64");
}
function extensionFor(filename) {
  if (!filename) {
    return "";
  }
  const dot = filename.lastIndexOf(".");
  return dot > 0 ? filename.slice(dot) : "";
}
var Store = class {
  constructor(_store, _access, _call, _policy = {}) {
    this._store = _store;
    this._access = _access;
    this._call = _call;
    this._policy = _policy;
  }
  /** The store's name. */
  get name() {
    return this._store;
  }
  /** The store's access level. */
  get access() {
    return this._access;
  }
  /** Store bytes. Returns a {@link StoredFile} with a ready-to-use `url`. */
  async put(content, options) {
    const ext = extensionFor(options?.filename);
    const key = options?.key ?? (options?.contentAddressed ? `${createHash("sha256").update(content).digest("hex")}${ext}` : `${randomUUID()}${ext}`);
    const meta = await this._call("put", {
      store: this._store,
      access: this._access,
      key,
      body: toBase64(content),
      ...options?.contentType ? { contentType: options.contentType } : {}
    });
    return this._toFile(key, meta);
  }
  /** Read an object's bytes (backend / trusted context). */
  async get(key) {
    const res = await this._call("get", {
      store: this._store,
      access: this._access,
      key
    });
    return Buffer.from(res.body, "base64");
  }
  /** Metadata without downloading. Rejects if the object doesn't exist. */
  async head(key) {
    const meta = await this._call("head", {
      store: this._store,
      access: this._access,
      key
    });
    return this._toFile(key, meta);
  }
  /** Whether an object exists. */
  async exists(key) {
    try {
      await this.head(key);
      return true;
    } catch {
      return false;
    }
  }
  /** List objects in the store (optionally under `prefix`), one page at a time. */
  async list(options) {
    const res = await this._call("list", {
      store: this._store,
      access: this._access,
      ...options?.prefix ? { prefix: options.prefix } : {},
      ...options?.cursor ? { cursor: options.cursor } : {},
      ...options?.limit ? { limit: options.limit } : {}
    });
    return {
      files: (res.files ?? []).map((f) => this._toFile(f.key, f)),
      ...res.cursor ? { cursor: res.cursor } : {}
    };
  }
  /** Delete an object. No-op if it doesn't exist. */
  async delete(key) {
    await this._call("delete", {
      store: this._store,
      access: this._access,
      key
    });
  }
  /**
   * Mint an ABSOLUTE, signed share URL for a key — works with **no** active
   * session (email it, or embed it on another site). Expires (default 24h).
   * Private stores only.
   *
   * The same link is available as `file.shareUrl()` on a {@link StoredFile};
   * this convenience skips the `head()` when you already hold just the key.
   */
  async shareUrl(key, options) {
    const res = await this._call("sign", {
      store: this._store,
      access: this._access,
      key,
      ...options?.expiresIn ? { expiresIn: options.expiresIn } : {}
    });
    return res.url;
  }
  /**
   * Mint an {@link UploadToken} for a **client-direct** upload — the browser
   * POSTs the file straight to storage, so the bytes never pass through the
   * platform. Return the token from a backend method and hand it to the
   * frontend's `platform.upload(token, file)`. Works for private + public stores.
   *
   * Enforced at upload time by the presigned POST: a max size (this call's
   * `maxSize`, else the store's, else the platform default) and — when
   * `contentType` is set — an exact content-type match. When the store declares
   * `contentTypes`, `contentType` must be one of them.
   *
   * Note: a presigned POST can pin exactly ONE content-type per token, so the
   * *allowlist* is declared on `defineStore({ contentTypes })` and each token
   * pins one type from it. This is by design, not a per-token limitation.
   *
   * @example
   * ```ts
   * // backend method
   * export async function getUploadSlot(input: { contentType: string }) {
   *   return Uploads.createUploadToken({ contentType: input.contentType, maxSize: 50 * 1024 * 1024 });
   * }
   * ```
   */
  async createUploadToken(options) {
    if (options?.contentType && this._policy.contentTypes && !this._policy.contentTypes.includes(options.contentType)) {
      throw new MindStudioError(
        `contentType "${options.contentType}" is not allowed by store "${this._store}".`,
        "content_type_not_allowed",
        400
      );
    }
    const key = options?.key ?? `${randomUUID()}${extensionFor(options?.filename)}`;
    const maxSize = options?.maxSize ?? this._policy.maxSize;
    const res = await this._call("create-upload", {
      store: this._store,
      access: this._access,
      key,
      ...options?.contentType ? { contentType: options.contentType } : {},
      ...maxSize ? { maxSize } : {},
      ...options?.expiresIn ? { expiresIn: options.expiresIn } : {}
    });
    return {
      key,
      url: `/_/files/${this._access}/${this._store}/${key}`,
      upload: { url: res.uploadUrl, fields: res.uploadFields }
    };
  }
  _toFile(key, meta) {
    const store = this._store;
    const access = this._access;
    const call = this._call;
    return {
      store,
      key,
      access,
      url: `/_/files/${access}/${store}/${key}`,
      ...typeof meta?.size === "number" ? { size: meta.size } : {},
      ...meta?.contentType ? { contentType: meta.contentType } : {},
      ...meta?.updatedAt ? { updatedAt: meta.updatedAt } : {},
      async shareUrl(options) {
        const res = await call("sign", {
          store,
          access,
          key,
          ...options?.expiresIn ? { expiresIn: options.expiresIn } : {}
        });
        return res.url;
      }
    };
  }
};

// src/files/index.ts
function createFiles(call) {
  return {
    defineStore(name, options) {
      return new Store(name, options?.access ?? "private", call, {
        ...options?.maxSize !== void 0 ? { maxSize: options.maxSize } : {},
        ...options?.contentTypes ? { contentTypes: options.contentTypes } : {}
      });
    }
  };
}

// src/datasources/source.ts
import { createHash as createHash2 } from "crypto";
var DataSource = class {
  constructor(_slug, _call) {
    this._slug = _slug;
    this._call = _call;
  }
  get name() {
    return this._slug;
  }
  /**
   * Search the corpus.
   *
   * Returns chunks ranked by relevance, each with a citation. Searching a
   * source that doesn't exist yet returns no results rather than throwing —
   * code may name a corpus the build hasn't populated.
   *
   * **Deterministic** for a fixed corpus and configuration: the same query
   * returns the same hits in the same order, so it's safe to build an eval set
   * or a regression check on top of it. There is no seed to set. Two things do
   * legitimately move the results: adding or removing documents, and changing
   * the corpus configuration — both of which you control.
   *
   * Alongside `results` and `latencyMs` comes {@link SearchRan} — what the
   * search actually did, which is the first thing to check when results don't
   * look like the options you passed.
   */
  async search(query, options) {
    const { results, mode, latencyMs } = await this._call("search", {
      slug: this._slug,
      query,
      ...options?.topK !== void 0 ? { topK: options.topK } : {},
      ...options?.scoreThreshold !== void 0 ? { scoreThreshold: options.scoreThreshold } : {},
      ...options?.filter !== void 0 ? { filter: options.filter } : {},
      ...options?.mode !== void 0 ? { mode: options.mode } : {},
      ...options?.maxPerDocument !== void 0 ? { maxPerDocument: options.maxPerDocument } : {},
      ...options?.highlight !== void 0 ? { highlight: options.highlight } : {},
      ...options?.rerank !== void 0 ? { rerank: options.rerank } : {},
      ...options?.hybrid !== void 0 ? { hybrid: options.hybrid } : {},
      ...options?.explain !== void 0 ? { explain: options.explain } : {},
      ...options?.expand !== void 0 ? { expand: options.expand } : {}
    });
    return { results: results ?? [], mode, latencyMs: latencyMs ?? 0 };
  }
  /**
   * What is in the corpus, and how it was built.
   *
   * Document and chunk counts, storage, and the embedding model and chunking
   * settings actually in effect — which is not the same as the platform
   * default, since a corpus keeps the configuration it was built with until
   * someone migrates it.
   */
  async stats() {
    return this._call("stats", { slug: this._slug });
  }
  /**
   * Every chunk of one document, exactly as it was indexed.
   *
   * The direct answer to "why isn't this document coming back?" — search only
   * shows you the chunks that surface, which is no help when none do. Reading
   * how a document was actually split usually is.
   *
   * Pass `{ vectors: true }` to include each chunk's embedding. Large: roughly
   * 8KB per chunk, so a 500-chunk document is several megabytes.
   */
  async chunks(documentId, options) {
    const { chunks } = await this._call("chunks", {
      slug: this._slug,
      documentId,
      ...options?.vectors ? { vectors: true } : {}
    });
    return chunks ?? [];
  }
  /**
   * Add a document to the corpus.
   *
   * Returns as soon as the document is queued — extraction and embedding run
   * in the background and take a while, so poll {@link documents} for status
   * rather than assuming the content is searchable on return.
   *
   * **Adding the same bytes twice is free.** Documents are content-addressed,
   * so a re-add is a no-op when this source has already processed those exact
   * bytes under its current configuration. Reconfiguring the source is what
   * makes a re-add do work again — and that is an explicit, owner-triggered
   * migration, never something a deploy causes.
   */
  async add(content, options) {
    const bytes = typeof content === "string" ? Buffer.from(content) : Buffer.from(content);
    return this._call("add", {
      slug: this._slug,
      filename: options.filename,
      ...options.contentType ? { contentType: options.contentType } : {},
      ...options.metadata !== void 0 ? { metadata: options.metadata } : {},
      body: bytes.toString("base64")
    });
  }
  /** Every document in the corpus, with ingest status. */
  async documents() {
    const { documents } = await this._call("documents", { slug: this._slug });
    return documents ?? [];
  }
  /** Remove a document and its vectors. */
  async remove(documentId) {
    await this._call("remove", { slug: this._slug, documentId });
  }
  /**
   * Create the data source if it doesn't exist yet.
   *
   * Rarely needed — `add` and `search` both handle a missing source. Useful
   * when you want it to exist (and appear in the dashboard) before any
   * document has been added.
   */
  async ensure(name) {
    await this._call("ensure", {
      slug: this._slug,
      ...name ? { name } : {}
    });
  }
  /**
   * @internal Content hash of some bytes, matching what the server computes.
   * Exposed for callers that want to check whether they already added a file.
   */
  static contentHash(content) {
    return createHash2("sha256").update(Buffer.from(content)).digest("hex");
  }
};

// src/datasources/index.ts
function createDataSources(call) {
  return {
    defineDataSource(name) {
      return new DataSource(name, call);
    }
  };
}

// src/voice/index.ts
function createVoice(call) {
  return {
    async call(params) {
      return await call("call", {
        to: params.to,
        assumeIdentity: params.assumeIdentity === true
      });
    }
  };
}

// src/generated/metadata.ts
var stepMetadata = {
  "activeCampaignAddNote": {
    stepType: "activeCampaignAddNote",
    description: "Add a note to an existing contact in ActiveCampaign.",
    usageNotes: "- Requires an ActiveCampaign OAuth connection (connectionId).\n- The contact must already exist \u2014 use the contact ID from a previous create or search step.",
    inputSchema: { "type": "object", "properties": { "contactId": { "type": "string", "description": "ActiveCampaign contact ID to add the note to" }, "note": { "type": "string", "description": "Note text content" }, "connectionId": { "type": "string", "description": "ActiveCampaign OAuth connection ID" } }, "required": ["contactId", "note"] },
    outputSchema: { "description": "This step does not produce output data." }
  },
  "activeCampaignCreateContact": {
    stepType: "activeCampaignCreateContact",
    description: "Create or sync a contact in ActiveCampaign.",
    usageNotes: "- Requires an ActiveCampaign OAuth connection (connectionId).\n- If a contact with the email already exists, it may be updated depending on ActiveCampaign settings.\n- Custom fields are passed as a key-value map where keys are field IDs.",
    inputSchema: { "type": "object", "properties": { "email": { "type": "string", "description": "Contact email address" }, "firstName": { "type": "string", "description": "Contact first name" }, "lastName": { "type": "string", "description": "Contact last name" }, "phone": { "type": "string", "description": "Contact phone number" }, "accountId": { "type": "string", "description": "ActiveCampaign account ID to associate the contact with" }, "customFields": { "type": "object", "properties": {}, "required": [], "description": "Custom field values keyed by field ID" }, "connectionId": { "type": "string", "description": "ActiveCampaign OAuth connection ID" } }, "required": ["email", "firstName", "lastName", "phone", "accountId", "customFields"] },
    outputSchema: { "type": "object", "properties": { "contactId": { "type": "string", "description": "ActiveCampaign contact ID of the created contact" } }, "required": ["contactId"] }
  },
  "addSubtitlesToVideo": {
    stepType: "addSubtitlesToVideo",
    description: "Automatically add subtitles to a video",
    usageNotes: "- Can control style of text and animation",
    inputSchema: { "type": "object", "properties": { "videoUrl": { "type": "string", "description": "URL of the source video" }, "language": { "type": "string", "description": "ISO language code for subtitle transcription" }, "fontName": { "type": "string", "description": "Google Font name for subtitle text" }, "fontSize": { "type": "number", "description": "Font size in pixels. Default: 100." }, "fontWeight": { "enum": ["normal", "bold", "black"], "type": "string", "description": "Font weight for subtitle text" }, "fontColor": { "enum": ["white", "black", "red", "green", "blue", "yellow", "orange", "purple", "pink", "brown", "gray", "cyan", "magenta"], "type": "string", "description": "Color of the subtitle text" }, "highlightColor": { "enum": ["white", "black", "red", "green", "blue", "yellow", "orange", "purple", "pink", "brown", "gray", "cyan", "magenta"], "type": "string", "description": "Color used to highlight the currently spoken word" }, "strokeWidth": { "type": "number", "description": "Width of the text stroke outline in pixels" }, "strokeColor": { "enum": ["black", "white", "red", "green", "blue", "yellow", "orange", "purple", "pink", "brown", "gray", "cyan", "magenta"], "type": "string", "description": "Color of the text stroke outline" }, "backgroundColor": { "enum": ["black", "white", "red", "green", "blue", "yellow", "orange", "purple", "pink", "brown", "gray", "cyan", "magenta", "none"], "type": "string", "description": "Background color behind subtitle text. Use 'none' for transparent." }, "backgroundOpacity": { "type": "number", "description": "Opacity of the subtitle background. 0.0 = fully transparent, 1.0 = fully opaque." }, "position": { "enum": ["top", "center", "bottom"], "type": "string", "description": "Vertical position of subtitle text on screen" }, "yOffset": { "type": "number", "description": "Vertical offset in pixels from the position. Positive moves down, negative moves up. Default: 75." }, "wordsPerSubtitle": { "type": "number", "description": "Maximum number of words per subtitle segment. Use 1 for single-word display, 2-3 for short phrases, or 8-12 for full sentences. Default: 3." }, "enableAnimation": { "type": "boolean", "description": "When true, enables bounce-style entrance animation for subtitles. Default: true." }, "intermediateAsset": { "type": "boolean", "description": "When true, the asset is created but hidden from the user's gallery (tagged as intermediate)" } }, "required": ["videoUrl", "language", "fontName", "fontSize", "fontWeight", "fontColor", "highlightColor", "strokeWidth", "strokeColor", "backgroundColor", "backgroundOpacity", "position", "yOffset", "wordsPerSubtitle", "enableAnimation"] },
    outputSchema: { "type": "object", "properties": { "videoUrl": { "type": "string", "description": "URL of the video with subtitles added" } }, "required": ["videoUrl"] }
  },
  "airtableCreateUpdateRecord": {
    stepType: "airtableCreateUpdateRecord",
    description: "Create a new record or update an existing record in an Airtable table.",
    usageNotes: '- If recordId is provided, updates that record. Otherwise, creates a new one.\n- When updating with updateMode "onlySpecified", unspecified fields are left as-is. With "all", unspecified fields are cleared.\n- Array fields (e.g. multipleAttachments) accept arrays of values.',
    inputSchema: { "type": "object", "properties": { "connectionId": { "type": "string", "description": "Airtable OAuth connection ID" }, "baseId": { "type": "string", "description": "Airtable base ID" }, "tableId": { "type": "string", "description": "Airtable table ID" }, "recordId": { "type": "string", "description": "Record ID to update. Omit to create a new record" }, "updateMode": { "enum": ["onlySpecified", "all"], "type": "string", "description": "How to handle unspecified fields on update. 'onlySpecified' leaves them as-is, 'all' clears them" }, "fields": { "description": "Field schema metadata used for type resolution" }, "recordData": { "type": "object", "properties": {}, "required": [], "description": "Field values to set, keyed by field ID" } }, "required": ["baseId", "tableId", "fields", "recordData"] },
    outputSchema: { "type": "object", "properties": { "recordId": { "type": "string", "description": "The Airtable record ID of the created or updated record" } }, "required": ["recordId"] }
  },
  "airtableDeleteRecord": {
    stepType: "airtableDeleteRecord",
    description: "Delete a record from an Airtable table by its record ID.",
    usageNotes: "- Requires an active Airtable OAuth connection (connectionId).\n- Silently succeeds if the record does not exist.",
    inputSchema: { "type": "object", "properties": { "connectionId": { "type": "string", "description": "Airtable OAuth connection ID" }, "baseId": { "type": "string", "description": "Airtable base ID" }, "tableId": { "type": "string", "description": "Airtable table ID" }, "recordId": { "type": "string", "description": "Record ID to delete" } }, "required": ["baseId", "tableId", "recordId"] },
    outputSchema: { "type": "object", "properties": { "deleted": { "type": "boolean", "description": "Whether the record was successfully deleted" } }, "required": ["deleted"] }
  },
  "airtableGetRecord": {
    stepType: "airtableGetRecord",
    description: "Fetch a single record from an Airtable table by its record ID.",
    usageNotes: "- Requires an active Airtable OAuth connection (connectionId).\n- If the record is not found, returns a string message instead of a record object.",
    inputSchema: { "type": "object", "properties": { "connectionId": { "type": "string", "description": "Airtable OAuth connection ID" }, "baseId": { "type": "string", "description": 'Airtable base ID (e.g. "appXXXXXX")' }, "tableId": { "type": "string", "description": 'Airtable table ID (e.g. "tblXXXXXX")' }, "recordId": { "type": "string", "description": 'Record ID to fetch (e.g. "recXXXXXX")' } }, "required": ["baseId", "tableId", "recordId"] },
    outputSchema: { "type": "object", "properties": { "record": { "anyOf": [{ "type": "object", "properties": { "id": { "type": "string", "description": "Airtable record ID" }, "createdTime": { "type": "string", "description": "ISO 8601 timestamp when the record was created" }, "fields": { "type": "object", "properties": {}, "required": [], "description": "Field values keyed by field name" } }, "required": ["id", "createdTime", "fields"] }, { "type": "null" }] } }, "required": ["record"] }
  },
  "airtableGetTableRecords": {
    stepType: "airtableGetTableRecords",
    description: "Fetch multiple records from an Airtable table with optional pagination.",
    usageNotes: "- Requires an active Airtable OAuth connection (connectionId).\n- Default limit is 100 records. Maximum is 1000.\n- When outputFormat is 'csv', the variable receives CSV text. The direct execution output always returns parsed records.",
    inputSchema: { "type": "object", "properties": { "connectionId": { "type": "string", "description": "Airtable OAuth connection ID" }, "baseId": { "type": "string", "description": 'Airtable base ID (e.g. "appXXXXXX")' }, "tableId": { "type": "string", "description": 'Airtable table ID (e.g. "tblXXXXXX")' }, "outputFormat": { "enum": ["json", "csv"], "type": "string", "description": "Output format for the result. Defaults to 'json'" }, "limit": { "type": "number", "description": "Maximum number of records to return. Defaults to 100, max 1000" } }, "required": ["baseId", "tableId"] },
    outputSchema: { "type": "object", "properties": { "records": { "type": "array", "items": { "type": "object", "properties": { "id": { "type": "string", "description": "Airtable record ID" }, "createdTime": { "type": "string", "description": "ISO 8601 timestamp when the record was created" }, "fields": { "type": "object", "properties": {}, "required": [], "description": "Field values keyed by field name" } }, "required": ["id", "createdTime", "fields"] }, "description": "The list of records retrieved from the Airtable table" } }, "required": ["records"] }
  },
  "analyzeImage": {
    stepType: "analyzeImage",
    description: "Analyze an image using a vision model based on a text prompt.",
    usageNotes: "- Uses the configured vision model to generate a text analysis of the image.\n- The prompt should describe what to look for or extract from the image.\n- Pass imageUrl for a single image, or imageUrls for multiple images analyzed together in one request.\n- Most vision models (OpenAI, Grok, Gemini) accept multiple images in one request. Ideogram describe is single-image only.",
    inputSchema: { "type": "object", "properties": { "prompt": { "type": "string", "description": "Instructions describing what to look for or extract from the image" }, "imageUrl": { "type": "string", "description": "URL of a single image to analyze. Kept for backward compatibility; prefer imageUrls." }, "imageUrls": { "type": "array", "items": { "type": "string" }, "description": "One or more image URLs to analyze together in a single model request" }, "visionModelOverride": { "anyOf": [{ "type": "object", "properties": { "model": { "type": "string" }, "config": { "type": "object", "properties": {}, "required": [] } }, "required": ["model"] }, { "type": "object", "properties": { "model": { "type": "string", "description": 'Model identifier (e.g. "gpt-4", "claude-3-opus")' }, "temperature": { "type": "number", "description": "Sampling temperature for the model (0-2)" }, "maxResponseTokens": { "type": "number", "description": "Maximum number of tokens in the model's response" }, "ignorePreamble": { "type": "boolean", "description": "Whether to skip the system preamble/instructions" }, "userMessagePreprocessor": { "type": "object", "properties": { "dataSource": { "type": "string", "description": "Data source identifier for the preprocessor" }, "messageTemplate": { "type": "string", "description": "Template string applied to user messages before sending to the model" }, "maxResults": { "type": "number", "description": "Maximum number of results to include from the data source" }, "enabled": { "type": "boolean", "description": "Whether the preprocessor is active" }, "shouldInherit": { "type": "boolean", "description": "Whether child steps should inherit this preprocessor configuration" } }, "description": "Preprocessor applied to user messages before sending to the model" }, "preamble": { "type": "string", "description": "System preamble/instructions for the model" }, "multiModelEnabled": { "type": "boolean", "description": "Whether multi-model candidate generation is enabled" }, "editResponseEnabled": { "type": "boolean", "description": "Whether the user can edit the model's response" }, "config": { "type": "object", "properties": {}, "required": [], "description": "Additional model-specific configuration" } }, "required": ["model", "temperature", "maxResponseTokens"] }] } }, "required": ["prompt"] },
    outputSchema: { "type": "object", "properties": { "analysis": { "type": "string", "description": "Text analysis of the image generated by the vision model" } }, "required": ["analysis"] }
  },
  "analyzeVideo": {
    stepType: "analyzeVideo",
    description: "Analyze a video using a video analysis model based on a text prompt.",
    usageNotes: "- Uses the configured video analysis model to generate a text analysis of the video.\n- The prompt should describe what to look for or extract from the video.",
    inputSchema: { "type": "object", "properties": { "prompt": { "type": "string", "description": "Instructions describing what to look for or extract from the video" }, "videoUrl": { "type": "string", "description": "URL of the video to analyze" }, "videoAnalysisModelOverride": { "anyOf": [{ "type": "object", "properties": { "model": { "type": "string" }, "config": { "type": "object", "properties": {}, "required": [] } }, "required": ["model"] }, { "type": "object", "properties": { "model": { "type": "string", "description": 'Model identifier (e.g. "gpt-4", "claude-3-opus")' }, "temperature": { "type": "number", "description": "Sampling temperature for the model (0-2)" }, "maxResponseTokens": { "type": "number", "description": "Maximum number of tokens in the model's response" }, "ignorePreamble": { "type": "boolean", "description": "Whether to skip the system preamble/instructions" }, "userMessagePreprocessor": { "type": "object", "properties": { "dataSource": { "type": "string", "description": "Data source identifier for the preprocessor" }, "messageTemplate": { "type": "string", "description": "Template string applied to user messages before sending to the model" }, "maxResults": { "type": "number", "description": "Maximum number of results to include from the data source" }, "enabled": { "type": "boolean", "description": "Whether the preprocessor is active" }, "shouldInherit": { "type": "boolean", "description": "Whether child steps should inherit this preprocessor configuration" } }, "description": "Preprocessor applied to user messages before sending to the model" }, "preamble": { "type": "string", "description": "System preamble/instructions for the model" }, "multiModelEnabled": { "type": "boolean", "description": "Whether multi-model candidate generation is enabled" }, "editResponseEnabled": { "type": "boolean", "description": "Whether the user can edit the model's response" }, "config": { "type": "object", "properties": {}, "required": [], "description": "Additional model-specific configuration" } }, "required": ["model", "temperature", "maxResponseTokens"] }] } }, "required": ["prompt", "videoUrl"] },
    outputSchema: { "type": "object", "properties": { "analysis": { "type": "string", "description": "Text analysis of the video generated by the video analysis model" } }, "required": ["analysis"] }
  },
  "captureThumbnail": {
    stepType: "captureThumbnail",
    description: "Capture a thumbnail from a video at a specified timestamp",
    usageNotes: "",
    inputSchema: { "type": "object", "properties": { "videoUrl": { "type": "string", "description": "URL of the source video to capture a frame from" }, "at": { "anyOf": [{ "type": "number" }, { "type": "string" }] } }, "required": ["videoUrl", "at"] },
    outputSchema: { "type": "object", "properties": { "thumbnailUrl": { "type": "string", "description": "URL of the captured thumbnail image" } }, "required": ["thumbnailUrl"] }
  },
  "checkAppRole": {
    stepType: "checkAppRole",
    description: "Check whether the current user has a specific app role and branch accordingly.",
    usageNotes: '- Checks if the current user has been assigned a specific role in this app.\n- If the user has the role, transitions to the "has role" path.\n- If the user does not have the role, transitions to the "no role" path, or errors if no path is configured.\n- Role names are defined by the app creator and assigned to users via the app roles system.\n- The roleName field supports {{variables}} for dynamic role checks.',
    inputSchema: { "type": "object", "properties": { "roleName": { "type": "string", "description": "The role name to check (supports {{variables}})" }, "hasRoleStepId": { "type": "string", "description": "Step to transition to if the user has the role (same workflow)" }, "hasRoleWorkflowId": { "type": "string", "description": "Workflow to jump to if the user has the role (cross workflow)" }, "noRoleStepId": { "type": "string", "description": "Step to transition to if the user does not have the role (same workflow)" }, "noRoleWorkflowId": { "type": "string", "description": "Workflow to jump to if the user does not have the role (cross workflow)" } }, "required": ["roleName"], "description": "Configuration for the check app role step" },
    outputSchema: { "type": "object", "properties": { "hasRole": { "type": "boolean", "description": "Whether the current user has the checked role" }, "userRoles": { "type": "array", "items": { "type": "string" }, "description": "All roles assigned to the current user for this app" } }, "required": ["hasRole", "userRoles"] }
  },
  "codaCreateUpdatePage": {
    stepType: "codaCreateUpdatePage",
    description: "Create a new page or update an existing page in a Coda document.",
    usageNotes: "- Requires a Coda OAuth connection (connectionId).\n- If pageData.pageId is provided, updates that page. Otherwise, creates a new one.\n- Page content is provided as markdown and converted to Coda's canvas format.\n- When updating, insertionMode controls how content is applied (default: 'append').",
    inputSchema: { "type": "object", "properties": { "connectionId": { "type": "string", "description": "Coda OAuth connection ID" }, "pageData": { "type": "object", "properties": { "docId": { "type": "string", "description": "Coda document ID" }, "pageId": { "type": "string", "description": "Page ID to update. Omit to create a new page" }, "name": { "type": "string", "description": "Page title" }, "subtitle": { "type": "string", "description": "Page subtitle" }, "iconName": { "type": "string", "description": "Page icon name" }, "imageUrl": { "type": "string", "description": "Page cover image URL" }, "parentPageId": { "type": "string", "description": "Parent page ID for nesting under another page" }, "pageContent": { "anyOf": [{ "type": "string" }, {}] }, "contentUpdate": { "description": "Content update payload for partial updates" }, "insertionMode": { "type": "string", "description": 'How to insert content on update: "append" or "replace"' } }, "required": ["docId", "name", "subtitle", "iconName", "imageUrl", "pageContent"], "description": "Page configuration including document ID, title, content, and optional parent page" } }, "required": ["pageData"] },
    outputSchema: { "type": "object", "properties": { "pageId": { "type": "string", "description": "The Coda page ID of the created or updated page" } }, "required": ["pageId"] }
  },
  "codaCreateUpdateRow": {
    stepType: "codaCreateUpdateRow",
    description: "Create a new row or update an existing row in a Coda table.",
    usageNotes: "- Requires a Coda OAuth connection (connectionId).\n- If rowId is provided, updates that row. Otherwise, creates a new one.\n- Row data keys are column IDs. Empty values are excluded.",
    inputSchema: { "type": "object", "properties": { "connectionId": { "type": "string", "description": "Coda OAuth connection ID" }, "docId": { "type": "string", "description": "Coda document ID" }, "tableId": { "type": "string", "description": "Table ID within the document" }, "rowId": { "type": "string", "description": "Row ID to update. Omit to create a new row" }, "rowData": { "type": "object", "properties": {}, "required": [], "description": "Column values to set, keyed by column ID" } }, "required": ["docId", "tableId", "rowData"] },
    outputSchema: { "type": "object", "properties": { "rowId": { "type": "string", "description": "The Coda row ID of the created or updated row" } }, "required": ["rowId"] }
  },
  "codaFindRow": {
    stepType: "codaFindRow",
    description: "Search for a row in a Coda table by matching column values.",
    usageNotes: "- Requires a Coda OAuth connection (connectionId).\n- Returns the first row matching all specified column values, or null if no match.\n- Search criteria in rowData are ANDed together.",
    inputSchema: { "type": "object", "properties": { "connectionId": { "type": "string", "description": "Coda OAuth connection ID" }, "docId": { "type": "string", "description": "Coda document ID" }, "tableId": { "type": "string", "description": "Table ID to search within" }, "rowData": { "type": "object", "properties": {}, "required": [], "description": "Column values to match against, keyed by column ID. All criteria are ANDed together" } }, "required": ["docId", "tableId", "rowData"] },
    outputSchema: { "type": "object", "properties": { "row": { "anyOf": [{ "type": "object", "properties": { "id": { "type": "string", "description": "Coda row ID" }, "values": { "type": "object", "properties": {}, "required": [], "description": "Column values keyed by column name" } }, "required": ["id", "values"] }, { "type": "null" }] } }, "required": ["row"] }
  },
  "codaGetPage": {
    stepType: "codaGetPage",
    description: "Export and read the contents of a page from a Coda document.",
    usageNotes: "- Requires a Coda OAuth connection (connectionId).\n- Page export is asynchronous on Coda's side \u2014 there may be a brief delay while it processes.\n- If a page was just created in a prior step, there is an automatic 20-second retry if the first export attempt fails.",
    inputSchema: { "type": "object", "properties": { "connectionId": { "type": "string", "description": "Coda OAuth connection ID" }, "docId": { "type": "string", "description": "Coda document ID" }, "pageId": { "type": "string", "description": "Page ID within the document" }, "outputFormat": { "enum": ["html", "markdown"], "type": "string", "description": "Export format for the page content. Defaults to 'html'" } }, "required": ["docId", "pageId"] },
    outputSchema: { "type": "object", "properties": { "content": { "type": "string", "description": "Page content in the requested format (HTML or Markdown)" } }, "required": ["content"] }
  },
  "codaGetTableRows": {
    stepType: "codaGetTableRows",
    description: "Fetch rows from a Coda table with optional pagination.",
    usageNotes: "- Requires a Coda OAuth connection (connectionId).\n- Default limit is 10000 rows. Rows are fetched in pages of 500.\n- When outputFormat is 'csv', the variable receives CSV text. The direct execution output always returns parsed rows.",
    inputSchema: { "type": "object", "properties": { "connectionId": { "type": "string", "description": "Coda OAuth connection ID" }, "docId": { "type": "string", "description": "Coda document ID" }, "tableId": { "type": "string", "description": "Table ID within the document" }, "limit": { "type": ["number", "string"] }, "outputFormat": { "enum": ["json", "csv"], "type": "string", "description": "Output format for the result. Defaults to 'json'" } }, "required": ["docId", "tableId"] },
    outputSchema: { "type": "object", "properties": { "rows": { "type": "array", "items": { "type": "object", "properties": { "id": { "type": "string", "description": "Coda row ID" }, "values": { "type": "object", "properties": {}, "required": [], "description": "Column values keyed by column name" } }, "required": ["id", "values"] }, "description": "The list of rows retrieved from the Coda table" } }, "required": ["rows"] }
  },
  "convertPdfToImages": {
    stepType: "convertPdfToImages",
    description: "Convert each page of a PDF document into a PNG image.",
    usageNotes: "- Each page is converted to a separate PNG and re-hosted on the CDN.\n- Returns an array of image URLs, one per page.",
    inputSchema: { "type": "object", "properties": { "pdfUrl": { "type": "string", "description": "URL of the PDF document to convert" } }, "required": ["pdfUrl"] },
    outputSchema: { "type": "object", "properties": { "imageUrls": { "type": "array", "items": { "type": "string" }, "description": "CDN URLs of the generated page images, one per page of the PDF" } }, "required": ["imageUrls"] }
  },
  "createDataSource": {
    stepType: "createDataSource",
    description: "Legacy v1 data sources. v2 apps should use `dataSources.defineDataSource()` from @mindstudio-ai/agent instead, which owns parsing, chunking, embedding and citations. Create a new empty vector data source for the current app.",
    usageNotes: '- Creates a new data source (vector database) associated with the current app version.\n- The data source is created empty \u2014 use the "Upload Data Source Document" block to add documents.\n- Returns the new data source ID which can be used in subsequent blocks.',
    inputSchema: { "type": "object", "properties": { "name": { "type": "string", "description": "Name for the new data source (supports variable interpolation)" } }, "required": ["name"] },
    outputSchema: { "description": "This step does not produce output data." }
  },
  "createGmailDraft": {
    stepType: "createGmailDraft",
    description: "Create a draft email in the connected Gmail account.",
    usageNotes: `- Requires a Google OAuth connection with Gmail compose scope.
- The draft appears in the user's Gmail Drafts folder but is not sent.
- messageType controls the body format: "plain" for plain text, "html" for raw HTML, "markdown" for auto-converted markdown.`,
    inputSchema: { "type": "object", "properties": { "to": { "type": "string", "description": "Recipient email address(es), comma-separated for multiple" }, "subject": { "type": "string", "description": "Email subject line" }, "message": { "type": "string", "description": "Email body content" }, "connectionId": { "type": "string", "description": "Google OAuth connection ID" }, "messageType": { "enum": ["plain", "html", "markdown"], "type": "string", "description": 'Body format: "plain", "html", or "markdown"' } }, "required": ["to", "subject", "message", "messageType"] },
    outputSchema: { "type": "object", "properties": { "draftId": { "type": "string", "description": "Gmail draft ID" } }, "required": ["draftId"] }
  },
  "createGoogleCalendarEvent": {
    stepType: "createGoogleCalendarEvent",
    description: "Create a new event on a Google Calendar.",
    usageNotes: '- Requires a Google OAuth connection with Calendar events scope.\n- Date/time values must be ISO 8601 format (e.g. "2025-07-02T10:00:00-07:00").\n- Attendees are specified as one email address per line in a single string.\n- Set addMeetLink to true to automatically attach a Google Meet video call.',
    inputSchema: { "type": "object", "properties": { "connectionId": { "type": "string", "description": "Google OAuth connection ID" }, "summary": { "type": "string", "description": "Event title" }, "description": { "type": "string", "description": "Event description" }, "location": { "type": "string", "description": "Event location" }, "startDateTime": { "type": "string", "description": "Start time in ISO 8601 format" }, "endDateTime": { "type": "string", "description": "End time in ISO 8601 format" }, "attendees": { "type": "string", "description": "Attendee email addresses, one per line" }, "addMeetLink": { "type": "boolean", "description": "Whether to attach a Google Meet video call link" }, "calendarId": { "type": "string", "description": 'Calendar ID (defaults to "primary" if omitted)' } }, "required": ["summary", "startDateTime", "endDateTime"] },
    outputSchema: { "type": "object", "properties": { "eventId": { "type": "string", "description": "Google Calendar event ID" }, "htmlLink": { "type": "string", "description": "URL to view the event in Google Calendar" } }, "required": ["eventId", "htmlLink"] }
  },
  "createGoogleDoc": {
    stepType: "createGoogleDoc",
    description: "Create a new Google Document and optionally populate it with content.",
    usageNotes: '- textType determines how the text field is interpreted: "plain" for plain text, "html" for HTML markup, "markdown" for Markdown.',
    inputSchema: { "type": "object", "properties": { "title": { "type": "string", "description": "Title for the new document" }, "text": { "type": "string", "description": "Document body content" }, "connectionId": { "type": "string", "description": "Google OAuth connection ID" }, "textType": { "enum": ["plain", "html", "markdown"], "type": "string", "description": 'Format of the text field: "plain", "html", or "markdown"' } }, "required": ["title", "text", "textType"] },
    outputSchema: { "type": "object", "properties": { "documentUrl": { "type": "string", "description": "URL of the newly created Google Document" } }, "required": ["documentUrl"] }
  },
  "createGoogleSheet": {
    stepType: "createGoogleSheet",
    description: "Create a new Google Spreadsheet and populate it with CSV data.",
    usageNotes: "",
    inputSchema: { "type": "object", "properties": { "title": { "type": "string", "description": "Title for the new spreadsheet" }, "text": { "type": "string", "description": "CSV data to populate the sheet with" }, "connectionId": { "type": "string", "description": "Google OAuth connection ID" } }, "required": ["title", "text"] },
    outputSchema: { "type": "object", "properties": { "spreadsheetUrl": { "type": "string", "description": "URL of the newly created Google Spreadsheet" } }, "required": ["spreadsheetUrl"] }
  },
  "deleteDataSource": {
    stepType: "deleteDataSource",
    description: "Legacy v1 data sources. v2 apps should use `dataSources.defineDataSource()` from @mindstudio-ai/agent instead, which owns parsing, chunking, embedding and citations. Delete a vector data source from the current app.",
    usageNotes: "- Soft-deletes a data source (vector database) by marking it as deleted.\n- The Milvus partition is cleaned up asynchronously by a background cron job.\n- The data source must belong to the current app version.",
    inputSchema: { "type": "object", "properties": { "dataSourceId": { "type": "string", "description": "ID of the data source to delete (supports variable interpolation)" } }, "required": ["dataSourceId"] },
    outputSchema: { "description": "This step does not produce output data." }
  },
  "deleteDataSourceDocument": {
    stepType: "deleteDataSourceDocument",
    description: "Legacy v1 data sources. v2 apps should use `dataSources.defineDataSource()` from @mindstudio-ai/agent instead, which owns parsing, chunking, embedding and citations. Delete a single document from a data source.",
    usageNotes: "- Soft-deletes a document by marking it as deleted.\n- Requires both the data source ID and document ID.\n- After deletion, reloads vectors into Milvus so the data source reflects the change immediately.",
    inputSchema: { "type": "object", "properties": { "dataSourceId": { "type": "string", "description": "ID of the data source containing the document (supports variable interpolation)" }, "documentId": { "type": "string", "description": "ID of the document to delete (supports variable interpolation)" } }, "required": ["dataSourceId", "documentId"] },
    outputSchema: { "description": "This step does not produce output data." }
  },
  "deleteGmailEmail": {
    stepType: "deleteGmailEmail",
    description: "Move an email to trash in the connected Gmail account (recoverable delete).",
    usageNotes: "- Requires a Google OAuth connection with Gmail modify scope.\n- Uses trash (recoverable) rather than permanent delete.",
    inputSchema: { "type": "object", "properties": { "messageId": { "type": "string", "description": "Gmail message ID to delete (move to trash)" }, "connectionId": { "type": "string", "description": "Google OAuth connection ID" } }, "required": ["messageId"] },
    outputSchema: { "description": "This step does not produce output data." }
  },
  "deleteGoogleCalendarEvent": {
    stepType: "deleteGoogleCalendarEvent",
    description: "Retrieve a specific event from a Google Calendar by event ID.",
    usageNotes: "- Requires a Google OAuth connection with Calendar events scope.\n- The variable receives JSON or XML-like text depending on exportType. The direct execution output always returns the structured event.",
    inputSchema: { "type": "object", "properties": { "connectionId": { "type": "string", "description": "Google OAuth connection ID" }, "eventId": { "type": "string", "description": "Google Calendar event ID to delete" }, "calendarId": { "type": "string", "description": 'Calendar ID (defaults to "primary" if omitted)' } }, "required": ["eventId"] },
    outputSchema: { "description": "This step does not produce output data." }
  },
  "deleteGoogleSheetRows": {
    stepType: "deleteGoogleSheetRows",
    description: "Delete a range of rows from a Google Spreadsheet.",
    usageNotes: "- Requires a Google OAuth connection with Drive scope.\n- startRow and endRow are 1-based row numbers (inclusive).\n- If sheetName is omitted, operates on the first sheet.",
    inputSchema: { "type": "object", "properties": { "documentId": { "type": "string", "description": "Google Spreadsheet ID or URL" }, "sheetName": { "type": "string", "description": "Sheet/tab name (defaults to first sheet)" }, "startRow": { "type": "string", "description": "First row to delete (1-based, inclusive)" }, "endRow": { "type": "string", "description": "Last row to delete (1-based, inclusive)" }, "connectionId": { "type": "string", "description": "Google OAuth connection ID" } }, "required": ["documentId", "startRow", "endRow"] },
    outputSchema: { "description": "This step does not produce output data." }
  },
  "detectChanges": {
    stepType: "detectChanges",
    description: "Detect changes between runs by comparing current input against previously stored state. Routes execution based on whether a change occurred.",
    usageNotes: '- Persists state across runs using a global variable keyed to the step ID.\n- Two modes: "comparison" (default) uses strict string inequality; "ai" uses an LLM to determine if a meaningful change occurred.\n- First run always treats the value as "changed" since there is no previous state.\n- Each mode supports transitions to different steps/workflows for the "changed" and "unchanged" paths.\n- AI mode bills normally for the LLM call.',
    inputSchema: { "type": "object", "properties": { "mode": { "enum": ["ai", "comparison"], "type": "string", "description": "Detection mode: 'comparison' for strict string inequality, 'ai' for LLM-based. Default: 'comparison'" }, "input": { "type": "string", "description": "Current value to check (variable template)" }, "prompt": { "type": "string", "description": "AI mode: what constitutes a meaningful change" }, "modelOverride": { "type": "object", "properties": { "model": { "type": "string", "description": 'Model identifier (e.g. "gpt-4", "claude-3-opus")' }, "temperature": { "type": "number", "description": "Sampling temperature for the model (0-2)" }, "maxResponseTokens": { "type": "number", "description": "Maximum number of tokens in the model's response" }, "ignorePreamble": { "type": "boolean", "description": "Whether to skip the system preamble/instructions" }, "userMessagePreprocessor": { "type": "object", "properties": { "dataSource": { "type": "string", "description": "Data source identifier for the preprocessor" }, "messageTemplate": { "type": "string", "description": "Template string applied to user messages before sending to the model" }, "maxResults": { "type": "number", "description": "Maximum number of results to include from the data source" }, "enabled": { "type": "boolean", "description": "Whether the preprocessor is active" }, "shouldInherit": { "type": "boolean", "description": "Whether child steps should inherit this preprocessor configuration" } }, "description": "Preprocessor applied to user messages before sending to the model" }, "preamble": { "type": "string", "description": "System preamble/instructions for the model" }, "multiModelEnabled": { "type": "boolean", "description": "Whether multi-model candidate generation is enabled" }, "editResponseEnabled": { "type": "boolean", "description": "Whether the user can edit the model's response" }, "config": { "type": "object", "properties": {}, "required": [], "description": "Additional model-specific configuration" } }, "required": ["model", "temperature", "maxResponseTokens"], "description": "AI mode: model settings override" }, "previousValueVariable": { "type": "string", "description": "Optional variable name to store the previous value into for downstream access" }, "changedStepId": { "type": "string", "description": "Step to transition to if changed (same workflow)" }, "changedWorkflowId": { "type": "string", "description": "Workflow to jump to if changed (cross workflow)" }, "unchangedStepId": { "type": "string", "description": "Step to transition to if unchanged (same workflow)" }, "unchangedWorkflowId": { "type": "string", "description": "Workflow to jump to if unchanged (cross workflow)" } }, "required": ["mode", "input"], "description": "Configuration for the detect changes step" },
    outputSchema: { "type": "object", "properties": { "hasChanged": { "type": "boolean", "description": "Whether a change was detected" }, "currentValue": { "type": "string", "description": "The resolved input value" }, "previousValue": { "type": "string", "description": "The stored value from last run (empty string on first run)" }, "isFirstRun": { "type": "boolean", "description": "True when no previous state exists" } }, "required": ["hasChanged", "currentValue", "previousValue", "isFirstRun"] }
  },
  "detectPII": {
    stepType: "detectPII",
    description: "Scan text for personally identifiable information using Microsoft Presidio.",
    usageNotes: "- In workflow mode, transitions to detectedStepId if PII is found, notDetectedStepId otherwise.\n- In direct execution, returns the detection results without transitioning.\n- If entities is empty, returns immediately with no detections.",
    inputSchema: { "type": "object", "properties": { "input": { "type": "string", "description": "Text to scan for personally identifiable information" }, "language": { "type": "string", "description": 'Language code of the input text (e.g. "en")' }, "entities": { "type": "array", "items": { "type": "string" }, "description": 'PII entity types to scan for (e.g. ["PHONE_NUMBER", "EMAIL_ADDRESS"]). Empty array means nothing is scanned.' }, "detectedStepId": { "type": "string", "description": "Step to transition to if PII is detected (workflow mode)" }, "notDetectedStepId": { "type": "string", "description": "Step to transition to if no PII is detected (workflow mode)" }, "outputLogVariable": { "type": "string", "description": "Variable name to store the raw detection results" } }, "required": ["input", "language", "entities"] },
    outputSchema: { "type": "object", "properties": { "detected": { "type": "boolean", "description": "Whether any PII was found in the input text" }, "detections": { "type": "array", "items": { "type": "object", "properties": { "entity_type": { "type": "string", "description": 'PII entity type (e.g. "PHONE_NUMBER", "EMAIL_ADDRESS", "PERSON")' }, "start": { "type": "number", "description": "Start character index in the input text" }, "end": { "type": "number", "description": "End character index in the input text" }, "score": { "type": "number", "description": "Confidence score between 0 and 1" } }, "required": ["entity_type", "start", "end", "score"] }, "description": "List of detected PII entities with type, location, and confidence" } }, "required": ["detected", "detections"] }
  },
  "discordEditMessage": {
    stepType: "discordEditMessage",
    description: "Edit a previously sent Discord channel message. Use with the message ID returned by Send Discord Message.",
    usageNotes: "- Only messages sent by the bot can be edited.\n- The messageId is returned by the Send Discord Message step.\n- Optionally attach a file by providing a URL to attachmentUrl. The file is downloaded and uploaded to Discord.\n- When editing with an attachment, the new attachment replaces any previous attachments on the message.\n- URLs in the text are automatically embedded by Discord (link previews for images, videos, etc.).",
    inputSchema: { "type": "object", "properties": { "botToken": { "type": "string", "description": "Discord bot token for authentication" }, "channelId": { "type": "string", "description": "Discord channel ID containing the message" }, "messageId": { "type": "string", "description": "ID of the message to edit (returned by Send Discord Message)" }, "text": { "type": "string", "description": "New message text to replace the existing content" }, "attachmentUrl": { "type": "string", "description": "URL of a file to download and attach to the message (replaces any previous attachments)" } }, "required": ["botToken", "channelId", "messageId", "text"] },
    outputSchema: { "description": "This step does not produce output data." }
  },
  "discordSendFollowUp": {
    stepType: "discordSendFollowUp",
    description: "Send a follow-up message to a Discord slash command interaction.",
    usageNotes: "- Requires the applicationId and interactionToken from the Discord trigger variables.\n- Follow-up messages appear as new messages in the channel after the initial response.\n- Returns the sent message ID.\n- Interaction tokens expire after 15 minutes.\n- Optionally attach a file by providing a URL to attachmentUrl. The file is downloaded and uploaded to Discord.\n- URLs in the text are automatically embedded by Discord (link previews for images, videos, etc.).",
    inputSchema: { "type": "object", "properties": { "applicationId": { "type": "string", "description": "Discord application ID from the bot registration" }, "interactionToken": { "type": "string", "description": "Interaction token provided by the Discord trigger \u2014 expires after 15 minutes" }, "text": { "type": "string", "description": "Message text to send as a follow-up" }, "attachmentUrl": { "type": "string", "description": "URL of a file to download and attach to the message" } }, "required": ["applicationId", "interactionToken", "text"] },
    outputSchema: { "type": "object", "properties": { "messageId": { "type": "string", "description": "ID of the sent follow-up message" } }, "required": ["messageId"] }
  },
  "discordSendMessage": {
    stepType: "discordSendMessage",
    description: "Send a message to Discord \u2014 either edit the loading message or send a new channel message.",
    usageNotes: '- mode "edit" replaces the loading message (interaction response) with the final result. Uses applicationId and interactionToken from trigger variables. No bot permissions required.\n- mode "send" sends a new message to a channel. Uses botToken and channelId from trigger variables. Returns a messageId that can be used with Edit Discord Message.\n- Optionally attach a file by providing a URL to attachmentUrl. The file is downloaded and uploaded to Discord.\n- URLs in the text are automatically embedded by Discord (link previews for images, videos, etc.).\n- Interaction tokens expire after 15 minutes.',
    inputSchema: { "type": "object", "properties": { "mode": { "enum": ["edit", "send"], "type": "string", "description": '"edit" replaces the loading message, "send" sends a new channel message' }, "text": { "type": "string", "description": "Message text to send" }, "applicationId": { "type": "string", "description": 'Discord application ID from the bot registration (required for "reply" mode)' }, "interactionToken": { "type": "string", "description": 'Interaction token provided by the Discord trigger \u2014 expires after 15 minutes (required for "reply" mode)' }, "botToken": { "type": "string", "description": 'Discord bot token for authentication (required for "send" mode)' }, "channelId": { "type": "string", "description": 'Discord channel ID to send the message to (required for "send" mode)' }, "attachmentUrl": { "type": "string", "description": "URL of a file to download and attach to the message" } }, "required": ["mode", "text"] },
    outputSchema: { "type": "object", "properties": { "messageId": { "type": "string", "description": 'ID of the sent Discord message, only present in "send" mode (use with Edit Discord Message)' } } }
  },
  "downloadVideo": {
    stepType: "downloadVideo",
    description: "Download a video file",
    usageNotes: "- Works with YouTube, TikTok, etc., by using ytdlp behind the scenes\n- Can save as mp4 or mp3",
    inputSchema: { "type": "object", "properties": { "videoUrl": { "type": "string", "description": "URL of the video to download (supports YouTube, TikTok, etc. via yt-dlp)" }, "format": { "enum": ["mp4", "mp3"], "type": "string", "description": "Output format for the downloaded file" } }, "required": ["videoUrl", "format"] },
    outputSchema: { "type": "object", "properties": { "videoUrl": { "type": "string", "description": "URL of the downloaded and re-hosted video file" } }, "required": ["videoUrl"] }
  },
  "enhanceImageGenerationPrompt": {
    stepType: "enhanceImageGenerationPrompt",
    description: "Generate or enhance an image generation prompt using a language model. Optionally generates a negative prompt.",
    usageNotes: "- Rewrites the user's prompt with added detail about style, lighting, colors, and composition.\n- Also useful for initial generation, it doesn't always need to be enhancing an existing prompt\n- When includeNegativePrompt is true, a second model call generates a negative prompt.",
    inputSchema: { "type": "object", "properties": { "initialPrompt": { "type": "string", "description": "The raw prompt to enhance" }, "includeNegativePrompt": { "type": "boolean", "description": "Whether to also generate a negative prompt" }, "negativePromptDestinationVariableName": { "type": "string", "description": "Variable name to save the negative prompt into" }, "systemPrompt": { "type": "string", "description": "Custom system prompt for the enhancement model. Uses a default prompt if not provided" }, "modelOverride": { "description": "Model override settings. Leave undefined to use the default model" } }, "required": ["initialPrompt", "includeNegativePrompt", "systemPrompt"] },
    outputSchema: { "type": "object", "properties": { "prompt": { "type": "string", "description": "The enhanced image generation prompt" }, "negativePrompt": { "type": "string", "description": "The negative prompt, only present when includeNegativePrompt was true" } }, "required": ["prompt"] }
  },
  "enhanceVideoGenerationPrompt": {
    stepType: "enhanceVideoGenerationPrompt",
    description: "Generate or enhance a video generation prompt using a language model. Optionally generates a negative prompt.",
    usageNotes: "- Rewrites the user's prompt with added detail about style, camera movement, lighting, and composition.\n- Also useful for initial generation, it doesn't always need to be enhancing an existing prompt\n- When includeNegativePrompt is true, a second model call generates a negative prompt.",
    inputSchema: { "type": "object", "properties": { "initialPrompt": { "type": "string", "description": "The raw prompt to enhance" }, "includeNegativePrompt": { "type": "boolean", "description": "Whether to also generate a negative prompt" }, "negativePromptDestinationVariableName": { "type": "string", "description": "Variable name to save the negative prompt into" }, "systemPrompt": { "type": "string", "description": "Custom system prompt for the enhancement model. Uses a default prompt if not provided" }, "modelOverride": { "description": "Model override settings. Leave undefined to use the default model" } }, "required": ["initialPrompt", "includeNegativePrompt", "systemPrompt"] },
    outputSchema: { "type": "object", "properties": { "prompt": { "type": "string", "description": "The enhanced video generation prompt" }, "negativePrompt": { "type": "string", "description": "The negative prompt, only present when includeNegativePrompt was true" } }, "required": ["prompt"] }
  },
  "enrichPerson": {
    stepType: "enrichPerson",
    description: "Look up professional information about a person using Apollo.io. Search by ID, name, LinkedIn URL, email, or domain.",
    usageNotes: "- At least one search parameter must be provided.\n- Returns enriched data from Apollo including contact details, employment info, and social profiles.",
    inputSchema: { "type": "object", "properties": { "params": { "type": "object", "properties": { "id": { "type": "string", "description": "Apollo person ID" }, "name": { "type": "string", "description": "Person's full name" }, "linkedinUrl": { "type": "string", "description": "LinkedIn profile URL" }, "email": { "type": "string", "description": "Email address" }, "domain": { "type": "string", "description": "Company domain" } }, "required": ["id", "name", "linkedinUrl", "email", "domain"], "description": "Search parameters to identify the person (ID, name, LinkedIn URL, email, or domain)" } }, "required": ["params"] },
    outputSchema: { "type": "object", "properties": { "data": { "description": "Apollo enrichment result with contact details, employment history, and social profiles" } }, "required": ["data"] }
  },
  "extractAudioFromVideo": {
    stepType: "extractAudioFromVideo",
    description: "Extract audio MP3 from a video file",
    usageNotes: "",
    inputSchema: { "type": "object", "properties": { "videoUrl": { "type": "string", "description": "URL of the source video to extract audio from" } }, "required": ["videoUrl"] },
    outputSchema: { "type": "object", "properties": { "audioUrl": { "type": "string", "description": "URL of the extracted audio MP3 file" } }, "required": ["audioUrl"] }
  },
  "extractText": {
    stepType: "extractText",
    description: "Download a file from a URL and extract its text content. Supports PDFs (including scanned/image-based PDFs via OCR), plain text files, and other document formats.",
    usageNotes: "- Best suited for PDFs and raw text/document files. For web pages, use the scrapeUrl step instead.\n- Handles both text-layer PDFs and image-based/scanned PDFs (e.g. Figma/Canva exports, scanned documents). Image-based PDFs are processed with OCR automatically \u2014 there is no need to convert PDF pages to images first.\n- Accepts a single URL, a comma-separated list of URLs, or a JSON array of URLs.\n- Files are rehosted on the MindStudio CDN before extraction.\n- Optionally set `model` to a specific document-extraction model (`mistral-ocr-latest`, `llamaparse`, `google-document-ai`); omit to use the platform default.\n- Maximum file size is 50MB per URL.",
    inputSchema: { "type": "object", "properties": { "url": { "anyOf": [{ "type": "string" }, { "type": "array", "items": { "type": "string" } }] }, "model": { "type": "string", "description": "Optional extraction model id (a `document_extraction` model, e.g. `mistral-ocr-latest`, `llamaparse`, `google-document-ai`). Defaults to the platform default when omitted." } }, "required": ["url"] },
    outputSchema: { "type": "object", "properties": { "text": { "anyOf": [{ "type": "string" }, { "type": "array", "items": { "type": "string" } }] } }, "required": ["text"] }
  },
  "fetchDataSourceDocument": {
    stepType: "fetchDataSourceDocument",
    description: "Legacy v1 data sources. v2 apps should use `dataSources.defineDataSource()` from @mindstudio-ai/agent instead, which owns parsing, chunking, embedding and citations. Fetch the full extracted text contents of a document in a data source.",
    usageNotes: '- Loads a document by ID and returns its full extracted text content.\n- The document must have been successfully processed (status "done").\n- Also returns document metadata (name, summary, word count).',
    inputSchema: { "type": "object", "properties": { "dataSourceId": { "type": "string", "description": "ID of the data source containing the document (supports variable interpolation)" }, "documentId": { "type": "string", "description": "ID of the document to fetch (supports variable interpolation)" } }, "required": ["dataSourceId", "documentId"] },
    outputSchema: { "description": "This step does not produce output data." }
  },
  "fetchGoogleDoc": {
    stepType: "fetchGoogleDoc",
    description: "Fetch the contents of an existing Google Document.",
    usageNotes: '- exportType controls the output format: "html" for HTML markup, "markdown" for Markdown, "json" for structured JSON, "plain" for plain text.',
    inputSchema: { "type": "object", "properties": { "documentId": { "type": "string", "description": "Google Document ID (from the document URL)" }, "connectionId": { "type": "string", "description": "Google OAuth connection ID" }, "exportType": { "enum": ["html", "markdown", "json", "plain"], "type": "string", "description": 'Output format: "html", "markdown", "json", or "plain"' } }, "required": ["documentId", "exportType"] },
    outputSchema: { "type": "object", "properties": { "content": { "type": "string", "description": "Document contents in the requested export format" } }, "required": ["content"] }
  },
  "fetchGoogleSheet": {
    stepType: "fetchGoogleSheet",
    description: "Fetch contents of a Google Spreadsheet range.",
    usageNotes: '- range uses A1 notation (e.g. "Sheet1!A1:C10"). Omit to fetch the entire first sheet.\n- exportType controls the output format: "csv" for comma-separated values, "json" for structured JSON.',
    inputSchema: { "type": "object", "properties": { "spreadsheetId": { "type": "string", "description": "Google Spreadsheet ID (from the spreadsheet URL)" }, "range": { "type": "string", "description": 'Cell range in A1 notation (e.g. "Sheet1!A1:C10")' }, "connectionId": { "type": "string", "description": "Google OAuth connection ID" }, "exportType": { "enum": ["csv", "json"], "type": "string", "description": 'Output format: "csv" or "json"' } }, "required": ["spreadsheetId", "range", "exportType"] },
    outputSchema: { "type": "object", "properties": { "content": { "type": "string", "description": "Spreadsheet data in the requested export format" } }, "required": ["content"] }
  },
  "fetchSlackChannelHistory": {
    stepType: "fetchSlackChannelHistory",
    description: "Fetch recent message history from a Slack channel.",
    usageNotes: "- The user is responsible for connecting their Slack workspace and selecting the channel",
    inputSchema: { "type": "object", "properties": { "connectionId": { "type": "string", "description": "Slack OAuth connection ID (leave empty to allow user to select)" }, "channelId": { "type": "string", "description": "Slack channel ID (leave empty to allow user to select a channel)" }, "limit": { "type": "number", "description": "Maximum number of messages to return (1-15)" }, "startDate": { "type": "string", "description": "Earliest date to include messages from" }, "endDate": { "type": "string", "description": "Latest date to include messages up to" }, "includeImages": { "type": "boolean", "description": "Whether to include images in the output" }, "includeRawMessage": { "type": "boolean", "description": "Whether to include the raw Slack message object (useful for bot messages with complex attachments)" } }, "required": ["channelId"] },
    outputSchema: { "type": "object", "properties": { "messages": { "type": "array", "items": { "type": "object", "properties": { "from": { "type": "string" }, "content": { "type": "string" }, "timestamp": { "type": "string" }, "images": { "type": "array", "items": { "type": "string" } }, "rawMessage": { "type": "object", "properties": { "app_id": { "type": "string" }, "assistant_app_thread": { "type": "object", "properties": { "first_user_thread_reply": { "type": "string" }, "title": { "type": "string" }, "title_blocks": { "type": "array", "items": { "type": "string" } } } }, "attachments": { "type": "array", "items": { "type": "object", "properties": { "actions": { "type": "array", "items": { "type": "string" } }, "app_id": { "type": "string" }, "app_unfurl_url": { "type": "string" }, "author_icon": { "type": "string" }, "author_id": { "type": "string" }, "author_link": { "type": "string" }, "author_name": { "type": "string" }, "author_subname": { "type": "string" }, "blocks": { "type": "array", "items": { "type": "string" } }, "bot_id": { "type": "string" }, "bot_team_id": { "type": "string" }, "callback_id": { "type": "string" }, "channel_id": { "type": "string" }, "channel_name": { "type": "string" }, "channel_team": { "type": "string" }, "color": { "type": "string" }, "fallback": { "type": "string" }, "fields": { "type": "array", "items": { "type": "string" } }, "file_id": { "type": "string" }, "filename": { "type": "string" }, "files": { "type": "array", "items": { "type": "string" } }, "footer": { "type": "string" }, "footer_icon": { "type": "string" }, "from_url": { "type": "string" }, "hide_border": { "type": "boolean" }, "hide_color": { "type": "boolean" }, "id": { "type": "number" }, "image_bytes": { "type": "number" }, "image_height": { "type": "number" }, "image_url": { "type": "string" }, "image_width": { "type": "number" }, "indent": { "type": "boolean" }, "is_app_unfurl": { "type": "boolean" }, "is_file_attachment": { "type": "boolean" }, "is_msg_unfurl": { "type": "boolean" }, "is_reply_unfurl": { "type": "boolean" }, "is_thread_root_unfurl": { "type": "boolean" }, "list": { "type": "string" }, "list_record": { "type": "string" }, "list_record_id": { "type": "string" }, "list_records": { "type": "array", "items": { "type": "string" } }, "list_schema": { "type": "array", "items": { "type": "string" } }, "list_view": { "type": "string" }, "list_view_id": { "type": "string" }, "message_blocks": { "type": "array", "items": { "type": "string" } }, "metadata": { "type": "string" }, "mimetype": { "type": "string" }, "mrkdwn_in": { "type": "array", "items": { "type": "string" } }, "msg_subtype": { "type": "string" }, "original_url": { "type": "string" }, "pretext": { "type": "string" }, "preview": { "type": "string" }, "service_icon": { "type": "string" }, "service_name": { "type": "string" }, "service_url": { "type": "string" }, "size": { "type": "number" }, "text": { "type": "string" }, "thumb_height": { "type": "number" }, "thumb_url": { "type": "string" }, "thumb_width": { "type": "number" }, "title": { "type": "string" }, "title_link": { "type": "string" }, "ts": { "type": "string" }, "url": { "type": "string" }, "video_html": { "type": "string" }, "video_html_height": { "type": "number" }, "video_html_width": { "type": "number" }, "video_url": { "type": "string" } } } }, "blocks": { "type": "array", "items": { "type": "object", "properties": { "accessory": { "type": "string" }, "alt_text": { "type": "string" }, "api_decoration_available": { "type": "boolean" }, "app_collaborators": { "type": "array", "items": { "type": "string" } }, "app_id": { "type": "string" }, "author_name": { "type": "string" }, "block_id": { "type": "string" }, "bot_user_id": { "type": "string" }, "button_label": { "type": "string" }, "call": { "type": "string" }, "call_id": { "type": "string" }, "description": { "type": "string" }, "developer_trace_id": { "type": "string" }, "dispatch_action": { "type": "boolean" }, "element": { "type": "string" }, "elements": { "type": "array", "items": { "type": "string" } }, "expand": { "type": "boolean" }, "external_id": { "type": "string" }, "fallback": { "type": "string" }, "fields": { "type": "array", "items": { "type": "string" } }, "file": { "type": "string" }, "file_id": { "type": "string" }, "function_trigger_id": { "type": "string" }, "hint": { "type": "string" }, "image_bytes": { "type": "number" }, "image_height": { "type": "number" }, "image_url": { "type": "string" }, "image_width": { "type": "number" }, "is_animated": { "type": "boolean" }, "is_workflow_app": { "type": "boolean" }, "label": { "type": "string" }, "optional": { "type": "boolean" }, "owning_team_id": { "type": "string" }, "provider_icon_url": { "type": "string" }, "provider_name": { "type": "string" }, "sales_home_workflow_app_type": { "type": "number" }, "share_url": { "type": "string" }, "slack_file": { "type": "string" }, "source": { "type": "string" }, "text": { "type": "string" }, "thumbnail_url": { "type": "string" }, "title": { "type": "string" }, "title_url": { "type": "string" }, "trigger_subtype": { "type": "string" }, "trigger_type": { "type": "string" }, "type": { "type": "string" }, "url": { "type": "string" }, "video_url": { "type": "string" }, "workflow_id": { "type": "string" } } } }, "bot_id": { "type": "string" }, "bot_profile": { "type": "object", "properties": { "app_id": { "type": "string" }, "deleted": { "type": "boolean" }, "icons": { "type": "string" }, "id": { "type": "string" }, "name": { "type": "string" }, "team_id": { "type": "string" }, "updated": { "type": "number" } } }, "client_msg_id": { "type": "string" }, "display_as_bot": { "type": "boolean" }, "edited": { "type": "object", "properties": { "ts": { "type": "string" }, "user": { "type": "string" } } }, "files": { "type": "array", "items": { "type": "object", "properties": { "access": { "type": "string" }, "alt_txt": { "type": "string" }, "app_id": { "type": "string" }, "app_name": { "type": "string" }, "attachments": { "type": "array", "items": {} }, "blocks": { "type": "array", "items": { "type": "string" } }, "bot_id": { "type": "string" }, "can_toggle_canvas_lock": { "type": "boolean" }, "canvas_printing_enabled": { "type": "boolean" }, "canvas_template_mode": { "type": "string" }, "cc": { "type": "array", "items": { "type": "string" } }, "channel_actions_count": { "type": "number" }, "channel_actions_ts": { "type": "string" }, "channels": { "type": "array", "items": { "type": "string" } }, "comments_count": { "type": "number" }, "converted_pdf": { "type": "string" }, "created": { "type": "number" }, "deanimate": { "type": "string" }, "deanimate_gif": { "type": "string" }, "display_as_bot": { "type": "boolean" }, "dm_mpdm_users_with_file_access": { "type": "array", "items": { "type": "string" } }, "duration_ms": { "type": "number" }, "edit_link": { "type": "string" }, "edit_timestamp": { "type": "number" }, "editable": { "type": "boolean" }, "editor": { "type": "string" }, "editors": { "type": "array", "items": { "type": "string" } }, "external_id": { "type": "string" }, "external_type": { "type": "string" }, "external_url": { "type": "string" }, "favorites": { "type": "array", "items": { "type": "string" } }, "file_access": { "type": "string" }, "filetype": { "type": "string" }, "from": { "type": "array", "items": { "type": "string" } }, "groups": { "type": "array", "items": { "type": "string" } }, "has_more": { "type": "boolean" }, "has_more_shares": { "type": "boolean" }, "has_rich_preview": { "type": "boolean" }, "headers": { "type": "string" }, "hls": { "type": "string" }, "hls_embed": { "type": "string" }, "id": { "type": "string" }, "image_exif_rotation": { "type": "number" }, "ims": { "type": "array", "items": { "type": "string" } }, "initial_comment": { "type": "string" }, "is_channel_space": { "type": "boolean" }, "is_external": { "type": "boolean" }, "is_public": { "type": "boolean" }, "is_restricted_sharing_enabled": { "type": "boolean" }, "is_starred": { "type": "boolean" }, "last_editor": { "type": "string" }, "last_read": { "type": "number" }, "lines": { "type": "number" }, "lines_more": { "type": "number" }, "linked_channel_id": { "type": "string" }, "list_csv_download_url": { "type": "string" }, "list_limits": { "type": "string" }, "list_metadata": { "type": "string" }, "media_display_type": { "type": "string" }, "media_progress": { "type": "string" }, "mimetype": { "type": "string" }, "mode": { "type": "string" }, "mp4": { "type": "string" }, "mp4_low": { "type": "string" }, "name": { "type": "string" }, "non_owner_editable": { "type": "boolean" }, "num_stars": { "type": "number" }, "org_or_workspace_access": { "type": "string" }, "original_attachment_count": { "type": "number" }, "original_h": { "type": "string" }, "original_w": { "type": "string" }, "permalink": { "type": "string" }, "permalink_public": { "type": "string" }, "pinned_to": { "type": "array", "items": { "type": "string" } }, "pjpeg": { "type": "string" }, "plain_text": { "type": "string" }, "pretty_type": { "type": "string" }, "preview": { "type": "string" }, "preview_highlight": { "type": "string" }, "preview_is_truncated": { "type": "boolean" }, "preview_plain_text": { "type": "string" }, "private_channels_with_file_access_count": { "type": "number" }, "private_file_with_access_count": { "type": "number" }, "public_url_shared": { "type": "boolean" }, "quip_thread_id": { "type": "string" }, "reactions": { "type": "array", "items": { "type": "string" } }, "saved": { "type": "string" }, "sent_to_self": { "type": "boolean" }, "shares": { "type": "string" }, "show_badge": { "type": "boolean" }, "simplified_html": { "type": "string" }, "size": { "type": "number" }, "source_team": { "type": "string" }, "subject": { "type": "string" }, "subtype": { "type": "string" }, "team_pref_version_history_enabled": { "type": "boolean" }, "teams_shared_with": { "type": "array", "items": {} }, "template_conversion_ts": { "type": "number" }, "template_description": { "type": "string" }, "template_icon": { "type": "string" }, "template_name": { "type": "string" }, "template_title": { "type": "string" }, "thumb_1024": { "type": "string" }, "thumb_1024_gif": { "type": "string" }, "thumb_1024_h": { "type": "string" }, "thumb_1024_w": { "type": "string" }, "thumb_160": { "type": "string" }, "thumb_160_gif": { "type": "string" }, "thumb_160_h": { "type": "string" }, "thumb_160_w": { "type": "string" }, "thumb_360": { "type": "string" }, "thumb_360_gif": { "type": "string" }, "thumb_360_h": { "type": "string" }, "thumb_360_w": { "type": "string" }, "thumb_480": { "type": "string" }, "thumb_480_gif": { "type": "string" }, "thumb_480_h": { "type": "string" }, "thumb_480_w": { "type": "string" }, "thumb_64": { "type": "string" }, "thumb_64_gif": { "type": "string" }, "thumb_64_h": { "type": "string" }, "thumb_64_w": { "type": "string" }, "thumb_720": { "type": "string" }, "thumb_720_gif": { "type": "string" }, "thumb_720_h": { "type": "string" }, "thumb_720_w": { "type": "string" }, "thumb_80": { "type": "string" }, "thumb_800": { "type": "string" }, "thumb_800_gif": { "type": "string" }, "thumb_800_h": { "type": "string" }, "thumb_800_w": { "type": "string" }, "thumb_80_gif": { "type": "string" }, "thumb_80_h": { "type": "string" }, "thumb_80_w": { "type": "string" }, "thumb_960": { "type": "string" }, "thumb_960_gif": { "type": "string" }, "thumb_960_h": { "type": "string" }, "thumb_960_w": { "type": "string" }, "thumb_gif": { "type": "string" }, "thumb_pdf": { "type": "string" }, "thumb_pdf_h": { "type": "string" }, "thumb_pdf_w": { "type": "string" }, "thumb_tiny": { "type": "string" }, "thumb_video": { "type": "string" }, "thumb_video_h": { "type": "number" }, "thumb_video_w": { "type": "number" }, "timestamp": { "type": "number" }, "title": { "type": "string" }, "title_blocks": { "type": "array", "items": { "type": "string" } }, "to": { "type": "array", "items": { "type": "string" } }, "transcription": { "type": "string" }, "update_notification": { "type": "number" }, "updated": { "type": "number" }, "url_private": { "type": "string" }, "url_private_download": { "type": "string" }, "url_static_preview": { "type": "string" }, "user": { "type": "string" }, "user_team": { "type": "string" }, "username": { "type": "string" }, "vtt": { "type": "string" } } } }, "icons": { "type": "object", "properties": { "emoji": { "type": "string" }, "image_36": { "type": "string" }, "image_48": { "type": "string" }, "image_64": { "type": "string" }, "image_72": { "type": "string" } } }, "inviter": { "type": "string" }, "is_locked": { "type": "boolean" }, "latest_reply": { "type": "string" }, "metadata": { "type": "object", "properties": { "event_payload": { "type": "string" }, "event_type": { "type": "string" } } }, "parent_user_id": { "type": "string" }, "purpose": { "type": "string" }, "reactions": { "type": "array", "items": { "type": "object", "properties": { "count": { "type": "number" }, "name": { "type": "string" }, "url": { "type": "string" }, "users": { "type": "array", "items": { "type": "string" } } } } }, "reply_count": { "type": "number" }, "reply_users": { "type": "array", "items": { "type": "string" } }, "reply_users_count": { "type": "number" }, "root": { "type": "object", "properties": { "bot_id": { "type": "string" }, "icons": { "type": "string" }, "latest_reply": { "type": "string" }, "parent_user_id": { "type": "string" }, "reply_count": { "type": "number" }, "reply_users": { "type": "array", "items": { "type": "string" } }, "reply_users_count": { "type": "number" }, "subscribed": { "type": "boolean" }, "subtype": { "type": "string" }, "text": { "type": "string" }, "thread_ts": { "type": "string" }, "ts": { "type": "string" }, "type": { "type": "string" }, "username": { "type": "string" } } }, "subscribed": { "type": "boolean" }, "subtype": { "type": "string" }, "team": { "type": "string" }, "text": { "type": "string" }, "thread_ts": { "type": "string" }, "topic": { "type": "string" }, "ts": { "type": "string" }, "type": { "type": "string" }, "upload": { "type": "boolean" }, "user": { "type": "string" }, "username": { "type": "string" }, "x_files": { "type": "array", "items": { "type": "string" } } } } }, "required": ["from", "content"] }, "description": "List of messages from the channel history" } }, "required": ["messages"] }
  },
  "fetchYoutubeCaptions": {
    stepType: "fetchYoutubeCaptions",
    description: "Retrieve the captions/transcript for a YouTube video.",
    usageNotes: '- Supports multiple languages via the language parameter.\n- "text" export produces timestamped plain text; "json" export produces structured transcript data.',
    inputSchema: { "type": "object", "properties": { "videoUrl": { "type": "string", "description": "YouTube video URL to fetch captions for" }, "exportType": { "enum": ["text", "json"], "type": "string", "description": 'Output format: "text" for timestamped plain text, "json" for structured transcript data' }, "language": { "type": "string", "description": 'Language code for the captions (e.g. "en")' } }, "required": ["videoUrl", "exportType", "language"] },
    outputSchema: { "type": "object", "properties": { "transcripts": { "type": "array", "items": { "type": "object", "properties": { "text": { "type": "string", "description": "Transcript text segment" }, "start": { "type": "number", "description": "Start time of the segment in seconds" } }, "required": ["text", "start"] }, "description": "Parsed transcript segments with text and start timestamps" } }, "required": ["transcripts"] }
  },
  "fetchYoutubeChannel": {
    stepType: "fetchYoutubeChannel",
    description: "Retrieve metadata and recent videos for a YouTube channel.",
    usageNotes: "- Accepts a YouTube channel URL (e.g. https://www.youtube.com/@ChannelName or /channel/ID).\n- Returns channel info and video listings as a JSON object.",
    inputSchema: { "type": "object", "properties": { "channelUrl": { "type": "string", "description": "YouTube channel URL (e.g. https://www.youtube.com/@ChannelName or /channel/ID)" } }, "required": ["channelUrl"] },
    outputSchema: { "type": "object", "properties": {}, "required": [] }
  },
  "fetchYoutubeComments": {
    stepType: "fetchYoutubeComments",
    description: "Retrieve comments for a YouTube video.",
    usageNotes: '- Paginates through comments (up to 5 pages).\n- "text" export produces markdown-formatted text; "json" export produces structured comment data.',
    inputSchema: { "type": "object", "properties": { "videoUrl": { "type": "string", "description": "YouTube video URL to fetch comments for" }, "exportType": { "enum": ["text", "json"], "type": "string", "description": 'Output format: "text" for markdown-formatted text, "json" for structured comment data' }, "limitPages": { "type": "string", "description": "Maximum number of comment pages to fetch (1-5)" } }, "required": ["videoUrl", "exportType", "limitPages"] },
    outputSchema: { "type": "object", "properties": { "comments": { "type": "array", "items": { "type": "object", "properties": { "id": { "type": "string", "description": "Unique comment identifier" }, "link": { "type": "string", "description": "Direct URL to the comment" }, "publishedDate": { "type": "string", "description": "Date the comment was published" }, "text": { "type": "string", "description": "Text content of the comment" }, "likes": { "type": "number", "description": "Number of likes on the comment" }, "replies": { "type": "number", "description": "Number of replies to the comment" }, "author": { "type": "string", "description": "Display name of the comment author" }, "authorLink": { "type": "string", "description": "URL to the author's YouTube channel" }, "authorImg": { "type": "string", "description": "URL of the author's profile image" } }, "required": ["id", "link", "publishedDate", "text", "likes", "replies", "author", "authorLink", "authorImg"] }, "description": "List of comments retrieved from the video" } }, "required": ["comments"] }
  },
  "fetchYoutubeVideo": {
    stepType: "fetchYoutubeVideo",
    description: "Retrieve metadata for a YouTube video (title, description, stats, channel info).",
    usageNotes: "- Returns video metadata, channel info, and engagement stats.\n- Video format data is excluded from the response.",
    inputSchema: { "type": "object", "properties": { "videoUrl": { "type": "string", "description": "YouTube video URL to fetch metadata for" } }, "required": ["videoUrl"] },
    outputSchema: { "type": "object", "properties": {}, "required": [] }
  },
  "generate3dModel": {
    stepType: "generate3dModel",
    description: "Generate a 3D model using a 3D generation model.",
    usageNotes: "- Text-to-3D models use the prompt field.\n- Image-to-3D and multi-view models take image URLs through the selected model's configuration inputs.\n- The output is standardized as a GLB URL plus optional FBX/OBJ/USDZ, thumbnail, texture maps, and provider task ID.",
    inputSchema: { "type": "object", "properties": { "prompt": { "type": "string", "description": "Text prompt for text-to-3D models, or optional guidance for image-to-3D models" }, "intermediateAsset": { "type": "boolean", "description": "When true, the asset is created but hidden from the user's gallery (tagged as intermediate)" }, "threeDModelOverride": { "type": "object", "properties": { "model": { "type": "string", "description": "3D generation model identifier" }, "config": { "type": "object", "properties": {}, "required": [], "description": "Additional model-specific configuration" } }, "required": ["model"], "description": "Optional model configuration override. Uses the workflow's default 3D model if not specified" } } },
    outputSchema: { "type": "object", "properties": { "prompt": { "type": "string" }, "glbUrl": { "type": "string" }, "fbxUrl": { "type": "string" }, "objUrl": { "type": "string" }, "usdzUrl": { "type": "string" }, "thumbnailUrl": { "type": "string" }, "textureUrls": { "type": "array", "items": { "type": "object", "properties": {}, "required": [] } }, "providerTaskId": { "type": "string" }, "resolvedConfig": { "type": "object", "properties": {}, "required": [] } }, "required": ["glbUrl"] }
  },
  "generateAsset": {
    stepType: "generatePdf",
    description: "Generate an HTML asset and export it as a webpage, PDF, or image",
    usageNotes: '- Agents can generate HTML documents and export as webpage, PDFs, images, or videos. They do this by using the "generatePdf" block, which defines an HTML page with variables, and then the generation process renders the page to create the output and save its URL at the specified variable.\n- The template for the HTML page is generated by a separate process, and it can only use variables that have already been defined in the workflow at the time of its execution. It has full access to handlebars to render the HTML template, including a handlebars helper to render a markdown variable string as HTML (which can be useful for creating templates that render long strings). The template can also create its own simple JavaScript to do things like format dates and strings.\n- If PDF or composited image generation are part of the workflow, assistant adds the block and leaves the "source" empty. In a separate step, assistant generates a detailed request for the developer who will write the HTML.\n- Can also auto-generate HTML from a prompt (like a generate text block to generate HTML). In these cases, create a prompt with variables in the dynamicPrompt variable describing, in detail, the document to generate\n- Can either display output directly to user (foreground mode) or save the URL of the asset to a variable (background mode)',
    inputSchema: { "type": "object", "properties": { "source": { "type": "string", "description": "The HTML or Markdown source template for the asset" }, "sourceType": { "enum": ["html", "markdown", "spa", "raw", "dynamic", "customInterface"], "type": "string", "description": "Source type: html, markdown (auto-formatted), spa (single page app), raw (pre-generated HTML in a variable), dynamic (AI-generated from prompt), or customInterface" }, "outputFormat": { "enum": ["pdf", "png", "html", "mp4", "openGraph"], "type": "string", "description": "The output format for the generated asset" }, "pageSize": { "enum": ["full", "letter", "A4", "custom"], "type": "string", "description": "Page size for PDF, PNG, or MP4 output" }, "testData": { "type": "object", "properties": {}, "required": [], "description": "Test data used for previewing the template with sample variable values" }, "options": { "type": "object", "properties": { "pageWidthPx": { "type": "number", "description": "Custom page width in pixels (for custom pageSize)" }, "pageHeightPx": { "type": "number", "description": "Custom page height in pixels (for custom pageSize)" }, "pageOrientation": { "enum": ["portrait", "landscape"], "type": "string", "description": "Page orientation for the rendered output" }, "rehostMedia": { "type": "boolean", "description": "Whether to re-host third-party images on the MindStudio CDN" }, "videoDurationSeconds": { "type": "number", "description": "Duration in seconds for MP4 video output" } }, "description": "Additional rendering options" }, "spaSource": { "type": "object", "properties": { "source": { "type": "string", "description": "Source code of the SPA (legacy, use files instead)" }, "lastCompiledSource": { "type": "string", "description": "Last compiled source (cached)" }, "files": { "type": "object", "properties": {}, "required": [], "description": "Multi-file SPA source" }, "paths": { "type": "array", "items": { "type": "string" }, "description": "Available route paths in the SPA" }, "root": { "type": "string", "description": "Root URL of the SPA bundle" }, "zipUrl": { "type": "string", "description": "URL of the zipped SPA bundle" } }, "required": ["paths", "root", "zipUrl"], "description": "Single page app source configuration (advanced)" }, "rawSource": { "type": "string", "description": "Raw HTML source stored in a variable, using handlebars syntax (e.g. {{myHtmlVariable}})" }, "dynamicPrompt": { "type": "string", "description": 'Prompt to generate the HTML dynamically when sourceType is "dynamic"' }, "dynamicSourceModelOverride": { "type": "object", "properties": { "model": { "type": "string", "description": 'Model identifier (e.g. "gpt-4", "claude-3-opus")' }, "temperature": { "type": "number", "description": "Sampling temperature for the model (0-2)" }, "maxResponseTokens": { "type": "number", "description": "Maximum number of tokens in the model's response" }, "ignorePreamble": { "type": "boolean", "description": "Whether to skip the system preamble/instructions" }, "userMessagePreprocessor": { "type": "object", "properties": { "dataSource": { "type": "string", "description": "Data source identifier for the preprocessor" }, "messageTemplate": { "type": "string", "description": "Template string applied to user messages before sending to the model" }, "maxResults": { "type": "number", "description": "Maximum number of results to include from the data source" }, "enabled": { "type": "boolean", "description": "Whether the preprocessor is active" }, "shouldInherit": { "type": "boolean", "description": "Whether child steps should inherit this preprocessor configuration" } }, "description": "Preprocessor applied to user messages before sending to the model" }, "preamble": { "type": "string", "description": "System preamble/instructions for the model" }, "multiModelEnabled": { "type": "boolean", "description": "Whether multi-model candidate generation is enabled" }, "editResponseEnabled": { "type": "boolean", "description": "Whether the user can edit the model's response" }, "config": { "type": "object", "properties": {}, "required": [], "description": "Additional model-specific configuration" } }, "required": ["model", "temperature", "maxResponseTokens"], "description": "Model override for dynamic HTML generation. Leave undefined to use the default model" }, "transitionControl": { "enum": ["default", "native"], "type": "string", "description": "Controls how the step transitions after displaying in foreground mode" }, "shareControl": { "enum": ["default", "hidden"], "type": "string", "description": "Controls visibility of the share button on displayed assets" }, "shareImageUrl": { "type": "string", "description": "URL of a custom Open Graph share image" }, "intermediateAsset": { "type": "boolean", "description": "When true, the asset is created but hidden from the user's gallery (tagged as intermediate)" } }, "required": ["source", "sourceType", "outputFormat", "pageSize", "testData"] },
    outputSchema: { "type": "object", "properties": { "url": { "type": "string", "description": "CDN URL of the generated asset (PDF, PNG, HTML, or MP4 depending on outputFormat)" } }, "required": ["url"] }
  },
  "generateChart": {
    stepType: "generateChart",
    description: "Create a chart image using QuickChart (Chart.js) and return the URL.",
    usageNotes: "- The data field must be a Chart.js-compatible JSON object serialized as a string.\n- Supported chart types: bar, line, pie.",
    inputSchema: { "type": "object", "properties": { "chart": { "type": "object", "properties": { "chartType": { "enum": ["bar", "line", "pie"], "type": "string", "description": "The type of chart to generate" }, "data": { "type": "string", "description": "Chart.js-compatible JSON data serialized as a string" }, "options": { "type": "object", "properties": { "width": { "type": "string", "description": 'Image width in pixels (e.g. "500")' }, "height": { "type": "string", "description": 'Image height in pixels (e.g. "300")' } }, "required": ["width", "height"], "description": "Image rendering options" } }, "required": ["chartType", "data", "options"], "description": "Chart configuration including type, data, and rendering options" } }, "required": ["chart"] },
    outputSchema: { "type": "object", "properties": { "chartUrl": { "type": "string", "description": "URL of the generated chart image" } }, "required": ["chartUrl"] }
  },
  "generateImage": {
    stepType: "generateImage",
    description: "Generate an image from a text prompt using an AI model.",
    usageNotes: "- Prompts should be descriptive but concise (roughly 3\u20136 sentences).\n- Images are automatically hosted on a CDN.\n- In foreground mode, the image is displayed to the user. In background mode, the URL is saved to a variable.\n- When generateVariants is true with numVariants > 1, multiple images are generated in parallel.\n- In direct execution, foreground mode behaves as background, and userSelect variant behavior behaves as saveAll.",
    inputSchema: { "type": "object", "properties": { "prompt": { "type": "string", "description": "Text prompt describing the image to generate" }, "intermediateAsset": { "type": "boolean", "description": "When true, the asset is created but hidden from the user's gallery (tagged as intermediate)" }, "imageModelOverride": { "type": "object", "properties": { "model": { "type": "string", "description": "Image generation model identifier" }, "config": { "type": "object", "properties": {}, "required": [], "description": "Additional model-specific configuration" } }, "required": ["model"], "description": "Optional model configuration override. Uses the workflow's default image model if not specified" }, "generateVariants": { "type": "boolean", "description": "Whether to generate multiple image variants in parallel" }, "numVariants": { "type": "number", "description": "Number of variants to generate (max 10)" }, "addWatermark": { "type": "boolean", "description": "Whether to add a MindStudio watermark to the generated image.\n\nThe watermark is a product mark on assets generated in the MindStudio UI. A step run directly via the SDK or API is producing the app's own asset, so it is never watermarked and this flag has no effect there." } }, "required": ["prompt"] },
    outputSchema: { "type": "object", "properties": { "imageUrl": { "anyOf": [{ "type": "string" }, { "type": "array", "items": { "type": "string" } }] } }, "required": ["imageUrl"] }
  },
  "generateLipsync": {
    stepType: "generateLipsync",
    description: "Generate a lip sync video from provided audio and image.",
    usageNotes: "- In foreground mode, the video is displayed to the user. In background mode, the URL is saved to a variable.",
    inputSchema: { "type": "object", "properties": { "intermediateAsset": { "type": "boolean", "description": "When true, the asset is created but hidden from the user's gallery (tagged as intermediate)" }, "addWatermark": { "type": "boolean", "description": "Whether to add a MindStudio watermark to the generated video.\n\nThe watermark is a product mark on assets generated in the MindStudio UI. A step run directly via the SDK or API is producing the app's own asset, so it is never watermarked and this flag has no effect there." }, "lipsyncModelOverride": { "type": "object", "properties": { "model": { "type": "string" }, "config": { "type": "object", "properties": {}, "required": [] } }, "required": ["model"], "description": "Optional model configuration override. Uses the workflow's default lipsync model if not specified" } } },
    outputSchema: { "description": "This step does not produce output data." }
  },
  "generateMusic": {
    stepType: "generateMusic",
    description: "Generate an audio file from provided instructions (text) using a music model.",
    usageNotes: "- The text field contains the instructions (prompt) for the music generation.\n- In foreground mode, the audio is displayed to the user. In background mode, the URL is saved to a variable.",
    inputSchema: { "type": "object", "properties": { "text": { "type": "string", "description": "The instructions (prompt) for the music generation" }, "intermediateAsset": { "type": "boolean", "description": "When true, the asset is created but hidden from the user's gallery (tagged as intermediate)" }, "musicModelOverride": { "type": "object", "properties": { "model": { "type": "string" }, "config": { "type": "object", "properties": {}, "required": [] } }, "required": ["model"], "description": "Optional model configuration override. Uses the workflow's default music model if not specified" } }, "required": ["text"] },
    outputSchema: { "description": "This step does not produce output data." }
  },
  "generatePdf": {
    stepType: "generatePdf",
    description: "Generate an HTML asset and export it as a webpage, PDF, or image",
    usageNotes: '- Agents can generate HTML documents and export as webpage, PDFs, images, or videos. They do this by using the "generatePdf" block, which defines an HTML page with variables, and then the generation process renders the page to create the output and save its URL at the specified variable.\n- The template for the HTML page is generated by a separate process, and it can only use variables that have already been defined in the workflow at the time of its execution. It has full access to handlebars to render the HTML template, including a handlebars helper to render a markdown variable string as HTML (which can be useful for creating templates that render long strings). The template can also create its own simple JavaScript to do things like format dates and strings.\n- If PDF or composited image generation are part of the workflow, assistant adds the block and leaves the "source" empty. In a separate step, assistant generates a detailed request for the developer who will write the HTML.\n- Can also auto-generate HTML from a prompt (like a generate text block to generate HTML). In these cases, create a prompt with variables in the dynamicPrompt variable describing, in detail, the document to generate\n- Can either display output directly to user (foreground mode) or save the URL of the asset to a variable (background mode)',
    inputSchema: { "type": "object", "properties": { "source": { "type": "string", "description": "The HTML or Markdown source template for the asset" }, "sourceType": { "enum": ["html", "markdown", "spa", "raw", "dynamic", "customInterface"], "type": "string", "description": "Source type: html, markdown (auto-formatted), spa (single page app), raw (pre-generated HTML in a variable), dynamic (AI-generated from prompt), or customInterface" }, "outputFormat": { "enum": ["pdf", "png", "html", "mp4", "openGraph"], "type": "string", "description": "The output format for the generated asset" }, "pageSize": { "enum": ["full", "letter", "A4", "custom"], "type": "string", "description": "Page size for PDF, PNG, or MP4 output" }, "testData": { "type": "object", "properties": {}, "required": [], "description": "Test data used for previewing the template with sample variable values" }, "options": { "type": "object", "properties": { "pageWidthPx": { "type": "number", "description": "Custom page width in pixels (for custom pageSize)" }, "pageHeightPx": { "type": "number", "description": "Custom page height in pixels (for custom pageSize)" }, "pageOrientation": { "enum": ["portrait", "landscape"], "type": "string", "description": "Page orientation for the rendered output" }, "rehostMedia": { "type": "boolean", "description": "Whether to re-host third-party images on the MindStudio CDN" }, "videoDurationSeconds": { "type": "number", "description": "Duration in seconds for MP4 video output" } }, "description": "Additional rendering options" }, "spaSource": { "type": "object", "properties": { "source": { "type": "string", "description": "Source code of the SPA (legacy, use files instead)" }, "lastCompiledSource": { "type": "string", "description": "Last compiled source (cached)" }, "files": { "type": "object", "properties": {}, "required": [], "description": "Multi-file SPA source" }, "paths": { "type": "array", "items": { "type": "string" }, "description": "Available route paths in the SPA" }, "root": { "type": "string", "description": "Root URL of the SPA bundle" }, "zipUrl": { "type": "string", "description": "URL of the zipped SPA bundle" } }, "required": ["paths", "root", "zipUrl"], "description": "Single page app source configuration (advanced)" }, "rawSource": { "type": "string", "description": "Raw HTML source stored in a variable, using handlebars syntax (e.g. {{myHtmlVariable}})" }, "dynamicPrompt": { "type": "string", "description": 'Prompt to generate the HTML dynamically when sourceType is "dynamic"' }, "dynamicSourceModelOverride": { "type": "object", "properties": { "model": { "type": "string", "description": 'Model identifier (e.g. "gpt-4", "claude-3-opus")' }, "temperature": { "type": "number", "description": "Sampling temperature for the model (0-2)" }, "maxResponseTokens": { "type": "number", "description": "Maximum number of tokens in the model's response" }, "ignorePreamble": { "type": "boolean", "description": "Whether to skip the system preamble/instructions" }, "userMessagePreprocessor": { "type": "object", "properties": { "dataSource": { "type": "string", "description": "Data source identifier for the preprocessor" }, "messageTemplate": { "type": "string", "description": "Template string applied to user messages before sending to the model" }, "maxResults": { "type": "number", "description": "Maximum number of results to include from the data source" }, "enabled": { "type": "boolean", "description": "Whether the preprocessor is active" }, "shouldInherit": { "type": "boolean", "description": "Whether child steps should inherit this preprocessor configuration" } }, "description": "Preprocessor applied to user messages before sending to the model" }, "preamble": { "type": "string", "description": "System preamble/instructions for the model" }, "multiModelEnabled": { "type": "boolean", "description": "Whether multi-model candidate generation is enabled" }, "editResponseEnabled": { "type": "boolean", "description": "Whether the user can edit the model's response" }, "config": { "type": "object", "properties": {}, "required": [], "description": "Additional model-specific configuration" } }, "required": ["model", "temperature", "maxResponseTokens"], "description": "Model override for dynamic HTML generation. Leave undefined to use the default model" }, "transitionControl": { "enum": ["default", "native"], "type": "string", "description": "Controls how the step transitions after displaying in foreground mode" }, "shareControl": { "enum": ["default", "hidden"], "type": "string", "description": "Controls visibility of the share button on displayed assets" }, "shareImageUrl": { "type": "string", "description": "URL of a custom Open Graph share image" }, "intermediateAsset": { "type": "boolean", "description": "When true, the asset is created but hidden from the user's gallery (tagged as intermediate)" } }, "required": ["source", "sourceType", "outputFormat", "pageSize", "testData"] },
    outputSchema: { "type": "object", "properties": { "url": { "type": "string", "description": "CDN URL of the generated asset (PDF, PNG, HTML, or MP4 depending on outputFormat)" } }, "required": ["url"] }
  },
  "generateStaticVideoFromImage": {
    stepType: "generateStaticVideoFromImage",
    description: "Convert a static image to an MP4",
    usageNotes: "- Can use to create slides/intertitles/slates for video composition",
    inputSchema: { "type": "object", "properties": { "imageUrl": { "type": "string", "description": "URL of the source image to convert to video" }, "duration": { "type": "string", "description": "Duration of the output video in seconds" } }, "required": ["imageUrl", "duration"] },
    outputSchema: { "type": "object", "properties": { "videoUrl": { "type": "string", "description": "URL of the generated static video" } }, "required": ["videoUrl"] }
  },
  "generateText": {
    stepType: "userMessage",
    description: "Send a message to an AI model and return the response, or echo a system message.",
    usageNotes: `- Source "user" sends the message to an LLM and returns the model's response.
- Source "system" echoes the message content directly (no AI call).
- Mode "background" saves the result to a variable. Mode "foreground" streams it to the user (not available in direct execution).
- Structured output (JSON/CSV) can be enforced via structuredOutputType and structuredOutputExample.
- When executed inside a v2 app method (managed sandbox or local dev tunnel),
  LLM token output can be streamed to the frontend in real time via an SSE
  side-channel. The frontend opts in by passing { stream: true } to the method
  invocation via @mindstudio-ai/interface. Tokens are published to Redis
  pub/sub as they arrive and forwarded as SSE events on the invoke response.
  The method code itself is unchanged \u2014 streaming is transparent to the
  developer. See V2ExecutionService.ts and the invoke handler in V2Apps for
  the server-side plumbing.`,
    inputSchema: { "type": "object", "properties": { "message": { "type": "string", "description": "The message to send (prompt for AI, or text for system echo)" }, "source": { "enum": ["user", "system"], "type": "string", "description": 'Message source: "user" sends to AI model, "system" echoes message content directly. Defaults to "user"' }, "modelOverride": { "type": "object", "properties": { "model": { "type": "string", "description": 'Model identifier (e.g. "gpt-4", "claude-3-opus")' }, "temperature": { "type": "number", "description": "Sampling temperature for the model (0-2)" }, "maxResponseTokens": { "type": "number", "description": "Maximum number of tokens in the model's response" }, "ignorePreamble": { "type": "boolean", "description": "Whether to skip the system preamble/instructions" }, "userMessagePreprocessor": { "type": "object", "properties": { "dataSource": { "type": "string", "description": "Data source identifier for the preprocessor" }, "messageTemplate": { "type": "string", "description": "Template string applied to user messages before sending to the model" }, "maxResults": { "type": "number", "description": "Maximum number of results to include from the data source" }, "enabled": { "type": "boolean", "description": "Whether the preprocessor is active" }, "shouldInherit": { "type": "boolean", "description": "Whether child steps should inherit this preprocessor configuration" } }, "description": "Preprocessor applied to user messages before sending to the model" }, "preamble": { "type": "string", "description": "System preamble/instructions for the model" }, "multiModelEnabled": { "type": "boolean", "description": "Whether multi-model candidate generation is enabled" }, "editResponseEnabled": { "type": "boolean", "description": "Whether the user can edit the model's response" }, "config": { "type": "object", "properties": {}, "required": [], "description": "Additional model-specific configuration" } }, "required": ["model", "temperature", "maxResponseTokens"], "description": "Model configuration override. Optional; uses the workflow's default model if not specified" }, "structuredOutputType": { "enum": ["text", "json", "csv"], "type": "string", "description": "Output format constraint for structured responses" }, "structuredOutputExample": { "type": "string", "description": "Sample showing the desired output shape (for JSON/CSV formats). A TypeScript interface is also useful here for more complex types." }, "chatHistoryMode": { "enum": ["include", "exclude"], "type": "string", "description": "Whether to include or exclude prior chat history in the AI context" } }, "required": ["message"], "description": "Configuration for the user message step" },
    outputSchema: { "type": "object", "properties": { "content": { "type": "string", "description": "The AI model's response or echoed system message content" } }, "required": ["content"] }
  },
  "generateVideo": {
    stepType: "generateVideo",
    description: "Generate a video from a text prompt using an AI model.",
    usageNotes: "- Prompts should be descriptive but concise (roughly 3\u20136 sentences).\n- Videos are automatically hosted on a CDN.\n- In foreground mode, the video is displayed to the user. In background mode, the URL is saved to a variable.\n- When generateVariants is true with numVariants > 1, multiple videos are generated in parallel.\n- In direct execution, foreground mode behaves as background, and userSelect variant behavior behaves as saveAll.",
    inputSchema: { "type": "object", "properties": { "prompt": { "type": "string", "description": "Text prompt describing the video to generate" }, "intermediateAsset": { "type": "boolean", "description": "When true, the asset is created but hidden from the user's gallery (tagged as intermediate)" }, "videoModelOverride": { "type": "object", "properties": { "model": { "type": "string", "description": "Video generation model identifier" }, "config": { "type": "object", "properties": {}, "required": [], "description": "Additional model-specific configuration" } }, "required": ["model"], "description": "Optional model configuration override. Uses the workflow's default video model if not specified" }, "generateVariants": { "type": "boolean", "description": "Whether to generate multiple video variants in parallel" }, "numVariants": { "type": "number", "description": "Number of variants to generate (max 10)" }, "addWatermark": { "type": "boolean", "description": "Whether to add a MindStudio watermark to the generated video.\n\nThe watermark is a product mark on assets generated in the MindStudio UI. A step run directly via the SDK or API is producing the app's own asset, so it is never watermarked and this flag has no effect there." } }, "required": ["prompt"] },
    outputSchema: { "type": "object", "properties": { "videoUrl": { "anyOf": [{ "type": "string" }, { "type": "array", "items": { "type": "string" } }] } }, "required": ["videoUrl"] }
  },
  "getGmailAttachments": {
    stepType: "getGmailAttachments",
    description: "Download attachments from a Gmail email and re-host them on CDN.",
    usageNotes: "- Requires a Google OAuth connection with Gmail readonly scope.\n- Attachments are uploaded to CDN and returned as URLs.\n- Attachments larger than 25MB are skipped.\n- Use the message ID from Search Gmail Emails, List Recent Gmail Emails, or Get Gmail Email steps.",
    inputSchema: { "type": "object", "properties": { "messageId": { "type": "string", "description": "Gmail message ID" }, "connectionId": { "type": "string", "description": "Google OAuth connection ID" } }, "required": ["messageId"] },
    outputSchema: { "description": "This step does not produce output data." }
  },
  "getGmailDraft": {
    stepType: "getGmailDraft",
    description: "Retrieve a specific draft from Gmail by draft ID.",
    usageNotes: "- Requires a Google OAuth connection with Gmail readonly scope.\n- Returns the draft content including subject, recipients, sender, and body.",
    inputSchema: { "type": "object", "properties": { "draftId": { "type": "string", "description": "Gmail draft ID to retrieve" }, "connectionId": { "type": "string", "description": "Google OAuth connection ID" } }, "required": ["draftId"] },
    outputSchema: { "type": "object", "properties": { "draftId": { "type": "string", "description": "Gmail draft ID" }, "messageId": { "type": "string", "description": "Gmail message ID" }, "subject": { "type": "string", "description": "Email subject" }, "to": { "type": "string", "description": "Recipient email" }, "from": { "type": "string", "description": "Sender email" }, "body": { "type": "string", "description": "Draft body content" } }, "required": ["draftId", "messageId", "subject", "to", "from", "body"] }
  },
  "getGmailEmail": {
    stepType: "getGmailEmail",
    description: "Retrieve a specific email from Gmail by message ID.",
    usageNotes: "- Requires a Google OAuth connection with Gmail readonly scope.\n- Returns the email subject, sender, recipient, date, body (plain text preferred, falls back to HTML), and labels.",
    inputSchema: { "type": "object", "properties": { "messageId": { "type": "string", "description": "Gmail message ID to retrieve" }, "connectionId": { "type": "string", "description": "Google OAuth connection ID" } }, "required": ["messageId"] },
    outputSchema: { "type": "object", "properties": { "messageId": { "type": "string", "description": "Gmail message ID" }, "subject": { "type": "string", "description": "Email subject" }, "from": { "type": "string", "description": "Sender email" }, "to": { "type": "string", "description": "Recipient email" }, "date": { "type": "string", "description": "Email date" }, "body": { "type": "string", "description": "Email body content" }, "labels": { "type": "string", "description": "Comma-separated label IDs" } }, "required": ["messageId", "subject", "from", "to", "date", "body", "labels"] }
  },
  "getGmailUnreadCount": {
    stepType: "getGmailUnreadCount",
    description: "Get the number of unread emails in the connected Gmail inbox.",
    usageNotes: "- Requires a Google OAuth connection with Gmail readonly scope.\n- Returns the unread message count for the inbox label.\n- This is a lightweight call that does not fetch any email content.",
    inputSchema: { "type": "object", "properties": { "connectionId": { "type": "string", "description": "Google OAuth connection ID" } } },
    outputSchema: { "description": "This step does not produce output data." }
  },
  "getGoogleCalendarEvent": {
    stepType: "getGoogleCalendarEvent",
    description: "Retrieve a specific event from a Google Calendar by event ID.",
    usageNotes: "- Requires a Google OAuth connection with Calendar events scope.\n- The variable receives JSON or XML-like text depending on exportType. The direct execution output always returns the structured event.",
    inputSchema: { "type": "object", "properties": { "connectionId": { "type": "string", "description": "Google OAuth connection ID" }, "eventId": { "type": "string", "description": "Google Calendar event ID to retrieve" }, "exportType": { "enum": ["json", "text"], "type": "string", "description": 'Format for the variable output: "json" or "text"' }, "calendarId": { "type": "string", "description": 'Calendar ID (defaults to "primary" if omitted)' } }, "required": ["eventId", "exportType"] },
    outputSchema: { "type": "object", "properties": { "event": { "type": "object", "properties": { "id": { "type": "string", "description": "Google Calendar event ID" }, "status": { "type": "string", "description": 'Event status (e.g. "confirmed", "tentative", "cancelled")' }, "htmlLink": { "type": "string", "description": "URL to view the event in Google Calendar" }, "created": { "type": "string", "description": "Timestamp when the event was created" }, "updated": { "type": "string", "description": "Timestamp when the event was last updated" }, "summary": { "type": "string", "description": "Event title" }, "description": { "type": "string", "description": "Event description" }, "location": { "type": "string", "description": "Event location" }, "organizer": { "anyOf": [{ "type": "object", "properties": { "displayName": { "type": "string" }, "email": { "type": "string" } } }, { "type": "null" }] }, "start": { "anyOf": [{ "type": "object", "properties": { "dateTime": { "type": "string" }, "timeZone": { "type": "string" } } }, { "type": "null" }] }, "end": { "anyOf": [{ "type": "object", "properties": { "dateTime": { "type": "string" }, "timeZone": { "type": "string" } } }, { "type": "null" }] }, "attendees": { "anyOf": [{ "type": "array", "items": { "type": "object", "properties": { "displayName": { "type": "string" }, "email": { "type": "string" }, "responseStatus": { "type": "string" } } } }, { "type": "null" }] } }, "description": "The retrieved calendar event" } }, "required": ["event"] }
  },
  "getGoogleDriveFile": {
    stepType: "getGoogleDriveFile",
    description: "Download a file from Google Drive and rehost it on the CDN. Returns a public CDN URL.",
    usageNotes: "- Requires a Google OAuth connection with Drive scope.\n- Google-native files (Docs, Sheets, Slides) cannot be downloaded \u2014 use dedicated steps instead.\n- Maximum file size: 200MB.\n- The file is downloaded and re-uploaded to the CDN; the returned URL is publicly accessible.",
    inputSchema: { "type": "object", "properties": { "fileId": { "type": "string", "description": "Google Drive file ID" }, "connectionId": { "type": "string", "description": "Google OAuth connection ID" } }, "required": ["fileId"] },
    outputSchema: { "type": "object", "properties": { "url": { "type": "string", "description": "CDN URL of the downloaded file" }, "name": { "type": "string", "description": "Original file name" }, "mimeType": { "type": "string", "description": "File MIME type" }, "size": { "type": "number", "description": "File size in bytes" } }, "required": ["url", "name", "mimeType", "size"] }
  },
  "getGoogleSheetInfo": {
    stepType: "getGoogleSheetInfo",
    description: "Get metadata about a Google Spreadsheet including sheet names, row counts, and column counts.",
    usageNotes: "- Requires a Google OAuth connection with Drive scope.\n- Returns the spreadsheet title and a list of all sheets with their dimensions.",
    inputSchema: { "type": "object", "properties": { "documentId": { "type": "string", "description": "Google Spreadsheet ID or URL" }, "connectionId": { "type": "string", "description": "Google OAuth connection ID" } }, "required": ["documentId"] },
    outputSchema: { "type": "object", "properties": { "title": { "type": "string", "description": "Spreadsheet title" }, "sheets": { "type": "array", "items": { "type": "object", "properties": { "sheetId": { "type": "number" }, "title": { "type": "string" }, "rowCount": { "type": "number" }, "columnCount": { "type": "number" } }, "required": ["sheetId", "title", "rowCount", "columnCount"] }, "description": "List of sheets with their properties" } }, "required": ["title", "sheets"] }
  },
  "getMediaMetadata": {
    stepType: "getMediaMetadata",
    description: "Get info about a media file",
    usageNotes: "",
    inputSchema: { "type": "object", "properties": { "mediaUrl": { "type": "string", "description": "URL of the audio or video file to analyze" } }, "required": ["mediaUrl"] },
    outputSchema: { "type": "object", "properties": { "metadata": { "type": "string", "description": "JSON string containing the media file metadata" } }, "required": ["metadata"] }
  },
  "hubspotCreateCompany": {
    stepType: "hubspotCreateCompany",
    description: "Create a new company or update an existing one in HubSpot. Matches by domain.",
    usageNotes: "- Requires a HubSpot OAuth connection (connectionId).\n- If a company with the given domain already exists, it is updated. Otherwise, a new one is created.\n- Property values are type-checked against enabledProperties before being sent to HubSpot.",
    inputSchema: { "type": "object", "properties": { "connectionId": { "type": "string", "description": "HubSpot OAuth connection ID" }, "company": { "type": "object", "properties": { "domain": { "type": "string", "description": "Company domain, used for matching existing companies" }, "name": { "type": "string", "description": "Company name" } }, "required": ["domain", "name"], "description": "Company data including domain, name, and additional properties" }, "enabledProperties": { "type": "array", "items": { "type": "object", "properties": { "label": { "type": "string", "description": "Display label for the HubSpot property" }, "value": { "type": "string", "description": "HubSpot property internal name" }, "type": { "enum": ["string", "number", "bool"], "type": "string", "description": "Data type of the property value" } }, "required": ["label", "value", "type"] }, "description": "HubSpot properties enabled for this step, used for type validation" } }, "required": ["company", "enabledProperties"] },
    outputSchema: { "type": "object", "properties": { "companyId": { "type": "string", "description": "HubSpot company ID of the created or updated company" } }, "required": ["companyId"] }
  },
  "hubspotCreateContact": {
    stepType: "hubspotCreateContact",
    description: "Create a new contact or update an existing one in HubSpot. Matches by email address.",
    usageNotes: "- Requires a HubSpot OAuth connection (connectionId).\n- If a contact with the given email already exists, it is updated. Otherwise, a new one is created.\n- If companyDomain is provided, the contact is associated with that company (creating the company if needed).\n- Property values are type-checked against enabledProperties before being sent to HubSpot.",
    inputSchema: { "type": "object", "properties": { "connectionId": { "type": "string", "description": "HubSpot OAuth connection ID" }, "contact": { "type": "object", "properties": { "email": { "type": "string", "description": "Contact email address, used for matching existing contacts" }, "firstname": { "type": "string", "description": "Contact first name" }, "lastname": { "type": "string", "description": "Contact last name" } }, "required": ["email", "firstname", "lastname"], "description": "Contact data including email, first name, last name, and additional properties" }, "enabledProperties": { "type": "array", "items": { "type": "object", "properties": { "label": { "type": "string", "description": "Display label for the HubSpot property" }, "value": { "type": "string", "description": "HubSpot property internal name" }, "type": { "enum": ["string", "number", "bool"], "type": "string", "description": "Data type of the property value" } }, "required": ["label", "value", "type"] }, "description": "HubSpot properties enabled for this step, used for type validation" }, "companyDomain": { "type": "string", "description": "Company domain to associate the contact with. Creates the company if it does not exist" } }, "required": ["contact", "enabledProperties", "companyDomain"] },
    outputSchema: { "type": "object", "properties": { "contactId": { "type": "string", "description": "HubSpot contact ID of the created or updated contact" } }, "required": ["contactId"] }
  },
  "hubspotGetCompany": {
    stepType: "hubspotGetCompany",
    description: "Look up a HubSpot company by domain name or company ID.",
    usageNotes: "- Requires a HubSpot OAuth connection (connectionId).\n- Returns null if the company is not found.\n- When searching by domain, performs a search query then fetches the full company record.\n- Use additionalProperties to request specific HubSpot properties beyond the defaults.",
    inputSchema: { "type": "object", "properties": { "connectionId": { "type": "string", "description": "HubSpot OAuth connection ID" }, "searchBy": { "enum": ["domain", "id"], "type": "string", "description": "How to look up the company: by domain name or HubSpot company ID" }, "companyDomain": { "type": "string", "description": "Domain to search by (used when searchBy is 'domain')" }, "companyId": { "type": "string", "description": "HubSpot company ID (used when searchBy is 'id')" }, "additionalProperties": { "type": "array", "items": { "type": "string" }, "description": "Extra HubSpot property names to include in the response beyond the defaults" } }, "required": ["searchBy", "companyDomain", "companyId", "additionalProperties"] },
    outputSchema: { "type": "object", "properties": { "company": { "anyOf": [{ "type": "object", "properties": { "id": { "type": "string" }, "properties": { "type": "object", "properties": {}, "required": [] }, "createdAt": { "type": "string" }, "updatedAt": { "type": "string" }, "archived": { "type": "boolean" } }, "required": ["id", "properties", "createdAt", "updatedAt", "archived"] }, { "type": "null" }] } }, "required": ["company"] }
  },
  "hubspotGetContact": {
    stepType: "hubspotGetContact",
    description: "Look up a HubSpot contact by email address or contact ID.",
    usageNotes: "- Requires a HubSpot OAuth connection (connectionId).\n- Returns null if the contact is not found.\n- Use additionalProperties to request specific HubSpot properties beyond the defaults.",
    inputSchema: { "type": "object", "properties": { "connectionId": { "type": "string", "description": "HubSpot OAuth connection ID" }, "searchBy": { "enum": ["email", "id"], "type": "string", "description": "How to look up the contact: by email address or HubSpot contact ID" }, "contactEmail": { "type": "string", "description": "Email address to search by (used when searchBy is 'email')" }, "contactId": { "type": "string", "description": "HubSpot contact ID (used when searchBy is 'id')" }, "additionalProperties": { "type": "array", "items": { "type": "string" }, "description": "Extra HubSpot property names to include in the response beyond the defaults" } }, "required": ["searchBy", "contactEmail", "contactId", "additionalProperties"] },
    outputSchema: { "type": "object", "properties": { "contact": { "anyOf": [{ "type": "object", "properties": { "id": { "type": "string" }, "properties": { "type": "object", "properties": {}, "required": [] }, "createdAt": { "type": "string" }, "updatedAt": { "type": "string" }, "archived": { "type": "boolean" } }, "required": ["id", "properties", "createdAt", "updatedAt", "archived"] }, { "type": "null" }] } }, "required": ["contact"] }
  },
  "hunterApiCompanyEnrichment": {
    stepType: "hunterApiCompanyEnrichment",
    description: "Look up company information by domain using Hunter.io.",
    usageNotes: "- Returns company name, description, location, industry, size, technologies, and more.\n- If the domain input is a full URL, the hostname is automatically extracted.\n- Returns null if the company is not found.",
    inputSchema: { "type": "object", "properties": { "domain": { "type": "string", "description": 'Domain or URL to look up (e.g. "example.com")' } }, "required": ["domain"] },
    outputSchema: { "type": "object", "properties": { "data": { "anyOf": [{ "type": "object", "properties": { "name": { "type": "string" }, "domain": { "type": "string" }, "description": { "type": "string" }, "country": { "type": "string" }, "state": { "type": "string" }, "city": { "type": "string" }, "industry": { "type": "string" }, "employees_range": { "type": "string" }, "logo_url": { "type": "string" }, "technologies": { "type": "array", "items": { "type": "string" } } }, "required": ["name", "domain", "description", "country", "state", "city", "industry", "employees_range", "logo_url", "technologies"] }, { "type": "null" }] } }, "required": ["data"] }
  },
  "hunterApiDomainSearch": {
    stepType: "hunterApiDomainSearch",
    description: "Search for email addresses associated with a domain using Hunter.io.",
    usageNotes: "- If the domain input is a full URL, the hostname is automatically extracted.\n- Returns a list of email addresses found for the domain along with organization info.",
    inputSchema: { "type": "object", "properties": { "domain": { "type": "string", "description": 'Domain or URL to search for email addresses (e.g. "example.com")' } }, "required": ["domain"] },
    outputSchema: { "type": "object", "properties": { "data": { "type": "object", "properties": { "domain": { "type": "string", "description": "The searched domain" }, "disposable": { "type": "boolean", "description": "Whether the domain uses disposable email addresses" }, "webmail": { "type": "boolean", "description": "Whether the domain is a webmail provider" }, "accept_all": { "type": "boolean", "description": "Whether the domain accepts all email addresses" }, "pattern": { "type": "string", "description": 'Common email pattern for the domain (e.g. "{first}.{last}")' }, "organization": { "type": "string", "description": "Organization name associated with the domain" }, "country": { "type": "string", "description": "Country of the organization" }, "state": { "type": "string", "description": "State or region of the organization" }, "emails": { "type": "array", "items": { "type": "object", "properties": { "value": { "type": "string", "description": "Email address" }, "type": { "type": "string", "description": 'Email type (e.g. "personal", "generic")' }, "confidence": { "type": "number", "description": "Confidence score (0-100)" }, "first_name": { "type": "string", "description": "Contact first name" }, "last_name": { "type": "string", "description": "Contact last name" }, "position": { "type": "string", "description": "Job title or position" }, "seniority": { "type": "string", "description": "Seniority level" }, "department": { "type": "string", "description": "Department within the organization" }, "linkedin": { "type": "string", "description": "LinkedIn profile URL" }, "twitter": { "type": "string", "description": "Twitter handle" }, "phone_number": { "type": "string", "description": "Phone number" } }, "required": ["value", "type", "confidence", "first_name", "last_name", "position", "seniority", "department", "linkedin", "twitter", "phone_number"] }, "description": "List of email addresses found for the domain" }, "linked_domains": { "type": "array", "items": { "type": "string" }, "description": "Other domains linked to this organization" } }, "required": ["domain", "disposable", "webmail", "accept_all", "pattern", "organization", "country", "state", "emails", "linked_domains"], "description": "Domain search results including emails and organization info" } }, "required": ["data"] }
  },
  "hunterApiEmailFinder": {
    stepType: "hunterApiEmailFinder",
    description: "Find an email address for a specific person at a domain using Hunter.io.",
    usageNotes: "- Requires a first name, last name, and domain.\n- If the domain input is a full URL, the hostname is automatically extracted.\n- Returns the most likely email address with a confidence score.",
    inputSchema: { "type": "object", "properties": { "domain": { "type": "string", "description": 'Domain to search (e.g. "example.com"). Full URLs are also accepted' }, "firstName": { "type": "string", "description": "Person's first name" }, "lastName": { "type": "string", "description": "Person's last name" } }, "required": ["domain", "firstName", "lastName"] },
    outputSchema: { "type": "object", "properties": { "data": { "type": "object", "properties": { "first_name": { "type": "string", "description": "Person's first name" }, "last_name": { "type": "string", "description": "Person's last name" }, "email": { "type": "string", "description": "The found email address" }, "score": { "type": "number", "description": "Confidence score (0-100)" }, "domain": { "type": "string", "description": "Domain searched" }, "accept_all": { "type": "boolean", "description": "Whether the domain accepts all email addresses" }, "position": { "type": "string", "description": "Job title or position" }, "twitter": { "type": "string", "description": "Twitter handle" }, "linkedin_url": { "type": "string", "description": "LinkedIn profile URL" }, "phone_number": { "type": "string", "description": "Phone number" }, "company": { "type": "string", "description": "Company name" }, "sources": { "type": "array", "items": { "type": "object", "properties": { "domain": { "type": "string", "description": "Domain where the email was found" }, "uri": { "type": "string", "description": "URI of the page where the email was found" }, "extracted_on": { "type": "string", "description": "Date when the email was extracted" } }, "required": ["domain", "uri", "extracted_on"] }, "description": "Sources where the email was found" } }, "required": ["first_name", "last_name", "email", "score", "domain", "accept_all", "position", "twitter", "linkedin_url", "phone_number", "company", "sources"], "description": "Email finder results including the found email and confidence score" } }, "required": ["data"] }
  },
  "hunterApiEmailVerification": {
    stepType: "hunterApiEmailVerification",
    description: "Verify whether an email address is valid and deliverable using Hunter.io.",
    usageNotes: '- Checks email format, MX records, SMTP server, and mailbox deliverability.\n- Returns a status ("valid", "invalid", "accept_all", "webmail", "disposable", "unknown") and a score.',
    inputSchema: { "type": "object", "properties": { "email": { "type": "string", "description": "Email address to verify" } }, "required": ["email"] },
    outputSchema: { "type": "object", "properties": { "data": { "type": "object", "properties": { "status": { "type": "string", "description": 'Verification status (e.g. "valid", "invalid", "accept_all", "webmail", "disposable", "unknown")' }, "result": { "type": "string", "description": "Deliverability result" }, "score": { "type": "number", "description": "Confidence score (0-100)" }, "email": { "type": "string", "description": "The verified email address" }, "regexp": { "type": "boolean", "description": "Whether the email matches a valid format" }, "gibberish": { "type": "boolean", "description": "Whether the email appears to be gibberish" }, "disposable": { "type": "boolean", "description": "Whether the email uses a disposable email service" }, "webmail": { "type": "boolean", "description": "Whether the email is from a webmail provider" }, "mx_records": { "type": "boolean", "description": "Whether MX records exist for the domain" }, "smtp_server": { "type": "boolean", "description": "Whether the SMTP server is reachable" }, "smtp_check": { "type": "boolean", "description": "Whether the SMTP mailbox check passed" }, "accept_all": { "type": "boolean", "description": "Whether the domain accepts all email addresses" }, "block": { "type": "boolean", "description": "Whether the email is blocked" }, "sources": { "type": "array", "items": { "type": "object", "properties": { "domain": { "type": "string", "description": "Domain where the email was found" }, "uri": { "type": "string", "description": "URI of the page where the email was found" }, "extracted_on": { "type": "string", "description": "Date when the email was extracted" } }, "required": ["domain", "uri", "extracted_on"] }, "description": "Sources where the email was found" } }, "required": ["status", "result", "score", "email", "regexp", "gibberish", "disposable", "webmail", "mx_records", "smtp_server", "smtp_check", "accept_all", "block", "sources"], "description": "Email verification results including status, deliverability, and confidence score" } }, "required": ["data"] }
  },
  "hunterApiPersonEnrichment": {
    stepType: "hunterApiPersonEnrichment",
    description: "Look up professional information about a person by their email address using Hunter.io.",
    usageNotes: "- Returns name, job title, social profiles, and company information.\n- If the person is not found, returns an object with an error message instead of throwing.",
    inputSchema: { "type": "object", "properties": { "email": { "type": "string", "description": "Email address to look up" } }, "required": ["email"] },
    outputSchema: { "type": "object", "properties": { "data": { "anyOf": [{ "type": "object", "properties": { "first_name": { "type": "string" }, "last_name": { "type": "string" }, "email": { "type": "string" }, "position": { "type": "string" }, "seniority": { "type": "string" }, "department": { "type": "string" }, "linkedin_url": { "type": "string" }, "twitter": { "type": "string" }, "phone_number": { "type": "string" }, "company": { "anyOf": [{ "type": "object", "properties": { "name": { "type": "string" }, "domain": { "type": "string" }, "industry": { "type": "string" } }, "required": ["name", "domain", "industry"] }, { "type": "null" }] } }, "required": ["first_name", "last_name", "email", "position", "seniority", "department", "linkedin_url", "twitter", "phone_number", "company"] }, { "type": "object", "properties": { "error": { "type": "string" } }, "required": ["error"] }] } }, "required": ["data"] }
  },
  "imageFaceSwap": {
    stepType: "imageFaceSwap",
    description: "Replace a face in an image with a face from another image using AI.",
    usageNotes: "- Requires both a target image and a face source image.\n- Output is re-hosted on the CDN as a PNG.",
    inputSchema: { "type": "object", "properties": { "imageUrl": { "type": "string", "description": "URL of the target image containing the face to replace" }, "faceImageUrl": { "type": "string", "description": "URL of the image containing the replacement face" }, "engine": { "type": "string", "description": "Face swap engine to use" } }, "required": ["imageUrl", "faceImageUrl", "engine"] },
    outputSchema: { "type": "object", "properties": { "imageUrl": { "type": "string", "description": "CDN URL of the face-swapped image (PNG)" } }, "required": ["imageUrl"] }
  },
  "imageRemoveWatermark": {
    stepType: "imageRemoveWatermark",
    description: "Remove watermarks from an image using AI.",
    usageNotes: "- Output is re-hosted on the CDN as a PNG.",
    inputSchema: { "type": "object", "properties": { "imageUrl": { "type": "string", "description": "URL of the image to remove the watermark from" }, "engine": { "type": "string", "description": "Watermark removal engine to use" }, "intermediateAsset": { "type": "boolean", "description": "When true, the asset is created but hidden from the user's gallery (tagged as intermediate)" } }, "required": ["imageUrl", "engine"] },
    outputSchema: { "type": "object", "properties": { "imageUrl": { "type": "string", "description": "CDN URL of the processed image with watermark removed (PNG)" } }, "required": ["imageUrl"] }
  },
  "insertVideoClips": {
    stepType: "insertVideoClips",
    description: "Insert b-roll clips into a base video at a timecode, optionally with an xfade transition.",
    usageNotes: "",
    inputSchema: { "type": "object", "properties": { "baseVideoUrl": { "type": "string", "description": "URL of the base video to insert clips into" }, "overlayVideos": { "type": "array", "items": { "type": "object", "properties": { "videoUrl": { "type": "string", "description": "URL of the overlay video clip" }, "startTimeSec": { "type": "number", "description": "Timecode in seconds at which to insert this clip" } }, "required": ["videoUrl", "startTimeSec"] }, "description": "Array of overlay clips to insert at specified timecodes" }, "transition": { "type": "string", "description": "Optional xfade transition effect name between clips" }, "transitionDuration": { "type": "number", "description": "Duration of the transition in seconds" }, "useOverlayAudio": { "type": "boolean", "description": "When true, uses audio from the overlay clips instead of the base video audio during inserts" }, "intermediateAsset": { "type": "boolean", "description": "When true, the asset is created but hidden from the user's gallery (tagged as intermediate)" } }, "required": ["baseVideoUrl", "overlayVideos"] },
    outputSchema: { "type": "object", "properties": { "videoUrl": { "type": "string", "description": "URL of the video with clips inserted" } }, "required": ["videoUrl"] }
  },
  "listDataSources": {
    stepType: "listDataSources",
    description: "Legacy v1 data sources. v2 apps should use `dataSources.defineDataSource()` from @mindstudio-ai/agent instead, which owns parsing, chunking, embedding and citations. List all data sources for the current app.",
    usageNotes: "- Returns metadata for every data source associated with the current app version.\n- Each entry includes the data source ID, name, description, status, and document list.",
    inputSchema: { "type": "object", "properties": {}, "required": [] },
    outputSchema: { "description": "This step does not produce output data." }
  },
  "listGmailDrafts": {
    stepType: "listGmailDrafts",
    description: "List drafts in the connected Gmail account.",
    usageNotes: "- Requires a Google OAuth connection with Gmail readonly scope.\n- Returns up to 50 drafts (default 10).\n- The variable receives text or JSON depending on exportType.",
    inputSchema: { "type": "object", "properties": { "connectionId": { "type": "string", "description": "Google OAuth connection ID" }, "limit": { "type": "string", "description": "Max drafts to return (default: 10, max: 50)" }, "exportType": { "enum": ["json", "text"], "type": "string", "description": 'Format for the variable output: "json" or "text"' } }, "required": ["exportType"] },
    outputSchema: { "type": "object", "properties": { "drafts": { "type": "array", "items": { "type": "object", "properties": { "draftId": { "type": "string", "description": "Gmail draft ID" }, "messageId": { "type": "string", "description": "Gmail message ID" }, "subject": { "type": "string", "description": "Email subject" }, "to": { "type": "string", "description": "Recipient email" }, "snippet": { "type": "string", "description": "Short preview text" } }, "required": ["draftId", "messageId", "subject", "to", "snippet"] }, "description": "List of draft summaries" } }, "required": ["drafts"] }
  },
  "listGmailLabels": {
    stepType: "listGmailLabels",
    description: "List all labels in the connected Gmail account. Use these label IDs or names with the Update Gmail Labels step.",
    usageNotes: '- Requires a Google OAuth connection with Gmail readonly scope.\n- Returns both system labels (INBOX, SENT, TRASH, etc.) and user-created labels.\n- Label type is "system" for built-in labels or "user" for custom labels.',
    inputSchema: { "type": "object", "properties": { "connectionId": { "type": "string", "description": "Google OAuth connection ID" } } },
    outputSchema: { "description": "This step does not produce output data." }
  },
  "listGoogleCalendarEvents": {
    stepType: "listGoogleCalendarEvents",
    description: "List upcoming events from a Google Calendar, ordered by start time.",
    usageNotes: "- Requires a Google OAuth connection with Calendar events scope.\n- Only returns future events (timeMin = now).\n- The variable receives JSON or XML-like text depending on exportType. The direct execution output always returns structured events.",
    inputSchema: { "type": "object", "properties": { "connectionId": { "type": "string", "description": "Google OAuth connection ID" }, "limit": { "type": "number", "description": "Maximum number of events to return (default: 10)" }, "exportType": { "enum": ["json", "text"], "type": "string", "description": 'Format for the variable output: "json" or "text"' }, "calendarId": { "type": "string", "description": 'Calendar ID (defaults to "primary" if omitted)' } }, "required": ["limit", "exportType"] },
    outputSchema: { "type": "object", "properties": { "events": { "type": "array", "items": { "type": "object", "properties": { "id": { "type": "string", "description": "Google Calendar event ID" }, "status": { "type": "string", "description": 'Event status (e.g. "confirmed", "tentative", "cancelled")' }, "htmlLink": { "type": "string", "description": "URL to view the event in Google Calendar" }, "created": { "type": "string", "description": "Timestamp when the event was created" }, "updated": { "type": "string", "description": "Timestamp when the event was last updated" }, "summary": { "type": "string", "description": "Event title" }, "description": { "type": "string", "description": "Event description" }, "location": { "type": "string", "description": "Event location" }, "organizer": { "anyOf": [{ "type": "object", "properties": { "displayName": { "type": "string" }, "email": { "type": "string" } } }, { "type": "null" }] }, "start": { "anyOf": [{ "type": "object", "properties": { "dateTime": { "type": "string" }, "timeZone": { "type": "string" } } }, { "type": "null" }] }, "end": { "anyOf": [{ "type": "object", "properties": { "dateTime": { "type": "string" }, "timeZone": { "type": "string" } } }, { "type": "null" }] }, "attendees": { "anyOf": [{ "type": "array", "items": { "type": "object", "properties": { "displayName": { "type": "string" }, "email": { "type": "string" }, "responseStatus": { "type": "string" } } } }, { "type": "null" }] } } }, "description": "List of upcoming calendar events ordered by start time" } }, "required": ["events"] }
  },
  "listGoogleDriveFiles": {
    stepType: "listGoogleDriveFiles",
    description: "List files in a Google Drive folder.",
    usageNotes: "- Requires a Google OAuth connection with Drive scope.\n- If folderId is omitted, lists files in the root folder.\n- Returns file metadata including name, type, size, and links.",
    inputSchema: { "type": "object", "properties": { "folderId": { "type": "string", "description": "Google Drive folder ID (defaults to root)" }, "limit": { "type": "number", "description": "Max files to return (default: 20)" }, "connectionId": { "type": "string", "description": "Google OAuth connection ID" }, "exportType": { "enum": ["json", "text"], "type": "string", "description": 'Format for the variable output: "json" or "text"' } }, "required": ["exportType"] },
    outputSchema: { "type": "object", "properties": { "files": { "type": "array", "items": { "type": "object", "properties": { "id": { "type": "string" }, "name": { "type": "string" }, "mimeType": { "type": "string" }, "size": { "type": "string" }, "webViewLink": { "type": "string" }, "createdTime": { "type": "string" }, "modifiedTime": { "type": "string" } }, "required": ["id", "name", "mimeType", "size", "webViewLink", "createdTime", "modifiedTime"] }, "description": "List of files in the folder" } }, "required": ["files"] }
  },
  "listRecentGmailEmails": {
    stepType: "listRecentGmailEmails",
    description: "List recent emails from the connected Gmail inbox.",
    usageNotes: '- Requires a Google OAuth connection with Gmail readonly scope.\n- Returns up to 100 emails (default 5), ordered by most recent first.\n- Functionally equivalent to Search Gmail Emails with an "in:inbox" query.',
    inputSchema: { "type": "object", "properties": { "connectionId": { "type": "string", "description": "Google OAuth connection ID" }, "exportType": { "enum": ["json", "text"], "type": "string", "description": 'Format for the variable output: "json" or "text"' }, "limit": { "type": "string", "description": "Maximum number of emails to return (1-100, default: 5)" } }, "required": ["exportType", "limit"] },
    outputSchema: { "description": "This step does not produce output data." }
  },
  "logic": {
    stepType: "logic",
    description: "Route execution to different branches based on AI evaluation, comparison operators, or workflow jumps.",
    usageNotes: `- Supports two modes: "ai" (default) uses an AI model to pick the most accurate statement; "comparison" uses operator-based checks.
- In AI mode, the model picks the most accurate statement from the list. All possible cases must be specified.
- In comparison mode, the context is the left operand and each case's condition is the right operand. First matching case wins. Use operator "default" as a fallback.
- Requires at least two cases.
- Each case can transition to a step in the current workflow (destinationStepId) or jump to another workflow (destinationWorkflowId).`,
    inputSchema: { "type": "object", "properties": { "mode": { "enum": ["ai", "comparison"], "type": "string", "description": "Evaluation mode: 'ai' for LLM-based, 'comparison' for operator-based. Default: 'ai'" }, "context": { "type": "string", "description": "AI mode: prompt context. Comparison mode: left operand (resolved via variables)." }, "cases": { "type": "array", "items": { "anyOf": [{ "type": "object", "properties": { "id": { "type": "string", "description": "Unique case identifier" }, "condition": { "type": "string", "description": "AI mode: statement to evaluate. Comparison mode: right operand value." }, "operator": { "enum": ["eq", "neq", "gt", "lt", "gte", "lte", "exists", "not_exists", "contains", "not_contains", "default"], "type": "string", "description": "Comparison operator (comparison mode only)" }, "destinationStepId": { "type": "string", "description": "Step to transition to if this case wins (workflow mode only)" }, "destinationWorkflowId": { "type": "string", "description": "Workflow to jump to if this case wins (uses that workflow's initial step)" } }, "required": ["id", "condition"] }, { "type": "string" }] }, "description": "List of conditions to evaluate (objects for managed UIs, strings for code)" }, "modelOverride": { "type": "object", "properties": { "model": { "type": "string", "description": 'Model identifier (e.g. "gpt-4", "claude-3-opus")' }, "temperature": { "type": "number", "description": "Sampling temperature for the model (0-2)" }, "maxResponseTokens": { "type": "number", "description": "Maximum number of tokens in the model's response" }, "ignorePreamble": { "type": "boolean", "description": "Whether to skip the system preamble/instructions" }, "userMessagePreprocessor": { "type": "object", "properties": { "dataSource": { "type": "string", "description": "Data source identifier for the preprocessor" }, "messageTemplate": { "type": "string", "description": "Template string applied to user messages before sending to the model" }, "maxResults": { "type": "number", "description": "Maximum number of results to include from the data source" }, "enabled": { "type": "boolean", "description": "Whether the preprocessor is active" }, "shouldInherit": { "type": "boolean", "description": "Whether child steps should inherit this preprocessor configuration" } }, "description": "Preprocessor applied to user messages before sending to the model" }, "preamble": { "type": "string", "description": "System preamble/instructions for the model" }, "multiModelEnabled": { "type": "boolean", "description": "Whether multi-model candidate generation is enabled" }, "editResponseEnabled": { "type": "boolean", "description": "Whether the user can edit the model's response" }, "config": { "type": "object", "properties": {}, "required": [], "description": "Additional model-specific configuration" } }, "required": ["model", "temperature", "maxResponseTokens"], "description": "Optional model settings override; uses the organization default if not specified (AI mode only)" } }, "required": ["context", "cases"], "description": "Configuration for the router step" },
    outputSchema: { "type": "object", "properties": { "selectedCase": { "type": "number", "description": "The index of the winning case" } }, "required": ["selectedCase"] }
  },
  "makeDotComRunScenario": {
    stepType: "makeDotComRunScenario",
    description: "Trigger a Make.com (formerly Integromat) scenario via webhook and return the response.",
    usageNotes: "- The webhook URL must be configured in your Make.com scenario.\n- Input key-value pairs are sent as JSON in the POST body.\n- Response format depends on the Make.com scenario configuration.",
    inputSchema: { "type": "object", "properties": { "webhookUrl": { "type": "string", "description": "Make.com webhook URL for the scenario" }, "input": { "type": "object", "properties": {}, "required": [], "description": "Key-value pairs to send as the JSON POST body" } }, "required": ["webhookUrl", "input"] },
    outputSchema: { "type": "object", "properties": { "data": { "description": "Response from the Make.com scenario (JSON or string depending on scenario configuration)" } }, "required": ["data"] }
  },
  "mergeAudio": {
    stepType: "mergeAudio",
    description: "Merge one or more clips into a single audio file.",
    usageNotes: "",
    inputSchema: { "type": "object", "properties": { "mp3Urls": { "type": "array", "items": { "type": "string" }, "description": "URLs of the MP3 audio clips to merge in order" }, "fileMetadata": { "type": "object", "properties": {}, "required": [], "description": "FFmpeg MP3 metadata key-value pairs to embed in the output file" }, "albumArtUrl": { "type": "string", "description": "URL of an image to embed as album art in the output file" }, "intermediateAsset": { "type": "boolean", "description": "When true, the asset is created but hidden from the user's gallery (tagged as intermediate)" } }, "required": ["mp3Urls"] },
    outputSchema: { "type": "object", "properties": { "audioUrl": { "type": "string", "description": "URL of the merged audio file" } }, "required": ["audioUrl"] }
  },
  "mergeVideos": {
    stepType: "mergeVideos",
    description: "Merge one or more clips into a single video.",
    usageNotes: "",
    inputSchema: { "type": "object", "properties": { "videoUrls": { "type": "array", "items": { "type": "string" }, "description": "URLs of the video clips to merge in order" }, "transition": { "type": "string", "description": "Optional xfade transition effect name" }, "transitionDuration": { "type": "number", "description": "Duration of the transition in seconds" }, "intermediateAsset": { "type": "boolean", "description": "When true, the asset is created but hidden from the user's gallery (tagged as intermediate)" } }, "required": ["videoUrls"] },
    outputSchema: { "type": "object", "properties": { "videoUrl": { "type": "string", "description": "URL of the merged video" } }, "required": ["videoUrl"] }
  },
  "meshyAnimate": {
    stepType: "meshyAnimate",
    description: "Apply a preset animation to a rigged 3D character model using Meshy.",
    usageNotes: "- Requires a rig_task_id from a previously completed Meshy rigging step.\n- Select an animation from Meshy's library of 600+ preset animations.\n- Only works with humanoid (bipedal) rigged characters.\n- Supports post-processing: FPS change (24/25/30/60), FBX-to-USDZ conversion, or armature extraction.\n- Animation categories: DailyActions, WalkAndRun, Fighting, Dancing, BodyMovements.",
    inputSchema: { "type": "object", "properties": { "rigTaskId": { "type": "string", "description": "ID of a completed Meshy rigging task" }, "actionId": { "type": "number", "description": "Animation action ID from the Meshy animation library" } }, "required": ["rigTaskId", "actionId"] },
    outputSchema: { "type": "object", "properties": { "glbUrl": { "type": "string" }, "fbxUrl": { "type": "string" }, "objUrl": { "type": "string" }, "usdzUrl": { "type": "string" }, "thumbnailUrl": { "type": "string" }, "textureUrls": { "type": "array", "items": { "type": "object", "properties": {}, "required": [] } }, "animations": { "type": "array", "items": { "type": "object", "properties": { "name": { "type": "string" }, "glbUrl": { "type": "string" }, "fbxUrl": { "type": "string" } }, "required": ["name"] } }, "providerTaskId": { "type": "string" } }, "required": ["glbUrl"] }
  },
  "meshyImageTo3d": {
    stepType: "meshyImageTo3d",
    description: "Generate a 3D model from one or more images using Meshy. Uses the multi-image-to-3D endpoint.",
    usageNotes: "- Accepts 1-4 image URLs. All images should depict the same object from different angles for best results.\n- By default generates with textures. Set shouldTexture to false for mesh-only output.\n- Uses should_remesh: false to preserve UV mapping integrity.",
    inputSchema: { "type": "object", "properties": { "imageUrls": { "type": "array", "items": { "type": "string" }, "description": "1-4 image URLs depicting the same object from different angles" }, "shouldTexture": { "type": "boolean", "description": "Whether to generate textures (default true)" }, "topology": { "type": "string", "description": '"triangle" (default) or "quad"' }, "targetPolycount": { "type": "number", "description": "Target polygon count (default 30000, range 100-300000)" }, "symmetryMode": { "type": "string", "description": 'Symmetry mode: "auto" (default), "off", or "on"' }, "poseMode": { "type": "string", "description": 'Pose mode: "a-pose", "t-pose", or "" (default, no specific pose)' }, "textureImageUrl": { "type": "string", "description": "2D image URL to guide the texturing process (.jpg, .jpeg, .png)" } }, "required": ["imageUrls"] },
    outputSchema: { "type": "object", "properties": { "glbUrl": { "type": "string" }, "fbxUrl": { "type": "string" }, "objUrl": { "type": "string" }, "usdzUrl": { "type": "string" }, "thumbnailUrl": { "type": "string" }, "textureUrls": { "type": "array", "items": { "type": "object", "properties": {}, "required": [] } }, "animations": { "type": "array", "items": { "type": "object", "properties": { "name": { "type": "string" }, "glbUrl": { "type": "string" }, "fbxUrl": { "type": "string" } }, "required": ["name"] } }, "providerTaskId": { "type": "string" } }, "required": ["glbUrl"] }
  },
  "meshyRemesh": {
    stepType: "meshyRemesh",
    description: "Remesh an existing 3D model to adjust topology, polygon count, or convert formats using Meshy.",
    usageNotes: "- Provide either an input task ID (from a previous Meshy step) or a model URL.\n- Defaults to triangle topology with 30,000 target polys.\n- Useful for reducing face count before rigging (max 300k faces for rigging).",
    inputSchema: { "type": "object", "properties": { "inputTaskId": { "type": "string", "description": "ID of a completed Meshy task to remesh" }, "modelUrl": { "type": "string", "description": "URL to a 3D model file (.glb, .fbx, .obj, .stl)" }, "topology": { "type": "string", "description": 'Topology: "triangle" (default) or "quad"' }, "targetPolycount": { "type": "number", "description": "Target polygon count (default 30000, range 100-300000)" }, "resizeHeight": { "type": "number", "description": "Resize model to this height in meters (0 or omitted = no resize)" } } },
    outputSchema: { "type": "object", "properties": { "glbUrl": { "type": "string" }, "fbxUrl": { "type": "string" }, "objUrl": { "type": "string" }, "usdzUrl": { "type": "string" }, "thumbnailUrl": { "type": "string" }, "textureUrls": { "type": "array", "items": { "type": "object", "properties": {}, "required": [] } }, "animations": { "type": "array", "items": { "type": "object", "properties": { "name": { "type": "string" }, "glbUrl": { "type": "string" }, "fbxUrl": { "type": "string" } }, "required": ["name"] } }, "providerTaskId": { "type": "string" } }, "required": ["glbUrl"] }
  },
  "meshyRig": {
    stepType: "meshyRig",
    description: "Auto-rig a humanoid 3D model and generate basic walking/running animations using Meshy.",
    usageNotes: "- Only works well with standard humanoid (bipedal) models with clearly defined limbs.\n- Prefers model_url over input_task_id for cleaner rigging input.\n- Models with more than 300,000 faces should be remeshed first.\n- Returns rigged model files and optional basic animations.",
    inputSchema: { "type": "object", "properties": { "inputTaskId": { "type": "string", "description": "ID of a completed Meshy task to rig" }, "modelUrl": { "type": "string", "description": "URL to a textured humanoid GLB file (preferred over inputTaskId)" }, "heightMeters": { "type": "number", "description": "Approximate character height in meters (default 1.7)" } } },
    outputSchema: { "type": "object", "properties": { "glbUrl": { "type": "string" }, "fbxUrl": { "type": "string" }, "objUrl": { "type": "string" }, "usdzUrl": { "type": "string" }, "thumbnailUrl": { "type": "string" }, "textureUrls": { "type": "array", "items": { "type": "object", "properties": {}, "required": [] } }, "animations": { "type": "array", "items": { "type": "object", "properties": { "name": { "type": "string" }, "glbUrl": { "type": "string" }, "fbxUrl": { "type": "string" } }, "required": ["name"] } }, "providerTaskId": { "type": "string" } }, "required": ["glbUrl"] }
  },
  "meshyTextTo3d": {
    stepType: "meshyTextTo3d",
    description: "Generate a 3D model preview from a text prompt using Meshy. Produces an untextured mesh (preview stage).",
    usageNotes: "- Creates a text-to-3D preview task (mesh generation only, no texture).\n- Use the Meshy Texture step to apply textures to the preview.\n- Maximum prompt length is 600 characters.",
    inputSchema: { "type": "object", "properties": { "prompt": { "type": "string", "description": "Description of the 3D model to generate (max 600 characters)" }, "modelType": { "type": "string", "description": '"standard" (default) or "lowpoly". Lowpoly ignores topology/target_polycount.' }, "topology": { "type": "string", "description": '"triangle" (default) or "quad"' }, "targetPolycount": { "type": "number", "description": "Target polygon count (default 30000, range 100-300000)" }, "symmetryMode": { "type": "string", "description": 'Symmetry mode: "auto" (default), "off", or "on"' }, "poseMode": { "type": "string", "description": 'Pose mode: "a-pose", "t-pose", or "" (default, no specific pose)' } }, "required": ["prompt"] },
    outputSchema: { "type": "object", "properties": { "glbUrl": { "type": "string" }, "fbxUrl": { "type": "string" }, "objUrl": { "type": "string" }, "usdzUrl": { "type": "string" }, "thumbnailUrl": { "type": "string" }, "textureUrls": { "type": "array", "items": { "type": "object", "properties": {}, "required": [] } }, "animations": { "type": "array", "items": { "type": "object", "properties": { "name": { "type": "string" }, "glbUrl": { "type": "string" }, "fbxUrl": { "type": "string" } }, "required": ["name"] } }, "providerTaskId": { "type": "string" } }, "required": ["glbUrl"] }
  },
  "meshyTexture": {
    stepType: "meshyTexture",
    description: "Apply or replace textures on a 3D model using a text prompt or reference image via Meshy.",
    usageNotes: "- Provide either an input task ID (from a previous Meshy step) or a model URL.\n- Provide either a text style prompt or an image style URL to guide texturing.\n- Supports .glb, .gltf, .obj, .fbx, .stl model formats when using modelUrl.\n- By default preserves original UVs (enableOriginalUv = true).\n- Works with any model source: text-to-3D previews, image-to-3D, remeshed models, or external files.",
    inputSchema: { "type": "object", "properties": { "inputTaskId": { "type": "string", "description": "ID of a completed Meshy task to texture" }, "modelUrl": { "type": "string", "description": "URL to a 3D model file (.glb, .gltf, .obj, .fbx, .stl)" }, "textStylePrompt": { "type": "string", "description": "Text description of desired texture style (max 600 characters)" }, "imageStyleUrl": { "type": "string", "description": "2D image URL to guide texturing (.jpg, .jpeg, .png)" }, "enableOriginalUv": { "type": "boolean", "description": "Preserve original UV mapping (default true)" }, "enablePbr": { "type": "boolean", "description": "Generate PBR maps (metallic, roughness, normal). Default false." } } },
    outputSchema: { "type": "object", "properties": { "glbUrl": { "type": "string" }, "fbxUrl": { "type": "string" }, "objUrl": { "type": "string" }, "usdzUrl": { "type": "string" }, "thumbnailUrl": { "type": "string" }, "textureUrls": { "type": "array", "items": { "type": "object", "properties": {}, "required": [] } }, "animations": { "type": "array", "items": { "type": "object", "properties": { "name": { "type": "string" }, "glbUrl": { "type": "string" }, "fbxUrl": { "type": "string" } }, "required": ["name"] } }, "providerTaskId": { "type": "string" } }, "required": ["glbUrl"] }
  },
  "mixAudioIntoVideo": {
    stepType: "mixAudioIntoVideo",
    description: "Mix an audio track into a video",
    usageNotes: "",
    inputSchema: { "type": "object", "properties": { "videoUrl": { "type": "string", "description": "URL of the source video" }, "audioUrl": { "type": "string", "description": "URL of the audio track to mix into the video" }, "options": { "type": "object", "properties": { "keepVideoAudio": { "type": "boolean", "description": "When true, preserves the original video audio alongside the new track. Defaults to false." }, "audioGainDb": { "type": "number", "description": "Volume adjustment for the new audio track in decibels. Defaults to 0." }, "videoGainDb": { "type": "number", "description": "Volume adjustment for the existing video audio in decibels. Defaults to 0." }, "loopAudio": { "type": "boolean", "description": "When true, loops the audio track to match the video duration. Defaults to false." } }, "description": "Audio mixing options" }, "intermediateAsset": { "type": "boolean", "description": "When true, the asset is created but hidden from the user's gallery (tagged as intermediate)" } }, "required": ["videoUrl", "audioUrl", "options"] },
    outputSchema: { "type": "object", "properties": { "videoUrl": { "type": "string", "description": "URL of the video with the mixed audio track" } }, "required": ["videoUrl"] }
  },
  "muteVideo": {
    stepType: "muteVideo",
    description: "Mute a video file",
    usageNotes: "",
    inputSchema: { "type": "object", "properties": { "videoUrl": { "type": "string", "description": "URL of the source video to mute" }, "intermediateAsset": { "type": "boolean", "description": "When true, the asset is created but hidden from the user's gallery (tagged as intermediate)" } }, "required": ["videoUrl"] },
    outputSchema: { "type": "object", "properties": { "videoUrl": { "type": "string", "description": "URL of the muted video" } }, "required": ["videoUrl"] }
  },
  "n8nRunNode": {
    stepType: "n8nRunNode",
    description: "Trigger an n8n workflow node via webhook and return the response.",
    usageNotes: "- The webhook URL must be configured in your n8n workflow.\n- Supports GET and POST methods with optional Basic authentication.\n- For GET requests, input values are sent as query parameters. For POST, they are sent as JSON body.",
    inputSchema: { "type": "object", "properties": { "method": { "type": "string", "description": "HTTP method to use (GET or POST)" }, "authentication": { "enum": ["none", "basic", "string"], "type": "string", "description": "Authentication type for the webhook request" }, "user": { "type": "string", "description": "Username for Basic authentication" }, "password": { "type": "string", "description": "Password for Basic authentication" }, "webhookUrl": { "type": "string", "description": "n8n webhook URL for the workflow node" }, "input": { "type": "object", "properties": {}, "required": [], "description": "Key-value pairs sent as query params (GET) or JSON body (POST)" } }, "required": ["method", "authentication", "user", "password", "webhookUrl", "input"] },
    outputSchema: { "type": "object", "properties": { "data": { "description": "Response from the n8n node (JSON or string depending on node configuration)" } }, "required": ["data"] }
  },
  "notionCreatePage": {
    stepType: "notionCreatePage",
    description: "Create a new page in Notion as a child of an existing page.",
    usageNotes: "- Requires a Notion OAuth connection (connectionId).\n- Content is provided as markdown and converted to Notion blocks (headings, paragraphs, lists, code, quotes).\n- The page is created as a child of the specified parent page (pageId).",
    inputSchema: { "type": "object", "properties": { "pageId": { "type": "string", "description": "Parent page ID to create the new page under" }, "content": { "type": "string", "description": "Page content in markdown format" }, "title": { "type": "string", "description": "Page title" }, "connectionId": { "type": "string", "description": "Notion OAuth connection ID" } }, "required": ["pageId", "content", "title"] },
    outputSchema: { "type": "object", "properties": { "pageId": { "type": "string", "description": "Notion page ID of the created page" }, "pageUrl": { "type": "string", "description": "URL to view the page in Notion" } }, "required": ["pageId", "pageUrl"] }
  },
  "notionUpdatePage": {
    stepType: "notionUpdatePage",
    description: "Update the content of an existing Notion page.",
    usageNotes: '- Requires a Notion OAuth connection (connectionId).\n- Content is provided as markdown and converted to Notion blocks.\n- "append" mode adds content to the end of the page. "overwrite" mode deletes all existing blocks first.',
    inputSchema: { "type": "object", "properties": { "pageId": { "type": "string", "description": "Notion page ID to update" }, "content": { "type": "string", "description": "New content in markdown format" }, "mode": { "enum": ["append", "overwrite"], "type": "string", "description": "How to apply the content: 'append' adds to end, 'overwrite' replaces all existing content" }, "connectionId": { "type": "string", "description": "Notion OAuth connection ID" } }, "required": ["pageId", "content", "mode"] },
    outputSchema: { "type": "object", "properties": { "pageId": { "type": "string", "description": "Notion page ID of the updated page" }, "pageUrl": { "type": "string", "description": "URL to view the page in Notion" } }, "required": ["pageId", "pageUrl"] }
  },
  "particlePodcastsFindMentions": {
    stepType: "particlePodcastsFindMentions",
    description: "Find every dialogue line mentioning a specific entity or company across all podcasts.",
    usageNotes: "- Provide `entityId` (for people, products, places) OR `companyId` (for organizations). At least one is required.\n- Use `contextLines` to include surrounding dialogue with each mention (default behavior is set by Particle).\n- Resolve a name to an `entityId` / `companyId` first via Search Companies (or by inspecting a Search Dialogue response).\n- Cursor-paginated; expect potentially large result sets for popular entities.",
    inputSchema: { "type": "object", "properties": { "entityId": { "type": "string", "description": "Knowledge-graph entity ID (person, product, place, etc.)" }, "companyId": { "type": "string", "description": "Company ID" }, "contextLines": { "type": "number", "description": "Surrounding dialogue lines to include with each mention" }, "limit": { "type": "number", "description": "Max results, up to 100" }, "cursor": { "type": "string", "description": "Pagination cursor" } } },
    outputSchema: { "type": "string" }
  },
  "particlePodcastsGetEpisode": {
    stepType: "particlePodcastsGetEpisode",
    description: "Fetch full metadata for a single episode: details, speakers, entities, clips, and ads \u2014 merged into one response.",
    usageNotes: "- Pass an episode ID or slug as `id`.\n- Returns five sub-resources merged: `episode` (metadata), `speakers` (diarized speaker list), `entities` (knowledge-graph mentions), `clips` (AI-extracted highlights), `ads` (detected ad spots).\n- Use Get Episode Transcript separately when you need the full transcript text \u2014 it isn't bundled here because the payload is large and has its own format/range options.\n- Bills as 5 units against the get-episode event type (one per sub-call).",
    inputSchema: { "type": "object", "properties": { "id": { "type": "string", "description": "Episode ID or slug" } }, "required": ["id"] },
    outputSchema: { "type": "string" }
  },
  "particlePodcastsGetEpisodeTranscript": {
    stepType: "particlePodcastsGetEpisodeTranscript",
    description: "Fetch the diarized transcript for an episode in dialogue, plain text, or SRT subtitle format.",
    usageNotes: '- Pass an episode ID or slug as `id`.\n- Use `format` = "dialogue" (default, with speaker turns), "text" (plain), or "srt" (subtitle).\n- Filter to a single speaker with `speaker`, or to a time range with `start` / `end` (seconds).\n- Transcripts are large \u2014 prefer time-range filtering when you only need a snippet.',
    inputSchema: { "type": "object", "properties": { "id": { "type": "string", "description": "Episode ID or slug" }, "format": { "enum": ["dialogue", "text", "srt"], "type": "string", "description": "Transcript format" }, "speaker": { "type": "string", "description": "Filter to a single speaker" }, "start": { "type": "number", "description": "Start time in seconds" }, "end": { "type": "number", "description": "End time in seconds" } }, "required": ["id"] },
    outputSchema: { "type": "string" }
  },
  "particlePodcastsSearchCompanies": {
    stepType: "particlePodcastsSearchCompanies",
    description: "Search the Particle knowledge graph for companies by name, ticker, domain, CIK, or QID.",
    usageNotes: '- Provide one or more identifiers: `q` (free-text name), `ticker` (e.g. "TSLA"), `domain` (e.g. "tesla.com"), `cik` (SEC), or `qid` (Wikidata).\n- Use this to resolve a company name to a canonical `companyId` for use with Find Mentions or Search Dialogue.\n- Returned company objects include slugs, domains, and IDs \u2014 any of these can be passed to downstream blocks.',
    inputSchema: { "type": "object", "properties": { "q": { "type": "string", "description": "Free-text company name" }, "ticker": { "type": "string", "description": "Stock ticker" }, "domain": { "type": "string", "description": "Company domain" }, "cik": { "type": "string", "description": "SEC CIK" }, "qid": { "type": "string", "description": "Wikidata QID" }, "entityId": { "type": "string", "description": "Knowledge-graph entity ID" }, "updatedAfter": { "type": "string", "description": "Only include companies updated after this ISO timestamp" }, "limit": { "type": "number", "description": "Max results" }, "cursor": { "type": "string", "description": "Pagination cursor" } } },
    outputSchema: { "type": "string" }
  },
  "particlePodcastsSearchDialogue": {
    stepType: "particlePodcastsSearchDialogue",
    description: "Search across podcast dialogue using semantic or keyword search. Returns matched lines grouped by episode.",
    usageNotes: '- Provide `semanticSearch` for meaning-based discovery ("find moments where someone talks about market timing") or `keywordSearch` for exact phrase/proper-noun matching. At least one must be provided.\n- Filter to a specific entity or company by passing `entityId` / `companyId`.\n- Each returned dialogue line carries the source episode + speaker so you can chain to Get Episode or Get Episode Transcript for context.\n- Cursor-paginated.',
    inputSchema: { "type": "object", "properties": { "semanticSearch": { "type": "string", "description": "Meaning-based dialogue search" }, "keywordSearch": { "type": "string", "description": "Exact-phrase dialogue search" }, "entityId": { "type": "string", "description": "Restrict to dialogue mentioning this entity" }, "companyId": { "type": "string", "description": "Restrict to dialogue mentioning this company" }, "limit": { "type": "number", "description": "Max results, up to 100" }, "cursor": { "type": "string", "description": "Pagination cursor" } } },
    outputSchema: { "type": "string" }
  },
  "particlePodcastsSearchPodcasts": {
    stepType: "particlePodcastsSearchPodcasts",
    description: "Search and list podcasts in the Particle catalog by keyword, topic, or language.",
    usageNotes: '- Use `q` for free-text keyword search across podcast titles and descriptions.\n- Use `topic` to filter to a Particle taxonomy topic.\n- Use `language` (BCP 47, e.g. "en") to restrict to a language.\n- Returns podcast objects with canonical IDs and slugs. Pass either to other Particle Podcasts blocks.\n- Cursor-paginated; pass the returned `cursor` back to `cursor` for the next page.',
    inputSchema: { "type": "object", "properties": { "q": { "type": "string", "description": "Free-text query across podcast title and description" }, "topic": { "type": "string", "description": "Particle taxonomy topic slug" }, "language": { "type": "string", "description": "BCP 47 language code" }, "suitabilityTier": { "type": "string", "description": "Brand-suitability tier filter" }, "limit": { "type": "number", "description": "Max results, up to 100" }, "cursor": { "type": "string", "description": "Pagination cursor" } } },
    outputSchema: { "type": "string" }
  },
  "peopleSearch": {
    stepType: "peopleSearch",
    description: "Search for people matching specific criteria using Apollo.io. Supports natural language queries and advanced filters.",
    usageNotes: '- Can use a natural language "smartQuery" which is converted to Apollo search parameters by an AI model.\n- Advanced params can override or supplement the smart query results.\n- Optionally enriches returned people and/or their organizations for additional detail.\n- Results are paginated. Use limit and page to control the result window.',
    inputSchema: { "type": "object", "properties": { "smartQuery": { "type": "string", "description": 'Natural language search query (e.g. "marketing directors at SaaS companies in NYC")' }, "enrichPeople": { "type": "boolean", "description": "Whether to enrich each result with full contact details" }, "enrichOrganizations": { "type": "boolean", "description": "Whether to enrich each result with full company details" }, "limit": { "type": "string", "description": "Maximum number of results to return" }, "page": { "type": "string", "description": "Page number for pagination" }, "params": { "type": "object", "properties": { "personTitles": { "type": "string", "description": "Job titles to search for (comma-separated)" }, "includeSimilarTitles": { "type": "string", "description": "Whether to include similar/related job titles" }, "qKeywords": { "type": "string", "description": "Keywords to search for in person profiles" }, "personLocations": { "type": "string", "description": "Geographic locations of people (comma-separated)" }, "personSeniorities": { "type": "string", "description": "Seniority levels to filter by (comma-separated)" }, "organizationLocations": { "type": "string", "description": "Geographic locations of organizations (comma-separated)" }, "qOrganizationDomainsList": { "type": "string", "description": "Organization domains to filter by (comma-separated)" }, "contactEmailStatus": { "type": "string", "description": "Email verification status filter" }, "organizationNumEmployeesRanges": { "type": "string", "description": 'Employee count ranges as semicolon-separated pairs (e.g. "1,10; 250,500")' }, "revenueRangeMin": { "type": "string", "description": "Minimum annual revenue filter" }, "revenueRangeMax": { "type": "string", "description": "Maximum annual revenue filter" }, "currentlyUsingAllOfTechnologyUids": { "type": "string", "description": "Technology UIDs the organization must use (all required)" }, "currentlyUsingAnyOfTechnologyUids": { "type": "string", "description": "Technology UIDs the organization uses (any match)" }, "currentlyNotUsingAnyOfTechnologyUids": { "type": "string", "description": "Technology UIDs the organization must not use" } }, "required": ["personTitles", "includeSimilarTitles", "qKeywords", "personLocations", "personSeniorities", "organizationLocations", "qOrganizationDomainsList", "contactEmailStatus", "organizationNumEmployeesRanges", "revenueRangeMin", "revenueRangeMax", "currentlyUsingAllOfTechnologyUids", "currentlyUsingAnyOfTechnologyUids", "currentlyNotUsingAnyOfTechnologyUids"], "description": "Advanced search filter parameters" } }, "required": ["smartQuery", "enrichPeople", "enrichOrganizations", "limit", "page", "params"] },
    outputSchema: { "type": "object", "properties": { "results": { "description": "Apollo search results with matched people and optionally enriched data" } }, "required": ["results"] }
  },
  "postToLinkedIn": {
    stepType: "postToLinkedIn",
    description: "Create a post on LinkedIn from the connected account.",
    usageNotes: "- Requires a LinkedIn OAuth connection (connectionId).\n- Supports text posts, image posts, video posts, document posts, and article posts.\n- Attach one media type per post: image, video, document, or article.\n- Documents support PDF, PPT, PPTX, DOC, DOCX (max 100MB, 300 pages). Displays as a slideshow carousel.\n- Articles create a link preview with optional custom title, description, and thumbnail.\n- Visibility controls who can see the post.",
    inputSchema: { "type": "object", "properties": { "message": { "type": "string", "description": "The text content of the LinkedIn post" }, "visibility": { "enum": ["PUBLIC", "CONNECTIONS"], "type": "string", "description": 'Who can see the post: "PUBLIC" or "CONNECTIONS"' }, "imageUrl": { "type": "string", "description": "URL of an image to attach to the post" }, "videoUrl": { "type": "string", "description": "URL of a video to attach to the post" }, "documentUrl": { "type": "string", "description": "URL of a document (PDF, PPT, DOC) to attach to the post" }, "articleUrl": { "type": "string", "description": "URL to share as an article link preview" }, "titleText": { "type": "string", "description": "Title text for media or article attachments" }, "descriptionText": { "type": "string", "description": "Description text for article attachments" }, "connectionId": { "type": "string", "description": "LinkedIn OAuth connection ID" } }, "required": ["message", "visibility"] },
    outputSchema: { "description": "This step does not produce output data." }
  },
  "postToSlackChannel": {
    stepType: "postToSlackChannel",
    description: "Send a message to a Slack channel via a connected bot.",
    usageNotes: "- The user is responsible for connecting their Slack workspace and selecting the channel\n- Supports both simple text messages and slack blocks messages\n- Text messages can use limited markdown (slack-only fomatting\u2014e.g., headers are just rendered as bold)",
    inputSchema: { "type": "object", "properties": { "channelId": { "type": "string", "description": "Slack channel ID (leave empty to allow user to select a channel)" }, "messageType": { "enum": ["string", "blocks"], "type": "string", "description": 'Message format: "string" for plain text/markdown, "blocks" for Slack Block Kit JSON' }, "message": { "type": "string", "description": 'Message content (plain text/markdown for "string" type, or JSON for "blocks" type)' }, "connectionId": { "type": "string", "description": "Slack OAuth connection ID (leave empty to allow user to select)" } }, "required": ["channelId", "messageType", "message"] },
    outputSchema: { "description": "This step does not produce output data." }
  },
  "postToX": {
    stepType: "postToX",
    description: "Create a post on X (Twitter) from the connected account.",
    usageNotes: "- Requires an X OAuth connection (connectionId).\n- Maximum 280 characters of text.\n- Optionally attach up to 4 media items (images, GIFs, or videos) via mediaUrls.\n- Media URLs must be publicly accessible. The service fetches and uploads them to X.\n- Supported formats: JPEG, PNG, GIF, WEBP, MP4. Images up to 5MB, videos up to 512MB.",
    inputSchema: { "type": "object", "properties": { "text": { "type": "string", "description": "The text content of the post (max 280 characters)" }, "connectionId": { "type": "string", "description": "X (Twitter) OAuth connection ID" }, "mediaUrls": { "type": "array", "items": { "type": "string" }, "description": "Up to 4 URLs of images, GIFs, or videos to attach to the post" } }, "required": ["text"] },
    outputSchema: { "description": "This step does not produce output data." }
  },
  "postToZapier": {
    stepType: "postToZapier",
    description: "Send data to a Zapier Zap via webhook and return the response.",
    usageNotes: "- The webhook URL must be configured in the Zapier Zap settings\n- Input keys and values are sent as the JSON body of the POST request\n- The webhook response (JSON or plain text) is returned as the output",
    inputSchema: { "type": "object", "properties": { "webhookUrl": { "type": "string", "description": "Zapier webhook URL to send data to" }, "input": { "type": "object", "properties": {}, "required": [], "description": "Key-value pairs to send as the JSON POST body" } }, "required": ["webhookUrl", "input"] },
    outputSchema: { "type": "object", "properties": { "data": { "description": "Parsed webhook response from Zapier (JSON object, array, or string)" } }, "required": ["data"] }
  },
  "queryAppDatabase": {
    stepType: "queryAppDatabase",
    description: "Execute a SQL query against the app managed database.",
    usageNotes: '- Executes raw SQL against a SQLite database managed by the app.\n- For SELECT queries, returns rows as JSON.\n- For INSERT/UPDATE/DELETE, returns the number of affected rows.\n- Use {{variables}} directly in your SQL. By default they are automatically extracted\n  and passed as safe parameterized values (preventing SQL injection).\n  Example: INSERT INTO contacts (name, comment) VALUES ({{name}}, {{comment}})\n- Full MindStudio handlebars syntax is supported, including helpers like {{json myVar}},\n  {{get myVar "$.path"}}, {{global.orgName}}, etc.\n- Set parameterize to false for raw/dynamic SQL where variables are interpolated directly\n  into the query string. Use this when another step generates full or partial SQL, e.g.\n  a bulk INSERT with a precomputed VALUES list. The user is responsible for sanitization\n  when parameterize is false.',
    inputSchema: { "type": "object", "properties": { "databaseId": { "type": "string", "description": "Name or ID of the app data database to query" }, "sql": { "type": "string", "description": "SQL query to execute. Use {{variables}} directly in the SQL \u2014 they are handled according to the `parameterize` setting.\n\nWhen parameterize is true (default):   {{variables}} are extracted from the SQL, replaced with ? placeholders,   resolved via the full MindStudio handlebars pipeline, and passed as safe   parameterized values to SQLite. This prevents SQL injection.   Example: INSERT INTO contacts (name, email) VALUES ({{name}}, {{email}})\n\nWhen parameterize is false:   The entire SQL string is resolved via compileString (standard handlebars   interpolation) and executed as-is. Use this for dynamic/generated SQL   where another step builds the query. The user is responsible for safety.   Example: {{generatedInsertQuery}}\n\nAsk the user for the database schema if they have not already provided it." }, "parameterize": { "type": "boolean", "description": "Whether to treat {{variables}} as parameterized query values (default: true).\n\n- true:  {{vars}} are extracted, replaced with ?, and passed as bind params.          Safe from SQL injection. Use for standard CRUD operations.\n- false: {{vars}} are interpolated directly into the SQL string via handlebars.          Use when another step generates full or partial SQL (e.g. bulk inserts          with precomputed VALUES). The user is responsible for sanitization." } }, "required": ["databaseId", "sql"] },
    outputSchema: { "type": "object", "properties": { "rows": { "type": "array", "items": {}, "description": "Result rows for SELECT queries (empty array for write queries)" }, "changes": { "type": "number", "description": "Number of rows affected by INSERT, UPDATE, or DELETE queries (0 for SELECT)" } }, "required": ["rows", "changes"] }
  },
  "queryDataSource": {
    stepType: "queryDataSource",
    description: "Legacy v1 data sources. v2 apps should use `dataSources.defineDataSource()` from @mindstudio-ai/agent instead, which owns parsing, chunking, embedding and citations. Search a vector data source (RAG) and return relevant document chunks.",
    usageNotes: "- Queries a vectorized data source and returns the most relevant chunks.\n- Useful for retrieval-augmented generation (RAG) workflows.",
    inputSchema: { "type": "object", "properties": { "dataSourceId": { "type": "string", "description": "ID of the vector data source to query" }, "query": { "type": "string", "description": "The search query to run against the data source" }, "maxResults": { "type": "number", "description": "Maximum number of chunks to return (recommended 1-3)" } }, "required": ["dataSourceId", "query", "maxResults"] },
    outputSchema: { "type": "object", "properties": { "text": { "type": "string", "description": "All matching chunks joined with newlines" }, "chunks": { "type": "array", "items": { "type": "string" }, "description": "Individual matching text chunks from the data source" }, "query": { "type": "string", "description": "The resolved search query that was executed" }, "citations": { "type": "array", "items": {}, "description": "Source citations for the matched chunks" }, "latencyMs": { "type": "number", "description": "Query execution time in milliseconds" } }, "required": ["text", "chunks", "query", "citations", "latencyMs"] }
  },
  "queryExternalDatabase": {
    stepType: "queryExternalDatabase",
    description: "Execute a SQL query against an external database connected to the workspace.",
    usageNotes: "- Requires a database connection configured in the workspace.\n- Supports PostgreSQL (including Supabase), MySQL, and MSSQL.\n- Results can be returned as JSON or CSV.",
    inputSchema: { "type": "object", "properties": { "connectionId": { "type": "string", "description": "Database connection ID configured in the workspace" }, "query": { "type": "string", "description": "SQL query to execute (supports variable interpolation)" }, "outputFormat": { "enum": ["json", "csv"], "type": "string", "description": "Output format for the result variable" } }, "required": ["query", "outputFormat"], "description": "Configuration for the external database query step" },
    outputSchema: { "type": "object", "properties": { "data": { "description": "Query result rows (array of objects for JSON, CSV string for CSV format)" } }, "required": ["data"] }
  },
  "redactPII": {
    stepType: "redactPII",
    description: "Replace personally identifiable information in text with placeholders using Microsoft Presidio.",
    usageNotes: '- PII is replaced with entity type placeholders (e.g. "Call me at <PHONE_NUMBER>").\n- If entities is empty, returns empty text immediately without processing.',
    inputSchema: { "type": "object", "properties": { "input": { "type": "string", "description": "Text to redact PII from" }, "language": { "type": "string", "description": 'Language code of the input text (e.g. "en")' }, "entities": { "type": "array", "items": { "type": "string" }, "description": 'PII entity types to redact (e.g. ["PHONE_NUMBER", "EMAIL_ADDRESS"]). Empty array means nothing is redacted.' } }, "required": ["input", "language", "entities"] },
    outputSchema: { "type": "object", "properties": { "text": { "type": "string", "description": 'The input text with detected PII replaced by entity type placeholders (e.g. "<PHONE_NUMBER>")' } }, "required": ["text"] }
  },
  "removeBackgroundFromImage": {
    stepType: "removeBackgroundFromImage",
    description: "Remove the background from an image using AI, producing a transparent PNG.",
    usageNotes: `- Uses the Bria background removal model via fal.ai by default.
- Uses WaveSpeed's Ideogram background removal model when type is "advanced".
- Output is re-hosted on the CDN as a PNG with transparency.`,
    inputSchema: { "type": "object", "properties": { "type": { "enum": ["standard", "advanced"], "type": "string", "description": "Background removal quality tier" }, "imageUrl": { "type": "string", "description": "URL of the source image to remove the background from" }, "autoCrop": { "type": "boolean", "description": "Whether to automatically trim transparent padding from the result, on by default" } }, "required": ["imageUrl"] },
    outputSchema: { "type": "object", "properties": { "imageUrl": { "type": "string", "description": "CDN URL of the image with background removed (transparent PNG)" } }, "required": ["imageUrl"] }
  },
  "replyToGmailEmail": {
    stepType: "replyToGmailEmail",
    description: "Reply to an existing email in Gmail. The reply is threaded under the original message.",
    usageNotes: '- Requires a Google OAuth connection with Gmail compose and readonly scopes.\n- The reply is sent to the original sender and threaded under the original message.\n- messageType controls the body format: "plain", "html", or "markdown".',
    inputSchema: { "type": "object", "properties": { "messageId": { "type": "string", "description": "Gmail message ID to reply to" }, "message": { "type": "string", "description": "Reply body content" }, "messageType": { "enum": ["plain", "html", "markdown"], "type": "string", "description": 'Body format: "plain", "html", or "markdown"' }, "connectionId": { "type": "string", "description": "Google OAuth connection ID" } }, "required": ["messageId", "message", "messageType"] },
    outputSchema: { "type": "object", "properties": { "messageId": { "type": "string", "description": "Gmail message ID of the sent reply" } }, "required": ["messageId"] }
  },
  "resizeVideo": {
    stepType: "resizeVideo",
    description: "Resize a video file",
    usageNotes: "",
    inputSchema: { "type": "object", "properties": { "videoUrl": { "type": "string", "description": "URL of the source video to resize" }, "mode": { "enum": ["fit", "exact"], "type": "string", "description": "Resize mode: 'fit' scales within max dimensions, 'exact' forces exact dimensions" }, "maxWidth": { "type": "number", "description": "Maximum width in pixels (used with 'fit' mode)" }, "maxHeight": { "type": "number", "description": "Maximum height in pixels (used with 'fit' mode)" }, "width": { "type": "number", "description": "Exact width in pixels (used with 'exact' mode)" }, "height": { "type": "number", "description": "Exact height in pixels (used with 'exact' mode)" }, "strategy": { "enum": ["pad", "crop"], "type": "string", "description": "Strategy for handling aspect ratio mismatch in 'exact' mode" }, "intermediateAsset": { "type": "boolean", "description": "When true, the asset is created but hidden from the user's gallery (tagged as intermediate)" } }, "required": ["videoUrl", "mode"] },
    outputSchema: { "type": "object", "properties": { "videoUrl": { "type": "string", "description": "URL of the resized video" } }, "required": ["videoUrl"] }
  },
  "runFromConnectorRegistry": {
    stepType: "runFromConnectorRegistry",
    description: "Run a raw API connector to a third-party service",
    usageNotes: '- Use the /developer/v2/helpers/connectors endpoint to list available services and actions.\n- Use /developer/v2/helpers/connectors/{serviceId}/{actionId} to get the full input configuration for an action.\n- Use /developer/v2/helpers/connections to list your available OAuth connections.\n- The actionId format is "serviceId/actionId" (e.g., "slack/send-message").\n- Pass a __connectionId to authenticate the request with a specific OAuth connection, otherwise the default will be used (if configured).',
    inputSchema: { "type": "object", "properties": { "actionId": { "type": "string", "description": "The connector action identifier in the format serviceId/actionId" }, "displayName": { "type": "string", "description": "Human-readable name of the connector action" }, "icon": { "type": "string", "description": "Icon URL for the connector" }, "configurationValues": { "type": "object", "properties": {}, "required": [], "description": "Key-value configuration parameters for the connector action" }, "__connectionId": { "type": "string", "description": "OAuth connection ID used to authenticate the connector request" } }, "required": ["actionId", "displayName", "icon", "configurationValues"], "description": "Configuration for the connector registry step" },
    outputSchema: { "type": "object", "properties": { "data": { "type": "object", "properties": {}, "required": [], "description": "Key-value map of output variables set by the connector" } }, "required": ["data"] }
  },
  "runPackagedWorkflow": {
    stepType: "runPackagedWorkflow",
    description: 'Run a packaged workflow ("custom block")',
    usageNotes: `- From the user's perspective, packaged workflows are just ordinary blocks. Behind the scenes, they operate like packages/libraries in a programming language, letting the user execute custom functionality.
- Some of these packaged workflows are available as part of MindStudio's "Standard Library" and available to every user.
- Available packaged workflows are documented here as individual blocks, but the runPackagedWorkflow block is how they need to be wrapped in order to be executed correctly.`,
    inputSchema: { "type": "object", "properties": { "appId": { "type": "string", "description": "The app ID of the packaged workflow source" }, "workflowId": { "type": "string", "description": "The source workflow ID to execute" }, "inputVariables": { "type": "object", "properties": {}, "required": [], "description": "Variables to pass as input to the packaged workflow" }, "outputVariables": { "type": "object", "properties": {}, "required": [], "description": "Variables to capture from the packaged workflow output" }, "name": { "type": "string", "description": "Display name of the packaged workflow" } }, "required": ["appId", "workflowId", "inputVariables", "outputVariables", "name"], "description": "Configuration for the packaged workflow step" },
    outputSchema: { "type": "object", "properties": { "data": { "description": "The result data returned from the packaged workflow" } }, "required": ["data"] }
  },
  "scrapeLinkedInCompany": {
    stepType: "scrapeLinkedInCompany",
    description: "Scrape public company data from a LinkedIn company page.",
    usageNotes: "- Requires a LinkedIn company URL (e.g. https://www.linkedin.com/company/mindstudioai).\n- Returns structured company data including description, employees, updates, and similar companies.",
    inputSchema: { "type": "object", "properties": { "url": { "type": "string", "description": "LinkedIn company page URL (e.g. https://www.linkedin.com/company/mindstudioai)" } }, "required": ["url"] },
    outputSchema: { "type": "object", "properties": { "company": { "description": "Scraped LinkedIn company data" } }, "required": ["company"] }
  },
  "scrapeLinkedInProfile": {
    stepType: "scrapeLinkedInProfile",
    description: "Scrape public profile data from a LinkedIn profile page.",
    usageNotes: "- Requires a LinkedIn profile URL (e.g. https://www.linkedin.com/in/username).\n- Returns structured profile data including experience, education, articles, and activities.",
    inputSchema: { "type": "object", "properties": { "url": { "type": "string", "description": "LinkedIn profile URL (e.g. https://www.linkedin.com/in/username)" } }, "required": ["url"] },
    outputSchema: { "type": "object", "properties": { "profile": { "description": "Scraped LinkedIn profile data" } }, "required": ["profile"] }
  },
  "scrapeUrl": {
    stepType: "scrapeUrl",
    description: "Extract text, HTML, or structured content from one or more web pages.",
    usageNotes: '- Accepts a single URL or multiple URLs (as a JSON array, comma-separated, or newline-separated).\n- Output format controls the result shape: "text" returns markdown, "html" returns raw HTML, "json" returns structured scraper data, "summary" returns a model-written summary and requires the "firecrawl" service.\n- Can optionally capture a screenshot of each page.\n- Handles bot protection automatically; no proxy or rendering configuration is needed.',
    inputSchema: { "type": "object", "properties": { "url": { "type": "string", "description": "URL(s) to scrape. Accepts a single URL, JSON array, or comma/newline-separated list" }, "service": { "enum": ["default", "firecrawl"], "type": "string", "description": "Scraping service to use" }, "autoEnhance": { "type": "boolean", "description": "No longer selects a provider \u2014 the default service's anti-bot engine decides per request how hard to work. Retained because existing workflows set it and the builder still renders it." }, "outputFormat": { "enum": ["text", "json", "html", "summary"], "type": "string", "description": "Output format: text returns markdown, html returns raw HTML, json returns structured scraper data, summary returns a model-written summary (Firecrawl only)" }, "pageOptions": { "type": "object", "properties": { "onlyMainContent": { "type": "boolean", "description": "Whether to extract only the main content of the page, excluding navigation, footers, etc." }, "screenshot": { "type": "boolean", "description": "Whether to capture a screenshot of the page" }, "waitFor": { "type": "number", "description": "Milliseconds to wait before scraping (0 for immediate)" }, "replaceAllPathsWithAbsolutePaths": { "type": "boolean", "description": "Whether to convert relative URLs to absolute URLs in the result" }, "headers": { "type": "object", "properties": {}, "required": [], "description": "Custom HTTP request headers as key-value pairs" }, "removeTags": { "type": "array", "items": { "type": "string" }, "description": "HTML tags to remove from the scraped result" }, "mobile": { "type": "boolean", "description": "Whether to scrape using a mobile user-agent" } }, "required": ["onlyMainContent", "screenshot", "waitFor", "replaceAllPathsWithAbsolutePaths", "headers", "removeTags", "mobile"], "description": "Page-level scraping options (content filtering, screenshots, headers, etc.)" } }, "required": ["url"] },
    outputSchema: { "type": "object", "properties": { "content": { "anyOf": [{ "type": "string" }, { "type": "array", "items": { "type": "string" } }, { "type": "object", "properties": { "text": { "type": "string", "description": "Markdown/plain-text content of the scraped page" }, "html": { "type": "string", "description": "Raw HTML content of the scraped page" }, "json": { "type": "object", "properties": {}, "required": [], "description": "Structured data extracted from the page" }, "screenshotUrl": { "type": "string", "description": "Screenshot URL of the page (if requested)" }, "metadata": { "type": "object", "properties": { "title": { "type": "string", "description": "Page title" }, "description": { "type": "string", "description": "Page meta description" }, "url": { "type": "string", "description": "Canonical URL" }, "image": { "type": "string", "description": "Open Graph image URL" } }, "required": ["title", "description", "url", "image"], "description": "Page metadata (Open Graph / meta tags)" }, "error": { "type": "object", "properties": { "code": { "type": "string" }, "message": { "type": "string" } }, "required": ["code", "message"], "description": "Set when the scrape failed. `text`/`html` still carry the human-readable error so existing callers behave as before, but callers that care \u2014 billing, in particular \u2014 can tell a failure from real page content." }, "costUnits": { "type": "number", "description": "What the provider actually charged, when it tells us. Scrapfly returns an exact per-request credit total that varies with how hard the target fought back (6 for an unprotected page, 80 for Glassdoor), so billing a flat rate would either overcharge the easy case or eat the hard one. Providers that report nothing leave this undefined and fall back to the route's estimate.\n\nIncludes every attempt made on the caller's behalf, not just the last one." } }, "required": ["text", "html"] }, { "type": "array", "items": { "type": "object", "properties": { "text": { "type": "string", "description": "Markdown/plain-text content of the scraped page" }, "html": { "type": "string", "description": "Raw HTML content of the scraped page" }, "json": { "type": "object", "properties": {}, "required": [], "description": "Structured data extracted from the page" }, "screenshotUrl": { "type": "string", "description": "Screenshot URL of the page (if requested)" }, "metadata": { "type": "object", "properties": { "title": { "type": "string", "description": "Page title" }, "description": { "type": "string", "description": "Page meta description" }, "url": { "type": "string", "description": "Canonical URL" }, "image": { "type": "string", "description": "Open Graph image URL" } }, "required": ["title", "description", "url", "image"], "description": "Page metadata (Open Graph / meta tags)" }, "error": { "type": "object", "properties": { "code": { "type": "string" }, "message": { "type": "string" } }, "required": ["code", "message"], "description": "Set when the scrape failed. `text`/`html` still carry the human-readable error so existing callers behave as before, but callers that care \u2014 billing, in particular \u2014 can tell a failure from real page content." }, "costUnits": { "type": "number", "description": "What the provider actually charged, when it tells us. Scrapfly returns an exact per-request credit total that varies with how hard the target fought back (6 for an unprotected page, 80 for Glassdoor), so billing a flat rate would either overcharge the easy case or eat the hard one. Providers that report nothing leave this undefined and fall back to the route's estimate.\n\nIncludes every attempt made on the caller's behalf, not just the last one." } }, "required": ["text", "html"] } }] }, "screenshot": { "anyOf": [{ "type": "string" }, { "type": "array", "items": { "type": "string" } }] } }, "required": ["content"] }
  },
  "scrapeXPost": {
    stepType: "scrapeXPost",
    description: "Scrape data from a single X (Twitter) post by URL.",
    usageNotes: "- Returns structured post data (text, html, optional json/screenshot/metadata).\n- Optionally saves the text content to a variable.",
    inputSchema: { "type": "object", "properties": { "url": { "type": "string", "description": "Full URL to the X post (e.g. https://x.com/elonmusk/status/1655608985058267139)" } }, "required": ["url"] },
    outputSchema: { "type": "object", "properties": { "post": { "type": "object", "properties": { "text": { "type": "string", "description": "Markdown/plain-text content of the scraped page" }, "html": { "type": "string", "description": "Raw HTML content of the scraped page" }, "json": { "type": "object", "properties": {}, "required": [], "description": "Structured data extracted from the page" }, "screenshotUrl": { "type": "string", "description": "Screenshot URL of the page (if requested)" }, "metadata": { "type": "object", "properties": { "title": { "type": "string", "description": "Page title" }, "description": { "type": "string", "description": "Page meta description" }, "url": { "type": "string", "description": "Canonical URL" }, "image": { "type": "string", "description": "Open Graph image URL" } }, "required": ["title", "description", "url", "image"], "description": "Page metadata (Open Graph / meta tags)" }, "error": { "type": "object", "properties": { "code": { "type": "string" }, "message": { "type": "string" } }, "required": ["code", "message"], "description": "Set when the scrape failed. `text`/`html` still carry the human-readable error so existing callers behave as before, but callers that care \u2014 billing, in particular \u2014 can tell a failure from real page content." }, "costUnits": { "type": "number", "description": "What the provider actually charged, when it tells us. Scrapfly returns an exact per-request credit total that varies with how hard the target fought back (6 for an unprotected page, 80 for Glassdoor), so billing a flat rate would either overcharge the easy case or eat the hard one. Providers that report nothing leave this undefined and fall back to the route's estimate.\n\nIncludes every attempt made on the caller's behalf, not just the last one." } }, "required": ["text", "html"], "description": "Scraped post data including text, HTML, and optional structured JSON" } }, "required": ["post"] }
  },
  "scrapeXProfile": {
    stepType: "scrapeXProfile",
    description: "Scrape public profile data from an X (Twitter) account by URL.",
    usageNotes: "- Returns structured profile data.\n- Optionally saves the result to a variable.",
    inputSchema: { "type": "object", "properties": { "url": { "type": "string", "description": "Full URL or username for the X profile (e.g. https://x.com/elonmusk)" } }, "required": ["url"] },
    outputSchema: { "type": "object", "properties": { "profile": { "type": "object", "properties": { "text": { "type": "string", "description": "Markdown/plain-text content of the scraped page" }, "html": { "type": "string", "description": "Raw HTML content of the scraped page" }, "json": { "type": "object", "properties": {}, "required": [], "description": "Structured data extracted from the page" }, "screenshotUrl": { "type": "string", "description": "Screenshot URL of the page (if requested)" }, "metadata": { "type": "object", "properties": { "title": { "type": "string", "description": "Page title" }, "description": { "type": "string", "description": "Page meta description" }, "url": { "type": "string", "description": "Canonical URL" }, "image": { "type": "string", "description": "Open Graph image URL" } }, "required": ["title", "description", "url", "image"], "description": "Page metadata (Open Graph / meta tags)" }, "error": { "type": "object", "properties": { "code": { "type": "string" }, "message": { "type": "string" } }, "required": ["code", "message"], "description": "Set when the scrape failed. `text`/`html` still carry the human-readable error so existing callers behave as before, but callers that care \u2014 billing, in particular \u2014 can tell a failure from real page content." }, "costUnits": { "type": "number", "description": "What the provider actually charged, when it tells us. Scrapfly returns an exact per-request credit total that varies with how hard the target fought back (6 for an unprotected page, 80 for Glassdoor), so billing a flat rate would either overcharge the easy case or eat the hard one. Providers that report nothing leave this undefined and fall back to the route's estimate.\n\nIncludes every attempt made on the caller's behalf, not just the last one." } }, "required": ["text", "html"], "description": "Scraped profile data including text, HTML, and optional structured JSON" } }, "required": ["profile"] }
  },
  "screenshotUrl": {
    stepType: "screenshotUrl",
    description: "Capture a screenshot of a web page as a PNG image.",
    usageNotes: "- Takes a viewport or full-page screenshot of the given URL.\n- Returns a CDN-hosted PNG image URL.\n- Viewport mode captures only the visible area; fullPage captures the entire scrollable page.\n- You can customize viewport width/height, add a delay, or wait for a CSS selector before capturing.",
    inputSchema: { "type": "object", "properties": { "url": { "type": "string", "description": "URL to screenshot" }, "mode": { "enum": ["viewport", "fullPage"], "type": "string", "description": "Screenshot mode: viewport captures visible area, fullPage captures entire page" }, "width": { "type": "number", "description": "Viewport width in pixels (default: 1280)" }, "height": { "type": "number", "description": "Viewport height in pixels (default: 800, ignored for fullPage mode)" }, "delay": { "type": "number", "description": "Milliseconds to wait before capturing (default: 0)" }, "waitFor": { "type": "string", "description": "CSS selector to wait for before capturing" } }, "required": ["url"] },
    outputSchema: { "type": "object", "properties": { "screenshotUrl": { "type": "string" } }, "required": ["screenshotUrl"] }
  },
  "searchGmailEmails": {
    stepType: "searchGmailEmails",
    description: "Search for emails in the connected Gmail account using a Gmail search query. To list recent inbox emails, pass an empty query string.",
    usageNotes: '- Requires a Google OAuth connection with Gmail readonly scope.\n- Uses Gmail search syntax (e.g. "from:user@example.com", "subject:invoice", "is:unread").\n- To list recent inbox emails, use an empty query string or "in:inbox".\n- Returns up to 100 emails (default 5). The variable receives text or JSON depending on exportType.\n- The direct execution output always returns structured email objects.',
    inputSchema: { "type": "object", "properties": { "query": { "type": "string", "description": 'Gmail search query (e.g. "from:user@example.com", "subject:invoice", "is:unread")' }, "connectionId": { "type": "string", "description": "Google OAuth connection ID" }, "exportType": { "enum": ["json", "text"], "type": "string", "description": 'Format for the variable output: "json" or "text"' }, "limit": { "type": "string", "description": "Maximum number of emails to return (1-10, default: 5)" } }, "required": ["query", "exportType", "limit"] },
    outputSchema: { "type": "object", "properties": { "emails": { "type": "array", "items": { "type": "object", "properties": { "id": { "type": "string", "description": "Gmail message ID" }, "subject": { "type": "string", "description": "Email subject line" }, "from": { "type": "string", "description": "Sender email address" }, "to": { "type": "string", "description": "Recipient email address" }, "date": { "type": "string", "description": "Email date" }, "plainBody": { "type": "string", "description": "Plain text body content" }, "htmlBody": { "type": "string", "description": "HTML body content (if available)" }, "labels": { "type": "string", "description": "Comma-separated label IDs applied to the email" } }, "required": ["id", "subject", "from", "to", "date", "plainBody", "htmlBody", "labels"] }, "description": "List of matching email messages" } }, "required": ["emails"] }
  },
  "searchGoogle": {
    stepType: "searchGoogle",
    description: "Search the web using Google and return structured results.",
    usageNotes: "- Defaults to us/english, but can optionally specify country and/or language.\n- Defaults to any time, but can optionally specify last hour, last day, week, month, or year.\n- Defaults to top 30 results, but can specify 1 to 100 results to return.",
    inputSchema: { "type": "object", "properties": { "query": { "type": "string", "description": "The search query to send to Google" }, "exportType": { "enum": ["text", "json"], "type": "string", "description": 'Format for the variable value: "text" or "json"' }, "countryCode": { "type": "string", "description": "Google gl country code (defaults to US)" }, "languageCode": { "type": "string", "description": 'Google hl language code (defaults to "en")' }, "dateRange": { "enum": ["hour", "day", "week", "month", "year", "any"], "type": "string", "description": 'Time range filter: "hour", "day", "week", "month", "year", or "any"' }, "numResults": { "type": "number", "description": "Number of results to return (1-100, default: 30)" } }, "required": ["query", "exportType"] },
    outputSchema: { "type": "object", "properties": { "results": { "type": "array", "items": { "type": "object", "properties": { "title": { "type": "string", "description": "Title of the search result" }, "description": { "type": "string", "description": "Snippet/description of the search result" }, "url": { "type": "string", "description": "URL of the search result page" } }, "required": ["title", "description", "url"] }, "description": "List of search result entries" } }, "required": ["results"] }
  },
  "searchGoogleCalendarEvents": {
    stepType: "searchGoogleCalendarEvents",
    description: "Search for events in a Google Calendar by keyword, date range, or both.",
    usageNotes: '- Requires a Google OAuth connection with Calendar events scope.\n- Supports keyword search via "query" and date filtering via "timeMin"/"timeMax" (ISO 8601 format).\n- Unlike "List Events" which only shows future events, this allows searching past events too.',
    inputSchema: { "type": "object", "properties": { "query": { "type": "string", "description": "Text search term" }, "timeMin": { "type": "string", "description": "Start of time range (ISO 8601)" }, "timeMax": { "type": "string", "description": "End of time range (ISO 8601)" }, "calendarId": { "type": "string", "description": 'Calendar ID (defaults to "primary")' }, "limit": { "type": "number", "description": "Maximum number of events to return (default: 10)" }, "exportType": { "enum": ["json", "text"], "type": "string", "description": 'Format for the variable output: "json" or "text"' }, "connectionId": { "type": "string", "description": "Google OAuth connection ID" } }, "required": ["exportType"] },
    outputSchema: { "type": "object", "properties": { "events": { "type": "array", "items": { "type": "object", "properties": { "id": { "type": "string", "description": "Google Calendar event ID" }, "status": { "type": "string", "description": 'Event status (e.g. "confirmed", "tentative", "cancelled")' }, "htmlLink": { "type": "string", "description": "URL to view the event in Google Calendar" }, "created": { "type": "string", "description": "Timestamp when the event was created" }, "updated": { "type": "string", "description": "Timestamp when the event was last updated" }, "summary": { "type": "string", "description": "Event title" }, "description": { "type": "string", "description": "Event description" }, "location": { "type": "string", "description": "Event location" }, "organizer": { "anyOf": [{ "type": "object", "properties": { "displayName": { "type": "string" }, "email": { "type": "string" } } }, { "type": "null" }] }, "start": { "anyOf": [{ "type": "object", "properties": { "dateTime": { "type": "string" }, "timeZone": { "type": "string" } } }, { "type": "null" }] }, "end": { "anyOf": [{ "type": "object", "properties": { "dateTime": { "type": "string" }, "timeZone": { "type": "string" } } }, { "type": "null" }] }, "attendees": { "anyOf": [{ "type": "array", "items": { "type": "object", "properties": { "displayName": { "type": "string" }, "email": { "type": "string" }, "responseStatus": { "type": "string" } } } }, { "type": "null" }] } } }, "description": "List of matching calendar events" } }, "required": ["events"] }
  },
  "searchGoogleDrive": {
    stepType: "searchGoogleDrive",
    description: "Search for files in Google Drive by keyword.",
    usageNotes: "- Requires a Google OAuth connection with Drive scope.\n- Searches file content and names using Google Drive's fullText search.",
    inputSchema: { "type": "object", "properties": { "query": { "type": "string", "description": "Search keyword" }, "limit": { "type": "number", "description": "Max files to return (default: 20)" }, "connectionId": { "type": "string", "description": "Google OAuth connection ID" }, "exportType": { "enum": ["json", "text"], "type": "string", "description": 'Format for the variable output: "json" or "text"' } }, "required": ["query", "exportType"] },
    outputSchema: { "type": "object", "properties": { "files": { "type": "array", "items": { "type": "object", "properties": { "id": { "type": "string" }, "name": { "type": "string" }, "mimeType": { "type": "string" }, "size": { "type": "string" }, "webViewLink": { "type": "string" }, "createdTime": { "type": "string" }, "modifiedTime": { "type": "string" } }, "required": ["id", "name", "mimeType", "size", "webViewLink", "createdTime", "modifiedTime"] }, "description": "List of matching files" } }, "required": ["files"] }
  },
  "searchGoogleImages": {
    stepType: "searchGoogleImages",
    description: "Search Google Images and return image results with URLs and metadata.",
    usageNotes: "- Defaults to us/english, but can optionally specify country and/or language.\n- Defaults to any time, but can optionally specify last hour, last day, week, month, or year.\n- Defaults to top 30 results, but can specify 1 to 100 results to return.",
    inputSchema: { "type": "object", "properties": { "query": { "type": "string", "description": "The image search query" }, "exportType": { "enum": ["text", "json"], "type": "string", "description": 'Format for the variable value: "text" or "json"' }, "countryCode": { "type": "string", "description": "Google gl country code (defaults to US)" }, "languageCode": { "type": "string", "description": 'Google hl language code (defaults to "en")' }, "dateRange": { "enum": ["hour", "day", "week", "month", "year", "any"], "type": "string", "description": 'Time range filter: "hour", "day", "week", "month", "year", or "any"' }, "numResults": { "type": "number", "description": "Number of results to return (1-100, default: 30)" } }, "required": ["query", "exportType"] },
    outputSchema: { "type": "object", "properties": { "images": { "type": "array", "items": { "type": "object", "properties": { "title": { "type": "string", "description": "Title/alt text of the image" }, "imageUrl": { "type": "string", "description": "Direct URL of the full-size image" }, "imageWidth": { "type": "number", "description": "Width of the full-size image in pixels" }, "imageHeight": { "type": "number", "description": "Height of the full-size image in pixels" }, "thumbnailUrl": { "type": "string", "description": "URL of the thumbnail image" }, "thumbnailWidth": { "type": "number", "description": "Width of the thumbnail in pixels" }, "thumbnailHeight": { "type": "number", "description": "Height of the thumbnail in pixels" }, "source": { "type": "string", "description": "Source website name" }, "domain": { "type": "string", "description": "Domain of the source website" }, "link": { "type": "string", "description": "URL of the page containing the image" }, "googleUrl": { "type": "string", "description": "Google Images URL for this result" }, "position": { "type": "number", "description": "Position/rank of this result in the search results" } }, "required": ["title", "imageUrl", "imageWidth", "imageHeight", "thumbnailUrl", "thumbnailWidth", "thumbnailHeight", "source", "domain", "link", "googleUrl", "position"] }, "description": "List of image search results with URLs and metadata" } }, "required": ["images"] }
  },
  "searchGoogleNews": {
    stepType: "searchGoogleNews",
    description: "Search Google News for recent news articles matching a query.",
    usageNotes: "- Defaults to top 30 results, but can specify 1 to 100 results to return.",
    inputSchema: { "type": "object", "properties": { "text": { "type": "string", "description": "The news search query" }, "exportType": { "enum": ["text", "json"], "type": "string", "description": 'Format for the variable value: "text" or "json"' }, "numResults": { "type": "number", "description": "Number of results to return (1-100, default: 30)" } }, "required": ["text", "exportType"] },
    outputSchema: { "type": "object", "properties": { "articles": { "type": "array", "items": { "type": "object", "properties": { "title": { "type": "string", "description": "Headline of the news article" }, "link": { "type": "string", "description": "URL to the full article" }, "date": { "type": "string", "description": "Publication date of the article" }, "source": { "type": "object", "properties": { "name": { "type": "string", "description": "Name of the news source" } }, "required": ["name"], "description": "Source publication" }, "snippet": { "type": "string", "description": "Brief excerpt or summary of the article" } }, "required": ["title", "link", "date", "source"] }, "description": "List of matching news articles" } }, "required": ["articles"] }
  },
  "searchGoogleTrends": {
    stepType: "searchGoogleTrends",
    description: "Fetch Google Trends data for a search term.",
    usageNotes: '- date accepts shorthand ("now 1-H", "today 1-m", "today 5-y", etc.) or custom "yyyy-mm-dd yyyy-mm-dd" ranges.\n- data_type controls the shape of returned data: TIMESERIES, GEO_MAP, GEO_MAP_0, RELATED_TOPICS, or RELATED_QUERIES.',
    inputSchema: { "type": "object", "properties": { "text": { "type": "string", "description": "The search term to look up on Google Trends" }, "hl": { "type": "string", "description": 'Language code (e.g. "en")' }, "geo": { "type": "string", "description": "Geographic region: empty string for worldwide, or a two-letter country code" }, "data_type": { "enum": ["TIMESERIES", "GEO_MAP", "GEO_MAP_0", "RELATED_TOPICS", "RELATED_QUERIES"], "type": "string", "description": "Type of trend data to return" }, "cat": { "type": "string", "description": 'Category filter ("0" for all categories)' }, "date": { "type": "string", "description": 'Date range for trend data. Available options:   - "now 1-H" - Past hour   - "now 4-H" - Past 4 hours   - "now 1-d" - Past day   - "now 7-d" - Past 7 days   - "today 1-m" - Past 30 days   - "today 3-m" - Past 90 days   - "today 12-m" - Past 12 months   - "today 5-y" - Past 5 years   - "all - 2004" - present   - You can also pass custom values: "yyyy-mm-dd yyyy-mm-dd"' }, "ts": { "type": "string", "description": "Timezone offset in minutes (-1439 to 1439, default: 420 for PDT)" } }, "required": ["text", "hl", "geo", "data_type", "cat", "date", "ts"] },
    outputSchema: { "type": "object", "properties": { "trends": { "type": "object", "properties": {}, "required": [], "description": "Google Trends data for the searched term" } }, "required": ["trends"] }
  },
  "searchPerplexity": {
    stepType: "searchPerplexity",
    description: "Search the web using the Perplexity API and return structured results.",
    usageNotes: "- Defaults to US results. Use countryCode (ISO code) to filter by country.\n- Returns 10 results by default, configurable from 1 to 20.\n- The variable receives text or JSON depending on exportType. The direct execution output always returns structured results.",
    inputSchema: { "type": "object", "properties": { "query": { "type": "string", "description": "Search query to send to Perplexity" }, "exportType": { "enum": ["text", "json"], "type": "string", "description": "Output format for the variable: plain text or structured JSON" }, "countryCode": { "type": "string", "description": 'ISO country code to filter results by region (e.g. "us", "gb")' }, "numResults": { "type": "number", "description": "Number of results to return (1-20, default: 10)" } }, "required": ["query", "exportType"] },
    outputSchema: { "type": "object", "properties": { "results": { "type": "array", "items": { "type": "object", "properties": { "title": { "type": "string", "description": "Page title of the search result" }, "description": { "type": "string", "description": "Snippet or description of the search result" }, "url": { "type": "string", "description": "URL of the search result page" } }, "required": ["title", "description", "url"] }, "description": "List of structured search results" } }, "required": ["results"] }
  },
  "searchXPosts": {
    stepType: "searchXPosts",
    description: "Search recent X (Twitter) posts matching a query.",
    usageNotes: "- Searches only the past 7 days of posts.\n- Query supports X API v2 search operators (up to 512 characters).\n\nAvailable search operators in query:\n\n| Operator         | Description                                      |\n| -----------------| -------------------------------------------------|\n| from:            | Posts from a specific user (e.g., from:elonmusk) |\n| to:              | Posts sent to a specific user (e.g., to:NASA)    |\n| @                | Mentions a user (e.g., @openai)                  |\n| #                | Hashtag search (e.g., #AI)                       |\n| is:retweet       | Filters retweets                                 |\n| is:reply         | Filters replies                                  |\n| has:media        | Posts containing media (images, videos, or GIFs) |\n| has:links        | Posts containing URLs                            |\n| lang:            | Filters by language (e.g., lang:en)              |\n| -                | Excludes specific terms (e.g., -spam)            |\n| ()               | Groups terms or operators (e.g., (AI OR ML))     |\n| AND, OR, NOT     | Boolean logic for combining or excluding terms   |\n\nConjunction-Required Operators (must be combined with a standalone operator):\n\n| Operator     | Description                                    |\n| ------------ | -----------------------------------------------|\n| has:media  | Posts containing media (images, videos, or GIFs) |\n| has:links  | Posts containing URLs                            |\n| is:retweet | Filters retweets                                 |\n| is:reply   | Filters replies                                  |\n\nFor example, has:media alone is invalid, but #AI has:media is valid.",
    inputSchema: { "type": "object", "properties": { "query": { "type": "string", "description": "Search query (max 512 chars, supports X API v2 search operators)" }, "scope": { "enum": ["recent", "all"], "type": "string", "description": 'Search scope: "recent" for past 7 days or "all" for full archive' }, "options": { "type": "object", "properties": { "startTime": { "type": "string", "description": "ISO 8601 date; only return posts after this time" }, "endTime": { "type": "string", "description": "ISO 8601 date; only return posts before this time" }, "maxResults": { "type": "number", "description": "Number of results to return (default: 50, max: 100)" } }, "description": "Additional search options" } }, "required": ["query", "scope", "options"] },
    outputSchema: { "type": "object", "properties": { "posts": { "type": "array", "items": { "type": "object", "properties": { "id": { "type": "string", "description": "Unique post identifier" }, "authorId": { "type": "string", "description": "Author's X user ID" }, "dateCreated": { "type": "string", "description": "ISO 8601 timestamp when the post was created" }, "text": { "type": "string", "description": "Text content of the post" }, "stats": { "type": "object", "properties": { "retweets": { "type": "number", "description": "Number of retweets/reposts" }, "replies": { "type": "number", "description": "Number of replies" }, "likes": { "type": "number", "description": "Number of likes" } }, "required": ["retweets", "replies", "likes"], "description": "Engagement statistics for the post" } }, "required": ["id", "authorId", "dateCreated", "text", "stats"] }, "description": "List of matching X posts" } }, "required": ["posts"] }
  },
  "searchYoutube": {
    stepType: "searchYoutube",
    description: "Search for YouTube videos by keyword.",
    usageNotes: "- Supports pagination (up to 5 pages) and country/language filters.\n- Use the filter/filterType fields for YouTube search parameter (sp) filters.",
    inputSchema: { "type": "object", "properties": { "query": { "type": "string", "description": "Search query for YouTube videos" }, "limitPages": { "type": "string", "description": "Maximum number of pages to fetch (1-5)" }, "filter": { "type": "string", "description": "YouTube search parameter (sp) filter value" }, "filterType": { "type": "string", "description": "Filter type identifier" }, "countryCode": { "type": "string", "description": 'Google gl country code for regional results (default: "US")' }, "languageCode": { "type": "string", "description": 'Google hl language code for result language (default: "en")' } }, "required": ["query", "limitPages", "filter", "filterType"] },
    outputSchema: { "type": "object", "properties": { "results": { "type": "object", "properties": {}, "required": [], "description": "YouTube search results including video_results, channel_results, etc." } }, "required": ["results"] }
  },
  "searchYoutubeTrends": {
    stepType: "searchYoutubeTrends",
    description: "Retrieve trending videos on YouTube by category and region.",
    usageNotes: '- Categories: "now" (trending now), "music", "gaming", "films".\n- Supports country and language filtering.',
    inputSchema: { "type": "object", "properties": { "bp": { "enum": ["now", "music", "gaming", "films"], "type": "string", "description": 'Trending category: "now" (trending now), "music", "gaming", or "films"' }, "hl": { "type": "string", "description": 'Language code (e.g. "en")' }, "gl": { "type": "string", "description": 'Country code (e.g. "US")' } }, "required": ["bp", "hl", "gl"] },
    outputSchema: { "type": "object", "properties": {}, "required": [] }
  },
  "sendEmail": {
    stepType: "sendEmail",
    description: "Send an email to one or more recipient addresses.",
    usageNotes: `- Use the "to" field to send to one or more specific recipient email addresses directly. Allowed recipients depend on the sender: when the app sends from a domain it owns (a verified custom domain or its <slug>.madewithremy.com subdomain) any recipient is allowed; when it falls back to the shared Remy address, recipients must be verified app users or members of the app's organization. (v1 apps cannot use a direct "to" \u2014 they must resolve recipients via a connection.)
- Alternatively, recipient email addresses can be resolved from OAuth connections configured by the app creator via connectionId. The user running the workflow does not specify the recipient directly.
- Use "cc" and "bcc" to add visible / hidden recipients (a string or an array). They are subject to the same recipient rules as "to".
- "to" is optional only in the sense that recipients can come from elsewhere \u2014 omit it and supply "cc"/"bcc" for a hidden-list send, or omit all three and recipients are resolved from an OAuth connection. Naming nobody at all is an error.
- Bcc-only sends are supported: with no "to" or "cc", the To: header is addressed to the app's own sender address (the standard "undisclosed recipients" pattern) so recipients can't see each other. The returned "recipients" reflects that auto-filled address.
- Every recipient counts toward the app's daily outbound cap, including cc and bcc.
- The sender defaults automatically: v2 apps send from the app's own identity \u2014 its verified custom domain if set, else its platform subdomain (noreply@<slug>.madewithremy.com), else the default Remy address.
- Optionally set "from" to a custom handle, but ONLY if the app has a custom domain or subdomain: a bare handle ("support" \u2192 support@<app-domain>), a full "support@your-domain.com", or "Name <support@your-domain.com>". The domain must be one the app owns, or the step fails.
- If the body is a URL to a hosted HTML file on the CDN, the HTML is fetched and used as the email body.
- The body is interpreted automatically: if it already looks like HTML it is sent as HTML, otherwise it is rendered from Markdown. Every email is sent as multipart with a plain-text alternative auto-derived from the body (better deliverability).
- Set bodyType to override interpretation: "html" (send as-is), "markdown" (render to HTML), or "text" (plain text only, no HTML part). Default is "auto".
- Optionally set "text" to supply your own plain-text alternative instead of the auto-derived one.
- Use "attachments" to attach files by URL. Each entry is a URL string, or an object { url, filename?, contentType? } to control the attachment's displayed filename and MIME type.
- When generateHtml is enabled, the body text is converted to a styled HTML email using an AI model (implies an HTML body).
- Set replyTo to control the Reply-To address for replies.
- For threaded replies in a shared inbox, set inReplyTo (the Message-ID being replied to) and references (prior Message-IDs in the thread).
- connectionId can be a comma-separated list to send to multiple recipients.
- The special connectionId "trigger_email" uses the email address that triggered the workflow.`,
    inputSchema: { "type": "object", "properties": { "subject": { "type": "string", "description": "Email subject line" }, "body": { "type": "string", "description": "Email body content (plain text, markdown, HTML, or a CDN URL to an HTML file)" }, "to": { "anyOf": [{ "type": "string" }, { "type": "array", "items": { "type": "string" } }] }, "cc": { "anyOf": [{ "type": "string" }, { "type": "array", "items": { "type": "string" } }] }, "bcc": { "anyOf": [{ "type": "string" }, { "type": "array", "items": { "type": "string" } }] }, "connectionId": { "type": "string", "description": "OAuth connection ID(s) for the recipient(s), comma-separated for multiple" }, "generateHtml": { "type": "boolean", "description": "When true, auto-convert the body text into a styled HTML email using AI" }, "generateHtmlInstructions": { "type": "string", "description": "Natural language instructions for the HTML generation style" }, "generateHtmlModelOverride": { "type": "object", "properties": { "model": { "type": "string", "description": 'Model identifier (e.g. "gpt-4", "claude-3-opus")' }, "temperature": { "type": "number", "description": "Sampling temperature for the model (0-2)" }, "maxResponseTokens": { "type": "number", "description": "Maximum number of tokens in the model's response" }, "ignorePreamble": { "type": "boolean", "description": "Whether to skip the system preamble/instructions" }, "userMessagePreprocessor": { "type": "object", "properties": { "dataSource": { "type": "string", "description": "Data source identifier for the preprocessor" }, "messageTemplate": { "type": "string", "description": "Template string applied to user messages before sending to the model" }, "maxResults": { "type": "number", "description": "Maximum number of results to include from the data source" }, "enabled": { "type": "boolean", "description": "Whether the preprocessor is active" }, "shouldInherit": { "type": "boolean", "description": "Whether child steps should inherit this preprocessor configuration" } }, "description": "Preprocessor applied to user messages before sending to the model" }, "preamble": { "type": "string", "description": "System preamble/instructions for the model" }, "multiModelEnabled": { "type": "boolean", "description": "Whether multi-model candidate generation is enabled" }, "editResponseEnabled": { "type": "boolean", "description": "Whether the user can edit the model's response" }, "config": { "type": "object", "properties": {}, "required": [], "description": "Additional model-specific configuration" } }, "required": ["model", "temperature", "maxResponseTokens"], "description": "Model settings override for HTML generation" }, "attachments": { "type": "array", "items": { "anyOf": [{ "type": "string" }, { "type": "object", "properties": { "url": { "type": "string" }, "filename": { "type": "string" }, "contentType": { "type": "string" } }, "required": ["url"] }] }, "description": "Files to attach: each entry is a URL string, or an object `{ url, filename?, contentType? }` to control the displayed filename and MIME type." }, "from": { "type": "string", "description": "Custom sender handle \u2014 only for apps with a custom domain or subdomain. Bare handle (`support`), full `support@your-domain.com`, or `Name <support@your-domain.com>`. Must resolve to a domain the app owns." }, "bodyType": { "enum": ["auto", "html", "markdown", "text"], "type": "string", "description": "How to interpret `body`: `auto` (default \u2014 detect HTML, else render markdown), `html` (send as-is), `markdown` (render to HTML), or `text` (send as plain text only, no HTML part). Every send includes a text/plain alternative." }, "text": { "type": "string", "description": "Explicit text/plain alternative body. Auto-derived from `body` if omitted." }, "replyTo": { "type": "string", "description": "Reply-To address for the email." }, "inReplyTo": { "type": "string", "description": "Message-ID this email replies to, for inbox threading (In-Reply-To header)." }, "references": { "type": "array", "items": { "type": "string" }, "description": "Prior Message-IDs in the thread, for inbox threading (References header)." } }, "required": ["subject", "body"] },
    outputSchema: { "type": "object", "properties": { "recipients": { "type": "array", "items": { "type": "string" }, "description": "To addresses the message was sent to." }, "cc": { "type": "array", "items": { "type": "string" }, "description": "Cc addresses on the message (empty if none)." }, "bcc": { "type": "array", "items": { "type": "string" }, "description": "Bcc addresses on the message (empty if none)." }, "from": { "type": "string", "description": "The resolved sender address the message went out as (auto-selected when no `from` is given)." } }, "required": ["recipients", "cc", "bcc", "from"] }
  },
  "sendGmailDraft": {
    stepType: "sendGmailDraft",
    description: "Send an existing draft from the connected Gmail account.",
    usageNotes: "- Requires a Google OAuth connection with Gmail compose scope.\n- The draft is sent and removed from the Drafts folder.\n- Use the draft ID returned by the Create Gmail Draft or List Gmail Drafts steps.",
    inputSchema: { "type": "object", "properties": { "draftId": { "type": "string", "description": "Gmail draft ID to send" }, "connectionId": { "type": "string", "description": "Google OAuth connection ID" } }, "required": ["draftId"] },
    outputSchema: { "description": "This step does not produce output data." }
  },
  "sendGmailMessage": {
    stepType: "sendGmailMessage",
    description: "Send an email from the connected Gmail account.",
    usageNotes: '- Requires a Google OAuth connection with Gmail compose scope.\n- messageType controls the body format: "plain" for plain text, "html" for raw HTML, "markdown" for auto-converted markdown.',
    inputSchema: { "type": "object", "properties": { "to": { "type": "string", "description": "Recipient email address(es), comma-separated for multiple" }, "subject": { "type": "string", "description": "Email subject line" }, "message": { "type": "string", "description": "Email body content" }, "connectionId": { "type": "string", "description": "Google OAuth connection ID" }, "messageType": { "enum": ["plain", "html", "markdown"], "type": "string", "description": 'Body format: "plain", "html", or "markdown"' } }, "required": ["to", "subject", "message", "messageType"] },
    outputSchema: { "type": "object", "properties": { "messageId": { "type": "string", "description": "Gmail message ID of the sent email" } }, "required": ["messageId"] }
  },
  "sendSlackDirectMessage": {
    stepType: "sendSlackDirectMessage",
    description: "Send a direct message to a Slack user via a connected bot.",
    usageNotes: "- The user is responsible for connecting their Slack workspace\n- The recipient is identified by their Slack user ID\n- Supports both simple text messages and Slack blocks messages\n- Text messages can use limited markdown (slack-only formatting\u2014e.g., headers are just rendered as bold)",
    inputSchema: { "type": "object", "properties": { "slackUserId": { "type": "string", "description": "Slack user ID of the recipient" }, "messageType": { "enum": ["string", "blocks"], "type": "string", "description": 'Message format: "string" for plain text/markdown, "blocks" for Slack Block Kit JSON' }, "message": { "type": "string", "description": 'Message content (plain text/markdown for "string" type, or JSON for "blocks" type)' }, "connectionId": { "type": "string", "description": "Slack OAuth connection ID (leave empty to allow user to select)" } }, "required": ["slackUserId", "messageType", "message"] },
    outputSchema: { "description": "This step does not produce output data." }
  },
  "sendSMS": {
    stepType: "sendSMS",
    description: "Send an SMS or MMS message to a phone number configured via OAuth connection.",
    usageNotes: "- User is responsible for configuring the connection to the number (MindStudio requires double opt-in to prevent spam)\n- If mediaUrls are provided, the message is sent as MMS instead of SMS\n- MMS supports up to 10 media URLs (images, video, audio, PDF) with a 5MB limit per file\n- MMS is only supported on US and Canadian carriers; international numbers will receive SMS only (media silently dropped)",
    inputSchema: { "type": "object", "properties": { "body": { "type": "string", "description": "SMS message body text" }, "connectionId": { "type": "string", "description": "OAuth connection ID for the recipient phone number" }, "mediaUrls": { "type": "array", "items": { "type": "string" }, "description": "Optional array of media URLs to send as MMS (up to 10, 5MB each)" } }, "required": ["body"] },
    outputSchema: { "description": "This step does not produce output data." }
  },
  "setGmailReadStatus": {
    stepType: "setGmailReadStatus",
    description: "Mark one or more Gmail emails as read or unread.",
    usageNotes: "- Requires a Google OAuth connection with Gmail modify scope.\n- Accepts one or more message IDs as a comma-separated string or array.\n- Set markAsRead to true to mark as read, false to mark as unread.",
    inputSchema: { "type": "object", "properties": { "messageIds": { "type": "string", "description": "Gmail message ID(s), comma-separated" }, "markAsRead": { "type": "boolean", "description": "true = mark as read, false = mark as unread" }, "connectionId": { "type": "string", "description": "Google OAuth connection ID" } }, "required": ["messageIds", "markAsRead"] },
    outputSchema: { "description": "This step does not produce output data." }
  },
  "setRunTitle": {
    stepType: "setRunTitle",
    description: "Set the title of the agent run for the user's history",
    usageNotes: "",
    inputSchema: { "type": "object", "properties": { "title": { "type": "string", "description": "The title to assign to the agent run (supports variable interpolation)" } }, "required": ["title"], "description": "Configuration for the set run title step" },
    outputSchema: { "description": "This step does not produce output data." }
  },
  "setVariable": {
    stepType: "setVariable",
    description: "Explicitly set a variable to a given value.",
    usageNotes: "- Useful for bootstrapping global variables or setting constants.\n- The variable name and value both support variable interpolation.\n- The type field is a UI hint only (controls input widget in the editor).",
    inputSchema: { "type": "object", "properties": { "value": { "anyOf": [{ "type": "string" }, { "type": "array", "items": { "type": "string" } }] } }, "required": ["value"], "description": "Configuration for the set variable step" },
    outputSchema: { "type": "object", "properties": {}, "required": [] }
  },
  "telegramEditMessage": {
    stepType: "telegramEditMessage",
    description: "Edit a previously sent Telegram message. Use with the message ID returned by Send Telegram Message.",
    usageNotes: '- Only text messages sent by the bot can be edited.\n- The messageId is returned by the Send Telegram Message step.\n- Common pattern: send a "Processing..." message, do work, then edit it with the result.',
    inputSchema: { "type": "object", "properties": { "botToken": { "type": "string", "description": 'Telegram bot token in "botId:token" format' }, "chatId": { "type": "string", "description": "Telegram chat ID containing the message" }, "messageId": { "type": "string", "description": "ID of the message to edit" }, "text": { "type": "string", "description": "New message text (MarkdownV2 formatting supported)" } }, "required": ["botToken", "chatId", "messageId", "text"] },
    outputSchema: { "description": "This step does not produce output data." }
  },
  "telegramReplyToMessage": {
    stepType: "telegramReplyToMessage",
    description: "Send a reply to a specific Telegram message. The reply will be visually threaded in the chat.",
    usageNotes: "- Use the rawMessage.message_id from the incoming trigger variables to reply to the user's message.\n- Especially useful in group chats where replies provide context.\n- Returns the sent message ID, which can be used with Edit Telegram Message.",
    inputSchema: { "type": "object", "properties": { "botToken": { "type": "string", "description": 'Telegram bot token in "botId:token" format' }, "chatId": { "type": "string", "description": "Telegram chat ID to send the reply to" }, "replyToMessageId": { "type": "string", "description": "ID of the message to reply to" }, "text": { "type": "string", "description": "Reply text (MarkdownV2 formatting supported)" } }, "required": ["botToken", "chatId", "replyToMessageId", "text"] },
    outputSchema: { "type": "object", "properties": { "messageId": { "type": "number", "description": "ID of the sent reply message" } }, "required": ["messageId"] }
  },
  "telegramSendAudio": {
    stepType: "telegramSendAudio",
    description: "Send an audio file to a Telegram chat as music or a voice note via a bot.",
    usageNotes: '- "audio" mode sends as a standard audio file. "voice" mode sends as a voice message (re-uploads the file for large file support).',
    inputSchema: { "type": "object", "properties": { "botToken": { "type": "string", "description": 'Telegram bot token in "botId:token" format' }, "chatId": { "type": "string", "description": "Telegram chat ID to send the audio to" }, "audioUrl": { "type": "string", "description": "URL of the audio file to send" }, "mode": { "enum": ["audio", "voice"], "type": "string", "description": 'Send as a standard audio track ("audio") or as a voice note ("voice")' }, "caption": { "type": "string", "description": "Optional caption text for the audio" } }, "required": ["botToken", "chatId", "audioUrl", "mode"] },
    outputSchema: { "description": "This step does not produce output data." }
  },
  "telegramSendFile": {
    stepType: "telegramSendFile",
    description: "Send a document/file to a Telegram chat via a bot.",
    usageNotes: "",
    inputSchema: { "type": "object", "properties": { "botToken": { "type": "string", "description": 'Telegram bot token in "botId:token" format' }, "chatId": { "type": "string", "description": "Telegram chat ID to send the file to" }, "fileUrl": { "type": "string", "description": "URL of the document/file to send" }, "caption": { "type": "string", "description": "Optional caption text for the file" } }, "required": ["botToken", "chatId", "fileUrl"] },
    outputSchema: { "description": "This step does not produce output data." }
  },
  "telegramSendImage": {
    stepType: "telegramSendImage",
    description: "Send an image to a Telegram chat via a bot.",
    usageNotes: "",
    inputSchema: { "type": "object", "properties": { "botToken": { "type": "string", "description": 'Telegram bot token in "botId:token" format' }, "chatId": { "type": "string", "description": "Telegram chat ID to send the image to" }, "imageUrl": { "type": "string", "description": "URL of the image to send" }, "caption": { "type": "string", "description": "Optional caption text for the image" } }, "required": ["botToken", "chatId", "imageUrl"] },
    outputSchema: { "description": "This step does not produce output data." }
  },
  "telegramSendMessage": {
    stepType: "telegramSendMessage",
    description: "Send a text message to a Telegram chat via a bot.",
    usageNotes: '- Messages are sent using MarkdownV2 formatting. Special characters are auto-escaped.\n- botToken format is "botId:token" \u2014 both parts are required.\n- Returns the sent message ID, which can be used with Edit Telegram Message to update the message later.',
    inputSchema: { "type": "object", "properties": { "botToken": { "type": "string", "description": 'Telegram bot token in "botId:token" format' }, "chatId": { "type": "string", "description": "Telegram chat ID to send the message to" }, "text": { "type": "string", "description": "Message text to send (MarkdownV2 formatting supported)" } }, "required": ["botToken", "chatId", "text"] },
    outputSchema: { "type": "object", "properties": { "messageId": { "type": "number", "description": "ID of the sent Telegram message" } }, "required": ["messageId"] }
  },
  "telegramSendVideo": {
    stepType: "telegramSendVideo",
    description: "Send a video to a Telegram chat via a bot.",
    usageNotes: "",
    inputSchema: { "type": "object", "properties": { "botToken": { "type": "string", "description": 'Telegram bot token in "botId:token" format' }, "chatId": { "type": "string", "description": "Telegram chat ID to send the video to" }, "videoUrl": { "type": "string", "description": "URL of the video to send" }, "caption": { "type": "string", "description": "Optional caption text for the video" } }, "required": ["botToken", "chatId", "videoUrl"] },
    outputSchema: { "description": "This step does not produce output data." }
  },
  "telegramSetTyping": {
    stepType: "telegramSetTyping",
    description: 'Show the "typing..." indicator in a Telegram chat via a bot.',
    usageNotes: "- The typing indicator automatically expires after a few seconds. Use this right before sending a message for a natural feel.",
    inputSchema: { "type": "object", "properties": { "botToken": { "type": "string", "description": 'Telegram bot token in "botId:token" format' }, "chatId": { "type": "string", "description": "Telegram chat ID to show the typing indicator in" } }, "required": ["botToken", "chatId"] },
    outputSchema: { "description": "This step does not produce output data." }
  },
  "textToSpeech": {
    stepType: "textToSpeech",
    description: "Generate an audio file from provided text using a speech model.",
    usageNotes: "- The text field contains the exact words to be spoken (not instructions).\n- In foreground mode, the audio is displayed to the user. In background mode, the URL is saved to a variable.",
    inputSchema: { "type": "object", "properties": { "text": { "type": "string", "description": "The text to convert to speech" }, "intermediateAsset": { "type": "boolean" }, "speechModelOverride": { "type": "object", "properties": { "model": { "type": "string", "description": "Speech synthesis model identifier" }, "config": { "type": "object", "properties": {}, "required": [], "description": "Additional model-specific configuration" } }, "required": ["model"], "description": "Optional model configuration override. Uses the workflow's default speech model if not specified" } }, "required": ["text"] },
    outputSchema: { "type": "object", "properties": { "audioUrl": { "type": "string", "description": "URL of the generated audio file" } }, "required": ["audioUrl"] }
  },
  "transcribeAudio": {
    stepType: "transcribeAudio",
    description: "Convert an audio file to text using a transcription model.",
    usageNotes: "- The prompt field provides optional context to improve transcription accuracy (e.g. language, speaker names, domain).",
    inputSchema: { "type": "object", "properties": { "audioUrl": { "type": "string", "description": "URL of the audio file to transcribe" }, "prompt": { "type": "string", "description": "Optional context to improve transcription accuracy (e.g. language, speaker names, domain terms)" }, "transcriptionModelOverride": { "type": "object", "properties": { "model": { "type": "string", "description": "Audio transcription model identifier" }, "config": { "type": "object", "properties": {}, "required": [], "description": "Additional model-specific configuration" } }, "required": ["model"], "description": "Optional model configuration override. Uses the workflow's default transcription model if not specified" } }, "required": ["audioUrl", "prompt"] },
    outputSchema: { "type": "object", "properties": { "text": { "type": "string", "description": "The transcribed text from the audio file" } }, "required": ["text"] }
  },
  "trimMedia": {
    stepType: "trimMedia",
    description: "Trim an audio or video clip",
    usageNotes: "",
    inputSchema: { "type": "object", "properties": { "inputUrl": { "type": "string", "description": "URL of the source audio or video file to trim" }, "start": { "type": ["number", "string"] }, "duration": { "type": ["string", "number"] }, "intermediateAsset": { "type": "boolean", "description": "When true, the asset is created but hidden from the user's gallery (tagged as intermediate)" } }, "required": ["inputUrl"] },
    outputSchema: { "type": "object", "properties": { "mediaUrl": { "type": "string", "description": "URL of the trimmed media file" } }, "required": ["mediaUrl"] }
  },
  "updateGmailLabels": {
    stepType: "updateGmailLabels",
    description: "Add or remove labels on Gmail messages, identified by message IDs or a search query.",
    usageNotes: "- Requires a Google OAuth connection with Gmail modify scope.\n- Provide either a query (Gmail search syntax) or explicit messageIds to target messages.\n- Label IDs can be label names or Gmail label IDs \u2014 names are resolved automatically.",
    inputSchema: { "type": "object", "properties": { "query": { "type": "string", "description": "Gmail search query to find messages (alternative to messageIds)" }, "connectionId": { "type": "string", "description": "Google OAuth connection ID" }, "messageIds": { "type": "string", "description": "Comma-separated message IDs to target (alternative to query)" }, "addLabelIds": { "type": "string", "description": "Comma-separated label names or IDs to add" }, "removeLabelIds": { "type": "string", "description": "Comma-separated label names or IDs to remove" } }, "required": ["query", "messageIds", "addLabelIds", "removeLabelIds"] },
    outputSchema: { "type": "object", "properties": { "updatedMessageIds": { "type": "array", "items": { "type": "string" }, "description": "Gmail message IDs that were updated" } }, "required": ["updatedMessageIds"] }
  },
  "updateGoogleCalendarEvent": {
    stepType: "updateGoogleCalendarEvent",
    description: "Update an existing event on a Google Calendar. Only specified fields are changed.",
    usageNotes: "- Requires a Google OAuth connection with Calendar events scope.\n- Fetches the existing event first, then applies only the provided updates. Omitted fields are left unchanged.\n- Attendees are specified as one email address per line, and replace the entire attendee list.",
    inputSchema: { "type": "object", "properties": { "connectionId": { "type": "string", "description": "Google OAuth connection ID" }, "eventId": { "type": "string", "description": "Google Calendar event ID to update" }, "summary": { "type": "string", "description": "Updated event title" }, "description": { "type": "string", "description": "Updated event description" }, "location": { "type": "string", "description": "Updated event location" }, "startDateTime": { "type": "string", "description": "Updated start time in ISO 8601 format" }, "endDateTime": { "type": "string", "description": "Updated end time in ISO 8601 format" }, "attendees": { "type": "string", "description": "Updated attendee email addresses (one per line, replaces all existing attendees)" }, "calendarId": { "type": "string", "description": 'Calendar ID (defaults to "primary" if omitted)' } }, "required": ["eventId"] },
    outputSchema: { "type": "object", "properties": { "eventId": { "type": "string", "description": "Google Calendar event ID" }, "htmlLink": { "type": "string", "description": "URL to view the updated event in Google Calendar" } }, "required": ["eventId", "htmlLink"] }
  },
  "updateGoogleDoc": {
    stepType: "updateGoogleDoc",
    description: "Update the contents of an existing Google Document.",
    usageNotes: '- operationType controls how content is applied: "addToTop" prepends, "addToBottom" appends, "overwrite" replaces all content.\n- textType determines how the text field is interpreted: "plain" for plain text, "html" for HTML markup, "markdown" for Markdown.',
    inputSchema: { "type": "object", "properties": { "documentId": { "type": "string", "description": "Google Document ID to update" }, "connectionId": { "type": "string", "description": "Google OAuth connection ID" }, "text": { "type": "string", "description": "New content to write to the document" }, "textType": { "enum": ["plain", "html", "markdown"], "type": "string", "description": 'Format of the text field: "plain", "html", or "markdown"' }, "operationType": { "enum": ["addToTop", "addToBottom", "overwrite"], "type": "string", "description": 'How to apply the content: "addToTop", "addToBottom", or "overwrite"' } }, "required": ["documentId", "text", "textType", "operationType"] },
    outputSchema: { "type": "object", "properties": { "documentUrl": { "type": "string", "description": "URL of the updated Google Document" } }, "required": ["documentUrl"] }
  },
  "updateGoogleSheet": {
    stepType: "updateGoogleSheet",
    description: "Update a Google Spreadsheet with new data.",
    usageNotes: '- operationType controls how data is written: "addToBottom" appends rows, "overwrite" replaces all data, "range" writes to a specific cell range.\n- Data should be provided as CSV in the text field.',
    inputSchema: { "type": "object", "properties": { "text": { "type": "string", "description": "CSV data to write to the spreadsheet" }, "connectionId": { "type": "string", "description": "Google OAuth connection ID" }, "spreadsheetId": { "type": "string", "description": "Google Spreadsheet ID to update" }, "range": { "type": "string", "description": 'Target cell range in A1 notation (used with "range" operationType)' }, "operationType": { "enum": ["addToBottom", "overwrite", "range"], "type": "string", "description": 'How to apply the data: "addToBottom", "overwrite", or "range"' } }, "required": ["text", "spreadsheetId", "range", "operationType"] },
    outputSchema: { "type": "object", "properties": { "spreadsheetUrl": { "type": "string", "description": "URL of the updated Google Spreadsheet" } }, "required": ["spreadsheetUrl"] }
  },
  "uploadDataSourceDocument": {
    stepType: "uploadDataSourceDocument",
    description: "Legacy v1 data sources. v2 apps should use `dataSources.defineDataSource()` from @mindstudio-ai/agent instead, which owns parsing, chunking, embedding and citations. Upload a file into an existing data source from a URL or raw text content.",
    usageNotes: '- If "file" is a single URL, the file is downloaded from that URL and uploaded.\n- If "file" is any other string, a .txt document is created from that content and uploaded.\n- The block waits (polls) for processing to complete before transitioning, up to 5 minutes.\n- Once processing finishes, vectors are loaded into Milvus so the data source is immediately queryable.\n- Supported file types (when using a URL) are the same as the data source upload UI (PDF, DOCX, TXT, etc.).',
    inputSchema: { "type": "object", "properties": { "dataSourceId": { "type": "string", "description": "ID of the target data source (supports variable interpolation)" }, "file": { "type": "string", "description": "A URL to download, or raw text content to create a .txt document from (supports variable interpolation)" }, "fileName": { "type": "string", "description": "Display name for the document (supports variable interpolation)" } }, "required": ["dataSourceId", "file", "fileName"] },
    outputSchema: { "description": "This step does not produce output data." }
  },
  "upscaleImage": {
    stepType: "upscaleImage",
    description: "Increase the resolution of an image using AI upscaling.",
    usageNotes: "- Output is re-hosted on the CDN as a PNG.",
    inputSchema: { "type": "object", "properties": { "imageUrl": { "type": "string", "description": "URL of the image to upscale" }, "targetResolution": { "enum": ["2k", "4k", "8k"], "type": "string", "description": "Target output resolution" }, "engine": { "enum": ["standard", "pro"], "type": "string", "description": "Upscaling engine quality tier" } }, "required": ["imageUrl", "targetResolution", "engine"] },
    outputSchema: { "type": "object", "properties": { "imageUrl": { "type": "string", "description": "CDN URL of the upscaled image (PNG)" } }, "required": ["imageUrl"] }
  },
  "upscaleVideo": {
    stepType: "upscaleVideo",
    description: "Upscale a video file",
    usageNotes: "",
    inputSchema: { "type": "object", "properties": { "videoUrl": { "type": "string", "description": "URL of the source video to upscale" }, "targetResolution": { "enum": ["720p", "1080p", "2K", "4K"], "type": "string", "description": "Target output resolution for the upscaled video" }, "engine": { "enum": ["standard", "pro", "ultimate", "flashvsr", "seedance", "seedvr2", "runwayml/upscale-v1"], "type": "string", "description": "Upscaling engine to use. Higher tiers produce better quality at higher cost." }, "intermediateAsset": { "type": "boolean", "description": "When true, the asset is created but hidden from the user's gallery (tagged as intermediate)" } }, "required": ["videoUrl", "targetResolution", "engine"] },
    outputSchema: { "type": "object", "properties": { "videoUrl": { "type": "string", "description": "URL of the upscaled video" } }, "required": ["videoUrl"] }
  },
  "userMessage": {
    stepType: "userMessage",
    description: "Send a message to an AI model and return the response, or echo a system message.",
    usageNotes: `- Source "user" sends the message to an LLM and returns the model's response.
- Source "system" echoes the message content directly (no AI call).
- Mode "background" saves the result to a variable. Mode "foreground" streams it to the user (not available in direct execution).
- Structured output (JSON/CSV) can be enforced via structuredOutputType and structuredOutputExample.
- When executed inside a v2 app method (managed sandbox or local dev tunnel),
  LLM token output can be streamed to the frontend in real time via an SSE
  side-channel. The frontend opts in by passing { stream: true } to the method
  invocation via @mindstudio-ai/interface. Tokens are published to Redis
  pub/sub as they arrive and forwarded as SSE events on the invoke response.
  The method code itself is unchanged \u2014 streaming is transparent to the
  developer. See V2ExecutionService.ts and the invoke handler in V2Apps for
  the server-side plumbing.`,
    inputSchema: { "type": "object", "properties": { "message": { "type": "string", "description": "The message to send (prompt for AI, or text for system echo)" }, "source": { "enum": ["user", "system"], "type": "string", "description": 'Message source: "user" sends to AI model, "system" echoes message content directly. Defaults to "user"' }, "modelOverride": { "type": "object", "properties": { "model": { "type": "string", "description": 'Model identifier (e.g. "gpt-4", "claude-3-opus")' }, "temperature": { "type": "number", "description": "Sampling temperature for the model (0-2)" }, "maxResponseTokens": { "type": "number", "description": "Maximum number of tokens in the model's response" }, "ignorePreamble": { "type": "boolean", "description": "Whether to skip the system preamble/instructions" }, "userMessagePreprocessor": { "type": "object", "properties": { "dataSource": { "type": "string", "description": "Data source identifier for the preprocessor" }, "messageTemplate": { "type": "string", "description": "Template string applied to user messages before sending to the model" }, "maxResults": { "type": "number", "description": "Maximum number of results to include from the data source" }, "enabled": { "type": "boolean", "description": "Whether the preprocessor is active" }, "shouldInherit": { "type": "boolean", "description": "Whether child steps should inherit this preprocessor configuration" } }, "description": "Preprocessor applied to user messages before sending to the model" }, "preamble": { "type": "string", "description": "System preamble/instructions for the model" }, "multiModelEnabled": { "type": "boolean", "description": "Whether multi-model candidate generation is enabled" }, "editResponseEnabled": { "type": "boolean", "description": "Whether the user can edit the model's response" }, "config": { "type": "object", "properties": {}, "required": [], "description": "Additional model-specific configuration" } }, "required": ["model", "temperature", "maxResponseTokens"], "description": "Model configuration override. Optional; uses the workflow's default model if not specified" }, "structuredOutputType": { "enum": ["text", "json", "csv"], "type": "string", "description": "Output format constraint for structured responses" }, "structuredOutputExample": { "type": "string", "description": "Sample showing the desired output shape (for JSON/CSV formats). A TypeScript interface is also useful here for more complex types." }, "chatHistoryMode": { "enum": ["include", "exclude"], "type": "string", "description": "Whether to include or exclude prior chat history in the AI context" } }, "required": ["message"], "description": "Configuration for the user message step" },
    outputSchema: { "type": "object", "properties": { "content": { "type": "string", "description": "The AI model's response or echoed system message content" } }, "required": ["content"] }
  },
  "videoFaceSwap": {
    stepType: "videoFaceSwap",
    description: "Swap faces in a video file",
    usageNotes: "",
    inputSchema: { "type": "object", "properties": { "videoUrl": { "type": "string", "description": "URL of the source video containing faces to swap" }, "faceImageUrl": { "type": "string", "description": "URL of the image containing the replacement face" }, "targetIndex": { "type": "number", "description": "Zero-based index of the face to replace in the video" }, "engine": { "type": "string", "description": "Face swap engine to use" }, "intermediateAsset": { "type": "boolean", "description": "When true, the asset is created but hidden from the user's gallery (tagged as intermediate)" } }, "required": ["videoUrl", "faceImageUrl", "targetIndex", "engine"] },
    outputSchema: { "type": "object", "properties": { "videoUrl": { "type": "string", "description": "URL of the face-swapped video" } }, "required": ["videoUrl"] }
  },
  "videoRemoveBackground": {
    stepType: "videoRemoveBackground",
    description: "Remove or replace background from a video",
    usageNotes: "",
    inputSchema: { "type": "object", "properties": { "videoUrl": { "type": "string", "description": "URL of the source video" }, "newBackground": { "enum": ["transparent", "image"], "type": "string", "description": "Whether to make the background transparent or replace it with an image" }, "newBackgroundImageUrl": { "type": "string", "description": "URL of a replacement background image. Required when newBackground is 'image'." }, "engine": { "type": "string", "description": "Background removal engine to use" }, "intermediateAsset": { "type": "boolean", "description": "When true, the asset is created but hidden from the user's gallery (tagged as intermediate)" } }, "required": ["videoUrl", "newBackground", "engine"] },
    outputSchema: { "type": "object", "properties": { "videoUrl": { "type": "string", "description": "URL of the video with background removed or replaced" } }, "required": ["videoUrl"] }
  },
  "videoRemoveWatermark": {
    stepType: "videoRemoveWatermark",
    description: "Remove a watermark from a video",
    usageNotes: "",
    inputSchema: { "type": "object", "properties": { "videoUrl": { "type": "string", "description": "URL of the source video containing a watermark" }, "engine": { "type": "string", "description": "Watermark removal engine to use" }, "intermediateAsset": { "type": "boolean", "description": "When true, the asset is created but hidden from the user's gallery (tagged as intermediate)" } }, "required": ["videoUrl", "engine"] },
    outputSchema: { "type": "object", "properties": { "videoUrl": { "type": "string", "description": "URL of the video with watermark removed" } }, "required": ["videoUrl"] }
  },
  "watermarkImage": {
    stepType: "watermarkImage",
    description: "Overlay a watermark image onto another image.",
    usageNotes: "- The watermark is placed at the specified corner with configurable padding and width.",
    inputSchema: { "type": "object", "properties": { "imageUrl": { "type": "string", "description": "URL of the base image" }, "watermarkImageUrl": { "type": "string", "description": "URL of the watermark image to overlay" }, "corner": { "enum": ["top-left", "top-right", "bottom-left", "bottom-right"], "type": "string", "description": "Corner position for the watermark placement" }, "paddingPx": { "type": "number", "description": "Padding from the corner in pixels" }, "widthPx": { "type": "number", "description": "Width of the watermark overlay in pixels" }, "intermediateAsset": { "type": "boolean", "description": "When true, the asset is created but hidden from the user's gallery (tagged as intermediate)" } }, "required": ["imageUrl", "watermarkImageUrl", "corner", "paddingPx", "widthPx"] },
    outputSchema: { "type": "object", "properties": { "imageUrl": { "type": "string", "description": "CDN URL of the watermarked image" } }, "required": ["imageUrl"] }
  },
  "watermarkVideo": {
    stepType: "watermarkVideo",
    description: "Add an image watermark to a video",
    usageNotes: "",
    inputSchema: { "type": "object", "properties": { "videoUrl": { "type": "string", "description": "URL of the source video" }, "imageUrl": { "type": "string", "description": "URL of the watermark image to overlay" }, "corner": { "enum": ["top-left", "top-right", "bottom-left", "bottom-right"], "type": "string", "description": "Corner position for the watermark placement" }, "paddingPx": { "type": "number", "description": "Padding from the corner in pixels" }, "widthPx": { "type": "number", "description": "Width of the watermark overlay in pixels" }, "intermediateAsset": { "type": "boolean", "description": "When true, the asset is created but hidden from the user's gallery (tagged as intermediate)" } }, "required": ["videoUrl", "imageUrl", "corner", "paddingPx", "widthPx"] },
    outputSchema: { "type": "object", "properties": { "videoUrl": { "type": "string", "description": "URL of the watermarked video" } }, "required": ["videoUrl"] }
  },
  "youDotComFinanceResearch": {
    stepType: "youDotComFinanceResearch",
    description: "Ask a financial research question using You.com Finance Research and return the sourced response.",
    usageNotes: "- Use this for financial questions such as company analysis, earnings, market research, filings, macroeconomics, and due diligence.\n- researchEffort supports deep (default) or exhaustive.\n- Finance Research returns the same response shape as Web Research, but searches a finance-optimized index.\n- Use it for cited synthesis, not raw price feeds or structured time-series exports.",
    inputSchema: { "type": "object", "properties": { "input": { "type": "string", "description": "Financial research question" }, "researchEffort": { "enum": ["deep", "exhaustive"], "type": "string", "description": "Depth of finance research to perform" } }, "required": ["input"] },
    outputSchema: { "type": "object", "properties": { "data": { "anyOf": [{ "type": "object", "properties": {}, "required": [] }, { "type": "array", "items": {} }] } }, "required": ["data"] }
  },
  "youDotComGetPageContent": {
    stepType: "youDotComGetPageContent",
    description: "Fetch clean Markdown, HTML, or metadata for known URLs using the You.com Contents API.",
    usageNotes: "- Use this step when you already know the URLs. Use Web Search with livecrawl when You.com should discover pages from a query.\n- A single request supports up to 10 URLs.\n- Request only the formats you need. Markdown is recommended for LLM consumption.\n- Increase crawlTimeout for JavaScript-heavy pages, up to 60 seconds.\n- Individual pages can partially fail; check each returned item before processing.",
    inputSchema: { "type": "object", "properties": { "urls": { "type": "array", "items": { "type": "string" }, "description": "URLs to fetch, max 10" }, "formats": { "type": "array", "items": { "enum": ["markdown", "html", "metadata"], "type": "string" }, "description": "Content formats to return; defaults to markdown" }, "crawlTimeout": { "type": "number", "description": "Per-URL crawl timeout in seconds" } }, "required": ["urls"] },
    outputSchema: { "type": "object", "properties": { "data": { "anyOf": [{ "type": "object", "properties": {}, "required": [] }, { "type": "array", "items": {} }] } }, "required": ["data"] }
  },
  "youDotComLiveNews": {
    stepType: "youDotComLiveNews",
    description: "Fetch live news articles through the You.com Search API and return the full structured response.",
    usageNotes: "- Defaults freshness to day for breaking or recent news.\n- Use country and language together to monitor regional or non-English news.\n- Use livecrawl: 'news' with livecrawlFormats: ['markdown'] when you need full article text.\n- Use a custom freshness range like YYYY-MM-DDtoYYYY-MM-DD for historical news windows.",
    inputSchema: { "type": "object", "properties": { "query": { "type": "string", "description": "News query" }, "freshness": { "type": "string", "description": "Recency filter; defaults to day" }, "count": { "type": "number", "description": "Max results per section, up to 100" }, "country": { "type": "string", "description": "ISO 3166-1 alpha-2 country code" }, "language": { "type": "string", "description": "BCP 47 language code" }, "safesearch": { "enum": ["off", "moderate", "strict"], "type": "string", "description": "Content moderation level" }, "livecrawl": { "enum": ["news", "all"], "type": "string", "description": "Fetch full content for news or all results" }, "livecrawlFormats": { "type": "array", "items": { "enum": ["markdown", "html"], "type": "string" }, "description": "Full-content formats to return when livecrawl is enabled" } }, "required": ["query"] },
    outputSchema: { "type": "object", "properties": { "data": { "anyOf": [{ "type": "object", "properties": {}, "required": [] }, { "type": "array", "items": {} }] } }, "required": ["data"] }
  },
  "youDotComWebResearch": {
    stepType: "youDotComWebResearch",
    description: "Ask a research question and return a grounded You.com Research API answer with sources.",
    usageNotes: "- Use Web Search when you need raw URLs and snippets. Use Web Research when you want a synthesized answer with citations.\n- researchEffort controls depth and latency: lite, standard, deep, or exhaustive. standard is a good default.\n- sourceControl can restrict, exclude, or boost domains, and can apply freshness or country filters.\n- includeDomains cannot be combined with excludeDomains or boostDomains.\n- outputSchema returns structured output.content and is supported by standard, deep, and exhaustive, not lite.",
    inputSchema: { "type": "object", "properties": { "input": { "type": "string", "description": "Research question" }, "researchEffort": { "enum": ["lite", "standard", "deep", "exhaustive"], "type": "string", "description": "Depth of research to perform" }, "sourceControl": { "anyOf": [{ "type": "object", "properties": { "includeDomains": { "type": "array", "items": { "type": "string" } }, "excludeDomains": { "type": "array", "items": { "type": "string" } }, "boostDomains": { "type": "array", "items": { "type": "string" } }, "freshness": { "type": "string" }, "country": { "type": "string" } } }, { "type": "string" }] }, "outputSchema": { "anyOf": [{ "type": "object", "properties": {}, "required": [] }, { "type": "string" }] } }, "required": ["input"] },
    outputSchema: { "type": "object", "properties": { "data": { "anyOf": [{ "type": "object", "properties": {}, "required": [] }, { "type": "array", "items": {} }] } }, "required": ["data"] }
  },
  "youDotComWebSearch": {
    stepType: "youDotComWebSearch",
    description: "Search the web and news using the You.com Search API and return the full structured response.",
    usageNotes: "- Query supports You.com search operators:\n\n| Operator | Description | Example |\n| -------- | ----------- | ------- |\n| site: | Search within a domain and its subdomains | site:uscourts.gov |\n| filetype: | Search for a specific file type | filetype:pdf |\n| + | Require the exact term after the operator | +GAAP |\n| - | Exclude the exact term after the operator | -prs |\n| AND | Require both expressions | guitar AND Fender |\n| OR | Match either expression | guitar OR drum |\n| NOT | Negate an expression | NOT site:uscourts.gov |\n\n- Use livecrawl with livecrawlFormats: ['markdown'] when you need full page content instead of snippets.\n- Use the Get Page Content step when you already know the URLs to fetch.\n- Use freshness for recency: day, week, month, year, or YYYY-MM-DDtoYYYY-MM-DD.\n- Use country (ISO 3166-1 alpha-2) and language (BCP 47) to focus results geographically or linguistically.\n- includeDomains cannot be combined with excludeDomains or boostDomains.",
    inputSchema: { "type": "object", "properties": { "query": { "type": "string", "description": "Search query; supports You.com search operators" }, "count": { "type": "number", "description": "Max results per section, up to 100" }, "freshness": { "type": "string", "description": "Recency filter: day, week, month, year, or YYYY-MM-DDtoYYYY-MM-DD" }, "country": { "type": "string", "description": "ISO 3166-1 alpha-2 country code" }, "language": { "type": "string", "description": "BCP 47 language code" }, "offset": { "type": "number", "description": "Pagination offset, 0-9" }, "safesearch": { "enum": ["off", "moderate", "strict"], "type": "string", "description": "Content moderation level" }, "livecrawl": { "enum": ["web", "news", "all"], "type": "string", "description": "Fetch full content for web, news, or all results" }, "livecrawlFormats": { "type": "array", "items": { "enum": ["markdown", "html"], "type": "string" }, "description": "Full-content formats to return when livecrawl is enabled" }, "crawlTimeout": { "type": "number", "description": "Maximum livecrawl timeout in seconds" }, "includeDomains": { "type": "array", "items": { "type": "string" }, "description": "Restrict results to these domains" }, "excludeDomains": { "type": "array", "items": { "type": "string" }, "description": "Exclude these domains" }, "boostDomains": { "type": "array", "items": { "type": "string" }, "description": "Boost these domains without excluding other domains" } }, "required": ["query"] },
    outputSchema: { "type": "object", "properties": { "data": { "anyOf": [{ "type": "object", "properties": {}, "required": [] }, { "type": "array", "items": {} }] } }, "required": ["data"] }
  }
};

// src/task/schema.ts
function describe(value) {
  if (value === void 0) return "undefined";
  const json = JSON.stringify(value);
  if (json === void 0) return String(value);
  return json.length > 60 ? `${json.slice(0, 57)}...` : json;
}
function matchesTypeName(value, name) {
  switch (name) {
    case "null":
      return value === null;
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number";
    case "integer":
      return typeof value === "number" && Number.isInteger(value);
    case "boolean":
      return typeof value === "boolean";
    case "array":
      return Array.isArray(value);
    case "object":
      return typeof value === "object" && value !== null && !Array.isArray(value);
  }
}
function validateAgainstSchema(value, schema) {
  const errors = [];
  walk(value, schema, "$", errors);
  return errors;
}
function walk(value, schema, path, errors) {
  if (schema.const !== void 0) {
    if (value !== schema.const) {
      errors.push({
        path,
        message: `expected the constant ${describe(schema.const)}, got ${describe(value)}`
      });
    }
    return;
  }
  if (schema.enum !== void 0) {
    if (!schema.enum.includes(value)) {
      errors.push({
        path,
        message: `expected one of ${schema.enum.map(describe).join(" | ")}, got ${describe(value)}`
      });
    }
    return;
  }
  if (schema.type !== void 0) {
    const names = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!names.some((name) => matchesTypeName(value, name))) {
      errors.push({
        path,
        message: `expected type ${names.join(" | ")}, got ${describe(value)}`
      });
      return;
    }
  }
  if (matchesTypeName(value, "object")) {
    const record = value;
    if (schema.required) {
      for (const key of schema.required) {
        if (!(key in record) || record[key] === void 0) {
          errors.push({
            path,
            message: `missing required property "${key}"`
          });
        }
      }
    }
    if (schema.properties) {
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        if (key in record && record[key] !== void 0) {
          walk(record[key], propSchema, `${path}.${key}`, errors);
        }
      }
      if (schema.additionalProperties === false) {
        for (const key of Object.keys(record)) {
          if (!(key in schema.properties)) {
            errors.push({
              path,
              message: `unexpected property "${key}" (additionalProperties is false)`
            });
          }
        }
      }
    }
  }
  if (Array.isArray(value) && schema.items) {
    value.forEach((item, index) => {
      walk(item, schema.items, `${path}[${index}]`, errors);
    });
  }
}
function formatValidationErrors(errors) {
  return errors.map((e) => `- at ${e.path}: ${e.message}`).join("\n");
}
var SUPPORTED_KEYWORDS = /* @__PURE__ */ new Set([
  "type",
  "properties",
  "required",
  "additionalProperties",
  "items",
  "enum",
  "const",
  // Harmless annotations — ignored by the validator, allowed to pass through.
  "description",
  "title",
  "examples",
  "default"
]);
function assertSupportedSchema(schema) {
  assertSupportedNode(schema, "$");
}
function assertSupportedNode(schema, path) {
  for (const key of Object.keys(schema)) {
    if (SUPPORTED_KEYWORDS.has(key)) continue;
    const hint = key === "nullable" ? ' Use a type array instead: type: ["string", "null"].' : key === "oneOf" || key === "anyOf" || key === "allOf" ? " Model alternatives with an enum, a type array, or a discriminating property instead." : "";
    throw new MindStudioError(
      `[task] Unsupported JSON Schema keyword "${key}" at ${path} in outputSchema. Supported: type, properties, required, additionalProperties, items, enum, const.${hint}`,
      "task_output_schema_unsupported",
      400
    );
  }
  if (schema.properties) {
    for (const [key, propSchema] of Object.entries(schema.properties)) {
      assertSupportedNode(propSchema, `${path}.${key}`);
    }
  }
  if (schema.items) {
    assertSupportedNode(schema.items, `${path}[]`);
  }
}
function buildExampleFromSchema(schema) {
  if (schema.const !== void 0) return schema.const;
  if (schema.enum !== void 0 && schema.enum.length > 0)
    return schema.enum[0];
  const names = Array.isArray(schema.type) ? schema.type : schema.type ? [schema.type] : [];
  const name = names.find((n) => n !== "null") ?? names[0];
  switch (name) {
    case "object": {
      const example = {};
      for (const [key, propSchema] of Object.entries(
        schema.properties ?? {}
      )) {
        example[key] = buildExampleFromSchema(propSchema);
      }
      return example;
    }
    case "array":
      return schema.items ? [buildExampleFromSchema(schema.items)] : [];
    case "string":
      return "...";
    case "number":
    case "integer":
      return 0;
    case "boolean":
      return true;
    case "null":
      return null;
    default:
      return null;
  }
}
function stripCodeFences(text) {
  const match = /^```[a-zA-Z]*[ \t]*\r?\n([\s\S]*?)\r?\n?```$/.exec(
    text.trim()
  );
  return match ? match[1] : text;
}

// src/task/index.ts
function resolveStepType(name) {
  const meta = stepMetadata[name];
  return meta ? meta.stepType : name;
}
function mapTools(tools) {
  return tools.map((t) => {
    if (typeof t === "object" && "appMethod" in t) {
      return {
        appMethod: t.appMethod,
        ...t.description ? { description: t.description } : {},
        ...t.defaults ? { defaults: t.defaults } : {}
      };
    }
    const method = typeof t === "string" ? t : t.method;
    const stepType = resolveStepType(method);
    const defaults = typeof t === "object" ? t.defaults : void 0;
    return defaults ? { stepType, defaults } : { stepType };
  });
}
function buildTaskRequestBody(options) {
  return {
    prompt: options.prompt,
    input: options.input,
    tools: mapTools(options.tools),
    // The legacy whole-task route requires structuredOutputExample and
    // composes its own prompt server-side, so in schema mode we synthesize a
    // skeleton example from the schema. Validation still happens client-side
    // after the result comes back (see _runTaskInner).
    structuredOutputExample: options.outputSchema ? JSON.stringify(buildExampleFromSchema(options.outputSchema)) : typeof options.structuredOutputExample === "string" ? options.structuredOutputExample : JSON.stringify(options.structuredOutputExample),
    model: options.model,
    ...options.maxTurns != null && { maxTurns: options.maxTurns },
    ...options.appId != null && { appId: options.appId },
    ...options.threadId != null && { threadId: options.threadId }
  };
}
function sleep2(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function isDevMode() {
  return !!(process.env.CALLBACK_TOKEN || getRequestContext()?.callbackToken);
}
function logTaskResult(result) {
  if (!isDevMode()) return;
  const toolSummary = result.toolCalls.map((tc) => `${tc.name} (${tc.durationMs}ms) ${tc.success ? "\u2713" : "\u2717"}`).join(", ");
  console.log(
    `[task] ${result.turns} turn${result.turns === 1 ? "" : "s"}` + (toolSummary ? `: ${toolSummary}` : "") + ` | ${result.parsedSuccessfully ? "output OK" : "\u26A0 output not valid JSON"} | cost: ${result.usage.totalBillingCost}`
  );
}
async function runTaskPoll(httpConfig, body) {
  const { data } = await request(
    httpConfig,
    "POST",
    "/task",
    body
  );
  const pollUrl = `${httpConfig.baseUrl}/developer/v2/task/poll/${data.taskToken}`;
  let pollDelay = 300;
  while (true) {
    await sleep2(pollDelay);
    pollDelay = Math.min(pollDelay * 1.5, 3e3);
    const res = await fetch(pollUrl, {
      headers: { "User-Agent": "@mindstudio-ai/agent" }
    });
    if (res.status === 502 || res.status === 503 || res.status === 504)
      continue;
    if (res.status === 404) {
      throw new MindStudioError(
        "Task poll token not found or expired.",
        "poll_token_expired",
        404
      );
    }
    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({}));
      throw new MindStudioError(
        errorBody.message ?? errorBody.error ?? `Task poll failed: ${res.status} ${res.statusText}`,
        errorBody.code ?? "poll_error",
        res.status,
        errorBody
      );
    }
    const poll = await res.json();
    if (poll.status === "pending") {
      if (isDevMode() && poll.currentTurn != null) {
        console.log(
          `[task] running... turn ${poll.currentTurn}/${poll.maxTurns ?? "?"}`
        );
      }
      continue;
    }
    if (poll.status === "error") {
      throw new MindStudioError(
        poll.error ?? "Task execution failed.",
        "task_execution_error",
        500
      );
    }
    const result = {
      output: poll.output,
      outputRaw: poll.outputRaw ?? "",
      parsedSuccessfully: poll.parsedSuccessfully ?? true,
      turns: poll.turns ?? 0,
      usage: poll.usage ?? {
        inputTokens: 0,
        outputTokens: 0,
        totalBillingCost: 0
      },
      toolCalls: poll.toolCalls ?? []
    };
    logTaskResult(result);
    return result;
  }
}
async function runTaskStream(httpConfig, body, onEvent) {
  const url = `${httpConfig.baseUrl}/developer/v2/task`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${httpConfig.token}`,
      "Content-Type": "application/json",
      "User-Agent": "@mindstudio-ai/agent",
      Accept: "text/event-stream"
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    let code = "api_error";
    let details;
    try {
      const text = await res.text();
      try {
        const errBody = JSON.parse(text);
        details = errBody;
        const errMsg = (typeof errBody.error === "string" ? errBody.error : void 0) ?? (typeof errBody.message === "string" ? errBody.message : void 0);
        if (errMsg) message = errMsg;
        if (errBody.code) code = errBody.code;
      } catch {
        const stripped = text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
        if (stripped) message = stripped.slice(0, 200);
      }
    } catch {
    }
    throw new MindStudioError(`[task] ${message}`, code, res.status, details);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result = null;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const event = JSON.parse(line.slice(6));
        onEvent(event);
        if (event.type === "error") {
          throw new MindStudioError(
            event.error ?? "Task execution failed.",
            "task_execution_error",
            500
          );
        }
        if (event.type === "done") {
          result = {
            output: event.output,
            outputRaw: event.outputRaw ?? "",
            parsedSuccessfully: event.parsedSuccessfully ?? true,
            turns: event.turns ?? 0,
            usage: event.usage ?? {
              inputTokens: 0,
              outputTokens: 0,
              totalBillingCost: 0
            },
            toolCalls: event.toolCalls ?? []
          };
        }
      } catch (err) {
        if (err instanceof MindStudioError) throw err;
      }
    }
  }
  if (buffer.startsWith("data: ")) {
    try {
      const event = JSON.parse(buffer.slice(6));
      onEvent(event);
      if (event.type === "error") {
        throw new MindStudioError(
          event.error ?? "Task execution failed.",
          "task_execution_error",
          500
        );
      }
      if (event.type === "done") {
        result = {
          output: event.output,
          outputRaw: event.outputRaw ?? "",
          parsedSuccessfully: event.parsedSuccessfully ?? true,
          turns: event.turns ?? 0,
          usage: event.usage ?? {
            inputTokens: 0,
            outputTokens: 0,
            totalBillingCost: 0
          },
          toolCalls: event.toolCalls ?? []
        };
      }
    } catch (err) {
      if (err instanceof MindStudioError) throw err;
    }
  }
  if (!result) {
    throw new MindStudioError(
      "[task] Stream ended without a done event. The task execution may have been interrupted.",
      "stream_error",
      500
    );
  }
  logTaskResult(result);
  return result;
}

// src/task/local.ts
var DEFAULT_MAX_TURNS = 20;
var MAX_TURNS_LIMIT = 100;
var MAX_SCHEMA_REPAIR_ATTEMPTS = 3;
var MAX_TOOL_OUTPUT_CHARS = 5e4;
var MAX_TURN_ATTEMPTS = 5;
var INITIAL_BACKOFF_MS = 1e3;
var STALL_TIMEOUT_MS = 3e5;
var TURN_UNAVAILABLE_CODE = "task_turn_unavailable";
var UNSAFE_KEYS = /* @__PURE__ */ new Set(["__proto__", "constructor", "prototype"]);
function isPlainObject(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}
function mergeToolInput(modelInput, defaults) {
  const merged = { ...modelInput };
  for (const [key, defaultValue] of Object.entries(defaults)) {
    if (UNSAFE_KEYS.has(key)) {
      continue;
    }
    const modelValue = merged[key];
    merged[key] = isPlainObject(defaultValue) && isPlainObject(modelValue) ? mergeToolInput(modelValue, defaultValue) : defaultValue;
  }
  return merged;
}
function truncateToolOutput(output) {
  const serialized = JSON.stringify(output);
  return serialized && serialized.length > MAX_TOOL_OUTPUT_CHARS ? serialized.slice(0, MAX_TOOL_OUTPUT_CHARS) + "... [truncated]" : output;
}
var TurnError = class extends Error {
  constructor(message, retryable, phase, status, errorCode) {
    super(message);
    this.retryable = retryable;
    this.phase = phase;
    this.status = status;
    this.errorCode = errorCode;
  }
};
async function attemptTurn(httpConfig, body) {
  const url = `${httpConfig.baseUrl}/developer/v2/task/turn`;
  await httpConfig.rateLimiter.acquire();
  try {
    let res;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${httpConfig.token}`,
          "Content-Type": "application/json",
          "User-Agent": "@mindstudio-ai/agent",
          Accept: "text/event-stream"
        },
        body: JSON.stringify(body)
      });
    } catch (err) {
      throw new TurnError(
        `Network error: ${err instanceof Error ? err.message : "fetch failed"}`,
        true,
        "request"
      );
    }
    httpConfig.rateLimiter.updateFromHeaders(res.headers);
    if (!res.ok) {
      let message = `${res.status} ${res.statusText}`;
      let code;
      try {
        const errBody = await res.json();
        const errMsg = (typeof errBody.errorMessage === "string" ? errBody.errorMessage : void 0) ?? (typeof errBody.errorString === "string" ? errBody.errorString : void 0) ?? (typeof errBody.error === "string" ? errBody.error : void 0);
        if (errMsg) message = errMsg;
        if (typeof errBody.errorString === "string") code = errBody.errorString;
      } catch {
      }
      const retryable = res.status >= 500 || res.status === 429;
      throw new TurnError(message, retryable, "request", res.status, code);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    const events = [];
    let text = "";
    const toolCalls = [];
    let turn = null;
    const handleLine = (line) => {
      if (!line.startsWith("data: ")) {
        return;
      }
      let event;
      try {
        event = JSON.parse(line.slice(6));
      } catch {
        return;
      }
      if (event.type === "error") {
        const status = typeof event.status === "number" ? event.status : 500;
        const message = typeof event.error === "string" ? event.error : "Model call failed";
        const retryable = status >= 500 || /overloaded|terminated|network/i.test(message);
        throw new TurnError(message, retryable, "model", status);
      }
      if (event.type === "turn") {
        turn = {
          events,
          text,
          toolCalls,
          stopReason: typeof event.stopReason === "string" ? event.stopReason : "end_turn",
          usage: event.usage ?? {},
          billingCost: typeof event.billingCost === "number" ? event.billingCost : 0
        };
        return;
      }
      if (event.type === "text" && typeof event.text === "string") {
        text += event.text;
      } else if (event.type === "tool_use") {
        toolCalls.push({
          id: event.id,
          name: event.name,
          input: event.input ?? {}
        });
      }
      events.push(event);
    };
    while (true) {
      let stallTimer;
      let readResult;
      try {
        readResult = await Promise.race([
          reader.read(),
          new Promise((_, reject) => {
            stallTimer = setTimeout(
              () => reject(new Error("stream_stall")),
              STALL_TIMEOUT_MS
            );
          })
        ]);
        clearTimeout(stallTimer);
      } catch (err) {
        clearTimeout(stallTimer);
        try {
          await reader.cancel();
        } catch {
        }
        if (err instanceof TurnError) {
          throw err;
        }
        const isStall = err instanceof Error && err.message === "stream_stall";
        throw new TurnError(
          isStall ? "Turn stalled \u2014 no data received for 5 minutes" : `Network error: stream interrupted \u2014 ${err instanceof Error ? err.message : "unknown"}`,
          true,
          "request"
        );
      }
      if (readResult.done) {
        break;
      }
      buffer += decoder.decode(readResult.value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        handleLine(line);
      }
    }
    if (buffer) {
      handleLine(buffer);
    }
    if (!turn) {
      throw new TurnError(
        "Network error: stream ended before turn completion",
        true,
        "request"
      );
    }
    return turn;
  } finally {
    httpConfig.rateLimiter.release();
  }
}
async function runTurnWithRetry(httpConfig, body) {
  for (let attempt = 0; attempt < MAX_TURN_ATTEMPTS; attempt++) {
    try {
      return await attemptTurn(httpConfig, body);
    } catch (err) {
      if (!(err instanceof TurnError) || !err.retryable || attempt >= MAX_TURN_ATTEMPTS - 1) {
        throw err;
      }
      if (isDevMode()) {
        console.log(
          `[task] connection lost, retrying turn (attempt ${attempt + 2} of ${MAX_TURN_ATTEMPTS})`
        );
      }
      await sleep2(INITIAL_BACKOFF_MS * 2 ** attempt);
    }
  }
  throw new TurnError("Turn retries exhausted", false, "request");
}
async function runTaskLocal(deps, options) {
  const { httpConfig } = deps;
  const onEvent = options.onEvent;
  const outputSchema = options.outputSchema;
  if (outputSchema) assertSupportedSchema(outputSchema);
  let system;
  if (outputSchema) {
    system = `${options.prompt}

When you have completed the task, respond with your final output as a single JSON object that conforms to this JSON Schema. Respond with the JSON object itself \u2014 NOT the schema, no prose, no code fences:
${JSON.stringify(outputSchema)}
<!-- cache_breakpoint -->`;
  } else {
    const structuredOutputExample = typeof options.structuredOutputExample === "string" ? options.structuredOutputExample : JSON.stringify(options.structuredOutputExample);
    system = `${options.prompt}

When you have completed the task, respond with your final output as JSON matching this example:
${structuredOutputExample}
<!-- cache_breakpoint -->`;
  }
  const wireTools = mapTools(options.tools);
  const toolKinds = /* @__PURE__ */ new Map();
  const toolDefaults = /* @__PURE__ */ new Map();
  for (const t of wireTools) {
    if ("appMethod" in t) {
      toolKinds.set(t.appMethod, "method");
      if (t.defaults) toolDefaults.set(t.appMethod, t.defaults);
    } else {
      toolKinds.set(t.stepType, "step");
      if (t.defaults) toolDefaults.set(t.stepType, t.defaults);
    }
  }
  const maxTurns = Math.min(
    Math.max(options.maxTurns || DEFAULT_MAX_TURNS, 1),
    MAX_TURNS_LIMIT
  );
  const messages = [
    { role: "user", content: JSON.stringify(options.input) }
  ];
  let loopCount = 0;
  let schemaRepairCount = 0;
  const toolCallLog = [];
  const totalUsage = {
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
    totalBillingCost: 0
  };
  const buildResult = (output2, outputRaw, parsedSuccessfully2, turns) => ({
    output: output2,
    outputRaw,
    parsedSuccessfully: parsedSuccessfully2,
    turns,
    usage: totalUsage,
    toolCalls: toolCallLog
  });
  const accumulate = (turn) => {
    totalUsage.inputTokens += turn.usage.inputTokens ?? 0;
    totalUsage.outputTokens += turn.usage.outputTokens ?? 0;
    totalUsage.cacheCreationTokens += turn.usage.cacheCreationTokens ?? 0;
    totalUsage.cacheReadTokens += turn.usage.cacheReadTokens ?? 0;
    totalUsage.totalBillingCost += turn.billingCost;
    for (const event of turn.events) {
      onEvent?.(event);
    }
  };
  const finish = (result) => {
    onEvent?.({ type: "done", ...result });
    logTaskResult(result);
    return result;
  };
  const schemaMismatch = (outputRaw, errors) => {
    onEvent?.({
      type: "error",
      error: "Output did not conform to outputSchema.",
      errors
    });
    return new MindStudioError(
      "[task] Output did not conform to outputSchema after all repair attempts.",
      "task_output_schema_mismatch",
      422,
      {
        outputRaw,
        errors,
        turns: loopCount,
        usage: totalUsage,
        toolCalls: toolCallLog
      }
    );
  };
  const turnFailure = (err) => {
    if (err instanceof TurnError && err.phase === "model") {
      if (isDevMode()) {
        console.error(`[task] Model call failed: ${err.message}`);
      }
      if (outputSchema) {
        throw new MindStudioError(
          `[task] ${err.message}`,
          "task_execution_error",
          500,
          { turns: loopCount, usage: totalUsage, toolCalls: toolCallLog }
        );
      }
      return finish(buildResult(null, "", false, loopCount));
    }
    if (err instanceof TurnError) {
      throw new MindStudioError(
        `[task] ${err.message}`,
        err.errorCode ?? "task_turn_error",
        err.status ?? 500
      );
    }
    throw err;
  };
  while (loopCount < maxTurns) {
    loopCount++;
    let turn;
    try {
      turn = await runTurnWithRetry(httpConfig, {
        model: options.model,
        system,
        messages,
        tools: wireTools
      });
    } catch (err) {
      if (loopCount === 1 && err instanceof TurnError && err.status === 404 && err.errorCode === "not_found") {
        throw new MindStudioError(
          "Task turn endpoint unavailable.",
          TURN_UNAVAILABLE_CODE,
          404
        );
      }
      return turnFailure(err);
    }
    accumulate(turn);
    if (turn.stopReason === "tool_use" && turn.toolCalls.length > 0) {
      messages.push({
        role: "assistant",
        content: turn.text,
        toolCalls: turn.toolCalls
      });
      const results = await Promise.all(
        turn.toolCalls.map(async (toolCall) => {
          onEvent?.({
            type: "tool_call_start",
            id: toolCall.id,
            name: toolCall.name
          });
          const startTime = Date.now();
          const defaults = toolDefaults.get(toolCall.name) || {};
          const mergedInput = mergeToolInput(toolCall.input, defaults);
          const execute = toolKinds.get(toolCall.name) === "method" ? deps.executeMethodTool : deps.executeStepTool;
          const result = await execute(toolCall.name, mergedInput);
          toolCallLog.push({
            name: toolCall.name,
            success: !result.isError,
            durationMs: Date.now() - startTime
          });
          return { toolCall, ...result };
        })
      );
      for (const { toolCall, output: output3, billingCost, isError } of results) {
        if (billingCost) {
          totalUsage.totalBillingCost += billingCost;
        }
        const truncated = truncateToolOutput(output3);
        messages.push({
          role: "user",
          content: JSON.stringify(truncated),
          toolCallId: toolCall.id,
          ...isError && { isToolError: true }
        });
        onEvent?.({
          type: "tool_call_result",
          id: toolCall.id,
          output: truncated
        });
      }
      if (isDevMode()) {
        console.log(`[task] running... turn ${loopCount}/${maxTurns}`);
      }
      continue;
    }
    messages.push({ role: "assistant", content: turn.text });
    let output2;
    let parseOk = true;
    try {
      output2 = JSON.parse(outputSchema ? stripCodeFences(turn.text) : turn.text);
    } catch {
      parseOk = false;
    }
    if (parseOk) {
      if (!outputSchema) {
        return finish(buildResult(output2, turn.text, true, loopCount));
      }
      const errors = validateAgainstSchema(output2, outputSchema);
      if (errors.length === 0) {
        return finish(buildResult(output2, turn.text, true, loopCount));
      }
      if (loopCount < maxTurns && schemaRepairCount < MAX_SCHEMA_REPAIR_ATTEMPTS) {
        schemaRepairCount++;
        messages.push({
          role: "user",
          content: `Your JSON output did not conform to the required schema. Fix these problems and respond again with ONLY the corrected JSON:
${formatValidationErrors(errors)}`
        });
        continue;
      }
      throw schemaMismatch(turn.text, errors);
    }
    if (loopCount < maxTurns) {
      messages.push({
        role: "user",
        content: "Your response was not valid JSON. Please respond with ONLY the JSON output, no other text."
      });
      continue;
    }
    if (outputSchema) {
      throw schemaMismatch(turn.text, [
        { path: "$", message: "output was not valid JSON" }
      ]);
    }
    return finish(buildResult(turn.text, turn.text, false, loopCount));
  }
  messages.push({
    role: "user",
    content: "You have reached the maximum number of turns. Please provide your final output now as JSON."
  });
  let finalText = "";
  try {
    const turn = await runTurnWithRetry(httpConfig, {
      model: options.model,
      system,
      messages,
      tools: []
    });
    accumulate(turn);
    finalText = turn.text;
  } catch (err) {
    if (err instanceof TurnError && err.phase === "model") {
      if (isDevMode()) {
        console.error(`[task] Final model call failed: ${err.message}`);
      }
    } else {
      return turnFailure(err);
    }
  }
  let parsedSuccessfully = true;
  let output;
  try {
    output = JSON.parse(outputSchema ? stripCodeFences(finalText) : finalText);
  } catch {
    output = finalText;
    parsedSuccessfully = false;
  }
  if (outputSchema) {
    if (!parsedSuccessfully) {
      throw schemaMismatch(finalText, [
        { path: "$", message: "output was not valid JSON" }
      ]);
    }
    const errors = validateAgainstSchema(output, outputSchema);
    if (errors.length > 0) {
      throw schemaMismatch(finalText, errors);
    }
  }
  return finish(
    buildResult(output, finalText, parsedSuccessfully, loopCount + 1)
  );
}

// src/generated/steps.ts
function applyStepMethods(AgentClass) {
  const proto = AgentClass.prototype;
  proto.activeCampaignAddNote = function(step, options) {
    return this.executeStep("activeCampaignAddNote", step, options);
  };
  proto.activeCampaignCreateContact = function(step, options) {
    return this.executeStep("activeCampaignCreateContact", step, options);
  };
  proto.addSubtitlesToVideo = function(step, options) {
    return this.executeStep("addSubtitlesToVideo", step, options);
  };
  proto.airtableCreateUpdateRecord = function(step, options) {
    return this.executeStep("airtableCreateUpdateRecord", step, options);
  };
  proto.airtableDeleteRecord = function(step, options) {
    return this.executeStep("airtableDeleteRecord", step, options);
  };
  proto.airtableGetRecord = function(step, options) {
    return this.executeStep("airtableGetRecord", step, options);
  };
  proto.airtableGetTableRecords = function(step, options) {
    return this.executeStep("airtableGetTableRecords", step, options);
  };
  proto.analyzeImage = function(step, options) {
    return this.executeStep("analyzeImage", step, options);
  };
  proto.analyzeVideo = function(step, options) {
    return this.executeStep("analyzeVideo", step, options);
  };
  proto.captureThumbnail = function(step, options) {
    return this.executeStep("captureThumbnail", step, options);
  };
  proto.checkAppRole = function(step, options) {
    return this.executeStep("checkAppRole", step, options);
  };
  proto.codaCreateUpdatePage = function(step, options) {
    return this.executeStep("codaCreateUpdatePage", step, options);
  };
  proto.codaCreateUpdateRow = function(step, options) {
    return this.executeStep("codaCreateUpdateRow", step, options);
  };
  proto.codaFindRow = function(step, options) {
    return this.executeStep("codaFindRow", step, options);
  };
  proto.codaGetPage = function(step, options) {
    return this.executeStep("codaGetPage", step, options);
  };
  proto.codaGetTableRows = function(step, options) {
    return this.executeStep("codaGetTableRows", step, options);
  };
  proto.convertPdfToImages = function(step, options) {
    return this.executeStep("convertPdfToImages", step, options);
  };
  proto.createDataSource = function(step, options) {
    return this.executeStep("createDataSource", step, options);
  };
  proto.createGmailDraft = function(step, options) {
    return this.executeStep("createGmailDraft", step, options);
  };
  proto.createGoogleCalendarEvent = function(step, options) {
    return this.executeStep("createGoogleCalendarEvent", step, options);
  };
  proto.createGoogleDoc = function(step, options) {
    return this.executeStep("createGoogleDoc", step, options);
  };
  proto.createGoogleSheet = function(step, options) {
    return this.executeStep("createGoogleSheet", step, options);
  };
  proto.deleteDataSource = function(step, options) {
    return this.executeStep("deleteDataSource", step, options);
  };
  proto.deleteDataSourceDocument = function(step, options) {
    return this.executeStep("deleteDataSourceDocument", step, options);
  };
  proto.deleteGmailEmail = function(step, options) {
    return this.executeStep("deleteGmailEmail", step, options);
  };
  proto.deleteGoogleCalendarEvent = function(step, options) {
    return this.executeStep("deleteGoogleCalendarEvent", step, options);
  };
  proto.deleteGoogleSheetRows = function(step, options) {
    return this.executeStep("deleteGoogleSheetRows", step, options);
  };
  proto.detectChanges = function(step, options) {
    return this.executeStep("detectChanges", step, options);
  };
  proto.detectPII = function(step, options) {
    return this.executeStep("detectPII", step, options);
  };
  proto.discordEditMessage = function(step, options) {
    return this.executeStep("discordEditMessage", step, options);
  };
  proto.discordSendFollowUp = function(step, options) {
    return this.executeStep("discordSendFollowUp", step, options);
  };
  proto.discordSendMessage = function(step, options) {
    return this.executeStep("discordSendMessage", step, options);
  };
  proto.downloadVideo = function(step, options) {
    return this.executeStep("downloadVideo", step, options);
  };
  proto.enhanceImageGenerationPrompt = function(step, options) {
    return this.executeStep("enhanceImageGenerationPrompt", step, options);
  };
  proto.enhanceVideoGenerationPrompt = function(step, options) {
    return this.executeStep("enhanceVideoGenerationPrompt", step, options);
  };
  proto.enrichPerson = function(step, options) {
    return this.executeStep("enrichPerson", step, options);
  };
  proto.extractAudioFromVideo = function(step, options) {
    return this.executeStep("extractAudioFromVideo", step, options);
  };
  proto.extractText = function(step, options) {
    return this.executeStep("extractText", step, options);
  };
  proto.fetchDataSourceDocument = function(step, options) {
    return this.executeStep("fetchDataSourceDocument", step, options);
  };
  proto.fetchGoogleDoc = function(step, options) {
    return this.executeStep("fetchGoogleDoc", step, options);
  };
  proto.fetchGoogleSheet = function(step, options) {
    return this.executeStep("fetchGoogleSheet", step, options);
  };
  proto.fetchSlackChannelHistory = function(step, options) {
    return this.executeStep("fetchSlackChannelHistory", step, options);
  };
  proto.fetchYoutubeCaptions = function(step, options) {
    return this.executeStep("fetchYoutubeCaptions", step, options);
  };
  proto.fetchYoutubeChannel = function(step, options) {
    return this.executeStep("fetchYoutubeChannel", step, options);
  };
  proto.fetchYoutubeComments = function(step, options) {
    return this.executeStep("fetchYoutubeComments", step, options);
  };
  proto.fetchYoutubeVideo = function(step, options) {
    return this.executeStep("fetchYoutubeVideo", step, options);
  };
  proto.generate3dModel = function(step, options) {
    return this.executeStep("generate3dModel", step, options);
  };
  proto.generateChart = function(step, options) {
    return this.executeStep("generateChart", step, options);
  };
  proto.generateImage = function(step, options) {
    return this.executeStep("generateImage", step, options);
  };
  proto.generateLipsync = function(step, options) {
    return this.executeStep("generateLipsync", step, options);
  };
  proto.generateMusic = function(step, options) {
    return this.executeStep("generateMusic", step, options);
  };
  proto.generateAsset = function(step, options) {
    return this.executeStep("generatePdf", step, options);
  };
  proto.generateStaticVideoFromImage = function(step, options) {
    return this.executeStep("generateStaticVideoFromImage", step, options);
  };
  proto.generateVideo = function(step, options) {
    return this.executeStep("generateVideo", step, options);
  };
  proto.getGmailAttachments = function(step, options) {
    return this.executeStep("getGmailAttachments", step, options);
  };
  proto.getGmailDraft = function(step, options) {
    return this.executeStep("getGmailDraft", step, options);
  };
  proto.getGmailEmail = function(step, options) {
    return this.executeStep("getGmailEmail", step, options);
  };
  proto.getGmailUnreadCount = function(step, options) {
    return this.executeStep("getGmailUnreadCount", step, options);
  };
  proto.getGoogleCalendarEvent = function(step, options) {
    return this.executeStep("getGoogleCalendarEvent", step, options);
  };
  proto.getGoogleDriveFile = function(step, options) {
    return this.executeStep("getGoogleDriveFile", step, options);
  };
  proto.getGoogleSheetInfo = function(step, options) {
    return this.executeStep("getGoogleSheetInfo", step, options);
  };
  proto.getMediaMetadata = function(step, options) {
    return this.executeStep("getMediaMetadata", step, options);
  };
  proto.hubspotCreateCompany = function(step, options) {
    return this.executeStep("hubspotCreateCompany", step, options);
  };
  proto.hubspotCreateContact = function(step, options) {
    return this.executeStep("hubspotCreateContact", step, options);
  };
  proto.hubspotGetCompany = function(step, options) {
    return this.executeStep("hubspotGetCompany", step, options);
  };
  proto.hubspotGetContact = function(step, options) {
    return this.executeStep("hubspotGetContact", step, options);
  };
  proto.hunterApiCompanyEnrichment = function(step, options) {
    return this.executeStep("hunterApiCompanyEnrichment", step, options);
  };
  proto.hunterApiDomainSearch = function(step, options) {
    return this.executeStep("hunterApiDomainSearch", step, options);
  };
  proto.hunterApiEmailFinder = function(step, options) {
    return this.executeStep("hunterApiEmailFinder", step, options);
  };
  proto.hunterApiEmailVerification = function(step, options) {
    return this.executeStep("hunterApiEmailVerification", step, options);
  };
  proto.hunterApiPersonEnrichment = function(step, options) {
    return this.executeStep("hunterApiPersonEnrichment", step, options);
  };
  proto.imageFaceSwap = function(step, options) {
    return this.executeStep("imageFaceSwap", step, options);
  };
  proto.imageRemoveWatermark = function(step, options) {
    return this.executeStep("imageRemoveWatermark", step, options);
  };
  proto.insertVideoClips = function(step, options) {
    return this.executeStep("insertVideoClips", step, options);
  };
  proto.listDataSources = function(step, options) {
    return this.executeStep("listDataSources", step, options);
  };
  proto.listGmailDrafts = function(step, options) {
    return this.executeStep("listGmailDrafts", step, options);
  };
  proto.listGmailLabels = function(step, options) {
    return this.executeStep("listGmailLabels", step, options);
  };
  proto.listGoogleCalendarEvents = function(step, options) {
    return this.executeStep("listGoogleCalendarEvents", step, options);
  };
  proto.listGoogleDriveFiles = function(step, options) {
    return this.executeStep("listGoogleDriveFiles", step, options);
  };
  proto.listRecentGmailEmails = function(step, options) {
    return this.executeStep("listRecentGmailEmails", step, options);
  };
  proto.logic = function(step, options) {
    return this.executeStep("logic", step, options);
  };
  proto.makeDotComRunScenario = function(step, options) {
    return this.executeStep("makeDotComRunScenario", step, options);
  };
  proto.mergeAudio = function(step, options) {
    return this.executeStep("mergeAudio", step, options);
  };
  proto.mergeVideos = function(step, options) {
    return this.executeStep("mergeVideos", step, options);
  };
  proto.meshyAnimate = function(step, options) {
    return this.executeStep("meshyAnimate", step, options);
  };
  proto.meshyImageTo3d = function(step, options) {
    return this.executeStep("meshyImageTo3d", step, options);
  };
  proto.meshyRemesh = function(step, options) {
    return this.executeStep("meshyRemesh", step, options);
  };
  proto.meshyRig = function(step, options) {
    return this.executeStep("meshyRig", step, options);
  };
  proto.meshyTextTo3d = function(step, options) {
    return this.executeStep("meshyTextTo3d", step, options);
  };
  proto.meshyTexture = function(step, options) {
    return this.executeStep("meshyTexture", step, options);
  };
  proto.mixAudioIntoVideo = function(step, options) {
    return this.executeStep("mixAudioIntoVideo", step, options);
  };
  proto.muteVideo = function(step, options) {
    return this.executeStep("muteVideo", step, options);
  };
  proto.n8nRunNode = function(step, options) {
    return this.executeStep("n8nRunNode", step, options);
  };
  proto.notionCreatePage = function(step, options) {
    return this.executeStep("notionCreatePage", step, options);
  };
  proto.notionUpdatePage = function(step, options) {
    return this.executeStep("notionUpdatePage", step, options);
  };
  proto.particlePodcastsFindMentions = function(step, options) {
    return this.executeStep("particlePodcastsFindMentions", step, options);
  };
  proto.particlePodcastsGetEpisode = function(step, options) {
    return this.executeStep("particlePodcastsGetEpisode", step, options);
  };
  proto.particlePodcastsGetEpisodeTranscript = function(step, options) {
    return this.executeStep("particlePodcastsGetEpisodeTranscript", step, options);
  };
  proto.particlePodcastsSearchCompanies = function(step, options) {
    return this.executeStep("particlePodcastsSearchCompanies", step, options);
  };
  proto.particlePodcastsSearchDialogue = function(step, options) {
    return this.executeStep("particlePodcastsSearchDialogue", step, options);
  };
  proto.particlePodcastsSearchPodcasts = function(step, options) {
    return this.executeStep("particlePodcastsSearchPodcasts", step, options);
  };
  proto.peopleSearch = function(step, options) {
    return this.executeStep("peopleSearch", step, options);
  };
  proto.postToLinkedIn = function(step, options) {
    return this.executeStep("postToLinkedIn", step, options);
  };
  proto.postToSlackChannel = function(step, options) {
    return this.executeStep("postToSlackChannel", step, options);
  };
  proto.postToX = function(step, options) {
    return this.executeStep("postToX", step, options);
  };
  proto.postToZapier = function(step, options) {
    return this.executeStep("postToZapier", step, options);
  };
  proto.queryAppDatabase = function(step, options) {
    return this.executeStep("queryAppDatabase", step, options);
  };
  proto.queryDataSource = function(step, options) {
    return this.executeStep("queryDataSource", step, options);
  };
  proto.queryExternalDatabase = function(step, options) {
    return this.executeStep("queryExternalDatabase", step, options);
  };
  proto.redactPII = function(step, options) {
    return this.executeStep("redactPII", step, options);
  };
  proto.removeBackgroundFromImage = function(step, options) {
    return this.executeStep("removeBackgroundFromImage", step, options);
  };
  proto.replyToGmailEmail = function(step, options) {
    return this.executeStep("replyToGmailEmail", step, options);
  };
  proto.resizeVideo = function(step, options) {
    return this.executeStep("resizeVideo", step, options);
  };
  proto.runFromConnectorRegistry = function(step, options) {
    return this.executeStep("runFromConnectorRegistry", step, options);
  };
  proto.runPackagedWorkflow = function(step, options) {
    return this.executeStep("runPackagedWorkflow", step, options);
  };
  proto.scrapeLinkedInCompany = function(step, options) {
    return this.executeStep("scrapeLinkedInCompany", step, options);
  };
  proto.scrapeLinkedInProfile = function(step, options) {
    return this.executeStep("scrapeLinkedInProfile", step, options);
  };
  proto.scrapeUrl = function(step, options) {
    return this.executeStep("scrapeUrl", step, options);
  };
  proto.scrapeXPost = function(step, options) {
    return this.executeStep("scrapeXPost", step, options);
  };
  proto.scrapeXProfile = function(step, options) {
    return this.executeStep("scrapeXProfile", step, options);
  };
  proto.screenshotUrl = function(step, options) {
    return this.executeStep("screenshotUrl", step, options);
  };
  proto.searchGmailEmails = function(step, options) {
    return this.executeStep("searchGmailEmails", step, options);
  };
  proto.searchGoogle = function(step, options) {
    return this.executeStep("searchGoogle", step, options);
  };
  proto.searchGoogleCalendarEvents = function(step, options) {
    return this.executeStep("searchGoogleCalendarEvents", step, options);
  };
  proto.searchGoogleDrive = function(step, options) {
    return this.executeStep("searchGoogleDrive", step, options);
  };
  proto.searchGoogleImages = function(step, options) {
    return this.executeStep("searchGoogleImages", step, options);
  };
  proto.searchGoogleNews = function(step, options) {
    return this.executeStep("searchGoogleNews", step, options);
  };
  proto.searchGoogleTrends = function(step, options) {
    return this.executeStep("searchGoogleTrends", step, options);
  };
  proto.searchPerplexity = function(step, options) {
    return this.executeStep("searchPerplexity", step, options);
  };
  proto.searchXPosts = function(step, options) {
    return this.executeStep("searchXPosts", step, options);
  };
  proto.searchYoutube = function(step, options) {
    return this.executeStep("searchYoutube", step, options);
  };
  proto.searchYoutubeTrends = function(step, options) {
    return this.executeStep("searchYoutubeTrends", step, options);
  };
  proto.sendEmail = function(step, options) {
    return this.executeStep("sendEmail", step, options);
  };
  proto.sendGmailDraft = function(step, options) {
    return this.executeStep("sendGmailDraft", step, options);
  };
  proto.sendGmailMessage = function(step, options) {
    return this.executeStep("sendGmailMessage", step, options);
  };
  proto.sendSlackDirectMessage = function(step, options) {
    return this.executeStep("sendSlackDirectMessage", step, options);
  };
  proto.sendSMS = function(step, options) {
    return this.executeStep("sendSMS", step, options);
  };
  proto.setGmailReadStatus = function(step, options) {
    return this.executeStep("setGmailReadStatus", step, options);
  };
  proto.setRunTitle = function(step, options) {
    return this.executeStep("setRunTitle", step, options);
  };
  proto.setVariable = function(step, options) {
    return this.executeStep("setVariable", step, options);
  };
  proto.telegramEditMessage = function(step, options) {
    return this.executeStep("telegramEditMessage", step, options);
  };
  proto.telegramReplyToMessage = function(step, options) {
    return this.executeStep("telegramReplyToMessage", step, options);
  };
  proto.telegramSendAudio = function(step, options) {
    return this.executeStep("telegramSendAudio", step, options);
  };
  proto.telegramSendFile = function(step, options) {
    return this.executeStep("telegramSendFile", step, options);
  };
  proto.telegramSendImage = function(step, options) {
    return this.executeStep("telegramSendImage", step, options);
  };
  proto.telegramSendMessage = function(step, options) {
    return this.executeStep("telegramSendMessage", step, options);
  };
  proto.telegramSendVideo = function(step, options) {
    return this.executeStep("telegramSendVideo", step, options);
  };
  proto.telegramSetTyping = function(step, options) {
    return this.executeStep("telegramSetTyping", step, options);
  };
  proto.textToSpeech = function(step, options) {
    return this.executeStep("textToSpeech", step, options);
  };
  proto.transcribeAudio = function(step, options) {
    return this.executeStep("transcribeAudio", step, options);
  };
  proto.trimMedia = function(step, options) {
    return this.executeStep("trimMedia", step, options);
  };
  proto.updateGmailLabels = function(step, options) {
    return this.executeStep("updateGmailLabels", step, options);
  };
  proto.updateGoogleCalendarEvent = function(step, options) {
    return this.executeStep("updateGoogleCalendarEvent", step, options);
  };
  proto.updateGoogleDoc = function(step, options) {
    return this.executeStep("updateGoogleDoc", step, options);
  };
  proto.updateGoogleSheet = function(step, options) {
    return this.executeStep("updateGoogleSheet", step, options);
  };
  proto.uploadDataSourceDocument = function(step, options) {
    return this.executeStep("uploadDataSourceDocument", step, options);
  };
  proto.upscaleImage = function(step, options) {
    return this.executeStep("upscaleImage", step, options);
  };
  proto.upscaleVideo = function(step, options) {
    return this.executeStep("upscaleVideo", step, options);
  };
  proto.generateText = function(step, options) {
    return this.executeStep("userMessage", step, options);
  };
  proto.videoFaceSwap = function(step, options) {
    return this.executeStep("videoFaceSwap", step, options);
  };
  proto.videoRemoveBackground = function(step, options) {
    return this.executeStep("videoRemoveBackground", step, options);
  };
  proto.videoRemoveWatermark = function(step, options) {
    return this.executeStep("videoRemoveWatermark", step, options);
  };
  proto.watermarkImage = function(step, options) {
    return this.executeStep("watermarkImage", step, options);
  };
  proto.watermarkVideo = function(step, options) {
    return this.executeStep("watermarkVideo", step, options);
  };
  proto.youDotComFinanceResearch = function(step, options) {
    return this.executeStep("youDotComFinanceResearch", step, options);
  };
  proto.youDotComGetPageContent = function(step, options) {
    return this.executeStep("youDotComGetPageContent", step, options);
  };
  proto.youDotComLiveNews = function(step, options) {
    return this.executeStep("youDotComLiveNews", step, options);
  };
  proto.youDotComWebResearch = function(step, options) {
    return this.executeStep("youDotComWebResearch", step, options);
  };
  proto.youDotComWebSearch = function(step, options) {
    return this.executeStep("youDotComWebSearch", step, options);
  };
}

// src/client.ts
var DEFAULT_BASE_URL = "https://v1.mindstudio-api.com";
var DEFAULT_MAX_RETRIES = 3;
var MindStudioAgent = class {
  /** @internal */
  _httpConfig;
  /** @internal */
  _reuseThreadId;
  /** @internal */
  _threadId;
  /** @internal Stream ID for SSE token streaming. Set by sandbox via STREAM_ID env var. */
  _streamId;
  // ---- App context (db + auth) ----
  /**
   * @internal App ID for context resolution. Resolved from:
   * constructor appId → MINDSTUDIO_APP_ID env → sandbox globals →
   * auto-detected from first executeStep response header.
   */
  _appId;
  /**
   * @internal Cached app context (auth + databases). Populated by
   * ensureContext() and cached for the lifetime of the instance.
   */
  _context;
  /**
   * @internal Deduplication promise for ensureContext(). Ensures only one
   * context fetch is in-flight at a time, even if multiple db/auth
   * operations trigger it concurrently.
   */
  _contextPromise;
  /** @internal Cached AuthContext instance, created during context hydration. */
  _auth;
  /** @internal Cached Db namespace instance, created during context hydration. */
  _db;
  /** @internal Cached Files namespace instance (lazy; no context hydration needed). */
  _files;
  _dataSources;
  _voice;
  /** @internal Auth type — 'internal' for CALLBACK_TOKEN (managed mode), 'apiKey' otherwise. */
  _authType;
  /** @internal Usage source sent on step executions (from MINDSTUDIO_REQUEST_SOURCE).
   *  Only set for api-key (CLI) auth so in-app/managed runtime is unaffected. */
  _requestSource;
  /**
   * @internal Resolve the current auth token. Checks ALS request context
   * first, then CALLBACK_TOKEN env var, then static config token.
   */
  get _token() {
    const rctx = getRequestContext();
    if (rctx?.callbackToken) return rctx.callbackToken;
    if (this._authType === "internal" && process.env.CALLBACK_TOKEN) {
      return process.env.CALLBACK_TOKEN;
    }
    return this._httpConfig.token;
  }
  /**
   * @internal HTTP config with ALS-aware baseUrl and token resolution.
   * Used instead of `_httpConfig` at all `request()` call sites.
   */
  get _currentHttpConfig() {
    const rctx = getRequestContext();
    if (rctx?.remoteHostname) {
      return {
        ...this._httpConfig,
        baseUrl: rctx.remoteHostname,
        token: this._token
      };
    }
    return this._httpConfig;
  }
  /**
   * @internal Stream ID with ALS-aware resolution.
   */
  get _currentStreamId() {
    return getRequestContext()?.streamId ?? this._streamId;
  }
  /**
   * @internal Get resolved app context from ALS or instance cache.
   */
  _getContext() {
    const rctx = getRequestContext();
    if (rctx?.auth && rctx?.databases) {
      return {
        auth: rctx.auth,
        databases: rctx.databases,
        authConfig: rctx.authConfig
      };
    }
    return this._context;
  }
  constructor(options = {}) {
    const config = loadConfig();
    const { token, authType } = resolveToken(options.apiKey, config);
    const rctx = getRequestContext();
    const baseUrl = options.baseUrl ?? rctx?.remoteHostname ?? process.env.MINDSTUDIO_BASE_URL ?? process.env.REMOTE_HOSTNAME ?? config.baseUrl ?? DEFAULT_BASE_URL;
    this._reuseThreadId = options.reuseThreadId ?? /^(true|1)$/i.test(process.env.MINDSTUDIO_REUSE_THREAD_ID ?? "");
    this._appId = options.appId ?? process.env.MINDSTUDIO_APP_ID ?? void 0;
    this._authType = authType;
    this._requestSource = authType === "apiKey" ? process.env.MINDSTUDIO_REQUEST_SOURCE || void 0 : void 0;
    this._httpConfig = {
      baseUrl,
      token,
      rateLimiter: new RateLimiter(authType),
      maxRetries: options.maxRetries ?? DEFAULT_MAX_RETRIES
    };
    if (authType === "internal") {
      this._trySandboxHydration();
    }
    this._streamId = process.env.STREAM_ID ?? void 0;
  }
  /**
   * Execute any step by its type name. This is the low-level method that all
   * typed step methods delegate to. Use it as an escape hatch for step types
   * not yet covered by the generated methods.
   *
   * ```ts
   * const result = await agent.executeStep("generateImage", { prompt: "hello", mode: "background" });
   * ```
   */
  async executeStep(stepType, step, options) {
    if (options?.onLog) {
      return this._executeStepStreaming(
        stepType,
        step,
        options
      );
    }
    const threadId = options?.threadId ?? (this._reuseThreadId && !getRequestContext() ? this._threadId : void 0);
    const { data: asyncData, headers } = await request(this._currentHttpConfig, "POST", `/steps/${stepType}/execute-async`, {
      step,
      ...options?.appId != null && { appId: options.appId },
      ...threadId != null && { threadId },
      ...this._currentStreamId != null && { streamId: this._currentStreamId },
      ...(options?.requestSource ?? this._requestSource) != null && {
        requestSource: options?.requestSource ?? this._requestSource
      },
      ...assetStoreBody(options?.store)
    });
    const remaining = headers.get("x-ratelimit-remaining");
    const returnedThreadId = asyncData.threadId ?? "";
    if (this._reuseThreadId && returnedThreadId && !getRequestContext()) {
      this._threadId = returnedThreadId;
    }
    if (!this._appId && asyncData.appId && !getRequestContext()) {
      this._appId = asyncData.appId;
    }
    const pollUrl = `${this._currentHttpConfig.baseUrl}/developer/v2/steps/${stepType}/execute-async/poll/${asyncData.executionToken}`;
    let pollDelay = 100;
    while (true) {
      await sleep3(pollDelay);
      pollDelay = Math.min(pollDelay * 2, 5e3);
      const res = await fetch(pollUrl, {
        headers: { "User-Agent": "@mindstudio-ai/agent" }
      });
      if (res.status === 502 || res.status === 503 || res.status === 504)
        continue;
      if (res.status === 404) {
        throw new MindStudioError(
          `[${stepType}] Execution token expired.`,
          "poll_token_expired",
          404
        );
      }
      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}));
        throw new MindStudioError(
          errorBody.message ?? errorBody.error ?? `[${stepType}] Poll failed: ${res.status} ${res.statusText}`,
          errorBody.code ?? "poll_error",
          res.status,
          errorBody
        );
      }
      const poll = await res.json();
      if (poll.status === "pending") continue;
      if (poll.status === "error") {
        throw new MindStudioError(
          `[${stepType}] ${poll.error ?? "Step execution failed."}`,
          "step_error",
          500
        );
      }
      let output;
      if (poll.output != null) {
        output = poll.output;
      } else if (poll.outputUrl) {
        const s3Res = await fetch(poll.outputUrl);
        if (!s3Res.ok) {
          throw new MindStudioError(
            `Failed to fetch ${stepType} output from S3: ${s3Res.status} ${s3Res.statusText}`,
            "output_fetch_error",
            s3Res.status
          );
        }
        const envelope = await s3Res.json();
        output = envelope.value;
      } else {
        output = void 0;
      }
      return {
        ...output,
        $appId: poll.appId ?? asyncData.appId ?? "",
        $threadId: poll.threadId ?? returnedThreadId,
        $rateLimitRemaining: remaining != null ? parseInt(remaining, 10) : void 0,
        $billingCost: poll.billingCost,
        $billingEvents: poll.billingEvents
      };
    }
  }
  /**
   * @internal Streaming step execution — sends `Accept: text/event-stream`
   * and parses SSE events for real-time debug logs.
   */
  async _executeStepStreaming(stepType, step, options) {
    const threadId = options.threadId ?? (this._reuseThreadId && !getRequestContext() ? this._threadId : void 0);
    const url = `${this._currentHttpConfig.baseUrl}/developer/v2/steps/${stepType}/execute`;
    const body = {
      step,
      ...options.appId != null && { appId: options.appId },
      ...threadId != null && { threadId },
      ...this._currentStreamId != null && { streamId: this._currentStreamId },
      ...(options.requestSource ?? this._requestSource) != null && {
        requestSource: options.requestSource ?? this._requestSource
      },
      ...assetStoreBody(options.store)
    };
    await this._httpConfig.rateLimiter.acquire();
    let res;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this._token}`,
          "Content-Type": "application/json",
          "User-Agent": "@mindstudio-ai/agent",
          Accept: "text/event-stream"
        },
        body: JSON.stringify(body)
      });
    } catch (err) {
      this._httpConfig.rateLimiter.release();
      throw err;
    }
    this._httpConfig.rateLimiter.updateFromHeaders(res.headers);
    if (!res.ok) {
      this._httpConfig.rateLimiter.release();
      let message = `${res.status} ${res.statusText}`;
      let code = "api_error";
      let details;
      try {
        const text = await res.text();
        try {
          const body2 = JSON.parse(text);
          details = body2;
          const errMsg = (typeof body2.error === "string" ? body2.error : void 0) ?? (typeof body2.message === "string" ? body2.message : void 0) ?? (typeof body2.details === "string" ? body2.details : void 0);
          if (errMsg) message = errMsg;
          else if (body2.error || body2.message || body2.details) {
            message = JSON.stringify(
              body2.error ?? body2.message ?? body2.details
            );
          }
          if (body2.code) code = body2.code;
        } catch {
          const stripped = text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
          if (stripped) message = stripped.slice(0, 200);
        }
      } catch {
      }
      throw new MindStudioError(
        `[${stepType}] ${message}`,
        code,
        res.status,
        details
      );
    }
    const headers = res.headers;
    try {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let doneEvent = null;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === "log") {
              options.onLog({
                value: event.value,
                tag: event.tag,
                ts: event.ts
              });
            } else if (event.type === "done") {
              doneEvent = {
                output: event.output,
                outputUrl: event.outputUrl,
                billingCost: event.billingCost,
                billingEvents: event.billingEvents
              };
            } else if (event.type === "error") {
              throw new MindStudioError(
                `[${stepType}] ${event.error || "Step execution failed"}`,
                "step_error",
                500
              );
            }
          } catch (err) {
            if (err instanceof MindStudioError) throw err;
          }
        }
      }
      if (buffer.startsWith("data: ")) {
        try {
          const event = JSON.parse(buffer.slice(6));
          if (event.type === "done") {
            doneEvent = {
              output: event.output,
              outputUrl: event.outputUrl,
              billingCost: event.billingCost,
              billingEvents: event.billingEvents
            };
          } else if (event.type === "error") {
            throw new MindStudioError(
              event.error || "Step execution failed",
              "step_error",
              500
            );
          } else if (event.type === "log") {
            options.onLog({
              value: event.value,
              tag: event.tag,
              ts: event.ts
            });
          }
        } catch (err) {
          if (err instanceof MindStudioError) throw err;
        }
      }
      if (!doneEvent) {
        throw new MindStudioError(
          `[${stepType}] Stream ended unexpectedly without completing. The step execution may have been interrupted.`,
          "stream_error",
          500
        );
      }
      let output;
      if (doneEvent.output != null) {
        output = doneEvent.output;
      } else if (doneEvent.outputUrl) {
        const s3Res = await fetch(doneEvent.outputUrl);
        if (!s3Res.ok) {
          throw new MindStudioError(
            `Failed to fetch ${stepType} output from S3: ${s3Res.status} ${s3Res.statusText}`,
            "output_fetch_error",
            s3Res.status
          );
        }
        const envelope = await s3Res.json();
        output = envelope.value;
      } else {
        output = void 0;
      }
      const returnedThreadId = headers.get("x-mindstudio-thread-id") ?? "";
      if (this._reuseThreadId && returnedThreadId && !getRequestContext()) {
        this._threadId = returnedThreadId;
      }
      const returnedAppId = headers.get("x-mindstudio-app-id");
      if (!this._appId && returnedAppId && !getRequestContext()) {
        this._appId = returnedAppId;
      }
      const remaining = headers.get("x-ratelimit-remaining");
      return {
        ...output,
        $appId: headers.get("x-mindstudio-app-id") ?? "",
        $threadId: returnedThreadId,
        $rateLimitRemaining: remaining != null ? parseInt(remaining, 10) : void 0,
        $billingCost: doneEvent.billingCost,
        $billingEvents: doneEvent.billingEvents
      };
    } finally {
      this._httpConfig.rateLimiter.release();
    }
  }
  /**
   * Execute multiple steps in parallel in a single request.
   *
   * All steps run in parallel on the server. Results are returned in the same
   * order as the input. Individual step failures do not affect other steps —
   * partial success is possible.
   *
   * ```ts
   * const { results } = await agent.executeStepBatch([
   *   { stepType: 'generateImage', step: { prompt: 'a sunset' } },
   *   { stepType: 'textToSpeech', step: { text: 'Hello world' } },
   * ]);
   * ```
   */
  async executeStepBatch(steps, options) {
    const threadId = options?.threadId ?? (this._reuseThreadId && !getRequestContext() ? this._threadId : void 0);
    const { data: asyncData } = await request(this._currentHttpConfig, "POST", "/steps/execute-batch-async", {
      steps: steps.map((s) => ({
        ...s,
        stepType: resolveStepType2(s.stepType)
      })),
      ...options?.appId != null && { appId: options.appId },
      ...threadId != null && { threadId },
      ...this._requestSource != null && {
        requestSource: this._requestSource
      },
      ...assetStoreBody(options?.store)
    });
    const pollUrl = `${this._currentHttpConfig.baseUrl}/developer/v2/steps/execute-batch-async/poll/${asyncData.batchToken}`;
    let pollDelay = 300;
    while (true) {
      await sleep3(pollDelay);
      pollDelay = Math.min(pollDelay * 1.5, 3e3);
      const res = await fetch(pollUrl, {
        headers: { "User-Agent": "@mindstudio-ai/agent" }
      });
      if (res.status === 502 || res.status === 503 || res.status === 504)
        continue;
      if (res.status === 404) {
        throw new MindStudioError(
          "Batch poll token not found or expired.",
          "poll_token_expired",
          404
        );
      }
      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}));
        throw new MindStudioError(
          errorBody.message ?? errorBody.error ?? `Batch poll failed: ${res.status} ${res.statusText}`,
          errorBody.code ?? "poll_error",
          res.status,
          errorBody
        );
      }
      const poll = await res.json();
      if (poll.status === "pending") {
        if (options?.onProgress && poll.totalSteps != null && poll.completedSteps != null) {
          options.onProgress(poll.completedSteps, poll.totalSteps);
        }
        continue;
      }
      if (poll.status === "error") {
        throw new MindStudioError(
          poll.error ?? "Batch execution failed.",
          "batch_execution_error",
          500
        );
      }
      const results = await Promise.all(
        poll.results.map(async (r) => {
          if (r.output != null) {
            return {
              stepType: r.stepType,
              output: r.output,
              billingCost: r.billingCost,
              error: r.error
            };
          }
          if (r.outputUrl) {
            const s3Res = await fetch(r.outputUrl);
            if (!s3Res.ok) {
              return {
                stepType: r.stepType,
                error: `Failed to fetch output from S3: ${s3Res.status} ${s3Res.statusText}`
              };
            }
            const envelope = await s3Res.json();
            return {
              stepType: r.stepType,
              output: envelope.value,
              billingCost: r.billingCost
            };
          }
          return {
            stepType: r.stepType,
            billingCost: r.billingCost,
            error: r.error
          };
        })
      );
      const resultThreadId = poll.threadId ?? asyncData.threadId;
      if (this._reuseThreadId && resultThreadId && !getRequestContext()) {
        this._threadId = resultThreadId;
      }
      return {
        results,
        totalBillingCost: poll.totalBillingCost,
        appId: poll.appId,
        threadId: resultThreadId
      };
    }
  }
  async runTask(options) {
    const taskPromise = this._runTaskInner(options);
    const hook = globalThis.__msWaitUntil;
    if (typeof hook === "function") {
      try {
        hook(taskPromise.catch(() => {
        }));
      } catch {
      }
    }
    return taskPromise;
  }
  /**
   * Register background work with the platform so the sandbox stays alive
   * until it settles (bounded at ~30 minutes) instead of being reaped as
   * idle, and so an interruption is recorded in the request log if the
   * sandbox is torn down anyway.
   *
   * Use it for the fire-and-forget pattern — kick off slow work, return
   * early, write results back when it finishes:
   *
   * ```ts
   * mindstudio.waitUntil(
   *   enrichRecord(id)
   *     .then((data) => Records.update(id, { ...data, status: 'ready' }))
   *     .catch(() => Records.update(id, { status: 'failed' })),
   * );
   * return { status: 'processing' };
   * ```
   *
   * Failures of the registered promise are caught and logged to the request
   * log — they can never crash the sandbox. Outside a managed sandbox this
   * degrades to just that error-catching. If you need the result, keep your
   * own reference to the promise and `await` it — `waitUntil` returns void.
   */
  waitUntil(promise) {
    const caught = Promise.resolve(promise).catch((err) => {
      console.error(
        "[waitUntil] Background work failed:",
        err instanceof Error ? err.stack ?? err.message : String(err)
      );
    });
    const hook = globalThis.__msWaitUntil;
    if (typeof hook === "function") {
      try {
        hook(caught);
      } catch {
      }
    }
  }
  async _runTaskInner(options) {
    const httpConfig = this._currentHttpConfig;
    try {
      return await runTaskLocal(
        {
          httpConfig,
          executeStepTool: async (stepType, input) => {
            try {
              const result = await this.executeStep(stepType, input, {
                requestSource: "v2-task"
              });
              const output = {};
              let billingCost = 0;
              for (const [key, value] of Object.entries(
                result
              )) {
                if (key === "$billingCost" && typeof value === "number") {
                  billingCost = value;
                }
                if (!key.startsWith("$")) {
                  output[key] = value;
                }
              }
              return { output, billingCost, isError: false };
            } catch (err) {
              return {
                output: {
                  error: err instanceof Error ? err.message : "Step execution failed"
                },
                billingCost: 0,
                isError: true
              };
            }
          },
          executeMethodTool: async (methodId, input) => {
            try {
              const { data } = await request(
                { ...httpConfig, maxRetries: 0 },
                "POST",
                "/task/invoke-method",
                {
                  methodId,
                  input
                }
              );
              if (data.error) {
                return {
                  output: { error: data.error },
                  billingCost: 0,
                  isError: true
                };
              }
              return {
                output: data.output ?? null,
                billingCost: 0,
                isError: false
              };
            } catch (err) {
              return {
                output: {
                  error: err instanceof Error ? err.message : "Method execution failed"
                },
                billingCost: 0,
                isError: true
              };
            }
          }
        },
        options
      );
    } catch (err) {
      if (err instanceof MindStudioError && err.code === TURN_UNAVAILABLE_CODE) {
        const body = buildTaskRequestBody(options);
        const result = options.onEvent ? await runTaskStream(httpConfig, body, options.onEvent) : await runTaskPoll(httpConfig, body);
        if (options.outputSchema) {
          const errors = result.parsedSuccessfully ? validateAgainstSchema(result.output, options.outputSchema) : [{ path: "$", message: "output was not valid JSON" }];
          if (errors.length > 0) {
            throw new MindStudioError(
              "[task] Output did not conform to outputSchema (legacy task route, no repair turns).",
              "task_output_schema_mismatch",
              422,
              {
                outputRaw: result.outputRaw,
                errors,
                turns: result.turns,
                usage: result.usage,
                toolCalls: result.toolCalls
              }
            );
          }
        }
        return result;
      }
      throw err;
    }
  }
  /**
   * Get the authenticated user's identity and organization info.
   *
   * ```ts
   * const info = await agent.getUserInfo();
   * console.log(info.displayName, info.organizationName);
   * ```
   */
  async getUserInfo() {
    const { data } = await request(
      this._currentHttpConfig,
      "GET",
      "/account/userinfo"
    );
    return data;
  }
  /**
   * List all pre-built agents in the organization.
   *
   * ```ts
   * const { apps } = await agent.listAgents();
   * for (const app of apps) console.log(app.name, app.id);
   * ```
   */
  async listAgents() {
    const { data } = await request(
      this._currentHttpConfig,
      "GET",
      "/agents/load"
    );
    return data;
  }
  /**
   * Run a pre-built agent and wait for the result.
   *
   * Uses async polling internally — the request returns immediately with a
   * callback token, then polls until the run completes or fails.
   *
   * ```ts
   * const result = await agent.runAgent({
   *   appId: 'your-agent-id',
   *   variables: { query: 'hello' },
   * });
   * console.log(result.result);
   * ```
   */
  async runAgent(options) {
    const pollInterval = options.pollIntervalMs ?? 1e3;
    const { data } = await request(this._currentHttpConfig, "POST", "/agents/run", {
      appId: options.appId,
      async: true,
      ...options.variables != null && { variables: options.variables },
      ...options.workflow != null && { workflow: options.workflow },
      ...options.version != null && { version: options.version },
      ...options.includeBillingCost != null && {
        includeBillingCost: options.includeBillingCost
      },
      ...options.metadata != null && { metadata: options.metadata }
    });
    const token = data.callbackToken;
    const pollUrl = `${this._currentHttpConfig.baseUrl}/developer/v2/agents/run/poll/${token}`;
    while (true) {
      await sleep3(pollInterval);
      const res = await fetch(pollUrl, {
        headers: { "User-Agent": "@mindstudio-ai/agent" }
      });
      if (res.status === 502 || res.status === 503 || res.status === 504)
        continue;
      if (res.status === 404) {
        throw new MindStudioError(
          "Poll token not found or expired.",
          "poll_token_expired",
          404
        );
      }
      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}));
        throw new MindStudioError(
          errorBody.message ?? errorBody.error ?? `Poll request failed: ${res.status} ${res.statusText}`,
          errorBody.code ?? "poll_error",
          res.status,
          errorBody
        );
      }
      const poll = await res.json();
      if (poll.status === "pending") continue;
      if (poll.status === "error") {
        throw new MindStudioError(
          poll.error ?? "Agent run failed.",
          "agent_run_error",
          500
        );
      }
      return poll.result;
    }
  }
  /** @internal Used by generated action methods. */
  _request(method, path, body) {
    return request(this._currentHttpConfig, method, path, body);
  }
  // -------------------------------------------------------------------------
  // Helper methods — models
  // -------------------------------------------------------------------------
  /** List all available AI models. */
  async listModels() {
    const { data } = await request(
      this._currentHttpConfig,
      "GET",
      "/helpers/models"
    );
    return data;
  }
  /** List AI models filtered by type. */
  async listModelsByType(modelType) {
    const { data } = await request(
      this._currentHttpConfig,
      "GET",
      `/helpers/models/${modelType}`
    );
    return data;
  }
  /** List all available AI models (summary). Returns only id, name, type, and tags. */
  async listModelsSummary() {
    const { data } = await request(
      this._currentHttpConfig,
      "GET",
      "/helpers/models-summary"
    );
    return data;
  }
  /** List AI models (summary) filtered by type. */
  async listModelsSummaryByType(modelType) {
    const { data } = await request(
      this._currentHttpConfig,
      "GET",
      `/helpers/models-summary/${modelType}`
    );
    return data;
  }
  // -------------------------------------------------------------------------
  // Helper methods — OAuth connectors & connections
  // -------------------------------------------------------------------------
  /**
   * List available OAuth connector services (Slack, Google, HubSpot, etc.).
   *
   * These are third-party integrations from the MindStudio Connector Registry.
   * For most tasks, use actions directly instead.
   */
  async listConnectors() {
    const { data } = await request(
      this._currentHttpConfig,
      "GET",
      "/helpers/connectors"
    );
    return data;
  }
  /** Get details for a single OAuth connector service. */
  async getConnector(serviceId) {
    const { data } = await request(
      this._currentHttpConfig,
      "GET",
      `/helpers/connectors/${serviceId}`
    );
    return data;
  }
  /** Get the full configuration for an OAuth connector action, including input fields. */
  async getConnectorAction(serviceId, actionId) {
    const { data } = await request(
      this._currentHttpConfig,
      "GET",
      `/helpers/connectors/${serviceId}/${actionId}`
    );
    return data;
  }
  /** List OAuth connections for the organization. These are authenticated third-party service links. */
  async listConnections() {
    const { data } = await request(
      this._currentHttpConfig,
      "GET",
      "/helpers/connections"
    );
    return data;
  }
  /** List packaged workflows available to the organization. */
  async listPackagedWorkflows() {
    const { data } = await request(
      this._currentHttpConfig,
      "GET",
      "/helpers/packaged-workflows"
    );
    return data;
  }
  // -------------------------------------------------------------------------
  // Helper methods — cost estimation
  // -------------------------------------------------------------------------
  /** Estimate the cost of executing an action before running it. */
  async estimateStepCost(stepType, step, options) {
    const { data } = await request(this._currentHttpConfig, "POST", "/helpers/step-cost-estimate", {
      step: { type: resolveStepType2(stepType), ...step },
      ...options
    });
    return data;
  }
  // -------------------------------------------------------------------------
  // Streaming
  // -------------------------------------------------------------------------
  /**
   * Send a stream chunk to the caller via SSE.
   *
   * When invoked from a method that was called with `stream: true`, chunks
   * are delivered in real-time as Server-Sent Events. When there is no active
   * stream (no `STREAM_ID`), calls are silently ignored — so it's safe to
   * call unconditionally.
   *
   * Accepts strings (sent as `type: 'token'`) or structured data (sent as
   * `type: 'data'`). The caller receives each chunk as an SSE event.
   *
   * @example
   * ```ts
   * // Stream text tokens
   * await agent.stream('Processing item 1...');
   *
   * // Stream structured data
   * await agent.stream({ progress: 50, currentItem: 'abc' });
   * ```
   */
  stream = async (data) => {
    const streamId = this._currentStreamId;
    if (!streamId) return;
    const url = `${this._currentHttpConfig.baseUrl}/_internal/v2/stream-chunk`;
    const body = typeof data === "string" ? { streamId, type: "token", text: data } : { streamId, type: "data", data };
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: this._token
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn(`[mindstudio] stream chunk failed: ${res.status} ${text}`);
    }
  };
  // -------------------------------------------------------------------------
  // db + auth namespaces
  // -------------------------------------------------------------------------
  /**
   * The `auth` namespace — synchronous role-based access control.
   *
   * Provides the current user's identity and roles. All methods are
   * synchronous since the role map is preloaded during context hydration.
   *
   * **Important**: Context must be hydrated before accessing `auth`.
   * - Inside the MindStudio sandbox: automatic (populated from globals)
   * - Outside the sandbox: call `await agent.ensureContext()` first,
   *   or access `auth` after any `db` operation (which auto-hydrates)
   *
   * @throws {MindStudioError} if context has not been hydrated yet
   *
   * @example
   * ```ts
   * await agent.ensureContext();
   * agent.auth.requireRole(Roles.admin);
   * const admins = agent.auth.getUsersByRole(Roles.admin);
   * ```
   */
  get auth() {
    const rctx = getRequestContext();
    if (rctx?.auth) {
      return new AuthContext(rctx.auth);
    }
    if (this._authType === "internal") {
      const ai = globalThis.ai;
      if (ai?.auth) {
        return new AuthContext(ai.auth);
      }
    }
    if (!this._auth) {
      this._trySandboxHydration();
    }
    if (!this._auth) {
      throw new MindStudioError(
        "Auth context not loaded. Call `await agent.ensureContext()` first, or perform any db operation (which auto-loads context).",
        "context_not_loaded",
        400
      );
    }
    return this._auth;
  }
  /**
   * The `db` namespace — chainable collection API over managed databases.
   *
   * Use `db.defineTable<T>(name)` to get a typed Table<T>, then call
   * collection methods (filter, sortBy, push, update, etc.) on it.
   *
   * Context is auto-hydrated on first query execution — you can safely
   * call `defineTable()` at module scope without triggering any HTTP.
   *
   * @example
   * ```ts
   * const Orders = agent.db.defineTable<Order>('orders');
   * const active = await Orders.filter(o => o.status === 'active').take(10);
   * ```
   */
  get db() {
    if (getRequestContext()) {
      return this._createLazyDb();
    }
    if (!this._db) {
      this._trySandboxHydration();
    }
    if (this._db) return this._db;
    return this._createLazyDb();
  }
  /**
   * Hydrate the app context (auth + database metadata). This must be
   * called before using `auth` synchronously. For `db`, hydration happens
   * automatically on first query.
   *
   * Context is fetched once and cached for the instance's lifetime.
   * Calling `ensureContext()` multiple times is safe (no-op after first).
   *
   * Context sources (checked in order):
   * 1. Sandbox globals (`globalThis.ai.auth`, `globalThis.ai.databases`)
   * 2. HTTP: `GET /developer/v2/helpers/app-context?appId={appId}`
   *
   * @throws {MindStudioError} if no `appId` is available
   *
   * @example
   * ```ts
   * await agent.ensureContext();
   * // auth is now available synchronously
   * agent.auth.requireRole(Roles.admin);
   * ```
   */
  async ensureContext() {
    if (this._getContext()) return;
    if (this._context) return;
    if (!this._contextPromise) {
      this._contextPromise = this._hydrateContext();
    }
    await this._contextPromise;
  }
  /**
   * @internal Fetch and cache app context, then create auth + db instances.
   *
   * In managed mode (CALLBACK_TOKEN), the platform resolves the app from
   * the token — no appId needed. With an API key, appId is required.
   */
  async _hydrateContext() {
    if (!this._appId && this._authType !== "internal") {
      throw new MindStudioError(
        "No app ID available for context resolution. Pass `appId` to the constructor, set the MINDSTUDIO_APP_ID environment variable, or make a step execution call first (which auto-detects the app ID).",
        "missing_app_id",
        400
      );
    }
    const context = await this.getAppContext(this._appId);
    this._applyContext(context);
  }
  /**
   * @internal Apply a resolved context object — creates AuthContext and Db.
   * Used by both the HTTP path and sandbox hydration.
   */
  _applyContext(context) {
    this._context = context;
    this._auth = new AuthContext(context.auth);
    this._db = createDb(
      context.databases,
      this._executeDbBatch.bind(this),
      context.authConfig,
      this._syncRoles.bind(this)
    );
  }
  /**
   * @internal Try to hydrate context synchronously from sandbox globals.
   * Called in the constructor when CALLBACK_TOKEN auth is detected.
   *
   * The MindStudio sandbox pre-populates `globalThis.ai` with:
   * - `ai.auth`: { userId, roleAssignments[] }
   * - `ai.databases`: [{ id, name, tables[] }]
   */
  _trySandboxHydration() {
    if (getRequestContext()) return;
    const ai = globalThis.ai;
    if (ai?.auth && ai?.databases) {
      this._applyContext({
        auth: ai.auth,
        databases: ai.databases,
        authConfig: ai.authConfig
      });
    }
  }
  /**
   * The `files` namespace — typed, private-by-default file storage (the twin of
   * `db`). No context hydration needed: the hook token identifies the app
   * server-side and stores are code-defined (access travels per call).
   *
   * @example
   * ```ts
   * const Uploads = agent.files.defineStore('uploads');
   * const f = await Uploads.put(buffer, { contentType: 'image/png' });
   * return { url: f.url };
   * ```
   */
  get files() {
    return this._files ??= createFiles(this._filesRequest.bind(this));
  }
  /**
   * Jewel surfaces: arrival-shaped triggers (`propose`) and the app-native
   * approval queue (`queue.list` / `queue.resolve`). See {@link JewelsApi}.
   */
  get jewels() {
    return {
      propose: (methodId, subject, opts) => {
        if (!methodId || typeof methodId !== "string") {
          throw new MindStudioError(
            "methodId is required",
            "missing_method_id",
            400
          );
        }
        return this._jewelsRequest("propose", {
          methodId,
          subject,
          ...opts?.idempotencyKey !== void 0 && {
            idempotencyKey: opts.idempotencyKey
          }
        });
      },
      queue: {
        list: (opts) => this._jewelsRequest("queue/list", {
          ...opts?.methodId !== void 0 && { methodId: opts.methodId },
          ...opts?.limit !== void 0 && { limit: opts.limit }
        }),
        resolve: (itemId, opts) => this._jewelsRequest("queue/resolve", {
          itemId,
          action: opts.action,
          ...opts.input !== void 0 && { input: opts.input }
        })
      }
    };
  }
  /**
   * Raw hook-token call shared by the jewels surfaces (mirrors reportIssue).
   * No retries: propose holds the request for the jewel run and is idempotent
   * by key anyway; resolve applies a method and must never double-fire.
   */
  async _jewelsRequest(path, body) {
    const rctx = getRequestContext();
    if (this._authType !== "internal" && !rctx?.callbackToken) {
      throw new MindStudioError(
        `jewels.${path.replace("/", ".")} requires an app execution context (hook token) \u2014 it cannot be called with an API key.`,
        "jewels_requires_app_context",
        400
      );
    }
    const url = `${this._currentHttpConfig.baseUrl}/_internal/v2/jewels/${path}`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: this._token
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      let code = "jewels_error";
      let message = `jewels.${path.replace("/", ".")} failed: ${res.status} ${res.statusText}`;
      let details;
      try {
        const errBody = await res.json();
        details = errBody;
        if (typeof errBody.errorString === "string") code = errBody.errorString;
        message = typeof errBody.errorMessage === "string" && errBody.errorMessage || typeof errBody.errorString === "string" && errBody.errorString || message;
      } catch {
      }
      throw new MindStudioError(message, code, res.status, details);
    }
    return await res.json();
  }
  /**
   * Searchable document corpora.
   *
   * @example
   * ```ts
   * const Policies = agent.dataSources.defineDataSource('policies');
   * const { results } = await Policies.search('what are the payment terms?');
   * ```
   */
  get dataSources() {
    return this._dataSources ??= createDataSources(
      this._dataSourcesRequest.bind(this)
    );
  }
  /**
   * Telephony: outbound calls answered by this app's voice agent.
   *
   * @example
   * ```ts
   * await agent.voice.call({ to: '+13105551234', assumeIdentity: true });
   * ```
   */
  get voice() {
    return this._voice ??= createVoice(this._voiceRequest.bind(this));
  }
  /**
   * @internal Transport for the `files` namespace — POST /_internal/v2/files/<op>
   * with the raw hook token (mirrors `_executeDbBatch`).
   */
  async _filesRequest(op, body) {
    return this._brokeredRequest("files", op, body, {
      fallbackMessage: "File operation failed",
      fallbackCode: "file_error"
    });
  }
  /**
   * @internal Transport for the `dataSources` namespace —
   * POST /_internal/v2/datasources/<op> with the raw hook token.
   */
  async _dataSourcesRequest(op, body) {
    return this._brokeredRequest("datasources", op, body, {
      fallbackMessage: "Data source operation failed",
      fallbackCode: "data_source_error"
    });
  }
  /**
   * @internal Transport for the `voice` namespace —
   * POST /_internal/v2/voice/<op> with the raw hook token.
   */
  async _voiceRequest(op, body) {
    return this._brokeredRequest("voice", op, body, {
      fallbackMessage: "Voice operation failed",
      fallbackCode: "voice_error"
    });
  }
  /**
   * @internal Shared shape for the brokered `/_internal/v2/<ns>/<op>` data
   * planes. Factored out rather than copied per namespace so error handling
   * can't drift between them.
   */
  async _brokeredRequest(namespace, op, body, errors) {
    const url = `${this._currentHttpConfig.baseUrl}/_internal/v2/${namespace}/${op}`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: this._token
      },
      body: JSON.stringify(body)
    });
    if (res.status === 204) {
      return void 0;
    }
    const text = await res.text();
    let json;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
      }
    }
    if (!res.ok) {
      const rawMsg = json?.errorMessage ?? (typeof json?.error === "string" ? json.error : json?.error?.message);
      const message = typeof rawMsg === "string" ? rawMsg : `${errors.fallbackMessage}: ${res.status} ${res.statusText}`;
      const code = json?.errorString ?? json?.code ?? errors.fallbackCode;
      throw new MindStudioError(message, code, res.status);
    }
    return json;
  }
  /**
   * @internal Execute a batch of SQL queries against a managed database.
   * Used as the `executeBatch` callback for Table/Query instances.
   *
   * Calls `POST /_internal/v2/db/query` directly with the hook token
   * (raw, no Bearer prefix). All queries run on a single SQLite connection,
   * enabling RETURNING clauses and multi-statement batches.
   */
  async _executeDbBatch(databaseId, queries) {
    const dbWsUrl = typeof process !== "undefined" ? process.env?.DB_WS_URL : void 0;
    if (dbWsUrl) {
      try {
        return await executeDbBatchOverWs(
          dbWsUrl,
          this._token,
          databaseId,
          queries
        );
      } catch (err) {
        if (!(err instanceof DbWsTransportError)) {
          throw err;
        }
        if (err.sent && queries.some((q) => !isReadOnlySql(q.sql))) {
          throw new MindStudioError(
            "[db] Connection was interrupted after this query was sent; because it contains a write, it was not automatically retried (the write may or may not have been applied). Verify the current state before re-running it.",
            "db_transport_interrupted",
            503
          );
        }
        console.warn(
          `[mindstudio] db: WebSocket transport unavailable (${err.message}); using HTTP for this query.`
        );
      }
    }
    const url = `${this._currentHttpConfig.baseUrl}/_internal/v2/db/query`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: this._token
      },
      body: JSON.stringify({ databaseId, queries })
    });
    if (!res.ok) {
      let message = `Database query failed: ${res.status} ${res.statusText}`;
      let code = "db_query_error";
      try {
        const text = await res.text();
        try {
          const body = JSON.parse(text);
          const errMsg = (typeof body.error === "string" ? body.error : void 0) ?? (typeof body.message === "string" ? body.message : void 0) ?? (typeof body.details === "string" ? body.details : void 0);
          if (errMsg) message = errMsg;
          else if (body.error || body.message || body.details) {
            message = JSON.stringify(
              body.error ?? body.message ?? body.details
            );
          }
          if (body.code) code = body.code;
        } catch {
          if (text && text.length < 500) message = text;
        }
      } catch {
      }
      throw new MindStudioError(`[db] ${message}`, code, res.status);
    }
    const data = await res.json();
    return data.results;
  }
  /**
   * @internal Sync a user's roles to the platform after a successful
   * auth table write. Calls POST /_internal/v2/auth/sync-user.
   * Fire-and-forget: errors are caught and logged, never propagated.
   */
  async _syncRoles(userId, roles) {
    try {
      const url = `${this._currentHttpConfig.baseUrl}/_internal/v2/auth/sync-user`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: this._token
        },
        body: JSON.stringify({
          appId: this._appId,
          userId,
          roles
        })
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.warn(
          `[mindstudio] Role sync failed for user ${userId} (${res.status}${text ? ": " + text.slice(0, 100) : ""}). Roles were saved to the database but may not be reflected in auth.hasRole() until the next successful write.`
        );
      }
    } catch (err) {
      console.warn(
        `[mindstudio] Role sync failed for user ${userId}: network error. Roles were saved to the database but may not be reflected in auth.hasRole() until the next successful write.`
      );
    }
  }
  /**
   * @internal Create a lazy Db proxy that auto-hydrates context.
   *
   * defineTable() returns Table instances immediately (no async needed).
   * But the Table's executeBatch callback is wrapped to call ensureContext()
   * before the first query, so context is fetched lazily.
   */
  _createLazyDb() {
    const agent = this;
    return {
      defineTable(name, options) {
        const databaseHint = options?.database;
        const tableConfig = {
          databaseId: "",
          tableName: name,
          columns: [],
          unique: options?.unique,
          defaults: options?.defaults,
          executeBatch: async (queries) => {
            await agent.ensureContext();
            const ctx = agent._getContext();
            const ac = ctx.authConfig;
            if (ac && ac.table === name && !tableConfig.managedColumns) {
              tableConfig.managedColumns = ac.columns;
              if (ac.columns.roles) {
                tableConfig.syncRoles = agent._syncRoles.bind(agent);
              }
            }
            const databases = ctx.databases;
            let targetDb;
            if (databaseHint) {
              targetDb = databases.find(
                (d) => d.id === databaseHint || d.name === databaseHint
              );
            } else {
              targetDb = databases.find(
                (d) => d.tables.some((t) => t.name === name)
              );
            }
            if (tableConfig.columns.length === 0 && targetDb) {
              const tableSchema = targetDb.tables.find((t) => t.name === name);
              if (tableSchema) {
                tableConfig.columns = tableSchema.schema;
              }
            }
            const databaseId = targetDb?.id ?? databases[0]?.id ?? "";
            return agent._executeDbBatch(databaseId, queries);
          }
        };
        return new Table(tableConfig);
      },
      // Time helpers work without context
      now: () => Date.now(),
      days: (n) => n * 864e5,
      hours: (n) => n * 36e5,
      minutes: (n) => n * 6e4,
      ago: (ms) => Date.now() - ms,
      fromNow: (ms) => Date.now() + ms,
      userRef: (id) => id.startsWith("@@user@@") ? id.slice("@@user@@".length) : id,
      // Batch needs context — hydrate first, then delegate to real db
      batch: ((...queries) => {
        return (async () => {
          await agent.ensureContext();
          const resolvedDb = agent._db ?? createDb(
            agent._getContext().databases,
            agent._executeDbBatch.bind(agent),
            agent._getContext().authConfig,
            agent._syncRoles.bind(agent)
          );
          return resolvedDb.batch(...queries);
        })();
      })
    };
  }
  // -------------------------------------------------------------------------
  // Helper methods — user resolution
  // -------------------------------------------------------------------------
  /**
   * Resolve a single user ID to display info (name, email, profile picture).
   *
   * Use this when you have a `User`-typed field value and need the person's
   * display name, email, or avatar. Returns null if the user ID is not found.
   *
   * Also available as a top-level import:
   * ```ts
   * import { resolveUser } from '@mindstudio-ai/agent';
   * ```
   *
   * @param userId - The user ID to resolve (a `User` branded string or plain UUID)
   * @returns Resolved user info, or null if not found
   *
   * @example
   * ```ts
   * const user = await agent.resolveUser(order.requestedBy);
   * if (user) {
   *   console.log(user.name);              // "Jane Smith"
   *   console.log(user.email);             // "jane@example.com"
   *   console.log(user.profilePictureUrl); // "https://..." or null
   * }
   * ```
   */
  async resolveUser(userId) {
    const { users } = await this.resolveUsers([userId]);
    return users[0] ?? null;
  }
  /**
   * Resolve multiple user IDs to display info in a single request.
   * Maximum 100 user IDs per request.
   *
   * Use this for batch resolution when you have multiple user references
   * to display (e.g. all approvers on a purchase order, all team members).
   *
   * @param userIds - Array of user IDs to resolve (max 100)
   * @returns Object with `users` array of resolved user info
   *
   * @example
   * ```ts
   * // Resolve all approvers at once
   * const approverIds = approvals.map(a => a.assignedTo);
   * const { users } = await agent.resolveUsers(approverIds);
   *
   * for (const u of users) {
   *   console.log(`${u.name} (${u.email})`);
   * }
   * ```
   */
  async resolveUsers(userIds) {
    const { data } = await request(
      this._currentHttpConfig,
      "POST",
      "/helpers/resolve-users",
      { userIds }
    );
    return data;
  }
  // -------------------------------------------------------------------------
  // Issue reporting
  // -------------------------------------------------------------------------
  /**
   * File a bug report or feature idea into this app's issue tracker.
   *
   * For building an in-app "Report a bug" feature: wire the frontend UI to
   * an app backend method that calls this. The issue lands in the app's
   * issue tracker, visible to the app's team and available to the Remy agent.
   *
   * **Backend / managed-context only.** It authenticates with the app's hook
   * token (the same credential used for `db` queries), and the app id is
   * derived from that token server-side. Calling it outside a managed
   * context (e.g. with a plain API key) will fail with `401`.
   *
   * Rate limited per app (20 / 60s). On the limit this throws a
   * `MindStudioError` with `code === 'rate_limited'` and `status === 429` —
   * catch it to show a graceful "try again shortly" message. Every call
   * creates a new issue (no dedupe), so guard against double-submit in the UI.
   *
   * @returns The filed issue. Show `issue.number` to confirm "Reported as #42".
   *
   * @example
   * ```ts
   * // app backend method, e.g. exported as `reportBug`
   * export async function reportBug({ title, details, userEmail }) {
   *   try {
   *     const { number } = await mindstudio.reportIssue({
   *       title,
   *       body: details,
   *       kind: 'bug',
   *       reporter: userEmail, // free-form label; omit for anonymous
   *     });
   *     return { ok: true, issueNumber: number };
   *   } catch (e) {
   *     if (e instanceof MindStudioError && e.code === 'rate_limited') {
   *       return { ok: false, retry: true };
   *     }
   *     throw e;
   *   }
   * }
   * ```
   */
  async reportIssue(input) {
    const title = input.title?.trim();
    if (!title) {
      throw new MindStudioError("title is required", "missing_title", 400);
    }
    const url = `${this._currentHttpConfig.baseUrl}/_internal/v2/report-issue`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: this._token
      },
      body: JSON.stringify({
        title,
        ...input.body !== void 0 && { body: input.body },
        ...input.kind !== void 0 && { kind: input.kind },
        ...input.reporter !== void 0 && { reporter: input.reporter }
      })
    });
    if (!res.ok) {
      let code = "report_issue_error";
      let message = `Report issue failed: ${res.status} ${res.statusText}`;
      let details;
      try {
        const body = await res.json();
        details = body;
        if (typeof body.errorString === "string") code = body.errorString;
        message = typeof body.errorMessage === "string" && body.errorMessage || typeof body.errorString === "string" && body.errorString || message;
      } catch {
      }
      throw new MindStudioError(message, code, res.status, details);
    }
    const data = await res.json();
    return data.issue;
  }
  /**
   * Invalidate the prerendered snapshot(s) for the current app so crawlers get
   * a fresh render on their next visit. Call after content behind a prerendered
   * page changes (e.g. a short URL's target). Omit `paths` (or pass an empty
   * array) to purge every snapshot for the app.
   *
   * Raw hook-token call (mirrors `reportIssue`) — the appId comes from the
   * token. Backend / managed-context only.
   *
   * ```ts
   * await mindstudio.invalidatePrerender(['/u/abc']);
   * ```
   */
  async invalidatePrerender(paths) {
    const url = `${this._currentHttpConfig.baseUrl}/_internal/v2/prerender/invalidate`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: this._token
      },
      body: JSON.stringify(paths && paths.length ? { paths } : {})
    });
    if (!res.ok) {
      let code = "prerender_invalidate_error";
      let message = `Prerender invalidation failed: ${res.status} ${res.statusText}`;
      let details;
      try {
        const body = await res.json();
        details = body;
        if (typeof body.errorString === "string") code = body.errorString;
        message = typeof body.errorMessage === "string" && body.errorMessage || typeof body.errorString === "string" && body.errorString || message;
      } catch {
      }
      throw new MindStudioError(message, code, res.status, details);
    }
    return await res.json();
  }
  // -------------------------------------------------------------------------
  // App context
  // -------------------------------------------------------------------------
  /**
   * Get auth and database context for an app.
   *
   * Returns role assignments and managed database schemas. Useful for
   * hydrating `auth` and `db` namespaces when running outside the sandbox.
   *
   * When called with a CALLBACK_TOKEN (managed mode), `appId` is optional —
   * the platform resolves the app from the token. With an API key, `appId`
   * is required.
   *
   * ```ts
   * const ctx = await agent.getAppContext('your-app-id');
   * console.log(ctx.auth.roleAssignments, ctx.databases);
   * ```
   */
  async getAppContext(appId) {
    const query = appId ? `?appId=${encodeURIComponent(appId)}` : "";
    const { data } = await request(
      this._currentHttpConfig,
      "GET",
      `/helpers/app-context${query}`
    );
    return data;
  }
  // -------------------------------------------------------------------------
  // Account methods
  // -------------------------------------------------------------------------
  /** Update the display name of the authenticated user/agent. */
  async changeName(displayName) {
    await request(this._currentHttpConfig, "POST", "/account/change-name", {
      name: displayName
    });
  }
  /** Update the profile picture of the authenticated user/agent. */
  async changeProfilePicture(url) {
    await request(
      this._currentHttpConfig,
      "POST",
      "/account/change-profile-picture",
      {
        url
      }
    );
  }
  /**
   * Upload a file to the MindStudio CDN.
   *
   * Gets a presigned upload request from the API, POSTs the file as
   * multipart/form-data, and returns the permanent public URL.
   *
   * @deprecated For app file storage use the `files` store
   * (`files.defineStore(...).put(...)`) — private by default, app-scoped, and
   * served on the app's own domain. `uploadFile` uploads to the shared account
   * media CDN; it remains only for account-level assets (e.g. an agent avatar
   * passed to `changeProfilePicture`).
   */
  async uploadFile(content, options) {
    const filename = options.filename ?? `upload.${options.extension}`;
    const { data } = await request(this._currentHttpConfig, "POST", "/account/upload", { filename });
    const form = new FormData();
    for (const [k, v] of Object.entries(data.fields)) form.append(k, v);
    const buf = content.buffer.slice(
      content.byteOffset,
      content.byteOffset + content.byteLength
    );
    const fileBlob = new Blob(
      [buf],
      options.type ? { type: options.type } : void 0
    );
    form.append("file", fileBlob, filename);
    const res = await fetch(data.url, { method: "POST", body: form });
    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      throw new MindStudioError(
        `Upload failed: ${res.status} ${res.statusText}${errorText ? ` \u2014 ${errorText.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 200)}` : ""}`,
        "upload_error",
        res.status,
        errorText || void 0
      );
    }
    if (!data.publicUrl) {
      throw new MindStudioError(
        "Upload succeeded but server did not return a public URL.",
        "missing_public_url",
        500
      );
    }
    return { url: data.publicUrl };
  }
};
function sleep3(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
applyStepMethods(MindStudioAgent);
function assetStoreBody(store) {
  return store ? { assetStore: { store: store.name, access: store.access } } : {};
}
function resolveStepType2(name) {
  const meta = stepMetadata[name];
  return meta ? meta.stepType : name;
}
function resolveToken(provided, config) {
  const rctx = getRequestContext();
  if (rctx?.callbackToken)
    return { token: rctx.callbackToken, authType: "internal" };
  if (process.env.CALLBACK_TOKEN)
    return { token: process.env.CALLBACK_TOKEN, authType: "internal" };
  if (provided) return { token: provided, authType: "apiKey" };
  if (process.env.MINDSTUDIO_API_KEY)
    return { token: process.env.MINDSTUDIO_API_KEY, authType: "apiKey" };
  if (config?.apiKey) return { token: config.apiKey, authType: "apiKey" };
  throw new MindStudioError(
    "No API key provided. Run `mindstudio login`, pass `apiKey` to the constructor, or set the MINDSTUDIO_API_KEY environment variable.",
    "missing_api_key",
    401
  );
}

// src/jewel/index.ts
function errorInfo(e) {
  if (e instanceof Error) return { message: e.message, stack: e.stack };
  return { message: String(e) };
}
function deepEqual(a, b) {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") {
    return false;
  }
  const aIsArray = Array.isArray(a);
  if (aIsArray !== Array.isArray(b)) return false;
  if (aIsArray) {
    const aa = a;
    const ba = b;
    return aa.length === ba.length && aa.every((v, i) => deepEqual(v, ba[i]));
  }
  const ao = a;
  const bo = b;
  const aKeys = Object.keys(ao).filter((k) => ao[k] !== void 0);
  const bKeys = Object.keys(bo).filter((k) => bo[k] !== void 0);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((k) => deepEqual(ao[k], bo[k]));
}
var VERDICTS = /* @__PURE__ */ new Set(["agree", "disagree", "skip"]);
function normalizeVerdict(v) {
  if (!v || !VERDICTS.has(v.verdict)) {
    return {
      verdict: "skip",
      notes: `grade returned invalid verdict: ${JSON.stringify(v)}`
    };
  }
  return v.notes === void 0 ? { verdict: v.verdict } : { verdict: v.verdict, notes: v.notes };
}
function defineJewel(method, config) {
  const runGrade = async (proposed, actual) => {
    if (config.grade) {
      try {
        return normalizeVerdict(await config.grade({ proposed, actual }));
      } catch (e) {
        return { verdict: "skip", notes: `grade threw: ${errorInfo(e).message}` };
      }
    }
    return deepEqual(proposed, actual) ? { verdict: "agree" } : { verdict: "disagree" };
  };
  const run = async (params) => {
    const startedAt = Date.now();
    const customGrade = config.grade !== void 0;
    const done = (rest) => ({
      v: 1,
      customGrade,
      startedAt,
      durationMs: Date.now() - startedAt,
      ...rest
    });
    if (Object.prototype.hasOwnProperty.call(params, "grade")) {
      const ctx = params.grade;
      const verdict2 = await runGrade(ctx.proposed, ctx.actual);
      return done({
        mode: "grade",
        proposed: ctx.proposed,
        actual: ctx.actual,
        verdict: verdict2.verdict,
        ...verdict2.notes !== void 0 ? { notes: verdict2.notes } : {}
      });
    }
    const isShadow = Object.prototype.hasOwnProperty.call(params, "humanInput");
    const mode = isShadow ? "shadow" : "eval";
    const actual = isShadow ? params.humanInput : void 0;
    let subject;
    if (isShadow) {
      try {
        subject = config.subject(actual);
      } catch (e) {
        return done({ mode, actual, error: { phase: "subject", ...errorInfo(e) } });
      }
    } else {
      subject = params.subject;
    }
    let proposal;
    try {
      proposal = await config.propose(subject);
    } catch (e) {
      return done({
        mode,
        subject,
        actual,
        error: { phase: "propose", ...errorInfo(e) }
      });
    }
    if (!isShadow) {
      return done({
        mode,
        subject,
        proposed: proposal.input,
        reasoning: proposal.reasoning
      });
    }
    const verdict = await runGrade(proposal.input, actual);
    return done({
      mode,
      subject,
      proposed: proposal.input,
      reasoning: proposal.reasoning,
      actual,
      verdict: verdict.verdict,
      ...verdict.notes !== void 0 ? { notes: verdict.notes } : {}
    });
  };
  return Object.assign(run, {
    kind: "jewel",
    method,
    subject: config.subject,
    propose: config.propose,
    grade: config.grade
  });
}

// src/generated/snippets.ts
var monacoSnippets = {
  "activeCampaignAddNote": { fields: [["contactId", "string"], ["note", "string"]], outputKeys: [] },
  "activeCampaignCreateContact": { fields: [["email", "string"], ["firstName", "string"], ["lastName", "string"], ["phone", "string"], ["accountId", "string"], ["customFields", "object"]], outputKeys: ["contactId"] },
  "addSubtitlesToVideo": { fields: [["videoUrl", "string"], ["language", "string"], ["fontName", "string"], ["fontSize", "number"], ["fontWeight", ["normal", "bold", "black"]], ["fontColor", ["white", "black", "red", "green", "blue", "yellow", "orange", "purple", "pink", "brown", "gray", "cyan", "magenta"]], ["highlightColor", ["white", "black", "red", "green", "blue", "yellow", "orange", "purple", "pink", "brown", "gray", "cyan", "magenta"]], ["strokeWidth", "number"], ["strokeColor", ["black", "white", "red", "green", "blue", "yellow", "orange", "purple", "pink", "brown", "gray", "cyan", "magenta"]], ["backgroundColor", ["black", "white", "red", "green", "blue", "yellow", "orange", "purple", "pink", "brown", "gray", "cyan", "magenta", "none"]], ["backgroundOpacity", "number"], ["position", ["top", "center", "bottom"]], ["yOffset", "number"], ["wordsPerSubtitle", "number"], ["enableAnimation", "boolean"]], outputKeys: ["videoUrl"] },
  "airtableCreateUpdateRecord": { fields: [["baseId", "string"], ["tableId", "string"], ["fields", "string"], ["recordData", "object"]], outputKeys: ["recordId"] },
  "airtableDeleteRecord": { fields: [["baseId", "string"], ["tableId", "string"], ["recordId", "string"]], outputKeys: ["deleted"] },
  "airtableGetRecord": { fields: [["baseId", "string"], ["tableId", "string"], ["recordId", "string"]], outputKeys: ["record"] },
  "airtableGetTableRecords": { fields: [["baseId", "string"], ["tableId", "string"]], outputKeys: ["records"] },
  "analyzeImage": { fields: [["prompt", "string"]], outputKeys: ["analysis"] },
  "analyzeVideo": { fields: [["prompt", "string"], ["videoUrl", "string"]], outputKeys: ["analysis"] },
  "captureThumbnail": { fields: [["videoUrl", "string"], ["at", "string"]], outputKeys: ["thumbnailUrl"] },
  "checkAppRole": { fields: [["roleName", "string"]], outputKeys: ["hasRole", "userRoles"] },
  "codaCreateUpdatePage": { fields: [["pageData", "object"]], outputKeys: ["pageId"] },
  "codaCreateUpdateRow": { fields: [["docId", "string"], ["tableId", "string"], ["rowData", "object"]], outputKeys: ["rowId"] },
  "codaFindRow": { fields: [["docId", "string"], ["tableId", "string"], ["rowData", "object"]], outputKeys: ["row"] },
  "codaGetPage": { fields: [["docId", "string"], ["pageId", "string"]], outputKeys: ["content"] },
  "codaGetTableRows": { fields: [["docId", "string"], ["tableId", "string"]], outputKeys: ["rows"] },
  "convertPdfToImages": { fields: [["pdfUrl", "string"]], outputKeys: ["imageUrls"] },
  "createDataSource": { fields: [["name", "string"]], outputKeys: [] },
  "createGmailDraft": { fields: [["to", "string"], ["subject", "string"], ["message", "string"], ["messageType", ["plain", "html", "markdown"]]], outputKeys: ["draftId"] },
  "createGoogleCalendarEvent": { fields: [["summary", "string"], ["startDateTime", "string"], ["endDateTime", "string"]], outputKeys: ["eventId", "htmlLink"] },
  "createGoogleDoc": { fields: [["title", "string"], ["text", "string"], ["textType", ["plain", "html", "markdown"]]], outputKeys: ["documentUrl"] },
  "createGoogleSheet": { fields: [["title", "string"], ["text", "string"]], outputKeys: ["spreadsheetUrl"] },
  "deleteDataSource": { fields: [["dataSourceId", "string"]], outputKeys: [] },
  "deleteDataSourceDocument": { fields: [["dataSourceId", "string"], ["documentId", "string"]], outputKeys: [] },
  "deleteGmailEmail": { fields: [["messageId", "string"]], outputKeys: [] },
  "deleteGoogleCalendarEvent": { fields: [["eventId", "string"]], outputKeys: [] },
  "deleteGoogleSheetRows": { fields: [["documentId", "string"], ["startRow", "string"], ["endRow", "string"]], outputKeys: [] },
  "detectChanges": { fields: [["mode", ["ai", "comparison"]], ["input", "string"]], outputKeys: ["hasChanged", "currentValue", "previousValue", "isFirstRun"] },
  "detectPII": { fields: [["input", "string"], ["language", "string"], ["entities", "array"]], outputKeys: ["detected", "detections"] },
  "discordEditMessage": { fields: [["botToken", "string"], ["channelId", "string"], ["messageId", "string"], ["text", "string"]], outputKeys: [] },
  "discordSendFollowUp": { fields: [["applicationId", "string"], ["interactionToken", "string"], ["text", "string"]], outputKeys: ["messageId"] },
  "discordSendMessage": { fields: [["mode", ["edit", "send"]], ["text", "string"]], outputKeys: [] },
  "downloadVideo": { fields: [["videoUrl", "string"], ["format", ["mp4", "mp3"]]], outputKeys: ["videoUrl"] },
  "enhanceImageGenerationPrompt": { fields: [["initialPrompt", "string"], ["includeNegativePrompt", "boolean"], ["systemPrompt", "string"]], outputKeys: ["prompt"] },
  "enhanceVideoGenerationPrompt": { fields: [["initialPrompt", "string"], ["includeNegativePrompt", "boolean"], ["systemPrompt", "string"]], outputKeys: ["prompt"] },
  "enrichPerson": { fields: [["params", "object"]], outputKeys: ["data"] },
  "extractAudioFromVideo": { fields: [["videoUrl", "string"]], outputKeys: ["audioUrl"] },
  "extractText": { fields: [["url", "string"]], outputKeys: ["text"] },
  "fetchDataSourceDocument": { fields: [["dataSourceId", "string"], ["documentId", "string"]], outputKeys: [] },
  "fetchGoogleDoc": { fields: [["documentId", "string"], ["exportType", ["html", "markdown", "json", "plain"]]], outputKeys: ["content"] },
  "fetchGoogleSheet": { fields: [["spreadsheetId", "string"], ["range", "string"], ["exportType", ["csv", "json"]]], outputKeys: ["content"] },
  "fetchSlackChannelHistory": { fields: [["channelId", "string"]], outputKeys: ["messages"] },
  "fetchYoutubeCaptions": { fields: [["videoUrl", "string"], ["exportType", ["text", "json"]], ["language", "string"]], outputKeys: ["transcripts"] },
  "fetchYoutubeChannel": { fields: [["channelUrl", "string"]], outputKeys: [] },
  "fetchYoutubeComments": { fields: [["videoUrl", "string"], ["exportType", ["text", "json"]], ["limitPages", "string"]], outputKeys: ["comments"] },
  "fetchYoutubeVideo": { fields: [["videoUrl", "string"]], outputKeys: [] },
  "generate3dModel": { fields: [], outputKeys: ["glbUrl"] },
  "generateAsset": { fields: [["source", "string"], ["sourceType", ["html", "markdown", "spa", "raw", "dynamic", "customInterface"]], ["outputFormat", ["pdf", "png", "html", "mp4", "openGraph"]], ["pageSize", ["full", "letter", "A4", "custom"]], ["testData", "object"]], outputKeys: ["url"] },
  "generateChart": { fields: [["chart", "object"]], outputKeys: ["chartUrl"] },
  "generateImage": { fields: [["prompt", "string"]], outputKeys: ["imageUrl"] },
  "generateLipsync": { fields: [], outputKeys: [] },
  "generateMusic": { fields: [["text", "string"]], outputKeys: [] },
  "generatePdf": { fields: [["source", "string"], ["sourceType", ["html", "markdown", "spa", "raw", "dynamic", "customInterface"]], ["outputFormat", ["pdf", "png", "html", "mp4", "openGraph"]], ["pageSize", ["full", "letter", "A4", "custom"]], ["testData", "object"]], outputKeys: ["url"] },
  "generateStaticVideoFromImage": { fields: [["imageUrl", "string"], ["duration", "string"]], outputKeys: ["videoUrl"] },
  "generateText": { fields: [["message", "string"]], outputKeys: ["content"] },
  "generateVideo": { fields: [["prompt", "string"]], outputKeys: ["videoUrl"] },
  "getGmailAttachments": { fields: [["messageId", "string"]], outputKeys: [] },
  "getGmailDraft": { fields: [["draftId", "string"]], outputKeys: ["draftId", "messageId", "subject", "to", "from", "body"] },
  "getGmailEmail": { fields: [["messageId", "string"]], outputKeys: ["messageId", "subject", "from", "to", "date", "body", "labels"] },
  "getGmailUnreadCount": { fields: [], outputKeys: [] },
  "getGoogleCalendarEvent": { fields: [["eventId", "string"], ["exportType", ["json", "text"]]], outputKeys: ["event"] },
  "getGoogleDriveFile": { fields: [["fileId", "string"]], outputKeys: ["url", "name", "mimeType", "size"] },
  "getGoogleSheetInfo": { fields: [["documentId", "string"]], outputKeys: ["title", "sheets"] },
  "getMediaMetadata": { fields: [["mediaUrl", "string"]], outputKeys: ["metadata"] },
  "hubspotCreateCompany": { fields: [["company", "object"], ["enabledProperties", "array"]], outputKeys: ["companyId"] },
  "hubspotCreateContact": { fields: [["contact", "object"], ["enabledProperties", "array"], ["companyDomain", "string"]], outputKeys: ["contactId"] },
  "hubspotGetCompany": { fields: [["searchBy", ["domain", "id"]], ["companyDomain", "string"], ["companyId", "string"], ["additionalProperties", "array"]], outputKeys: ["company"] },
  "hubspotGetContact": { fields: [["searchBy", ["email", "id"]], ["contactEmail", "string"], ["contactId", "string"], ["additionalProperties", "array"]], outputKeys: ["contact"] },
  "hunterApiCompanyEnrichment": { fields: [["domain", "string"]], outputKeys: ["data"] },
  "hunterApiDomainSearch": { fields: [["domain", "string"]], outputKeys: ["data"] },
  "hunterApiEmailFinder": { fields: [["domain", "string"], ["firstName", "string"], ["lastName", "string"]], outputKeys: ["data"] },
  "hunterApiEmailVerification": { fields: [["email", "string"]], outputKeys: ["data"] },
  "hunterApiPersonEnrichment": { fields: [["email", "string"]], outputKeys: ["data"] },
  "imageFaceSwap": { fields: [["imageUrl", "string"], ["faceImageUrl", "string"], ["engine", "string"]], outputKeys: ["imageUrl"] },
  "imageRemoveWatermark": { fields: [["imageUrl", "string"], ["engine", "string"]], outputKeys: ["imageUrl"] },
  "insertVideoClips": { fields: [["baseVideoUrl", "string"], ["overlayVideos", "array"]], outputKeys: ["videoUrl"] },
  "listDataSources": { fields: [], outputKeys: [] },
  "listGmailDrafts": { fields: [["exportType", ["json", "text"]]], outputKeys: ["drafts"] },
  "listGmailLabels": { fields: [], outputKeys: [] },
  "listGoogleCalendarEvents": { fields: [["limit", "number"], ["exportType", ["json", "text"]]], outputKeys: ["events"] },
  "listGoogleDriveFiles": { fields: [["exportType", ["json", "text"]]], outputKeys: ["files"] },
  "listRecentGmailEmails": { fields: [["exportType", ["json", "text"]], ["limit", "string"]], outputKeys: [] },
  "logic": { fields: [["context", "string"], ["cases", "array"]], outputKeys: ["selectedCase"] },
  "makeDotComRunScenario": { fields: [["webhookUrl", "string"], ["input", "object"]], outputKeys: ["data"] },
  "mergeAudio": { fields: [["mp3Urls", "array"]], outputKeys: ["audioUrl"] },
  "mergeVideos": { fields: [["videoUrls", "array"]], outputKeys: ["videoUrl"] },
  "meshyAnimate": { fields: [["rigTaskId", "string"], ["actionId", "number"]], outputKeys: ["glbUrl"] },
  "meshyImageTo3d": { fields: [["imageUrls", "array"]], outputKeys: ["glbUrl"] },
  "meshyRemesh": { fields: [], outputKeys: ["glbUrl"] },
  "meshyRig": { fields: [], outputKeys: ["glbUrl"] },
  "meshyTextTo3d": { fields: [["prompt", "string"]], outputKeys: ["glbUrl"] },
  "meshyTexture": { fields: [], outputKeys: ["glbUrl"] },
  "mixAudioIntoVideo": { fields: [["videoUrl", "string"], ["audioUrl", "string"], ["options", "object"]], outputKeys: ["videoUrl"] },
  "muteVideo": { fields: [["videoUrl", "string"]], outputKeys: ["videoUrl"] },
  "n8nRunNode": { fields: [["method", "string"], ["authentication", ["none", "basic", "string"]], ["user", "string"], ["password", "string"], ["webhookUrl", "string"], ["input", "object"]], outputKeys: ["data"] },
  "notionCreatePage": { fields: [["pageId", "string"], ["content", "string"], ["title", "string"]], outputKeys: ["pageId", "pageUrl"] },
  "notionUpdatePage": { fields: [["pageId", "string"], ["content", "string"], ["mode", ["append", "overwrite"]]], outputKeys: ["pageId", "pageUrl"] },
  "particlePodcastsFindMentions": { fields: [], outputKeys: [] },
  "particlePodcastsGetEpisode": { fields: [["id", "string"]], outputKeys: [] },
  "particlePodcastsGetEpisodeTranscript": { fields: [["id", "string"]], outputKeys: [] },
  "particlePodcastsSearchCompanies": { fields: [], outputKeys: [] },
  "particlePodcastsSearchDialogue": { fields: [], outputKeys: [] },
  "particlePodcastsSearchPodcasts": { fields: [], outputKeys: [] },
  "peopleSearch": { fields: [["smartQuery", "string"], ["enrichPeople", "boolean"], ["enrichOrganizations", "boolean"], ["limit", "string"], ["page", "string"], ["params", "object"]], outputKeys: ["results"] },
  "postToLinkedIn": { fields: [["message", "string"], ["visibility", ["PUBLIC", "CONNECTIONS"]]], outputKeys: [] },
  "postToSlackChannel": { fields: [["channelId", "string"], ["messageType", ["string", "blocks"]], ["message", "string"]], outputKeys: [] },
  "postToX": { fields: [["text", "string"]], outputKeys: [] },
  "postToZapier": { fields: [["webhookUrl", "string"], ["input", "object"]], outputKeys: ["data"] },
  "queryAppDatabase": { fields: [["databaseId", "string"], ["sql", "string"]], outputKeys: ["rows", "changes"] },
  "queryDataSource": { fields: [["dataSourceId", "string"], ["query", "string"], ["maxResults", "number"]], outputKeys: ["text", "chunks", "query", "citations", "latencyMs"] },
  "queryExternalDatabase": { fields: [["query", "string"], ["outputFormat", ["json", "csv"]]], outputKeys: ["data"] },
  "redactPII": { fields: [["input", "string"], ["language", "string"], ["entities", "array"]], outputKeys: ["text"] },
  "removeBackgroundFromImage": { fields: [["imageUrl", "string"]], outputKeys: ["imageUrl"] },
  "replyToGmailEmail": { fields: [["messageId", "string"], ["message", "string"], ["messageType", ["plain", "html", "markdown"]]], outputKeys: ["messageId"] },
  "resizeVideo": { fields: [["videoUrl", "string"], ["mode", ["fit", "exact"]]], outputKeys: ["videoUrl"] },
  "runFromConnectorRegistry": { fields: [["actionId", "string"], ["displayName", "string"], ["icon", "string"], ["configurationValues", "object"]], outputKeys: ["data"] },
  "runPackagedWorkflow": { fields: [["appId", "string"], ["workflowId", "string"], ["inputVariables", "object"], ["outputVariables", "object"], ["name", "string"]], outputKeys: ["data"] },
  "scrapeLinkedInCompany": { fields: [["url", "string"]], outputKeys: ["company"] },
  "scrapeLinkedInProfile": { fields: [["url", "string"]], outputKeys: ["profile"] },
  "scrapeUrl": { fields: [["url", "string"]], outputKeys: ["content"] },
  "scrapeXPost": { fields: [["url", "string"]], outputKeys: ["post"] },
  "scrapeXProfile": { fields: [["url", "string"]], outputKeys: ["profile"] },
  "screenshotUrl": { fields: [["url", "string"]], outputKeys: ["screenshotUrl"] },
  "searchGmailEmails": { fields: [["query", "string"], ["exportType", ["json", "text"]], ["limit", "string"]], outputKeys: ["emails"] },
  "searchGoogle": { fields: [["query", "string"], ["exportType", ["text", "json"]]], outputKeys: ["results"] },
  "searchGoogleCalendarEvents": { fields: [["exportType", ["json", "text"]]], outputKeys: ["events"] },
  "searchGoogleDrive": { fields: [["query", "string"], ["exportType", ["json", "text"]]], outputKeys: ["files"] },
  "searchGoogleImages": { fields: [["query", "string"], ["exportType", ["text", "json"]]], outputKeys: ["images"] },
  "searchGoogleNews": { fields: [["text", "string"], ["exportType", ["text", "json"]]], outputKeys: ["articles"] },
  "searchGoogleTrends": { fields: [["text", "string"], ["hl", "string"], ["geo", "string"], ["data_type", ["TIMESERIES", "GEO_MAP", "GEO_MAP_0", "RELATED_TOPICS", "RELATED_QUERIES"]], ["cat", "string"], ["date", "string"], ["ts", "string"]], outputKeys: ["trends"] },
  "searchPerplexity": { fields: [["query", "string"], ["exportType", ["text", "json"]]], outputKeys: ["results"] },
  "searchXPosts": { fields: [["query", "string"], ["scope", ["recent", "all"]], ["options", "object"]], outputKeys: ["posts"] },
  "searchYoutube": { fields: [["query", "string"], ["limitPages", "string"], ["filter", "string"], ["filterType", "string"]], outputKeys: ["results"] },
  "searchYoutubeTrends": { fields: [["bp", ["now", "music", "gaming", "films"]], ["hl", "string"], ["gl", "string"]], outputKeys: [] },
  "sendEmail": { fields: [["subject", "string"], ["body", "string"]], outputKeys: ["recipients", "cc", "bcc", "from"] },
  "sendGmailDraft": { fields: [["draftId", "string"]], outputKeys: [] },
  "sendGmailMessage": { fields: [["to", "string"], ["subject", "string"], ["message", "string"], ["messageType", ["plain", "html", "markdown"]]], outputKeys: ["messageId"] },
  "sendSlackDirectMessage": { fields: [["slackUserId", "string"], ["messageType", ["string", "blocks"]], ["message", "string"]], outputKeys: [] },
  "sendSMS": { fields: [["body", "string"]], outputKeys: [] },
  "setGmailReadStatus": { fields: [["messageIds", "string"], ["markAsRead", "boolean"]], outputKeys: [] },
  "setRunTitle": { fields: [["title", "string"]], outputKeys: [] },
  "setVariable": { fields: [["value", "string"]], outputKeys: [] },
  "telegramEditMessage": { fields: [["botToken", "string"], ["chatId", "string"], ["messageId", "string"], ["text", "string"]], outputKeys: [] },
  "telegramReplyToMessage": { fields: [["botToken", "string"], ["chatId", "string"], ["replyToMessageId", "string"], ["text", "string"]], outputKeys: ["messageId"] },
  "telegramSendAudio": { fields: [["botToken", "string"], ["chatId", "string"], ["audioUrl", "string"], ["mode", ["audio", "voice"]]], outputKeys: [] },
  "telegramSendFile": { fields: [["botToken", "string"], ["chatId", "string"], ["fileUrl", "string"]], outputKeys: [] },
  "telegramSendImage": { fields: [["botToken", "string"], ["chatId", "string"], ["imageUrl", "string"]], outputKeys: [] },
  "telegramSendMessage": { fields: [["botToken", "string"], ["chatId", "string"], ["text", "string"]], outputKeys: ["messageId"] },
  "telegramSendVideo": { fields: [["botToken", "string"], ["chatId", "string"], ["videoUrl", "string"]], outputKeys: [] },
  "telegramSetTyping": { fields: [["botToken", "string"], ["chatId", "string"]], outputKeys: [] },
  "textToSpeech": { fields: [["text", "string"]], outputKeys: ["audioUrl"] },
  "transcribeAudio": { fields: [["audioUrl", "string"], ["prompt", "string"]], outputKeys: ["text"] },
  "trimMedia": { fields: [["inputUrl", "string"]], outputKeys: ["mediaUrl"] },
  "updateGmailLabels": { fields: [["query", "string"], ["messageIds", "string"], ["addLabelIds", "string"], ["removeLabelIds", "string"]], outputKeys: ["updatedMessageIds"] },
  "updateGoogleCalendarEvent": { fields: [["eventId", "string"]], outputKeys: ["eventId", "htmlLink"] },
  "updateGoogleDoc": { fields: [["documentId", "string"], ["text", "string"], ["textType", ["plain", "html", "markdown"]], ["operationType", ["addToTop", "addToBottom", "overwrite"]]], outputKeys: ["documentUrl"] },
  "updateGoogleSheet": { fields: [["text", "string"], ["spreadsheetId", "string"], ["range", "string"], ["operationType", ["addToBottom", "overwrite", "range"]]], outputKeys: ["spreadsheetUrl"] },
  "uploadDataSourceDocument": { fields: [["dataSourceId", "string"], ["file", "string"], ["fileName", "string"]], outputKeys: [] },
  "upscaleImage": { fields: [["imageUrl", "string"], ["targetResolution", ["2k", "4k", "8k"]], ["engine", ["standard", "pro"]]], outputKeys: ["imageUrl"] },
  "upscaleVideo": { fields: [["videoUrl", "string"], ["targetResolution", ["720p", "1080p", "2K", "4K"]], ["engine", ["standard", "pro", "ultimate", "flashvsr", "seedance", "seedvr2", "runwayml/upscale-v1"]]], outputKeys: ["videoUrl"] },
  "userMessage": { fields: [["message", "string"]], outputKeys: ["content"] },
  "videoFaceSwap": { fields: [["videoUrl", "string"], ["faceImageUrl", "string"], ["targetIndex", "number"], ["engine", "string"]], outputKeys: ["videoUrl"] },
  "videoRemoveBackground": { fields: [["videoUrl", "string"], ["newBackground", ["transparent", "image"]], ["engine", "string"]], outputKeys: ["videoUrl"] },
  "videoRemoveWatermark": { fields: [["videoUrl", "string"], ["engine", "string"]], outputKeys: ["videoUrl"] },
  "watermarkImage": { fields: [["imageUrl", "string"], ["watermarkImageUrl", "string"], ["corner", ["top-left", "top-right", "bottom-left", "bottom-right"]], ["paddingPx", "number"], ["widthPx", "number"]], outputKeys: ["imageUrl"] },
  "watermarkVideo": { fields: [["videoUrl", "string"], ["imageUrl", "string"], ["corner", ["top-left", "top-right", "bottom-left", "bottom-right"]], ["paddingPx", "number"], ["widthPx", "number"]], outputKeys: ["videoUrl"] },
  "youDotComFinanceResearch": { fields: [["input", "string"]], outputKeys: ["data"] },
  "youDotComGetPageContent": { fields: [["urls", "array"]], outputKeys: ["data"] },
  "youDotComLiveNews": { fields: [["query", "string"]], outputKeys: ["data"] },
  "youDotComWebResearch": { fields: [["input", "string"]], outputKeys: ["data"] },
  "youDotComWebSearch": { fields: [["query", "string"]], outputKeys: ["data"] }
};
var blockTypeAliases = {
  "userMessage": "generateText",
  "generatePdf": "generateAsset"
};

// src/index.ts
var MindStudioAgent2 = MindStudioAgent;
var _default;
var mindstudio = new Proxy({}, {
  get(_, prop, receiver) {
    _default ??= new MindStudioAgent2();
    const value = Reflect.get(_default, prop, _default);
    return typeof value === "function" ? value.bind(_default) : value;
  }
});
var index_default = mindstudio;
var auth = new Proxy({}, {
  get(_, prop) {
    const target = mindstudio.auth;
    const value = Reflect.get(target, prop, target);
    return typeof value === "function" ? value.bind(target) : value;
  }
});
var db = new Proxy({}, {
  get(_, prop) {
    const target = mindstudio.db;
    const value = Reflect.get(target, prop, target);
    return typeof value === "function" ? value.bind(target) : value;
  }
});
var files = new Proxy({}, {
  get(_, prop) {
    const target = mindstudio.files;
    const value = Reflect.get(target, prop, target);
    return typeof value === "function" ? value.bind(target) : value;
  }
});
var dataSources = new Proxy({}, {
  get(_, prop) {
    const target = mindstudio.dataSources;
    const value = Reflect.get(target, prop, target);
    return typeof value === "function" ? value.bind(target) : value;
  }
});
var voice = new Proxy({}, {
  get(_, prop) {
    const target = mindstudio.voice;
    const value = Reflect.get(target, prop, target);
    return typeof value === "function" ? value.bind(target) : value;
  }
});
var session = new Proxy(
  {},
  {
    get(_, prop) {
      const ctx = getRequestContext();
      return ctx?.session?.[prop];
    }
  }
);
var stream = (data) => mindstudio.stream(data);
var waitUntil = (promise) => mindstudio.waitUntil(promise);
var resolveUser = (userId) => mindstudio.resolveUser(userId);
var reportIssue = (input) => mindstudio.reportIssue(input);
var prerender = {
  invalidate: (paths) => mindstudio.invalidatePrerender(paths)
};
export {
  AuthContext,
  MindStudioAgent2 as MindStudioAgent,
  MindStudioError,
  Roles,
  auth,
  blockTypeAliases,
  dataSources,
  db,
  index_default as default,
  defineJewel,
  files,
  getRequestContext,
  mindstudio,
  monacoSnippets,
  prerender,
  reportIssue,
  resolveUser,
  runWithContext,
  session,
  stepMetadata,
  stream,
  voice,
  waitUntil
};
//# sourceMappingURL=index.js.map