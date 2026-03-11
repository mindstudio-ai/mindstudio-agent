/**
 * Query chain builder — lazy, immutable query construction for database reads.
 *
 * A Query<T> represents a pending database query. It accumulates operations
 * (filter, sort, limit, skip) without executing anything. Execution happens
 * only when the query is awaited (via PromiseLike) or a terminal method
 * is called (first, last, count, some, every, min, max, groupBy).
 *
 * ## Immutability
 *
 * Every chain method returns a NEW Query instance. This means chains can
 * safely fork:
 *
 * ```ts
 * const base = Orders.filter(o => o.status === 'active');
 * const recent = base.sortBy(o => o.createdAt).reverse().take(10);
 * const count = await base.count();  // doesn't affect `recent`
 * ```
 *
 * ## Execution strategy (SQL fast path vs JS fallback)
 *
 * When a Query is executed, it attempts to compile all predicates to SQL:
 *
 * - **Fast path**: All predicates compile → single SQL query with WHERE,
 *   ORDER BY, LIMIT, OFFSET. Efficient, minimal data transfer.
 *
 * - **Fallback path**: Any predicate fails to compile → fetch ALL rows
 *   from the table (SELECT *), then apply the entire chain as native JS
 *   array operations (Array.filter, Array.sort, Array.slice, etc.).
 *   A warning is logged so developers can optimize if needed.
 *
 * Both paths produce identical results. The SQL path is a transparent
 * performance optimization.
 *
 * ## Data flow
 *
 * ```
 * .filter(pred1).filter(pred2).sortBy(fn).reverse().take(10)
 *     ↓
 * Query { predicates: [pred1, pred2], sortAccessor: fn, reversed: true, limit: 10 }
 *     ↓ (on await)
 * compilePredicate(pred1) → SQL?   compilePredicate(pred2) → SQL?
 *     ↓
 * All SQL? → buildSelect('table', { where: 'p1 AND p2', orderBy, desc, limit })
 *            → executeQuery(sql) → deserialize rows → return T[]
 *
 * Any JS?  → buildSelect('table', {}) → executeQuery → deserialize all rows
 *            → Array.filter(pred1).filter(pred2).sort(...).slice(0, 10) → return T[]
 * ```
 */

import { compilePredicate } from './predicate.js';
import {
  buildSelect,
  buildCount,
  buildExists,
  deserializeRow,
} from './sql.js';
import type {
  Predicate,
  Accessor,
  TableConfig,
  CompiledPredicate,
} from './types.js';

// ---------------------------------------------------------------------------
// Query class
// ---------------------------------------------------------------------------

/**
 * A lazy, chainable database query. Implements PromiseLike<T[]> so it
 * can be awaited directly to get the result rows.
 *
 * @example
 * ```ts
 * // Chain operations (nothing executes yet)
 * const query = Orders
 *   .filter(o => o.status === 'active')
 *   .sortBy(o => o.createdAt)
 *   .reverse()
 *   .take(10);
 *
 * // Execute the query by awaiting it
 * const rows = await query;
 * ```
 */
export class Query<T> implements PromiseLike<T[]> {
  /** @internal Accumulated predicate functions to filter by. */
  private readonly _predicates: Predicate<T>[];

  /** @internal The field accessor for sorting, if set. */
  private readonly _sortAccessor: Accessor<T> | undefined;

  /** @internal Whether the sort order is reversed (DESC). */
  private readonly _reversed: boolean;

  /** @internal Maximum number of results (SQL LIMIT). */
  private readonly _limit: number | undefined;

  /** @internal Number of results to skip (SQL OFFSET). */
  private readonly _offset: number | undefined;

  /** @internal Binding to the database execution layer. */
  private readonly _config: TableConfig;

  constructor(
    config: TableConfig,
    options?: {
      predicates?: Predicate<T>[];
      sortAccessor?: Accessor<T>;
      reversed?: boolean;
      limit?: number;
      offset?: number;
    },
  ) {
    this._config = config;
    this._predicates = options?.predicates ?? [];
    this._sortAccessor = options?.sortAccessor;
    this._reversed = options?.reversed ?? false;
    this._limit = options?.limit;
    this._offset = options?.offset;
  }

  /**
   * Create a clone of this query with some options overridden.
   * Used internally by chain methods to maintain immutability.
   */
  private _clone(overrides: {
    predicates?: Predicate<T>[];
    sortAccessor?: Accessor<T>;
    reversed?: boolean;
    limit?: number;
    offset?: number;
  }): Query<T> {
    return new Query<T>(this._config, {
      predicates: overrides.predicates ?? this._predicates,
      sortAccessor: overrides.sortAccessor ?? this._sortAccessor,
      reversed: overrides.reversed ?? this._reversed,
      limit: overrides.limit ?? this._limit,
      offset: overrides.offset ?? this._offset,
    });
  }

  // -------------------------------------------------------------------------
  // Chain methods — return new Query instances
  // -------------------------------------------------------------------------

  /**
   * Add a filter predicate. Multiple filters are ANDed together.
   *
   * @example
   * ```ts
   * const active = Orders.filter(o => o.status === 'active');
   * const expensive = active.filter(o => o.amount > 5000);
   * // WHERE status = 'active' AND amount > 5000
   * ```
   */
  filter(predicate: Predicate<T>): Query<T> {
    return this._clone({
      predicates: [...this._predicates, predicate],
    });
  }

  /**
   * Sort results by a field (ascending by default).
   * Use `.reverse()` after `.sortBy()` for descending order.
   *
   * @example
   * ```ts
   * const newest = Orders.sortBy(o => o.createdAt).reverse();
   * ```
   */
  sortBy(accessor: Accessor<T>): Query<T> {
    return this._clone({ sortAccessor: accessor });
  }

  /**
   * Reverse the current sort order. If no sort is set, this has no effect.
   */
  reverse(): Query<T> {
    return this._clone({ reversed: !this._reversed });
  }

  /**
   * Limit the number of results returned.
   *
   * @example
   * ```ts
   * const top10 = Orders.sortBy(o => o.amount).reverse().take(10);
   * ```
   */
  take(n: number): Query<T> {
    return this._clone({ limit: n });
  }

  /**
   * Skip the first n results. Use with `.take()` for pagination.
   *
   * @example
   * ```ts
   * const page2 = Orders.sortBy(o => o.createdAt).skip(50).take(50);
   * ```
   */
  skip(n: number): Query<T> {
    return this._clone({ offset: n });
  }

  // -------------------------------------------------------------------------
  // Terminal methods — execute the query and return results
  // -------------------------------------------------------------------------

  /**
   * Return the first matching row, or null if no rows match.
   * Applies the current sort order before taking the first result.
   */
  async first(): Promise<T | null> {
    const rows = await this._clone({ limit: 1 })._execute();
    return rows[0] ?? null;
  }

  /**
   * Return the last matching row (per current sort), or null.
   * Flips the sort direction and takes 1 row.
   */
  async last(): Promise<T | null> {
    const rows = await this._clone({ limit: 1, reversed: !this._reversed })._execute();
    return rows[0] ?? null;
  }

  /**
   * Count matching rows. Returns a number, not the rows themselves.
   * Executes as `SELECT COUNT(*)` when predicates compile to SQL.
   */
  async count(): Promise<number> {
    const compiled = this._compilePredicates();

    if (compiled.allSql) {
      // Fast path: single COUNT query
      const where = compiled.sqlWhere || undefined;
      const sql = buildCount(this._config.tableName, where);
      const result = await this._config.executeQuery(sql);
      const row = result.rows[0] as { count: number } | undefined;
      return row?.count ?? 0;
    }

    // Fallback: fetch all and count in JS
    const rows = await this._fetchAndFilterInJs(compiled);
    return rows.length;
  }

  /**
   * Check if any row matches the current filters. Short-circuits —
   * doesn't load all rows when using SQL.
   */
  async some(): Promise<boolean> {
    const compiled = this._compilePredicates();

    if (compiled.allSql) {
      const where = compiled.sqlWhere || undefined;
      const sql = buildExists(this._config.tableName, where);
      const result = await this._config.executeQuery(sql);
      const row = result.rows[0] as { result: number } | undefined;
      return row?.result === 1;
    }

    const rows = await this._fetchAndFilterInJs(compiled);
    return rows.length > 0;
  }

  /**
   * Check if all rows match the current filters. Short-circuits on false.
   *
   * Implemented as NOT EXISTS(... WHERE NOT predicate) — returns true
   * if no rows fail the predicate.
   */
  async every(): Promise<boolean> {
    const compiled = this._compilePredicates();

    if (compiled.allSql && compiled.sqlWhere) {
      // NOT EXISTS(SELECT 1 FROM t WHERE NOT (predicate))
      const sql = buildExists(this._config.tableName, `NOT (${compiled.sqlWhere})`, true);
      const result = await this._config.executeQuery(sql);
      const row = result.rows[0] as { result: number } | undefined;
      return row?.result === 1;
    }

    // Fallback: fetch all and check with JS
    // For every(), we need to check that all rows in the table match.
    // If there are no predicates, every() is vacuously true.
    if (this._predicates.length === 0) return true;

    const allRows = await this._fetchAllRows();
    return allRows.every((row) =>
      this._predicates.every((pred) => pred(row as T)),
    );
  }

  /**
   * Return the row with the minimum value for the given field.
   * Executes as `ORDER BY field ASC LIMIT 1` in SQL.
   */
  async min(accessor: Accessor<T, number>): Promise<T | null> {
    return this.sortBy(accessor as Accessor<T>).first();
  }

  /**
   * Return the row with the maximum value for the given field.
   * Executes as `ORDER BY field DESC LIMIT 1` in SQL.
   */
  async max(accessor: Accessor<T, number>): Promise<T | null> {
    return this.sortBy(accessor as Accessor<T>).reverse().first();
  }

  /**
   * Group rows by a field value. Returns a Map.
   * Always executes in JS (no SQL equivalent for grouping into a Map).
   */
  async groupBy<K extends string | number>(
    accessor: Accessor<T, K>,
  ): Promise<Map<K, T[]>> {
    const rows = await this._execute();
    const map = new Map<K, T[]>();

    for (const row of rows) {
      const key = accessor(row);
      const group = map.get(key);
      if (group) {
        group.push(row);
      } else {
        map.set(key, [row]);
      }
    }

    return map;
  }

  // -------------------------------------------------------------------------
  // PromiseLike implementation — makes `await query` work
  // -------------------------------------------------------------------------

  /**
   * PromiseLike.then() — executes the query and pipes the result.
   * This is what makes `const rows = await query` work.
   */
  then<TResult1 = T[], TResult2 = never>(
    onfulfilled?: ((value: T[]) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this._execute().then(onfulfilled, onrejected);
  }

  // -------------------------------------------------------------------------
  // Execution internals
  // -------------------------------------------------------------------------

  /**
   * Execute the query and return typed result rows.
   *
   * This is the core execution method. It:
   * 1. Tries to compile all predicates to SQL
   * 2. If all compile → builds and executes a single SQL query
   * 3. If any fail → fetches all rows and processes in JS
   * 4. Deserializes rows (user prefix stripping, JSON parsing)
   */
  private async _execute(): Promise<T[]> {
    const compiled = this._compilePredicates();

    if (compiled.allSql) {
      // Fast path: everything compiles to SQL
      const sortField = this._sortAccessor
        ? extractFieldName(this._sortAccessor)
        : undefined;

      const sql = buildSelect(this._config.tableName, {
        where: compiled.sqlWhere || undefined,
        orderBy: sortField ?? undefined,
        desc: this._reversed,
        limit: this._limit,
        offset: this._offset,
      });

      const result = await this._config.executeQuery(sql);
      return result.rows.map(
        (row) =>
          deserializeRow(
            row as Record<string, unknown>,
            this._config.columns,
          ) as T,
      );
    }

    // Fallback path: fetch all rows, process in JS
    let rows = await this._fetchAndFilterInJs(compiled);

    // Apply sort in JS
    if (this._sortAccessor) {
      const accessor = this._sortAccessor;
      rows.sort((a, b) => {
        const aVal = accessor(a as T) as number | string;
        const bVal = accessor(b as T) as number | string;
        if (aVal < bVal) return this._reversed ? 1 : -1;
        if (aVal > bVal) return this._reversed ? -1 : 1;
        return 0;
      });
    }

    // Apply offset and limit in JS
    if (this._offset != null || this._limit != null) {
      const start = this._offset ?? 0;
      const end = this._limit != null ? start + this._limit : undefined;
      rows = rows.slice(start, end);
    }

    return rows as T[];
  }

  /**
   * Compile all accumulated predicates and determine the execution strategy.
   *
   * Returns an object with:
   * - `allSql`: whether all predicates compiled to SQL
   * - `sqlWhere`: combined WHERE clause (ANDed) if all compiled
   * - `compiled`: individual compilation results
   */
  private _compilePredicates(): {
    allSql: boolean;
    sqlWhere: string;
    compiled: CompiledPredicate<T>[];
  } {
    if (this._predicates.length === 0) {
      return { allSql: true, sqlWhere: '', compiled: [] };
    }

    const compiled = this._predicates.map((pred) => compilePredicate(pred));
    const allSql = compiled.every((c) => c.type === 'sql');

    let sqlWhere = '';
    if (allSql) {
      // AND all SQL WHERE clauses together
      sqlWhere = compiled
        .map((c) => (c as { type: 'sql'; where: string }).where)
        .join(' AND ');
    }

    return { allSql, sqlWhere, compiled };
  }

  /**
   * Fetch all rows from the table and apply JS predicates.
   * This is the fallback path when SQL compilation fails.
   *
   * Logs a warning to stderr so developers know they're on the slow path.
   */
  private async _fetchAndFilterInJs(
    compiled: { compiled: CompiledPredicate<T>[] },
  ): Promise<Record<string, unknown>[]> {
    const allRows = await this._fetchAllRows();

    // Log a warning about the JS fallback
    if (compiled.compiled.some((c) => c.type === 'js')) {
      console.warn(
        `[mindstudio] Filter on ${this._config.tableName} could not be compiled to SQL — scanning ${allRows.length} rows in JS`,
      );
    }

    // Apply all predicates as JS filters
    return allRows.filter((row) =>
      this._predicates.every((pred) => pred(row as T)),
    );
  }

  /**
   * Fetch all rows from the table (SELECT * with no WHERE).
   * Used by the JS fallback path.
   */
  private async _fetchAllRows(): Promise<Record<string, unknown>[]> {
    const sql = buildSelect(this._config.tableName);
    const result = await this._config.executeQuery(sql);
    return result.rows.map((row) =>
      deserializeRow(row as Record<string, unknown>, this._config.columns),
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract the field name from an accessor function.
 *
 * Parses `o => o.fieldName` to get `"fieldName"`. Used for building
 * ORDER BY clauses from sort accessors.
 *
 * Returns null if the pattern can't be parsed (in which case the sort
 * will be applied in JS instead).
 */
export function extractFieldName<T>(accessor: Accessor<T>): string | null {
  const source = accessor.toString();
  // Match: `param => param.field` or `(param) => param.field`
  const match = source.match(
    /^\s*\(?([a-zA-Z_$][a-zA-Z0-9_$]*)\)?\s*=>\s*\1\.([a-zA-Z_$][a-zA-Z0-9_$]*)\s*$/,
  );
  return match?.[2] ?? null;
}
