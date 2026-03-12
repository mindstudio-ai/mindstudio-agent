/**
 * Table<T> — a typed persistent collection backed by SQLite.
 *
 * Created via `db.defineTable<T>(name)`. Every method either returns a
 * chainable Query<T> (for lazy reads) or a Promise (for terminal reads
 * and writes).
 *
 * ## Write operations use RETURNING
 *
 * INSERT and UPDATE use `RETURNING *` to get the created/updated row
 * back in a single round trip — no separate SELECT needed. This is
 * executed via the batch endpoint which runs all queries on a single
 * SQLite connection.
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

export class Table<T> {
  /** @internal */
  private readonly _config: TableConfig;

  constructor(config: TableConfig) {
    this._config = config;
  }

  // -------------------------------------------------------------------------
  // Reads — direct
  // -------------------------------------------------------------------------

  async get(id: string): Promise<T | null> {
    const query = buildSelect(this._config.tableName, {
      where: `id = ?`,
      whereParams: [id],
      limit: 1,
    });
    const results = await this._config.executeBatch([query]);
    if (results[0].rows.length === 0) return null;
    return deserializeRow(
      results[0].rows[0] as Record<string, unknown>,
      this._config.columns,
    ) as T;
  }

  async findOne(predicate: Predicate<T>): Promise<T | null> {
    return this.filter(predicate).first();
  }

  async count(predicate?: Predicate<T>): Promise<number> {
    if (predicate) return this.filter(predicate).count();

    const query = buildCount(this._config.tableName);
    const results = await this._config.executeBatch([query]);
    const row = results[0]?.rows[0] as { count: number } | undefined;
    return row?.count ?? 0;
  }

  async some(predicate: Predicate<T>): Promise<boolean> {
    return this.filter(predicate).some();
  }

  async every(predicate: Predicate<T>): Promise<boolean> {
    return this.filter(predicate).every();
  }

  async isEmpty(): Promise<boolean> {
    const query = buildExists(this._config.tableName, undefined, undefined, true);
    const results = await this._config.executeBatch([query]);
    const row = results[0]?.rows[0] as { result: number } | undefined;
    return row?.result === 1;
  }

  async min(accessor: Accessor<T, number>): Promise<T | null> {
    return this.sortBy(accessor as Accessor<T>).first();
  }

  async max(accessor: Accessor<T, number>): Promise<T | null> {
    return this.sortBy(accessor as Accessor<T>).reverse().first();
  }

  async groupBy<K extends string | number>(
    accessor: Accessor<T, K>,
  ): Promise<Map<K, T[]>> {
    return new Query<T>(this._config).groupBy(accessor);
  }

  // -------------------------------------------------------------------------
  // Reads — chainable
  // -------------------------------------------------------------------------

  filter(predicate: Predicate<T>): Query<T> {
    return new Query<T>(this._config).filter(predicate);
  }

  sortBy(accessor: Accessor<T>): Query<T> {
    return new Query<T>(this._config).sortBy(accessor);
  }

  // -------------------------------------------------------------------------
  // Writes — all use RETURNING * for single-roundtrip results
  // -------------------------------------------------------------------------

  /**
   * Insert one or more rows. Returns the created row(s) with system fields
   * populated (id, createdAt, updatedAt, lastUpdatedBy).
   *
   * Uses `INSERT ... RETURNING *` so the created row comes back in a
   * single round trip — no separate SELECT needed.
   */
  async push(data: PushInput<T>): Promise<T>;
  async push(data: PushInput<T>[]): Promise<T[]>;
  async push(data: PushInput<T> | PushInput<T>[]): Promise<T | T[]> {
    const isArray = Array.isArray(data);
    const items = isArray ? data : [data];

    // Build all INSERT queries and execute in a single batch
    const queries = items.map((item) =>
      buildInsert(
        this._config.tableName,
        item as Record<string, unknown>,
        this._config.columns,
      ),
    );

    const results = await this._config.executeBatch(queries);

    const rows = results.map((r) => {
      if (r.rows.length > 0) {
        return deserializeRow(
          r.rows[0] as Record<string, unknown>,
          this._config.columns,
        ) as T;
      }
      return undefined as unknown as T;
    });

    return isArray ? rows : rows[0];
  }

  /**
   * Update a row by ID. Only the provided fields are changed.
   * Returns the updated row via `UPDATE ... RETURNING *`.
   */
  async update(id: string, data: UpdateInput<T>): Promise<T> {
    const query = buildUpdate(
      this._config.tableName,
      id,
      data as Record<string, unknown>,
      this._config.columns,
    );

    const results = await this._config.executeBatch([query]);

    return deserializeRow(
      results[0].rows[0] as Record<string, unknown>,
      this._config.columns,
    ) as T;
  }

  async remove(id: string): Promise<void> {
    const query = buildDelete(this._config.tableName, `id = ?`, [id]);
    await this._config.executeBatch([query]);
  }

  /**
   * Remove all rows matching a predicate. Returns the count removed.
   */
  async removeAll(predicate: Predicate<T>): Promise<number> {
    const compiled = compilePredicate(predicate);

    if (compiled.type === 'sql') {
      const query = buildDelete(this._config.tableName, compiled.where);
      const results = await this._config.executeBatch([query]);
      return results[0].changes;
    }

    // Fallback: fetch matching rows, delete by ID
    console.warn(
      `[mindstudio] removeAll predicate on ${this._config.tableName} could not be compiled to SQL — fetching all rows first`,
    );

    const allQuery = buildSelect(this._config.tableName);
    const allResults = await this._config.executeBatch([allQuery]);
    const allRows = allResults[0].rows.map(
      (r) =>
        deserializeRow(
          r as Record<string, unknown>,
          this._config.columns,
        ) as Record<string, unknown>,
    );

    const matching = allRows.filter((row) => predicate(row as T));
    if (matching.length === 0) return 0;

    // Delete all matching rows in a single batch
    const deleteQueries = matching
      .filter((row) => row.id)
      .map((row) => buildDelete(this._config.tableName, `id = ?`, [row.id as string]));

    if (deleteQueries.length > 0) {
      await this._config.executeBatch(deleteQueries);
    }

    return matching.length;
  }

  async clear(): Promise<void> {
    const query = buildDelete(this._config.tableName);
    await this._config.executeBatch([query]);
  }
}
