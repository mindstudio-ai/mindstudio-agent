/**
 * SQL builders for the `db` namespace.
 *
 * Pure functions that generate SQL strings with `?` placeholder bind params
 * for SQLite. These are used by Table and Query to translate collection
 * operations into queries executed via `POST /_internal/v2/db/query`.
 *
 * ## Parameterized queries
 *
 * All builders return `{ sql, params }` tuples. Values are passed as
 * positional bind params (`?` placeholders) rather than inlined into the
 * SQL string. This is safer and works naturally with the batch endpoint
 * which accepts `{ sql, params }` per query.
 *
 * ## RETURNING support
 *
 * INSERT and UPDATE builders append `RETURNING *` so the platform returns
 * the created/updated row in a single round trip — no separate SELECT needed.
 *
 * ## User type columns
 *
 * Columns with schema type `'user'` store values with a `@@user@@` prefix
 * in SQLite (e.g. `@@user@@550e8400-...`). The `serializeParam()` and
 * `deserializeRow()` functions handle this transparently — application
 * code always works with clean UUID strings.
 */

import type { AppDatabaseColumnSchema } from '../types.js';
import type { SqlQuery } from './types.js';

// ---------------------------------------------------------------------------
// Value serialization — converts JS values to bind param values
// ---------------------------------------------------------------------------

/**
 * Serialize a JavaScript value for use as a bind param.
 *
 * - `null` / `undefined` → `null`
 * - `boolean` → `1` or `0` (SQLite convention)
 * - `number` / `string` → passed through
 * - `object` / `array` → JSON-encoded string
 */
export function serializeParam(val: unknown): unknown {
  if (val === null || val === undefined) return null;
  if (typeof val === 'boolean') return val ? 1 : 0;
  if (typeof val === 'number' || typeof val === 'string') return val;
  return JSON.stringify(val);
}

/**
 * Serialize a value for a specific column, handling the @@user@@ prefix
 * for user-type columns.
 */
export function serializeColumnParam(
  val: unknown,
  columnName: string,
  columns: AppDatabaseColumnSchema[],
): unknown {
  const col = columns.find((c) => c.name === columnName);

  // User-type columns: add @@user@@ prefix to non-null string values
  if (col?.type === 'user' && typeof val === 'string') {
    return `@@user@@${val}`;
  }

  return serializeParam(val);
}

// ---------------------------------------------------------------------------
// Inline value escaping — used by the predicate compiler for WHERE clauses
// ---------------------------------------------------------------------------

/**
 * Escape a JavaScript value for safe inline use in a SQL WHERE clause.
 * Used by the predicate compiler which builds WHERE strings with inlined
 * values (since predicates are parsed from function source code, not from
 * structured data).
 *
 * For structured data (INSERT/UPDATE/SELECT params), use `serializeParam()`
 * with `?` bind params instead.
 */
export function escapeValue(val: unknown): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? '1' : '0';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
  const json = JSON.stringify(val);
  return `'${json.replace(/'/g, "''")}'`;
}

// ---------------------------------------------------------------------------
// Row deserialization — strips @@user@@ prefixes, parses JSON columns
// ---------------------------------------------------------------------------

const USER_PREFIX = '@@user@@';

/**
 * Deserialize a row from the database, handling:
 * - Stripping `@@user@@` prefix from user-type columns
 * - Parsing JSON strings for json-type columns
 */
export function deserializeRow(
  row: Record<string, unknown>,
  columns: AppDatabaseColumnSchema[],
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(row)) {
    const col = columns.find((c) => c.name === key);

    if (col?.type === 'user' && typeof value === 'string' && value.startsWith(USER_PREFIX)) {
      result[key] = value.slice(USER_PREFIX.length);
    } else if (col?.type === 'json' && typeof value === 'string') {
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

// ---------------------------------------------------------------------------
// SELECT builders
// ---------------------------------------------------------------------------

export interface SelectOptions {
  /** WHERE clause (with ? placeholders). */
  where?: string;
  /** Params for the WHERE clause. */
  whereParams?: unknown[];
  orderBy?: string;
  desc?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Build a SELECT query with bind params.
 */
export function buildSelect(table: string, options: SelectOptions = {}): SqlQuery {
  let sql = `SELECT * FROM ${table}`;
  const params: unknown[] = [];

  if (options.where) {
    sql += ` WHERE ${options.where}`;
    if (options.whereParams) params.push(...options.whereParams);
  }
  if (options.orderBy) sql += ` ORDER BY ${options.orderBy}${options.desc ? ' DESC' : ' ASC'}`;
  if (options.limit != null) sql += ` LIMIT ${options.limit}`;
  if (options.offset != null) sql += ` OFFSET ${options.offset}`;

  return { sql, params: params.length > 0 ? params : undefined };
}

/**
 * Build a SELECT COUNT(*) query.
 */
export function buildCount(table: string, where?: string, whereParams?: unknown[]): SqlQuery {
  let sql = `SELECT COUNT(*) as count FROM ${table}`;
  if (where) sql += ` WHERE ${where}`;
  return { sql, params: whereParams?.length ? whereParams : undefined };
}

/**
 * Build a SELECT EXISTS query. Used for `.some()` and `.every()`.
 */
export function buildExists(table: string, where?: string, whereParams?: unknown[], negate?: boolean): SqlQuery {
  const inner = where ? `SELECT 1 FROM ${table} WHERE ${where}` : `SELECT 1 FROM ${table}`;
  const fn = negate ? 'NOT EXISTS' : 'EXISTS';
  return { sql: `SELECT ${fn}(${inner}) as result`, params: whereParams?.length ? whereParams : undefined };
}

// ---------------------------------------------------------------------------
// Write builders — all use RETURNING * for single-roundtrip results
// ---------------------------------------------------------------------------

/**
 * Build an INSERT statement with RETURNING *.
 * System columns are excluded automatically.
 * Values are passed as bind params.
 */
export function buildInsert(
  table: string,
  data: Record<string, unknown>,
  columns: AppDatabaseColumnSchema[],
): SqlQuery {
  const filtered = stripSystemColumns(data);
  const keys = Object.keys(filtered);
  const placeholders = keys.map(() => '?').join(', ');
  const params = keys.map((k) => serializeColumnParam(filtered[k], k, columns));
  return {
    sql: `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders}) RETURNING *`,
    params,
  };
}

/**
 * Build an UPDATE statement with RETURNING *.
 * System columns are excluded. Values are bind params.
 */
export function buildUpdate(
  table: string,
  id: string,
  data: Record<string, unknown>,
  columns: AppDatabaseColumnSchema[],
): SqlQuery {
  const filtered = stripSystemColumns(data);
  const keys = Object.keys(filtered);
  const assignments = keys.map((k) => `${k} = ?`).join(', ');
  const params = [
    ...keys.map((k) => serializeColumnParam(filtered[k], k, columns)),
    id, // for WHERE id = ?
  ];
  return {
    sql: `UPDATE ${table} SET ${assignments} WHERE id = ? RETURNING *`,
    params,
  };
}

/**
 * Build a DELETE statement.
 */
export function buildDelete(table: string, where?: string, whereParams?: unknown[]): SqlQuery {
  let sql = `DELETE FROM ${table}`;
  if (where) sql += ` WHERE ${where}`;
  return { sql, params: whereParams?.length ? whereParams : undefined };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SYSTEM_COLUMNS = new Set([
  'id',
  'created_at', 'createdAt',
  'updated_at', 'updatedAt',
  'last_updated_by', 'lastUpdatedBy',
]);

function stripSystemColumns(
  data: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (!SYSTEM_COLUMNS.has(key)) {
      result[key] = value;
    }
  }
  return result;
}
