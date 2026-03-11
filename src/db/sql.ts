/**
 * SQL string builders for the `db` namespace.
 *
 * Pure functions that generate fully-formed SQL strings for SQLite. These
 * are used by Table and Query to translate collection operations into SQL
 * executed via the `queryAppDatabase` step.
 *
 * ## Why inline values instead of parameterized queries?
 *
 * The `queryAppDatabase` step supports parameterized queries via Handlebars
 * `{{variable}}` syntax, but the SDK generates SQL programmatically from
 * known-safe inputs (user code -> predicate compiler -> SQL). Since we
 * control the entire SQL generation pipeline, we use `parameterize: false`
 * and inline escaped values directly. This is simpler and avoids the
 * Handlebars variable-name indirection layer.
 *
 * SQLite string escaping: single quotes are doubled (`'` -> `''`).
 * Null, booleans, and numbers are serialized to their SQL equivalents.
 *
 * ## User type columns
 *
 * Columns with schema type `'user'` store values with a `@@user@@` prefix
 * in SQLite (e.g. `@@user@@550e8400-...`). The `serializeValue()` and
 * `deserializeRow()` functions handle this transparently — application
 * code always works with clean UUID strings.
 */

import type { AppDatabaseColumnSchema } from '../types.js';

// ---------------------------------------------------------------------------
// Value escaping — converts JS values to safe SQL literals
// ---------------------------------------------------------------------------

/**
 * Escape a JavaScript value for safe inline use in a SQL string.
 *
 * - `null` / `undefined` → `'NULL'`
 * - `boolean` → `'1'` or `'0'` (SQLite convention)
 * - `number` → string representation (no quotes)
 * - `string` → single-quoted with internal quotes doubled
 * - `object` / `array` → JSON-encoded, then string-escaped
 *
 * @example
 * ```ts
 * escapeValue("it's")     // "'it''s'"
 * escapeValue(42)         // "42"
 * escapeValue(null)       // "NULL"
 * escapeValue(true)       // "1"
 * escapeValue({a: 1})     // "'{"a":1}'"
 * ```
 */
export function escapeValue(val: unknown): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? '1' : '0';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;

  // Objects and arrays → JSON string
  const json = JSON.stringify(val);
  return `'${json.replace(/'/g, "''")}'`;
}

/**
 * Serialize a value for a specific column, handling the @@user@@ prefix
 * for user-type columns.
 */
export function serializeValue(
  val: unknown,
  columnName: string,
  columns: AppDatabaseColumnSchema[],
): string {
  const col = columns.find((c) => c.name === columnName);

  // User-type columns: add @@user@@ prefix to non-null string values
  if (col?.type === 'user' && typeof val === 'string') {
    return escapeValue(`@@user@@${val}`);
  }

  return escapeValue(val);
}

// ---------------------------------------------------------------------------
// Row deserialization — strips @@user@@ prefixes, parses JSON columns
// ---------------------------------------------------------------------------

/**
 * The `@@user@@` prefix that the platform adds to user ID values in SQLite.
 * Stripped on read so application code works with clean UUID strings.
 */
const USER_PREFIX = '@@user@@';

/**
 * Deserialize a row from the database, handling:
 * - Stripping `@@user@@` prefix from user-type columns
 * - Parsing JSON strings for json-type columns
 *
 * @param row - Raw row object from the queryAppDatabase step
 * @param columns - Column schema from app context (identifies column types)
 * @returns The deserialized row with clean values
 */
export function deserializeRow(
  row: Record<string, unknown>,
  columns: AppDatabaseColumnSchema[],
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(row)) {
    const col = columns.find((c) => c.name === key);

    if (col?.type === 'user' && typeof value === 'string' && value.startsWith(USER_PREFIX)) {
      // Strip the @@user@@ prefix from user-type columns
      result[key] = value.slice(USER_PREFIX.length);
    } else if (col?.type === 'json' && typeof value === 'string') {
      // Parse JSON columns that come back as strings
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
  where?: string;
  orderBy?: string;
  desc?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Build a SELECT query.
 *
 * @example
 * ```ts
 * buildSelect('orders', { where: "status = 'active'", orderBy: 'createdAt', desc: true, limit: 10 })
 * // "SELECT * FROM orders WHERE status = 'active' ORDER BY createdAt DESC LIMIT 10"
 * ```
 */
export function buildSelect(table: string, options: SelectOptions = {}): string {
  let sql = `SELECT * FROM ${table}`;
  if (options.where) sql += ` WHERE ${options.where}`;
  if (options.orderBy) sql += ` ORDER BY ${options.orderBy}${options.desc ? ' DESC' : ' ASC'}`;
  if (options.limit != null) sql += ` LIMIT ${options.limit}`;
  if (options.offset != null) sql += ` OFFSET ${options.offset}`;
  return sql;
}

/**
 * Build a SELECT COUNT(*) query.
 *
 * @example
 * ```ts
 * buildCount('orders', "status = 'active'")
 * // "SELECT COUNT(*) as count FROM orders WHERE status = 'active'"
 * ```
 */
export function buildCount(table: string, where?: string): string {
  let sql = `SELECT COUNT(*) as count FROM ${table}`;
  if (where) sql += ` WHERE ${where}`;
  return sql;
}

/**
 * Build a SELECT EXISTS query. Used for `.some()` and `.every()`.
 *
 * When `negate` is true, wraps in NOT EXISTS — used by `.every()` to check
 * that no rows fail the condition.
 *
 * @example
 * ```ts
 * buildExists('orders', "status = 'active'")
 * // "SELECT EXISTS(SELECT 1 FROM orders WHERE status = 'active') as result"
 *
 * buildExists('orders', "status = 'active'", true)
 * // "SELECT NOT EXISTS(SELECT 1 FROM orders WHERE status = 'active') as result"
 * ```
 */
export function buildExists(table: string, where?: string, negate?: boolean): string {
  const inner = where ? `SELECT 1 FROM ${table} WHERE ${where}` : `SELECT 1 FROM ${table}`;
  const fn = negate ? 'NOT EXISTS' : 'EXISTS';
  return `SELECT ${fn}(${inner}) as result`;
}

// ---------------------------------------------------------------------------
// Write builders
// ---------------------------------------------------------------------------

/**
 * Build an INSERT statement. System columns are excluded automatically.
 *
 * @param table - Table name
 * @param data - Column-value pairs to insert
 * @param columns - Schema for user-type column handling
 * @returns The INSERT SQL string
 *
 * @example
 * ```ts
 * buildInsert('orders', { item: 'Laptop', amount: 999 }, [])
 * // "INSERT INTO orders (item, amount) VALUES ('Laptop', 999)"
 * ```
 */
export function buildInsert(
  table: string,
  data: Record<string, unknown>,
  columns: AppDatabaseColumnSchema[],
): string {
  const filtered = stripSystemColumns(data);
  const keys = Object.keys(filtered);
  const vals = keys.map((k) => serializeValue(filtered[k], k, columns));
  return `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${vals.join(', ')})`;
}

/**
 * Build an UPDATE statement for a single row by ID.
 *
 * @example
 * ```ts
 * buildUpdate('orders', 'abc-123', { status: 'approved' }, [])
 * // "UPDATE orders SET status = 'approved' WHERE id = 'abc-123'"
 * ```
 */
export function buildUpdate(
  table: string,
  id: string,
  data: Record<string, unknown>,
  columns: AppDatabaseColumnSchema[],
): string {
  const filtered = stripSystemColumns(data);
  const assignments = Object.entries(filtered)
    .map(([k, v]) => `${k} = ${serializeValue(v, k, columns)}`)
    .join(', ');
  return `UPDATE ${table} SET ${assignments} WHERE id = ${escapeValue(id)}`;
}

/**
 * Build a DELETE statement. If no `where` clause is provided, deletes all rows.
 *
 * @example
 * ```ts
 * buildDelete('orders', "status = 'rejected'")
 * // "DELETE FROM orders WHERE status = 'rejected'"
 *
 * buildDelete('orders')
 * // "DELETE FROM orders"
 * ```
 */
export function buildDelete(table: string, where?: string): string {
  let sql = `DELETE FROM ${table}`;
  if (where) sql += ` WHERE ${where}`;
  return sql;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** System column names that are managed by the platform and excluded from writes. */
const SYSTEM_COLUMNS = new Set(['id', 'createdAt', 'updatedAt', 'lastUpdatedBy']);

/**
 * Remove system-managed columns from a data object before INSERT or UPDATE.
 * These columns are populated automatically by SQLite triggers on the platform.
 */
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
