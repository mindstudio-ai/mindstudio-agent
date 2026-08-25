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
  buildExists,
  buildScalarAggregate,
  buildGroupedAggregate,
  deserializeRow,
} from './sql.js';
import {
  normalizeAggregateSpec,
  computeAggregateInJs,
  deserializeAggregateRows,
  type AggregateSelect,
  type AggregateRow,
  type NormalizedAggregateSpec,
} from './aggregate.js';
import type {
  Predicate,
  PredicateBindings,
  PredicateEntry,
  Accessor,
  TableConfig,
  CompiledPredicate,
  SqlQuery,
  SqlResult,
} from './types.js';

// ---------------------------------------------------------------------------
// Aggregate state — set by the aggregate terminals (count, sum, avg,
// countDistinct, aggregate). When present and the chain compiles to SQL,
// execution runs a single aggregate statement instead of fetching rows;
// the terminal's postProcess remains the JS-fallback path.
// ---------------------------------------------------------------------------

type AggregateState<T> =
  | {
      kind: 'scalar';
      fn: 'count' | 'sum' | 'avg' | 'countDistinct';
      accessor?: Accessor<T>;
    }
  | { kind: 'grouped'; spec: NormalizedAggregateSpec };

// ---------------------------------------------------------------------------
// Query class
// ---------------------------------------------------------------------------

export class Query<T, TResult = T[]> implements PromiseLike<TResult> {
  private readonly _predicates: PredicateEntry<T>[];
  private readonly _sortAccessor: Accessor<T> | undefined;
  private readonly _reversed: boolean;
  private readonly _limit: number | undefined;
  private readonly _offset: number | undefined;
  private readonly _config: TableConfig;
  /** @internal Pre-compiled WHERE clause (bypasses predicate compiler). Used by Table.get(). */
  private readonly _rawWhere: string | undefined;
  private readonly _rawWhereParams: unknown[] | undefined;
  /** @internal See AggregateState — set by aggregate terminals. */
  private readonly _aggregate: AggregateState<T> | undefined;
  /** @internal Post-process transform applied after row deserialization. */
  readonly _postProcess: ((rows: T[]) => TResult) | undefined;

  constructor(
    config: TableConfig,
    options?: {
      predicates?: PredicateEntry<T>[];
      sortAccessor?: Accessor<T>;
      reversed?: boolean;
      limit?: number;
      offset?: number;
      postProcess?: (rows: T[]) => TResult;
      rawWhere?: string;
      rawWhereParams?: unknown[];
      aggregate?: AggregateState<T>;
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
    this._aggregate = options?.aggregate;
  }

  private _clone(overrides: {
    predicates?: PredicateEntry<T>[];
    sortAccessor?: Accessor<T>;
    reversed?: boolean;
    limit?: number;
    offset?: number;
    postProcess?: (rows: T[]) => unknown;
    aggregate?: AggregateState<T>;
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
      aggregate: overrides.aggregate ?? this._aggregate,
    });
  }

  // -------------------------------------------------------------------------
  // Chain methods
  // -------------------------------------------------------------------------

  filter(predicate: Predicate<T>): Query<T>;
  filter<B extends PredicateBindings>(
    predicate: (row: T, bindings: B) => boolean,
    bindings: B,
  ): Query<T>;
  filter(predicate: Predicate<T>, bindings?: PredicateBindings): Query<T> {
    return this._clone({
      predicates: [...this._predicates, { fn: predicate, bindings }],
    });
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
    // The aggregate state compiles to SELECT COUNT(*) when the predicates
    // compile to SQL; postProcess is the JS-fallback path (fetch matching
    // rows, count client-side). Same shape for sum/avg/countDistinct below.
    return this._clone({
      aggregate: { kind: 'scalar', fn: 'count' },
      postProcess: (rows: T[]) => rows.length,
    }) as unknown as Query<T, number>;
  }

  /**
   * Sum of a numeric field across matching rows. Compiles to a SQL
   * aggregate (TOTAL) when possible — no rows are fetched. Returns 0 for
   * an empty set; NULL values are skipped (SQL semantics).
   */
  sum(accessor: Accessor<T, number | null | undefined>): Query<T, number> {
    return this._clone({
      aggregate: { kind: 'scalar', fn: 'sum', accessor: accessor as Accessor<T> },
      postProcess: (rows: T[]) =>
        rows.reduce((total: number, row) => {
          const value = accessor(row);
          return value == null ? total : total + value;
        }, 0),
    }) as unknown as Query<T, number>;
  }

  /**
   * Average of a numeric field across matching rows. Compiles to SQL AVG
   * when possible. Returns null for an empty set (or when every value is
   * null) — SQL AVG semantics.
   */
  avg(
    accessor: Accessor<T, number | null | undefined>,
  ): Query<T, number | null> {
    return this._clone({
      aggregate: { kind: 'scalar', fn: 'avg', accessor: accessor as Accessor<T> },
      postProcess: (rows: T[]) => {
        const values = rows
          .map((row) => accessor(row))
          .filter((v): v is number => v != null);
        return values.length === 0
          ? null
          : values.reduce((s, v) => s + v, 0) / values.length;
      },
    }) as unknown as Query<T, number | null>;
  }

  /**
   * Number of distinct non-null values of a field across matching rows.
   * Compiles to SQL COUNT(DISTINCT col) when possible.
   */
  countDistinct(accessor: Accessor<T>): Query<T, number> {
    return this._clone({
      aggregate: { kind: 'scalar', fn: 'countDistinct', accessor },
      postProcess: (rows: T[]) =>
        new Set(rows.map((row) => accessor(row)).filter((v) => v != null))
          .size,
    }) as unknown as Query<T, number>;
  }

  /**
   * Multiple aggregates over all matching rows — a single result object.
   * Compiles to one SQL aggregate statement; no rows are fetched.
   *
   * ```ts
   * const stats = await Orders
   *   .filter(o => o.status === 'paid')
   *   .aggregate({ select: { n: { count: true }, revenue: { sum: 'amount' } } });
   * // { n: number; revenue: number }
   * ```
   */
  aggregate<S extends AggregateSelect<T>>(spec: {
    select: S;
  }): Query<T, AggregateRow<T, S>>;
  /**
   * Grouped aggregation — compiles to SELECT ... GROUP BY; never fetches
   * rows (when the filter compiles to SQL). Returns one plain object per
   * group: the group-key columns plus one property per select alias.
   * `orderBy` names a select alias or group key; with `desc` + `limit`
   * this expresses top-N groups in a single statement.
   *
   * ```ts
   * const top = await Answers
   *   .filter((a, $) => a.surveyId === $.surveyId, { surveyId })
   *   .aggregate({
   *     by: ['questionId'],
   *     select: {
   *       n: { count: true },
   *       avgScore: { avg: 'score' },
   *       respondents: { countDistinct: 'responseId' },
   *     },
   *     orderBy: 'n',
   *     desc: true,
   *     limit: 20,
   *   });
   * // Array<{ questionId: string; n: number; avgScore: number | null; respondents: number }>
   * ```
   */
  aggregate<
    const By extends readonly (keyof T & string)[],
    S extends AggregateSelect<T>,
  >(spec: {
    by: By;
    select: S;
    orderBy?: (keyof S & string) | By[number];
    desc?: boolean;
    limit?: number;
  }): Query<T, Array<Pick<T, By[number]> & AggregateRow<T, S>>>;
  aggregate(spec: {
    by?: readonly string[];
    select: AggregateSelect<T>;
    orderBy?: string;
    desc?: boolean;
    limit?: number;
  }): Query<T, unknown> {
    const normalized = normalizeAggregateSpec(
      spec as Parameters<typeof normalizeAggregateSpec>[0],
    );
    return this._clone({
      aggregate: { kind: 'grouped', spec: normalized },
      postProcess: (rows: T[]) =>
        computeAggregateInJs(
          rows as Record<string, unknown>[],
          normalized,
        ),
    }) as unknown as Query<T, unknown>;
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
      this._predicates.every((p) => p.fn(row as T, p.bindings)),
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
      const agg = this._compileAggregateSql(compiled.sqlWhere);
      if (agg) {
        return { type: 'query', query: agg.query, fallbackQuery: null, config: this._config, processRaw: agg.processRaw };
      }
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
    // Aggregate fast path — the result rows ARE the answer (aggregate
    // values, not table rows): the compiled processor reads them directly,
    // bypassing row deserialization and postProcess.
    if (compiled.processRaw) {
      return compiled.processRaw(result);
    }

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
      ? rows.filter((row) => compiled.predicates!.every((p) => p.fn(row, p.bindings)))
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
    return this._run().then(onfulfilled, onrejected);
  }

  private async _run(): Promise<TResult> {
    // Aggregate fast path — mirrors the processRaw branch in _compile()/
    // _processResults() for the standalone-await case. JS-fallback
    // predicates (and unextractable accessors) drop through to _execute()
    // + postProcess, which computes the same result over fetched rows.
    if (this._aggregate && !this._rawWhere) {
      const compiled = this._compilePredicates();
      if (compiled.allSql) {
        const agg = this._compileAggregateSql(compiled.sqlWhere);
        if (agg) {
          const results = await this._config.executeBatch([agg.query]);
          return agg.processRaw(results[0]);
        }
      }
    }
    const rows = await this._execute();
    return (this._postProcess ? this._postProcess(rows) : rows) as TResult;
  }

  /**
   * @internal Compile the pending aggregate into a single SQL statement +
   * result processor. Returns null (→ fetch path, postProcess computes the
   * aggregate) when there is no aggregate, when a pre-compiled WHERE is in
   * play (Table.get()), when limit/offset are set (aggregate-the-page
   * semantics — COUNT(*)/TOTAL can't express "over the limited page"), or
   * when a scalar accessor doesn't extract to a column (computed accessors
   * stay correct via JS, with a warning to prompt optimization).
   */
  private _compileAggregateSql(
    sqlWhere: string,
  ): { query: SqlQuery; processRaw: (result: SqlResult) => TResult } | null {
    const agg = this._aggregate;
    if (
      !agg ||
      this._rawWhere ||
      this._limit != null ||
      this._offset != null
    ) {
      return null;
    }
    const where = sqlWhere || undefined;

    if (agg.kind === 'scalar') {
      let column: string | null = null;
      if (agg.accessor) {
        column = extractFieldName(agg.accessor);
        if (column == null) {
          console.warn(
            `[mindstudio] ${agg.fn}() accessor on '${this._config.tableName}' could not be compiled to SQL — fetching matching rows and computing in JS`,
          );
          return null;
        }
      }
      const query = buildScalarAggregate(
        this._config.tableName,
        agg.fn,
        column,
        where,
      );
      const processRaw = (result: SqlResult): TResult => {
        const value = (result.rows[0] as { value?: unknown } | undefined)
          ?.value;
        if (agg.fn === 'avg') {
          return (value == null ? null : Number(value)) as TResult;
        }
        return Number(value ?? 0) as TResult;
      };
      return { query, processRaw };
    }

    const spec = agg.spec;
    const query = buildGroupedAggregate(this._config.tableName, {
      by: spec.by,
      select: spec.select,
      where,
      orderBy: spec.orderBy,
      desc: spec.desc,
      limit: spec.limit,
    });
    const processRaw = (result: SqlResult): TResult => {
      const rows = deserializeAggregateRows(
        result.rows,
        spec,
        this._config.columns,
      );
      // No group-by → the statement returns exactly one row: the result is
      // that single object, matching computeAggregateInJs.
      return (spec.by.length === 0 ? rows[0] : rows) as TResult;
    };
    return { query, processRaw };
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

    const compiled = this._predicates.map((p) => compilePredicate(p.fn, p.bindings));
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
      this._predicates.every((p) => p.fn(row as T, p.bindings)),
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
  predicates?: PredicateEntry<T>[];
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
  /** When set, the SQL result rows ARE the answer (aggregate values, not
   * table rows): called instead of deserialize + postProcess. */
  processRaw?: (result: SqlResult) => TResult;
}

export function extractFieldName<T>(accessor: Accessor<T>): string | null {
  const source = accessor.toString();
  const match = source.match(
    /^\s*\(?([a-zA-Z_$][a-zA-Z0-9_$]*)\)?\s*=>\s*\1\.([a-zA-Z_$][a-zA-Z0-9_$]*)\s*$/,
  );
  return match?.[2] ?? null;
}
