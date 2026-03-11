/**
 * Table<T> — a typed persistent collection backed by SQLite.
 *
 * Created via `db.defineTable<T>(name)`. The returned object is the full
 * API for interacting with that table. Every method either returns a
 * chainable Query<T> (for lazy reads) or a Promise (for terminal reads
 * and writes).
 *
 * ## Read vs Write operations
 *
 * **Reads** come in two flavors:
 * - **Direct reads**: `get(id)`, `findOne()`, `count()`, `some()`, `every()`,
 *   `isEmpty()`, `min()`, `max()`, `groupBy()` — return Promises directly.
 * - **Chainable reads**: `filter()`, `sortBy()` — return a Query<T> that
 *   accumulates operations lazily. The query executes when awaited.
 *
 * **Writes** are always immediate (return Promises):
 * - `push()` — INSERT + SELECT to return the created row with system fields
 * - `update()` — UPDATE + SELECT to return the updated row
 * - `remove()` — DELETE by ID
 * - `removeAll()` — DELETE with compiled WHERE clause
 * - `clear()` — DELETE all rows
 *
 * ## System columns
 *
 * Every row has platform-managed columns: `id`, `createdAt`, `updatedAt`,
 * `lastUpdatedBy`. These are:
 * - Included in read results (populated by the platform)
 * - Excluded from `push()` and `update()` inputs (TypeScript enforces this
 *   via PushInput<T> and UpdateInput<T>; runtime also strips them)
 *
 * ## User type handling
 *
 * Columns with schema type `'user'` store values with a `@@user@@` prefix
 * in SQLite. This is handled transparently:
 * - On read: prefix is stripped, application code gets clean UUID strings
 * - On write: prefix is added before sending to the database
 */

import { Query, extractFieldName } from './query.js';
import { compilePredicate } from './predicate.js';
import {
  buildSelect,
  buildCount,
  buildExists,
  buildInsert,
  buildUpdate,
  buildDelete,
  deserializeRow,
  escapeValue,
} from './sql.js';
import type { Predicate, Accessor, PushInput, UpdateInput, TableConfig } from './types.js';

// ---------------------------------------------------------------------------
// Table class
// ---------------------------------------------------------------------------

export class Table<T> {
  /** @internal Runtime config binding this table to the execution layer. */
  private readonly _config: TableConfig;

  constructor(config: TableConfig) {
    this._config = config;
  }

  // -------------------------------------------------------------------------
  // Reads — direct (return Promises)
  // -------------------------------------------------------------------------

  /**
   * Get a single row by ID. Returns null if not found.
   *
   * @example
   * ```ts
   * const order = await Orders.get('abc-123');
   * if (order) console.log(order.status);
   * ```
   */
  async get(id: string): Promise<T | null> {
    const sql = buildSelect(this._config.tableName, {
      where: `id = ${escapeValue(id)}`,
      limit: 1,
    });
    const result = await this._config.executeQuery(sql);
    if (result.rows.length === 0) return null;
    return deserializeRow(
      result.rows[0] as Record<string, unknown>,
      this._config.columns,
    ) as T;
  }

  /**
   * Find the first row matching a predicate. Returns null if none match.
   *
   * @example
   * ```ts
   * const activeOrder = await Orders.findOne(o => o.status === 'active');
   * ```
   */
  async findOne(predicate: Predicate<T>): Promise<T | null> {
    return this.filter(predicate).first();
  }

  /**
   * Count rows, optionally filtered by a predicate.
   *
   * @example
   * ```ts
   * const total = await Orders.count();
   * const pending = await Orders.count(o => o.status === 'pending');
   * ```
   */
  async count(predicate?: Predicate<T>): Promise<number> {
    if (predicate) {
      return this.filter(predicate).count();
    }

    const sql = buildCount(this._config.tableName);
    const result = await this._config.executeQuery(sql);
    const row = result.rows[0] as { count: number } | undefined;
    return row?.count ?? 0;
  }

  /**
   * Check if any row matches a predicate. Short-circuits.
   *
   * @example
   * ```ts
   * const hasActive = await Orders.some(o => o.status === 'active');
   * ```
   */
  async some(predicate: Predicate<T>): Promise<boolean> {
    return this.filter(predicate).some();
  }

  /**
   * Check if all rows match a predicate.
   *
   * @example
   * ```ts
   * const allComplete = await Orders.every(o => o.status === 'completed');
   * ```
   */
  async every(predicate: Predicate<T>): Promise<boolean> {
    return this.filter(predicate).every();
  }

  /**
   * Check if the table has zero rows.
   *
   * @example
   * ```ts
   * if (await Orders.isEmpty()) console.log('No orders yet');
   * ```
   */
  async isEmpty(): Promise<boolean> {
    const sql = buildExists(this._config.tableName, undefined, true);
    const result = await this._config.executeQuery(sql);
    const row = result.rows[0] as { result: number } | undefined;
    return row?.result === 1;
  }

  /**
   * Return the row with the minimum value for a field.
   * Executes as `ORDER BY field ASC LIMIT 1`.
   *
   * @example
   * ```ts
   * const cheapest = await Orders.min(o => o.amount);
   * ```
   */
  async min(accessor: Accessor<T, number>): Promise<T | null> {
    return this.sortBy(accessor as Accessor<T>).first();
  }

  /**
   * Return the row with the maximum value for a field.
   * Executes as `ORDER BY field DESC LIMIT 1`.
   *
   * @example
   * ```ts
   * const mostExpensive = await Orders.max(o => o.amount);
   * ```
   */
  async max(accessor: Accessor<T, number>): Promise<T | null> {
    return this.sortBy(accessor as Accessor<T>).reverse().first();
  }

  /**
   * Group all rows by a field value. Returns a Map.
   *
   * @example
   * ```ts
   * const byStatus = await Orders.groupBy(o => o.status);
   * // Map { 'pending' => [...], 'approved' => [...] }
   * ```
   */
  async groupBy<K extends string | number>(
    accessor: Accessor<T, K>,
  ): Promise<Map<K, T[]>> {
    return new Query<T>(this._config).groupBy(accessor);
  }

  // -------------------------------------------------------------------------
  // Reads — chainable (return Query<T>)
  // -------------------------------------------------------------------------

  /**
   * Filter rows by a predicate. Returns a chainable Query.
   *
   * The predicate is compiled to SQL when possible. If compilation fails,
   * the query falls back to fetching all rows and filtering in JS.
   *
   * @example
   * ```ts
   * const active = await Orders.filter(o => o.status === 'active');
   * const recentActive = await Orders
   *   .filter(o => o.status === 'active')
   *   .sortBy(o => o.createdAt)
   *   .reverse()
   *   .take(10);
   * ```
   */
  filter(predicate: Predicate<T>): Query<T> {
    return new Query<T>(this._config).filter(predicate);
  }

  /**
   * Sort all rows by a field. Returns a chainable Query.
   *
   * @example
   * ```ts
   * const newest = await Orders.sortBy(o => o.createdAt).reverse().take(5);
   * ```
   */
  sortBy(accessor: Accessor<T>): Query<T> {
    return new Query<T>(this._config).sortBy(accessor);
  }

  // -------------------------------------------------------------------------
  // Writes — INSERT, UPDATE, DELETE
  // -------------------------------------------------------------------------

  /**
   * Insert one or more rows. Returns the created row(s) with system fields
   * populated (id, createdAt, updatedAt, lastUpdatedBy).
   *
   * System columns are stripped from the input automatically — you don't
   * need to (and can't) set id, createdAt, etc.
   *
   * @example
   * ```ts
   * // Single row
   * const order = await Orders.push({ item: 'Laptop', amount: 999, status: 'pending' });
   * console.log(order.id, order.createdAt); // system fields populated
   *
   * // Multiple rows
   * const orders = await Orders.push([
   *   { item: 'Monitor', amount: 300, status: 'pending' },
   *   { item: 'Keyboard', amount: 50, status: 'pending' },
   * ]);
   * ```
   */
  async push(data: PushInput<T>): Promise<T>;
  async push(data: PushInput<T>[]): Promise<T[]>;
  async push(data: PushInput<T> | PushInput<T>[]): Promise<T | T[]> {
    const isArray = Array.isArray(data);
    const items = isArray ? data : [data];

    const results: T[] = [];
    for (const item of items) {
      // INSERT the row
      const insertSql = buildInsert(
        this._config.tableName,
        item as Record<string, unknown>,
        this._config.columns,
      );
      await this._config.executeQuery(insertSql);

      // Fetch the newly created row using last_insert_rowid()
      // SQLite's last_insert_rowid() returns the rowid of the most recent INSERT.
      // Our tables use UUID ids set by triggers, so we need to fetch by rowid
      // and then get the row with its generated id.
      const fetchSql = `SELECT * FROM ${this._config.tableName} WHERE rowid = last_insert_rowid()`;
      const fetchResult = await this._config.executeQuery(fetchSql);

      if (fetchResult.rows.length > 0) {
        results.push(
          deserializeRow(
            fetchResult.rows[0] as Record<string, unknown>,
            this._config.columns,
          ) as T,
        );
      }
    }

    return isArray ? results : results[0];
  }

  /**
   * Update a row by ID. Only the provided fields are changed.
   * Returns the updated row.
   *
   * System columns cannot be updated — they're stripped automatically.
   * `updatedAt` and `lastUpdatedBy` are set by the platform.
   *
   * @example
   * ```ts
   * const updated = await Orders.update(order.id, { status: 'approved' });
   * console.log(updated.updatedAt); // freshly updated
   * ```
   */
  async update(id: string, data: UpdateInput<T>): Promise<T> {
    const updateSql = buildUpdate(
      this._config.tableName,
      id,
      data as Record<string, unknown>,
      this._config.columns,
    );
    await this._config.executeQuery(updateSql);

    // Fetch the updated row
    const fetchSql = buildSelect(this._config.tableName, {
      where: `id = ${escapeValue(id)}`,
      limit: 1,
    });
    const result = await this._config.executeQuery(fetchSql);

    return deserializeRow(
      result.rows[0] as Record<string, unknown>,
      this._config.columns,
    ) as T;
  }

  /**
   * Remove a row by ID.
   *
   * @example
   * ```ts
   * await Orders.remove('abc-123');
   * ```
   */
  async remove(id: string): Promise<void> {
    const sql = buildDelete(
      this._config.tableName,
      `id = ${escapeValue(id)}`,
    );
    await this._config.executeQuery(sql);
  }

  /**
   * Remove all rows matching a predicate. Returns the count removed.
   *
   * The predicate is compiled to SQL when possible. If compilation fails,
   * the function fetches all matching rows, collects their IDs, and
   * deletes them individually.
   *
   * @example
   * ```ts
   * const removed = await Orders.removeAll(o => o.status === 'rejected');
   * console.log(`Removed ${removed} orders`);
   * ```
   */
  async removeAll(predicate: Predicate<T>): Promise<number> {
    const compiled = compilePredicate(predicate);

    if (compiled.type === 'sql') {
      // Fast path: compile predicate to SQL WHERE and delete directly
      const sql = buildDelete(this._config.tableName, compiled.where);
      const result = await this._config.executeQuery(sql);
      return result.changes;
    }

    // Fallback: fetch matching rows, delete by ID
    console.warn(
      `[mindstudio] removeAll predicate on ${this._config.tableName} could not be compiled to SQL — fetching all rows first`,
    );

    const allSql = buildSelect(this._config.tableName);
    const allResult = await this._config.executeQuery(allSql);
    const allRows = allResult.rows.map(
      (r) =>
        deserializeRow(
          r as Record<string, unknown>,
          this._config.columns,
        ) as Record<string, unknown>,
    );

    const matching = allRows.filter((row) => predicate(row as T));
    let count = 0;

    for (const row of matching) {
      const id = row.id as string;
      if (id) {
        const sql = buildDelete(this._config.tableName, `id = ${escapeValue(id)}`);
        await this._config.executeQuery(sql);
        count++;
      }
    }

    return count;
  }

  /**
   * Remove all rows from the table.
   *
   * @example
   * ```ts
   * await Orders.clear();
   * ```
   */
  async clear(): Promise<void> {
    const sql = buildDelete(this._config.tableName);
    await this._config.executeQuery(sql);
  }
}
