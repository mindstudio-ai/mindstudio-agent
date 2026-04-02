/**
 * Table<T> — a typed persistent collection backed by SQLite.
 *
 * Created via `db.defineTable<T>(name)`. Every method either returns a
 * chainable Query<T> (for lazy reads), a Mutation<T> (for lazy writes),
 * or a Promise (for terminal reads).
 *
 * ## Write operations use RETURNING
 *
 * INSERT and UPDATE use `RETURNING *` to get the created/updated row
 * back in a single round trip — no separate SELECT needed. This is
 * executed via the batch endpoint which runs all queries on a single
 * SQLite connection.
 */

import { Query } from './query.js';
import { Mutation } from './mutation.js';
import { compilePredicate } from './predicate.js';
import { MindStudioError } from '../errors.js';
import {
  buildSelect,
  buildExists,
  buildInsert,
  buildUpdate,
  buildUpsert,
  buildDelete,
  deserializeRow,
} from './sql.js';
import type { Predicate, Accessor, PushInput, UpdateInput, SystemFields, TableConfig } from './types.js';

export class Table<T> {
  /** @internal */
  private readonly _config: TableConfig;

  constructor(config: TableConfig) {
    this._config = config;
  }

  // -------------------------------------------------------------------------
  // Reads — all return batchable Query objects (lazy until awaited)
  // -------------------------------------------------------------------------

  /** Get a single row by ID. Returns null if not found. */
  get(id: string): Query<T, T | null> {
    return new Query<T, T | null>(this._config, {
      rawWhere: 'id = ?',
      rawWhereParams: [id],
      limit: 1,
      postProcess: (rows: T[]) => rows[0] ?? null,
    });
  }

  /** Find the first row matching a predicate. Returns null if none match. */
  findOne(predicate: Predicate<T>): Query<T, T | null> {
    return this.filter(predicate).first();
  }

  /** Count all rows, or rows matching a predicate. */
  count(): Query<T, number>;
  count(predicate: Predicate<T>): Query<T, number>;
  count(predicate?: Predicate<T>): Query<T, number> {
    if (predicate) return this.filter(predicate).count();
    return this.toArray().count();
  }

  /** True if any row matches the predicate. */
  some(predicate: Predicate<T>): Query<T, boolean> {
    return this.filter(predicate).some();
  }

  /** True if all rows match the predicate. */
  async every(predicate: Predicate<T>): Promise<boolean> {
    return this.filter(predicate).every();
  }

  /** True if the table has zero rows. */
  async isEmpty(): Promise<boolean> {
    const query = buildExists(this._config.tableName, undefined, undefined, true);
    const results = await this._config.executeBatch([query]);
    const row = results[0]?.rows[0] as { result: number } | undefined;
    return row?.result === 1;
  }

  /** Row with the minimum value for a field, or null if table is empty. */
  min(accessor: Accessor<T, number>): Query<T, T | null> {
    return this.sortBy(accessor as Accessor<T>).first();
  }

  /** Row with the maximum value for a field, or null if table is empty. */
  max(accessor: Accessor<T, number>): Query<T, T | null> {
    return this.sortBy(accessor as Accessor<T>).reverse().first();
  }

  /** Group rows by a field. Returns a Map. */
  groupBy<K extends string | number>(
    accessor: Accessor<T, K>,
  ): Query<T, Map<K, T[]>> {
    return new Query<T>(this._config).groupBy(accessor) as Query<T, Map<K, T[]>>;
  }

  /** Get all rows as an array. */
  toArray(): Query<T> {
    return new Query<T>(this._config);
  }

  /** Filter rows by a predicate. Returns a chainable Query. */
  filter(predicate: Predicate<T>): Query<T> {
    return new Query<T>(this._config).filter(predicate);
  }

  /** Sort rows by a field. Returns a chainable Query. */
  sortBy(accessor: Accessor<T>): Query<T> {
    return new Query<T>(this._config).sortBy(accessor);
  }

  // -------------------------------------------------------------------------
  // Writes — lazy Mutations, batchable via db.batch()
  //
  // All write methods return Mutation<T> which implements PromiseLike.
  // When awaited standalone, they execute immediately (same behavior as
  // before). When passed to db.batch(), their SQL is bundled into a
  // single round trip.
  // -------------------------------------------------------------------------

  /**
   * Insert one or more rows. Returns the created row(s) with system fields
   * populated (id, createdAt, updatedAt, lastUpdatedBy).
   *
   * Uses `INSERT ... RETURNING *` so the created row comes back in a
   * single round trip — no separate SELECT needed.
   */
  push(data: PushInput<T>): Mutation<T>;
  push(data: PushInput<T>[]): Mutation<T[]>;
  push(data: PushInput<T> | PushInput<T>[]): Mutation<T | T[]> {
    const isArray = Array.isArray(data);
    const items = (isArray ? data : [data]).map((item) =>
      this._config.defaults
        ? ({ ...this._config.defaults, ...item } as PushInput<T>)
        : item,
    );

    for (const item of items) {
      this._checkManagedColumns(item as Record<string, unknown>);
    }

    const queries = items.map((item) =>
      buildInsert(
        this._config.tableName,
        item as Record<string, unknown>,
        this._config.columns,
      ),
    );

    return new Mutation<T | T[]>(this._config, queries, (results) => {
      const rows = results.map((r) => {
        if (r.rows.length > 0) {
          return deserializeRow(
            r.rows[0] as Record<string, unknown>,
            this._config.columns,
          ) as T;
        }
        throw new MindStudioError(
          `Insert into '${this._config.tableName}' succeeded but returned no row. This may indicate a constraint violation.`,
          'insert_failed',
          500,
        );
      });
      const result = isArray ? rows : rows[0];
      this._syncRolesIfNeeded(
        items as Record<string, unknown>[],
        result,
        isArray,
      );
      return result;
    });
  }

  /**
   * Update a row by ID. Only the provided fields are changed.
   * Returns the updated row via `UPDATE ... RETURNING *`.
   */
  update(id: string, data: UpdateInput<T>): Mutation<T> {
    this._checkManagedColumns(data as Record<string, unknown>);
    const query = buildUpdate(
      this._config.tableName,
      id,
      data as Record<string, unknown>,
      this._config.columns,
    );

    return new Mutation<T>(this._config, [query], (results) => {
      if (!results[0]?.rows[0]) {
        throw new MindStudioError(
          `Row not found: no row with ID '${id}' in table '${this._config.tableName}'`,
          'row_not_found',
          404,
        );
      }
      const result = deserializeRow(
        results[0].rows[0] as Record<string, unknown>,
        this._config.columns,
      ) as T;
      this._syncRolesIfNeeded(
        [data as Record<string, unknown>],
        result,
        false,
      );
      return result;
    });
  }

  remove(id: string): Mutation<{ deleted: boolean }> {
    const query = buildDelete(this._config.tableName, `id = ?`, [id]);
    return new Mutation<{ deleted: boolean }>(this._config, [query], (results) => ({
      deleted: results[0].changes > 0,
    }));
  }

  /**
   * Remove all rows matching a predicate. Returns the count removed.
   */
  removeAll(predicate: Predicate<T>): Mutation<number> {
    const compiled = compilePredicate(predicate);

    if (compiled.type === 'sql') {
      const query = buildDelete(this._config.tableName, compiled.where);
      return new Mutation<number>(this._config, [query], (results) => results[0].changes);
    }

    // Fallback: multi-step execution — not batchable
    return Mutation.fromExecutor<number>(this._config, async () => {
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

      const deleteQueries = matching
        .filter((row) => row.id)
        .map((row) => buildDelete(this._config.tableName, `id = ?`, [row.id as string]));

      if (deleteQueries.length > 0) {
        await this._config.executeBatch(deleteQueries);
      }

      return matching.length;
    });
  }

  clear(): Mutation<number> {
    const query = buildDelete(this._config.tableName);
    return new Mutation<number>(this._config, [query], (results) => results[0].changes);
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
  upsert(
    conflictKey:
      | (keyof Omit<T, SystemFields> & string)
      | (keyof Omit<T, SystemFields> & string)[],
    data: PushInput<T>,
  ): Mutation<T> {
    const conflictColumns = (
      Array.isArray(conflictKey) ? conflictKey : [conflictKey]
    ) as string[];

    this._validateUniqueConstraint(conflictColumns);

    const withDefaults = this._config.defaults
      ? ({ ...this._config.defaults, ...data } as Record<string, unknown>)
      : (data as Record<string, unknown>);

    this._checkManagedColumns(withDefaults);

    for (const col of conflictColumns) {
      if (!(col in withDefaults)) {
        throw new MindStudioError(
          `Upsert on ${this._config.tableName} requires "${col}" in data (conflict key)`,
          'missing_conflict_key',
          400,
        );
      }
    }

    const query = buildUpsert(
      this._config.tableName,
      withDefaults,
      conflictColumns,
      this._config.columns,
    );

    return new Mutation<T>(this._config, [query], (results) => {
      if (!results[0]?.rows[0]) {
        throw new MindStudioError(
          `Upsert into ${this._config.tableName} returned no row`,
          'upsert_failed',
          500,
        );
      }
      const result = deserializeRow(
        results[0].rows[0] as Record<string, unknown>,
        this._config.columns,
      ) as T;
      this._syncRolesIfNeeded([withDefaults], result, false);
      return result;
    });
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  /** @internal Throw if data includes a platform-managed email/phone column. */
  private _checkManagedColumns(data: Record<string, unknown>): void {
    const mc = this._config.managedColumns;
    if (!mc) return;

    const keys = Object.keys(data);
    for (const key of keys) {
      if (
        (mc.email && key === mc.email) ||
        (mc.phone && key === mc.phone)
      ) {
        throw new MindStudioError(
          `Cannot write to "${key}" — this column is managed by auth. ` +
            `Use the auth API to change a user's ${key === mc.email ? 'email' : 'phone'}.`,
          'managed_column_write',
          400,
        );
      }
    }
  }

  /**
   * @internal Fire role sync for rows that wrote to the roles column.
   * Called inside processResult (runs after SQL execution in both
   * standalone and batch paths). Fire-and-forget.
   */
  private _syncRolesIfNeeded(
    inputItems: Record<string, unknown>[],
    result: unknown,
    isArray: boolean,
  ): void {
    const rolesCol = this._config.managedColumns?.roles;
    const syncRoles = this._config.syncRoles;
    if (!rolesCol || !syncRoles) return;

    if (!inputItems.some((item) => rolesCol in item)) return;

    if (isArray) {
      for (const row of result as Record<string, unknown>[]) {
        if (row?.id) {
          syncRoles(row.id as string, row[rolesCol]).catch(() => {});
        }
      }
    } else {
      const row = result as Record<string, unknown>;
      if (row?.id) {
        syncRoles(row.id as string, row[rolesCol]).catch(() => {});
      }
    }
  }

  /** @internal Validate that the given columns match a declared unique constraint. */
  private _validateUniqueConstraint(columns: string[]): void {
    if (!this._config.unique?.length) {
      throw new MindStudioError(
        `Cannot upsert on ${this._config.tableName}: no unique constraints declared. ` +
          `Add unique: [[${columns.map((c) => `'${c}'`).join(', ')}]] to defineTable options.`,
        'no_unique_constraint',
        400,
      );
    }
    const sorted = [...columns].sort().join(',');
    const match = this._config.unique.some(
      (u) => [...u].sort().join(',') === sorted,
    );
    if (!match) {
      throw new MindStudioError(
        `Cannot upsert on (${columns.join(', ')}): no matching unique constraint declared on ${this._config.tableName}.`,
        'no_unique_constraint',
        400,
      );
    }
  }
}
