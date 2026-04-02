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
  SqlQuery,
  SqlResult,
} from './types.js';

// ---------------------------------------------------------------------------
// Query class
// ---------------------------------------------------------------------------

export class Query<T, TResult = T[]> implements PromiseLike<TResult> {
  private readonly _predicates: Predicate<T>[];
  private readonly _sortAccessor: Accessor<T> | undefined;
  private readonly _reversed: boolean;
  private readonly _limit: number | undefined;
  private readonly _offset: number | undefined;
  private readonly _config: TableConfig;
  /** @internal Pre-compiled WHERE clause (bypasses predicate compiler). Used by Table.get(). */
  private readonly _rawWhere: string | undefined;
  private readonly _rawWhereParams: unknown[] | undefined;
  /** @internal Post-process transform applied after row deserialization. */
  readonly _postProcess: ((rows: T[]) => TResult) | undefined;

  constructor(
    config: TableConfig,
    options?: {
      predicates?: Predicate<T>[];
      sortAccessor?: Accessor<T>;
      reversed?: boolean;
      limit?: number;
      offset?: number;
      postProcess?: (rows: T[]) => TResult;
      rawWhere?: string;
      rawWhereParams?: unknown[];
    },
  ) {
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

  private _clone(overrides: {
    predicates?: Predicate<T>[];
    sortAccessor?: Accessor<T>;
    reversed?: boolean;
    limit?: number;
    offset?: number;
    postProcess?: (rows: T[]) => unknown;
  }): Query<T> {
    return new Query<T>(this._config, {
      predicates: overrides.predicates ?? this._predicates,
      sortAccessor: overrides.sortAccessor ?? this._sortAccessor,
      reversed: overrides.reversed ?? this._reversed,
      limit: overrides.limit ?? this._limit,
      offset: overrides.offset ?? this._offset,
      postProcess: overrides.postProcess as ((rows: T[]) => T[]) | undefined,
      rawWhere: this._rawWhere,
      rawWhereParams: this._rawWhereParams,
    });
  }

  // -------------------------------------------------------------------------
  // Chain methods
  // -------------------------------------------------------------------------

  filter(predicate: Predicate<T>): Query<T> {
    return this._clone({ predicates: [...this._predicates, predicate] });
  }

  sortBy(accessor: Accessor<T>): Query<T> {
    return this._clone({ sortAccessor: accessor });
  }

  reverse(): Query<T> {
    return this._clone({ reversed: !this._reversed });
  }

  take(n: number): Query<T> {
    return this._clone({ limit: n });
  }

  skip(n: number): Query<T> {
    return this._clone({ offset: n });
  }

  // -------------------------------------------------------------------------
  // Terminal methods
  // -------------------------------------------------------------------------

  first(): Query<T, T | null> {
    return this._clone({
      limit: 1,
      postProcess: (rows: T[]) => rows[0] ?? null,
    }) as unknown as Query<T, T | null>;
  }

  last(): Query<T, T | null> {
    return this._clone({
      limit: 1,
      reversed: !this._reversed,
      postProcess: (rows: T[]) => rows[0] ?? null,
    }) as unknown as Query<T, T | null>;
  }

  count(): Query<T, number> {
    return this._clone({
      postProcess: (rows: T[]) => rows.length,
    }) as unknown as Query<T, number>;
  }

  some(): Query<T, boolean> {
    return this._clone({
      limit: 1,
      postProcess: (rows: T[]) => rows.length > 0,
    }) as unknown as Query<T, boolean>;
  }

  async every(): Promise<boolean> {
    const compiled = this._compilePredicates();

    if (compiled.allSql && compiled.sqlWhere) {
      const query = buildExists(
        this._config.tableName,
        `NOT (${compiled.sqlWhere})`,
        undefined,
        true,
      );
      const results = await this._config.executeBatch([query]);
      const row = results[0]?.rows[0] as { result: number } | undefined;
      return row?.result === 1;
    }

    if (this._predicates.length === 0) return true;

    const allRows = await this._fetchAllRows();
    return allRows.every((row) =>
      this._predicates.every((pred) => pred(row as T)),
    );
  }

  min(accessor: Accessor<T, number>): Query<T, T | null> {
    return this.sortBy(accessor as Accessor<T>).first();
  }

  max(accessor: Accessor<T, number>): Query<T, T | null> {
    return this.sortBy(accessor as Accessor<T>).reverse().first();
  }

  groupBy<K extends string | number>(
    accessor: Accessor<T, K>,
  ): Query<T, Map<K, T[]>> {
    return this._clone({
      postProcess: (rows: T[]) => {
        const map = new Map<K, T[]>();
        for (const row of rows) {
          const key = accessor(row);
          const group = map.get(key);
          if (group) group.push(row);
          else map.set(key, [row]);
        }
        return map;
      },
    }) as unknown as Query<T, Map<K, T[]>>;
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
  _compile(): CompiledQuery<T, TResult> {
    // Raw WHERE path — bypass predicate compiler (used by Table.get())
    if (this._rawWhere) {
      const query = buildSelect(this._config.tableName, {
        where: this._rawWhere,
        whereParams: this._rawWhereParams,
        orderBy: undefined,
        limit: this._limit,
        offset: this._offset,
      });
      return { type: 'query', query, fallbackQuery: null, config: this._config, postProcess: this._postProcess };
    }

    const compiled = this._compilePredicates();
    const sortField = this._sortAccessor
      ? extractFieldName(this._sortAccessor)
      : undefined;

    if (compiled.allSql) {
      const query = buildSelect(this._config.tableName, {
        where: compiled.sqlWhere || undefined,
        orderBy: sortField ?? undefined,
        desc: this._reversed,
        limit: this._limit,
        offset: this._offset,
      });
      return { type: 'query', query, fallbackQuery: null, config: this._config, postProcess: this._postProcess };
    }

    // JS fallback — need all rows
    const fallbackQuery = buildSelect(this._config.tableName);
    return {
      type: 'query',
      query: null,
      fallbackQuery,
      config: this._config,
      predicates: this._predicates,
      sortAccessor: this._sortAccessor,
      reversed: this._reversed,
      limit: this._limit,
      offset: this._offset,
      postProcess: this._postProcess,
    };
  }

  /**
   * @internal Process raw SQL results into typed rows. Used by db.batch()
   * after executing the compiled query.
   *
   * For SQL-compiled queries: just deserialize the rows.
   * For JS-fallback queries: filter, sort, and slice in JS.
   */
  static _processResults<T, R = T[]>(
    result: SqlResult,
    compiled: CompiledQuery<T, R>,
  ): R {
    const rows = result.rows.map(
      (row) =>
        deserializeRow(
          row as Record<string, unknown>,
          compiled.config.columns,
        ) as T,
    );

    // SQL path — rows are already filtered/sorted/limited
    if (compiled.query) {
      return compiled.postProcess ? compiled.postProcess(rows) : rows as unknown as R;
    }

    // JS fallback — apply predicates, sort, slice
    let filtered: T[] = compiled.predicates
      ? rows.filter((row) => compiled.predicates!.every((pred) => pred(row)))
      : rows;

    if (compiled.sortAccessor) {
      const accessor = compiled.sortAccessor;
      const reversed = compiled.reversed ?? false;
      filtered.sort((a, b) => {
        const aVal = accessor(a) as number | string;
        const bVal = accessor(b) as number | string;
        if (aVal < bVal) return reversed ? 1 : -1;
        if (aVal > bVal) return reversed ? -1 : 1;
        return 0;
      });
    }

    if (compiled.offset != null || compiled.limit != null) {
      const start = compiled.offset ?? 0;
      const end = compiled.limit != null ? start + compiled.limit : undefined;
      filtered = filtered.slice(start, end);
    }

    return compiled.postProcess ? compiled.postProcess(filtered) : filtered as unknown as R;
  }

  // -------------------------------------------------------------------------
  // PromiseLike
  // -------------------------------------------------------------------------

  then<TResult1 = TResult, TResult2 = never>(
    onfulfilled?: ((value: TResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    const promise = this._execute().then(
      (rows) => (this._postProcess ? this._postProcess(rows) : rows) as TResult,
    );
    return promise.then(onfulfilled, onrejected);
  }

  catch<TResult2 = never>(
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult | TResult2> {
    return this.then(undefined, onrejected) as Promise<TResult | TResult2>;
  }

  // -------------------------------------------------------------------------
  // Execution internals
  // -------------------------------------------------------------------------

  private async _execute(): Promise<T[]> {
    // Raw WHERE path — bypass predicate compiler (used by Table.get())
    if (this._rawWhere) {
      const query = buildSelect(this._config.tableName, {
        where: this._rawWhere,
        whereParams: this._rawWhereParams,
        limit: this._limit,
        offset: this._offset,
      });
      const results = await this._config.executeBatch([query]);
      return results[0].rows.map(
        (row) =>
          deserializeRow(
            row as Record<string, unknown>,
            this._config.columns,
          ) as T,
      );
    }

    const compiled = this._compilePredicates();

    if (compiled.allSql) {
      const sortField = this._sortAccessor
        ? extractFieldName(this._sortAccessor)
        : undefined;

      const query = buildSelect(this._config.tableName, {
        where: compiled.sqlWhere || undefined,
        orderBy: sortField ?? undefined,
        desc: this._reversed,
        limit: this._limit,
        offset: this._offset,
      });

      const results = await this._config.executeBatch([query]);
      return results[0].rows.map(
        (row) =>
          deserializeRow(
            row as Record<string, unknown>,
            this._config.columns,
          ) as T,
      );
    }

    // Fallback: fetch all rows, process in JS
    let rows = await this._fetchAndFilterInJs(compiled);

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

    if (this._offset != null || this._limit != null) {
      const start = this._offset ?? 0;
      const end = this._limit != null ? start + this._limit : undefined;
      rows = rows.slice(start, end);
    }

    return rows as T[];
  }

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
      sqlWhere = compiled
        .map((c) => (c as { type: 'sql'; where: string }).where)
        .join(' AND ');
    }

    return { allSql, sqlWhere, compiled };
  }

  private async _fetchAndFilterInJs(
    compiled: { compiled: CompiledPredicate<T>[] },
  ): Promise<Record<string, unknown>[]> {
    const allRows = await this._fetchAllRows();

    const jsFallbacks = compiled.compiled.filter((c) => c.type === 'js');
    if (jsFallbacks.length > 0) {
      const reasons = jsFallbacks
        .map((c) => c.type === 'js' ? c.reason : undefined)
        .filter(Boolean);
      const reasonSuffix = reasons.length > 0 ? ` (${reasons.join('; ')})` : '';
      console.warn(
        `[mindstudio] Filter on '${this._config.tableName}' could not be compiled to SQL${reasonSuffix} — scanning ${allRows.length} rows in JS`,
      );
    }

    return allRows.filter((row) =>
      this._predicates.every((pred) => pred(row as T)),
    );
  }

  private async _fetchAllRows(): Promise<Record<string, unknown>[]> {
    const query = buildSelect(this._config.tableName);
    const results = await this._config.executeBatch([query]);
    return results[0].rows.map((row) =>
      deserializeRow(row as Record<string, unknown>, this._config.columns),
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Result of Query._compile(). Contains either a compiled SQL query
 * (fast path) or a fallback SELECT * with JS processing metadata.
 */
export interface CompiledQuery<T, TResult = T[]> {
  type: 'query';
  /** Compiled SQL query, or null if JS fallback needed. */
  query: SqlQuery | null;
  /** SELECT * fallback query, or null if SQL compiled. */
  fallbackQuery: SqlQuery | null;
  /** Table config for deserialization. */
  config: TableConfig;
  /** JS predicates (only for fallback). */
  predicates?: Predicate<T>[];
  /** Sort accessor (only for fallback). */
  sortAccessor?: Accessor<T>;
  /** Sort direction (only for fallback). */
  reversed?: boolean;
  /** Limit (only for fallback). */
  limit?: number;
  /** Offset (only for fallback). */
  offset?: number;
  /** Post-process transform (e.g. first() extracts [0] ?? null). */
  postProcess?: (rows: T[]) => TResult;
}

export function extractFieldName<T>(accessor: Accessor<T>): string | null {
  const source = accessor.toString();
  const match = source.match(
    /^\s*\(?([a-zA-Z_$][a-zA-Z0-9_$]*)\)?\s*=>\s*\1\.([a-zA-Z_$][a-zA-Z0-9_$]*)\s*$/,
  );
  return match?.[2] ?? null;
}
