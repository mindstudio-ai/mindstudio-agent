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
import type { AppDatabase, AppDatabaseColumnSchema, AuthTableConfig, User } from '../types.js';
import { Table } from './table.js';
import { Query } from './query.js';
import { Mutation } from './mutation.js';
import { RawQuery } from './raw.js';
import { USER_PREFIX, serializeParam } from './sql.js';
import type { TableConfig, SqlQuery, SqlResult, SystemColumns, SystemFields } from './types.js';

// ---------------------------------------------------------------------------
// Options for defineTable
// ---------------------------------------------------------------------------

/**
 * Options for `db.defineTable()`.
 */
export interface DefineTableOptions<T = unknown> {
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

  /**
   * Unique constraints for the table. Each entry is an array of column
   * names that together must be unique. The SDK communicates these to
   * the platform which creates the corresponding SQLite UNIQUE indexes.
   *
   * Required for `upsert()` — the conflict key must match a declared
   * unique constraint.
   *
   * @example
   * ```ts
   * // Single column unique
   * db.defineTable<User>('users', { unique: [['email']] });
   *
   * // Compound unique
   * db.defineTable<Membership>('memberships', { unique: [['userId', 'orgId']] });
   *
   * // Multiple constraints
   * db.defineTable<User>('users', { unique: [['email'], ['slug']] });
   * ```
   */
  unique?: (keyof T & string)[][];

  /**
   * Default values for columns, applied client-side in `push()` and
   * `upsert()`. Explicit values in the input override defaults.
   *
   * @example
   * ```ts
   * db.defineTable<Order>('orders', {
   *   defaults: { status: 'pending', retryCount: 0 },
   * });
   * ```
   */
  defaults?: Partial<Omit<T, SystemFields>>;
}

// Re-export Table, Query, Mutation, RawQuery, and types for consumers
export { Table } from './table.js';
export { Query } from './query.js';
export { Mutation } from './mutation.js';
export { RawQuery } from './raw.js';
export type { CompiledRawQuery } from './raw.js';
export type {
  AggregateSelect,
  AggregateTerm,
  AggregateRow,
} from './aggregate.js';
export type {
  Predicate,
  Accessor,
  PushInput,
  UpdateInput,
  Row,
  SystemColumns,
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
  defineTable<T>(name: string, options?: DefineTableOptions<T>): Table<T & SystemColumns>;

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

  // --- User references ---

  /**
   * Type a plain UUID string as a `User` reference, for writing into
   * user-typed columns without an `as any` cast. Strips any existing
   * `@@user@@` prefix so the input is always a bare UUID in app code.
   *
   * The SDK adds the `@@user@@` prefix automatically on write — you do
   * not need to (and should not) add it yourself.
   *
   * @example
   * ```ts
   * await Orders.push({
   *   requestedBy: db.userRef(someUuid),
   *   ...
   * });
   * ```
   */
  userRef(id: string): User;

  // --- Raw SQL (read-only) ---

  /**
   * Run a raw read-only SQL statement against the app's managed database —
   * the escape hatch for joins, subqueries, and anything the typed Table
   * API can't express. SELECT/WITH only; writes are rejected — use Table
   * methods (push/update/upsert/remove) for writes.
   *
   * Positional `?` bind params. Lazy and batchable: await it directly, or
   * pass it to `db.batch()` alongside Query/Mutation objects.
   *
   * Multi-database apps: pass `{ database }` (name or ID); single-database
   * apps resolve automatically.
   *
   * Note: raw rows come back close to how SQLite stores them and may not
   * exactly match the typed table API's representations.
   *
   * @example
   * ```ts
   * const rows = await db.sql<{ questionId: string; n: number }>(
   *   'SELECT questionId, COUNT(*) AS n FROM answers WHERE surveyId = ? GROUP BY questionId',
   *   [surveyId],
   * );
   * ```
   */
  sql<T = Record<string, unknown>>(
    query: string,
    params?: unknown[],
    options?: { database?: string },
  ): RawQuery<T[]>;

  // --- Batch execution ---

  /**
   * Execute multiple reads and writes in a single round trip. All
   * operations run on the same database connection, eliminating
   * per-operation HTTP overhead. Writes execute in argument order.
   *
   * Accepts Query objects (reads) and Mutation objects (writes from
   * push, update, remove, removeAll, clear). Compiles them to SQL,
   * sends all in one batch request, and returns typed results.
   *
   * Only un-awaited Query/Mutation objects can be batched — their SQL is
   * compiled and bundled. A plain Promise has no SQL to extract, so it is
   * rejected at the type level (and would throw at runtime): pass
   * `Table.filter(...)`, not `await`ed results or wrapper functions.
   *
   * @example
   * ```ts
   * // Mixed reads and writes in one round trip
   * const [, newCard, cards] = await db.batch(
   *   Cards.update(card1.id, { position: 1 }),
   *   Cards.push({ title: 'New', columnId, position: 0 }),
   *   Cards.filter(c => c.columnId === columnId),
   * );
   * ```
   */
  batch<A>(q1: Batchable<A>): Promise<[A]>;
  batch<A, B>(q1: Batchable<A>, q2: Batchable<B>): Promise<[A, B]>;
  batch<A, B, C>(q1: Batchable<A>, q2: Batchable<B>, q3: Batchable<C>): Promise<[A, B, C]>;
  batch<A, B, C, D>(q1: Batchable<A>, q2: Batchable<B>, q3: Batchable<C>, q4: Batchable<D>): Promise<[A, B, C, D]>;
  batch<A, B, C, D, E>(q1: Batchable<A>, q2: Batchable<B>, q3: Batchable<C>, q4: Batchable<D>, q5: Batchable<E>): Promise<[A, B, C, D, E]>;
  batch(...queries: Batchable<unknown>[]): Promise<unknown[]>;
}

/**
 * An operation `db.batch()` can bundle: an un-awaited Query (read),
 * Mutation (write), or RawQuery (db.sql). The batch executor compiles
 * these to SQL — a plain Promise carries no SQL and cannot be batched,
 * which is why this is not `PromiseLike`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Batchable<A> = Query<any, A> | Mutation<A> | RawQuery<A>;

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
  authConfig?: AuthTableConfig,
  syncRoles?: (userId: string, roles: unknown) => Promise<void>,
): Db {
  return {
    defineTable<T>(name: string, options?: DefineTableOptions<T>): Table<T & SystemColumns> {
      // Resolve which database contains this table
      const resolved = resolveTable(databases, name, options?.database);

      const config: TableConfig = {
        databaseId: resolved.databaseId,
        tableName: name,
        columns: resolved.columns,
        unique: options?.unique as string[][] | undefined,
        defaults: options?.defaults as Record<string, unknown> | undefined,
        managedColumns:
          authConfig?.table === name ? authConfig.columns : undefined,
        syncRoles:
          authConfig?.table === name && authConfig.columns.roles
            ? syncRoles
            : undefined,
        executeBatch: (queries: SqlQuery[]) =>
          executeBatch(resolved.databaseId, queries),
      };

      return new Table<T & SystemColumns>(config);
    },

    // --- Time helpers ---
    // Pure JS, no platform dependency. All timestamps are unix ms.

    now: () => Date.now(),
    days: (n: number) => n * 86_400_000,
    hours: (n: number) => n * 3_600_000,
    minutes: (n: number) => n * 60_000,
    ago: (ms: number) => Date.now() - ms,
    fromNow: (ms: number) => Date.now() + ms,

    // --- User references ---

    userRef: (id: string): User =>
      id.startsWith(USER_PREFIX) ? id.slice(USER_PREFIX.length) : id,

    // --- Raw SQL (read-only) ---

    sql<T = Record<string, unknown>>(
      query: string,
      params?: unknown[],
      options?: { database?: string },
    ): RawQuery<T[]> {
      validateRawSql(query);
      const database = resolveDatabase(databases, options?.database);
      return new RawQuery<T[]>(
        database.id,
        (queries: SqlQuery[]) => executeBatch(database.id, queries),
        { sql: query, params: params?.map(serializeParam) },
      );
    },

    // --- Batch execution ---

    batch: ((...operations: Batchable<unknown>[]) => {
      return (async () => {
      // Compile each operation into SQL
      type CompiledOp =
        | ReturnType<InstanceType<typeof Query<unknown>>['_compile']>
        | ReturnType<InstanceType<typeof Mutation<unknown>>['_compile']>
        | ReturnType<InstanceType<typeof RawQuery<unknown>>['_compile']>;

      const compiled: CompiledOp[] = operations.map((op) => {
        if (op instanceof Query) {
          return (op as InstanceType<typeof Query<unknown>>)._compile();
        }
        if (op instanceof Mutation) {
          return (op as InstanceType<typeof Mutation<unknown>>)._compile();
        }
        if (op instanceof RawQuery) {
          return (op as InstanceType<typeof RawQuery<unknown>>)._compile();
        }
        throw new MindStudioError(
          'db.batch() only accepts Query, Mutation, and RawQuery objects (from .filter(), .update(), .push(), db.sql(), etc.)',
          'invalid_batch_operation',
          400,
        );
      });

      // Build a flat list of SQL queries, tracking which slice belongs
      // to which operation. Queries (reads) produce 1 SQL statement.
      // Mutations (writes) may produce N (e.g. push([a, b, c]) = 3 INSERTs).
      const groups = new Map<
        string,
        { opIndex: number; sqlQueries: SqlQuery[] }[]
      >();

      for (let i = 0; i < compiled.length; i++) {
        const c = compiled[i];
        const dbId = c.config.databaseId;

        if (!groups.has(dbId)) groups.set(dbId, []);

        if (c.type === 'query') {
          const sqlQuery = c.query ?? c.fallbackQuery!;
          groups.get(dbId)!.push({ opIndex: i, sqlQueries: [sqlQuery] });
        } else if (c.type === 'raw') {
          groups.get(dbId)!.push({ opIndex: i, sqlQueries: [c.query] });
        } else {
          groups.get(dbId)!.push({ opIndex: i, sqlQueries: c.queries });
        }
      }

      // Execute one batch per database, then map result slices back
      const opResults = new Map<number, SqlResult[]>();

      await Promise.all(
        Array.from(groups.entries()).map(async ([dbId, entries]) => {
          // Flatten all SQL for this database into one batch
          const flatQueries: SqlQuery[] = [];
          const slices: { opIndex: number; start: number; count: number }[] = [];

          for (const entry of entries) {
            slices.push({
              opIndex: entry.opIndex,
              start: flatQueries.length,
              count: entry.sqlQueries.length,
            });
            flatQueries.push(...entry.sqlQueries);
          }

          const results = await executeBatch(dbId, flatQueries);

          for (const { opIndex, start, count } of slices) {
            opResults.set(opIndex, results.slice(start, start + count));
          }
        }),
      );

      // Process results: deserialize + apply JS fallback where needed
      return compiled.map((c, i) => {
        const results = opResults.get(i)!;

        if (c.type === 'query') {
          // Log warning for JS fallback queries
          if (!c.query && c.predicates?.length) {
            // Reason is not available at the batch level (predicates are pre-compiled)
            console.warn(
              `[mindstudio] db.batch(): filter on '${c.config.tableName}' could not be compiled to SQL — processing in JS`,
            );
          }
          return Query._processResults(results[0], c);
        } else if (c.type === 'raw') {
          return RawQuery._processResults(results[0], c);
        } else {
          return Mutation._processResults(results, c);
        }
      });
      })();
    }) as Db['batch'],
  };
}

// ---------------------------------------------------------------------------
// Database + table resolution from app context metadata
// ---------------------------------------------------------------------------

/**
 * Validate a `db.sql()` statement: non-empty, and read-only. The gate is
 * advisory — it catches accidents, not adversaries (method authors already
 * control the SQL strings the typed API compiles, so the trust model is
 * unchanged). Writes belong on Table methods, which enforce managed-column
 * rules and role sync.
 *
 * @internal Shared by createDb() and the client's lazy Db proxy.
 */
export function validateRawSql(query: string): void {
  if (typeof query !== 'string' || !query.trim()) {
    throw new MindStudioError(
      'db.sql() requires a non-empty SQL string.',
      'invalid_sql',
      400,
    );
  }
  if (!/^\s*(select|with)\b/i.test(query)) {
    throw new MindStudioError(
      'db.sql() is read-only — the statement must start with SELECT or WITH. Use Table methods (push/update/upsert/remove) for writes.',
      'sql_read_only',
      400,
    );
  }
}

/**
 * Resolve a database from app context metadata — by name or ID when a hint
 * is given, implicitly when the app has exactly one database. Used by
 * `db.sql()` directly and by `resolveTable`'s hint branch; unlike table
 * resolution there is no table name to disambiguate with, so multiple
 * databases without a hint is an error.
 *
 * @internal Also used by the client's lazy Db proxy at execution time.
 */
export function resolveDatabase(
  databases: AppDatabase[],
  hint?: string,
): AppDatabase {
  if (databases.length === 0) {
    throw new MindStudioError(
      `No databases found in app context. Make sure the app has at least one database configured.`,
      'no_databases',
      400,
    );
  }

  if (hint) {
    const targetDb = databases.find(
      (db) => db.id === hint || db.name === hint,
    );
    if (!targetDb) {
      const available = databases.map((db) => db.name || db.id).join(', ');
      throw new MindStudioError(
        `Database "${hint}" not found. Available databases: ${available}`,
        'database_not_found',
        400,
      );
    }
    return targetDb;
  }

  if (databases.length > 1) {
    const available = databases.map((db) => db.name || db.id).join(', ');
    throw new MindStudioError(
      `This app has multiple databases — pass { database } to pick one. Available databases: ${available}`,
      'ambiguous_database',
      400,
    );
  }

  return databases[0];
}

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
    const targetDb = resolveDatabase(databases, databaseHint);

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
