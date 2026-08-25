/**
 * RawQuery — the lazy result of `db.sql()`, the read-only raw-SQL escape
 * hatch. Like Mutation, it's a fixed statement with a result processor:
 * awaiting executes it; passing it to `db.batch()` bundles it with typed
 * Query/Mutation operations in one round trip.
 *
 * The read-only gate (SELECT/WITH only) lives in `db.sql()` itself — by the
 * time a RawQuery exists, the statement has passed it.
 */

import { deserializeRow } from './sql.js';
import type { SqlQuery, SqlResult } from './types.js';

export interface CompiledRawQuery<TResult> {
  type: 'raw';
  query: SqlQuery;
  /** Only databaseId — that's all batch grouping reads from config. */
  config: { databaseId: string };
  processResult: (result: SqlResult) => TResult;
}

export class RawQuery<TResult = Record<string, unknown>[]>
  implements PromiseLike<TResult>
{
  private readonly _databaseId: string;
  private readonly _executeBatch: (
    queries: SqlQuery[],
  ) => Promise<SqlResult[]>;
  private readonly _query: SqlQuery;

  constructor(
    databaseId: string,
    executeBatch: (queries: SqlQuery[]) => Promise<SqlResult[]>,
    query: SqlQuery,
  ) {
    this._databaseId = databaseId;
    this._executeBatch = executeBatch;
    this._query = query;
  }

  // -------------------------------------------------------------------------
  // PromiseLike — executes on await
  // -------------------------------------------------------------------------

  then<T1 = TResult, T2 = never>(
    onfulfilled?: ((value: TResult) => T1 | PromiseLike<T1>) | null,
    onrejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
  ): Promise<T1 | T2> {
    return this._execute().then(onfulfilled, onrejected);
  }

  catch<T2 = never>(
    onrejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
  ): Promise<TResult | T2> {
    return this._execute().catch(onrejected);
  }

  // -------------------------------------------------------------------------
  // Batch support
  // -------------------------------------------------------------------------

  /** @internal Compile for db.batch(). */
  _compile(): CompiledRawQuery<TResult> {
    return {
      type: 'raw',
      query: this._query,
      config: { databaseId: this._databaseId },
      processResult: (result) => RawQuery._process(result) as TResult,
    };
  }

  /** @internal Process a raw SQL result. Used by db.batch(). */
  static _processResults<T>(
    result: SqlResult,
    compiled: CompiledRawQuery<T>,
  ): T {
    return compiled.processResult(result);
  }

  // -------------------------------------------------------------------------
  // Execution
  // -------------------------------------------------------------------------

  /** Schema-less deserialization: strips @@user@@ prefixes and best-effort
   * parses JSON-looking strings; makes no other representation promises. */
  private static _process(result: SqlResult): Record<string, unknown>[] {
    return result.rows.map((row) =>
      deserializeRow(row as Record<string, unknown>, []),
    );
  }

  private async _execute(): Promise<TResult> {
    const results = await this._executeBatch([this._query]);
    return RawQuery._process(results[0]) as TResult;
  }
}
