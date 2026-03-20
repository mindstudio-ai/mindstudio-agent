/**
 * Mutation<T> — a lazy write operation backed by SQLite.
 *
 * Created by Table write methods (push, update, remove, removeAll, clear).
 * Like Query, implements PromiseLike so `await` triggers execution. Unlike
 * Query, there's no chaining — a Mutation is a fixed set of SQL statements
 * with a result processor.
 *
 * ## Batch support
 *
 * `db.batch()` calls `_compile()` to extract the SQL without executing,
 * then bundles it with other operations into a single round trip. After
 * execution, `_processResults()` deserializes the raw SQL results.
 *
 * ## Non-batchable mutations
 *
 * Some mutations (e.g. `removeAll` with a JS-fallback predicate) require
 * multi-step execution that can't be expressed as a fixed SQL batch.
 * These are created via `Mutation.fromExecutor()` and work fine when
 * awaited standalone, but throw if passed to `db.batch()`.
 */

import type { TableConfig, SqlQuery, SqlResult } from './types.js';

// ---------------------------------------------------------------------------
// CompiledMutation — returned by _compile() for db.batch()
// ---------------------------------------------------------------------------

export interface CompiledMutation<TResult> {
  type: 'mutation';
  queries: SqlQuery[];
  config: TableConfig;
  processResult: (results: SqlResult[]) => TResult;
}

// ---------------------------------------------------------------------------
// Mutation class
// ---------------------------------------------------------------------------

export class Mutation<TResult> implements PromiseLike<TResult> {
  /** @internal */
  private readonly _config: TableConfig;
  /** @internal */
  private readonly _queries: SqlQuery[];
  /** @internal */
  private readonly _processResult: (results: SqlResult[]) => TResult;
  /** @internal Non-batchable executor for complex mutations (e.g. removeAll JS fallback). */
  private readonly _executor:
    | (() => Promise<TResult>)
    | undefined;

  constructor(
    config: TableConfig,
    queries: SqlQuery[],
    processResult: (results: SqlResult[]) => TResult,
  ) {
    this._config = config;
    this._queries = queries;
    this._processResult = processResult;
    this._executor = undefined;
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
  static fromExecutor<T>(
    config: TableConfig,
    executor: () => Promise<T>,
  ): Mutation<T> {
    const m = new Mutation<T>(config, [], () => undefined as T);
    // Override the private field — TypeScript doesn't allow reassigning
    // readonly in a static method, so we use Object.defineProperty.
    Object.defineProperty(m, '_executor', { value: executor });
    return m;
  }

  // -------------------------------------------------------------------------
  // PromiseLike — executes on await
  // -------------------------------------------------------------------------

  then<T1 = TResult, T2 = never>(
    onfulfilled?:
      | ((value: TResult) => T1 | PromiseLike<T1>)
      | null,
    onrejected?:
      | ((reason: unknown) => T2 | PromiseLike<T2>)
      | null,
  ): Promise<T1 | T2> {
    return this._execute().then(onfulfilled, onrejected);
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
  _compile(): CompiledMutation<TResult> {
    if (this._executor) {
      throw new Error(
        'This operation cannot be batched (e.g. removeAll with a predicate that cannot compile to SQL). Await it separately.',
      );
    }

    return {
      type: 'mutation',
      queries: this._queries,
      config: this._config,
      processResult: this._processResult,
    };
  }

  /**
   * @internal Process raw SQL results into the typed result.
   * Used by db.batch() after executing the compiled queries.
   */
  static _processResults<T>(
    results: SqlResult[],
    compiled: CompiledMutation<T>,
  ): T {
    return compiled.processResult(results);
  }

  // -------------------------------------------------------------------------
  // Execution
  // -------------------------------------------------------------------------

  private async _execute(): Promise<TResult> {
    if (this._executor) {
      return this._executor();
    }

    const results = await this._config.executeBatch(this._queries);
    return this._processResult(results);
  }
}
