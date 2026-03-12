/**
 * The `db` namespace — factory and time helpers for MindStudio managed databases.
 *
 * This module provides `createDb()`, which builds the `Db` object that users
 * interact with. The Db object has:
 *
 * - `defineTable<T>(name)` — creates a typed Table<T> for a given table name
 * - Time helpers: `now()`, `days()`, `hours()`, `minutes()`, `ago()`, `fromNow()`
 *
 * ## How defineTable works
 *
 * `defineTable` is a factory that binds a table name to the correct database
 * and execution context. It:
 *
 * 1. Looks up the table name in the app context database metadata
 * 2. Resolves the databaseId (implicit if only one database exists)
 * 3. Gets the column schema (for user-type handling and JSON parsing)
 * 4. Returns a Table<T> instance bound to the executeQuery function
 *
 * Tables are typically defined at module scope and imported into route handlers:
 *
 * ```ts
 * // tables/orders.ts
 * import { db } from '@mindstudio-ai/agent';
 * export const Orders = db.defineTable<Order>('orders');
 *
 * // routes/getOrders.ts
 * import { Orders } from '../tables/orders';
 * const active = await Orders.filter(o => o.status === 'active').take(10);
 * ```
 *
 * Since `defineTable()` is lazy (no queries execute until you await something
 * on the Table), it's safe to call at module scope. The actual database
 * context resolution happens on first query execution.
 *
 * ## Time helpers
 *
 * All timestamps in MindStudio databases are unix timestamps (milliseconds
 * since epoch). The time helpers make it easy to work with relative times
 * without writing `Date.now() - 48 * 60 * 60 * 1000` everywhere:
 *
 * ```ts
 * const cutoff = db.ago(db.days(2));           // 2 days ago (unix ms)
 * const deadline = db.fromNow(db.hours(48));   // 48 hours from now
 * const window = db.days(7) + db.hours(12);    // composable durations
 * ```
 */

import { MindStudioError } from '../errors.js';
import type { AppDatabase, AppDatabaseColumnSchema } from '../types.js';
import { Table } from './table.js';
import { Query } from './query.js';
import type { TableConfig, SqlQuery, SqlResult } from './types.js';

// ---------------------------------------------------------------------------
// Options for defineTable
// ---------------------------------------------------------------------------

/**
 * Options for `db.defineTable()`.
 */
export interface DefineTableOptions {
  /**
   * Database name or ID to target. Required when the app has multiple
   * databases and the table name alone is ambiguous.
   *
   * Accepts either the database's display name or its ID. The SDK
   * matches against both.
   *
   * If omitted, the SDK resolves the database automatically:
   * - Single database → used implicitly
   * - Multiple databases → searched by table name
   */
  database?: string;
}

// Re-export Table, Query, and types for consumers
export { Table } from './table.js';
export { Query } from './query.js';
export type {
  Predicate,
  Accessor,
  PushInput,
  UpdateInput,
  SystemFields,
  TableConfig,
} from './types.js';

// ---------------------------------------------------------------------------
// Db interface — the shape of the `db` namespace object
// ---------------------------------------------------------------------------

/**
 * The `db` namespace object. Contains `defineTable()` for creating typed
 * collections and time helpers for working with unix timestamps.
 */
export interface Db {
  /**
   * Define a typed table. Returns a Table<T> bound to the app's managed
   * database. The table name must match a table in the app's database schema.
   *
   * Tables are lazy — nothing executes until you call a method on the Table
   * and await the result. This makes it safe to call `defineTable()` at
   * module scope.
   *
   * Database resolution:
   * - If the app has a single database (common case), it's used automatically.
   * - If the app has multiple databases, pass `{ database }` with the
   *   database name or ID to target the right one. If omitted, the SDK
   *   searches all databases by table name.
   *
   * @example
   * ```ts
   * // Single database (common) — no need to specify
   * const Orders = db.defineTable<Order>('orders');
   *
   * // Multiple databases — specify which one
   * const Orders = db.defineTable<Order>('orders', { database: 'main' });
   * ```
   */
  defineTable<T>(name: string, options?: DefineTableOptions): Table<T>;

  // --- Time helpers ---
  // All return numbers (unix timestamps in milliseconds or durations in ms).

  /** Returns the current time as a unix timestamp (ms). Equivalent to `Date.now()`. */
  now(): number;

  /** Returns milliseconds for n days. Composable with `+`. */
  days(n: number): number;

  /** Returns milliseconds for n hours. Composable with `+`. */
  hours(n: number): number;

  /** Returns milliseconds for n minutes. Composable with `+`. */
  minutes(n: number): number;

  /** Returns a unix timestamp for (now - duration). Use with days/hours/minutes. */
  ago(ms: number): number;

  /** Returns a unix timestamp for (now + duration). Use with days/hours/minutes. */
  fromNow(ms: number): number;

  // --- Batch execution ---

  /**
   * Execute multiple queries in a single round trip. All queries run on
   * the same database connection, eliminating per-query HTTP overhead.
   *
   * Accepts Query objects (lazy, not yet executed). Compiles them to SQL,
   * sends all in one batch request, and returns typed results.
   *
   * @example
   * ```ts
   * const [orders, approvals, vendors] = await db.batch(
   *   Orders.filter(o => o.status === 'active').take(10),
   *   Approvals.filter(a => a.status === 'pending').take(25),
   *   Vendors.sortBy(v => v.createdAt).reverse().take(5),
   * );
   * ```
   */
  batch<A>(q1: PromiseLike<A>): Promise<[A]>;
  batch<A, B>(q1: PromiseLike<A>, q2: PromiseLike<B>): Promise<[A, B]>;
  batch<A, B, C>(q1: PromiseLike<A>, q2: PromiseLike<B>, q3: PromiseLike<C>): Promise<[A, B, C]>;
  batch<A, B, C, D>(q1: PromiseLike<A>, q2: PromiseLike<B>, q3: PromiseLike<C>, q4: PromiseLike<D>): Promise<[A, B, C, D]>;
  batch<A, B, C, D, E>(q1: PromiseLike<A>, q2: PromiseLike<B>, q3: PromiseLike<C>, q4: PromiseLike<D>, q5: PromiseLike<E>): Promise<[A, B, C, D, E]>;
  batch(...queries: PromiseLike<unknown>[]): Promise<unknown[]>;
}

// ---------------------------------------------------------------------------
// Factory — creates a Db instance from app context
// ---------------------------------------------------------------------------

/**
 * Create a Db namespace object from app context database metadata.
 *
 * @param databases - Database metadata from `getAppContext()` or sandbox globals
 * @param executeBatch - Bound function that executes SQL batches via POST /_internal/v2/db/query
 * @returns The Db object with defineTable() and time helpers
 *
 * @internal Called by MindStudioAgent during context hydration. Not part of
 * the public API — users access `db` via the agent instance or top-level export.
 */
export function createDb(
  databases: AppDatabase[],
  executeBatch: (databaseId: string, queries: SqlQuery[]) => Promise<SqlResult[]>,
): Db {
  return {
    defineTable<T>(name: string, options?: DefineTableOptions): Table<T> {
      // Resolve which database contains this table
      const resolved = resolveTable(databases, name, options?.database);

      const config: TableConfig = {
        databaseId: resolved.databaseId,
        tableName: name,
        columns: resolved.columns,
        executeBatch: (queries: SqlQuery[]) =>
          executeBatch(resolved.databaseId, queries),
      };

      return new Table<T>(config);
    },

    // --- Time helpers ---
    // Pure JS, no platform dependency. All timestamps are unix ms.

    now: () => Date.now(),
    days: (n: number) => n * 86_400_000,
    hours: (n: number) => n * 3_600_000,
    minutes: (n: number) => n * 60_000,
    ago: (ms: number) => Date.now() - ms,
    fromNow: (ms: number) => Date.now() + ms,

    // --- Batch execution ---

    batch: ((...queries: PromiseLike<unknown>[]) => {
      return (async () => {
      // Compile each Query into SQL (or fallback SELECT *)
      const compiled = queries.map((q) => {
        if (!(q instanceof Query)) {
          throw new MindStudioError(
            'db.batch() only accepts Query objects (from .filter(), .sortBy(), etc.)',
            'invalid_batch_query',
            400,
          );
        }
        return (q as InstanceType<typeof Query<unknown>>)._compile();
      });

      // Group queries by databaseId for minimal HTTP calls.
      // Most apps have one database, so this is usually one group.
      const groups = new Map<
        string,
        { index: number; sqlQuery: SqlQuery }[]
      >();

      for (let i = 0; i < compiled.length; i++) {
        const c = compiled[i];
        const dbId = c.config.databaseId;
        const sqlQuery = c.query ?? c.fallbackQuery!;

        if (!groups.has(dbId)) groups.set(dbId, []);
        groups.get(dbId)!.push({ index: i, sqlQuery });
      }

      // Execute one batch per database
      const allResults: (SqlResult | undefined)[] = new Array(compiled.length);

      await Promise.all(
        Array.from(groups.entries()).map(async ([dbId, entries]) => {
          const sqlQueries = entries.map((e) => e.sqlQuery);
          const results = await executeBatch(dbId, sqlQueries);
          for (let i = 0; i < entries.length; i++) {
            allResults[entries[i].index] = results[i];
          }
        }),
      );

      // Process results: deserialize + apply JS fallback where needed
      return compiled.map((c, i) => {
        const result = allResults[i]!;

        // Log warning for JS fallback queries
        if (!c.query && c.predicates?.length) {
          console.warn(
            `[mindstudio] db.batch(): filter on ${c.config.tableName} could not be compiled to SQL — processing in JS`,
          );
        }

        return Query._processResults(result, c);
      });
      })();
    }) as Db['batch'],
  };
}

// ---------------------------------------------------------------------------
// Table resolution — finds the database + schema for a table name
// ---------------------------------------------------------------------------

interface ResolvedTable {
  databaseId: string;
  columns: AppDatabaseColumnSchema[];
}

/**
 * Look up a table name in the app context database metadata.
 *
 * Resolution strategy:
 * 1. If `databaseHint` is provided, find that database (by name or ID)
 *    and look for the table within it.
 * 2. If only one database exists, look for the table in that database.
 * 3. If multiple databases exist, search all of them by table name.
 * 4. Throws if the table or database is not found.
 *
 * @param databases - Database metadata from app context
 * @param tableName - The table name to find
 * @param databaseHint - Optional database name or ID to narrow the search
 * @returns The database ID and column schema for the table
 */
function resolveTable(
  databases: AppDatabase[],
  tableName: string,
  databaseHint?: string,
): ResolvedTable {
  if (databases.length === 0) {
    throw new MindStudioError(
      `No databases found in app context. Make sure the app has at least one database configured.`,
      'no_databases',
      400,
    );
  }

  // If a database hint is provided, narrow to that specific database
  if (databaseHint) {
    const targetDb = databases.find(
      (db) => db.id === databaseHint || db.name === databaseHint,
    );
    if (!targetDb) {
      const available = databases.map((db) => db.name || db.id).join(', ');
      throw new MindStudioError(
        `Database "${databaseHint}" not found. Available databases: ${available}`,
        'database_not_found',
        400,
      );
    }

    const table = targetDb.tables.find((t) => t.name === tableName);
    if (!table) {
      const available = targetDb.tables.map((t) => t.name).join(', ');
      throw new MindStudioError(
        `Table "${tableName}" not found in database "${databaseHint}". Available tables: ${available || '(none)'}`,
        'table_not_found',
        400,
      );
    }

    return { databaseId: targetDb.id, columns: table.schema };
  }

  // No hint — search all databases for a matching table name
  for (const db of databases) {
    const table = db.tables.find((t) => t.name === tableName);
    if (table) {
      return {
        databaseId: db.id,
        columns: table.schema,
      };
    }
  }

  // Table not found — build a helpful error message
  const availableTables = databases
    .flatMap((db) => db.tables.map((t) => t.name))
    .join(', ');

  throw new MindStudioError(
    `Table "${tableName}" not found in app databases. Available tables: ${availableTables || '(none)'}`,
    'table_not_found',
    400,
  );
}
