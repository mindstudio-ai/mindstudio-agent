/**
 * Internal type definitions for the `db` namespace.
 *
 * These types power the chainable collection API over MindStudio's managed
 * SQLite databases. They're used internally by Table, Query, and the
 * predicate compiler — most are also re-exported from the package for
 * consumers who need them in type annotations.
 *
 * Key concepts:
 * - **SystemFields**: columns managed by the platform (id, timestamps, audit).
 *   Stripped from write inputs automatically.
 * - **Predicate / Accessor**: callback shapes used in filter(), sortBy(), etc.
 *   Predicates are compiled to SQL WHERE clauses when possible, with a JS
 *   fallback for complex expressions.
 * - **TableConfig**: runtime binding between a Table instance and the
 *   underlying queryAppDatabase step execution.
 */

import type { AppDatabaseColumnSchema } from '../types.js';

// ---------------------------------------------------------------------------
// System fields — managed by the platform, excluded from write inputs
// ---------------------------------------------------------------------------

/**
 * Names of columns that the platform manages automatically.
 *
 * - `id`: UUID primary key, generated on INSERT
 * - `createdAt`: unix timestamp (ms), set on INSERT
 * - `updatedAt`: unix timestamp (ms), set on INSERT and every UPDATE
 * - `lastUpdatedBy`: reference to the run ID that last wrote this row
 */
export type SystemFields = 'id' | 'createdAt' | 'updatedAt' | 'lastUpdatedBy';

/**
 * Input type for `Table.push()`. Excludes system-managed fields.
 * Optional fields in T remain optional.
 *
 * @example
 * ```ts
 * // If Order has { id, createdAt, updatedAt, lastUpdatedBy, item, amount }
 * // then PushInput<Order> is { item: string; amount: number }
 * ```
 */
export type PushInput<T> = Omit<T, SystemFields>;

/**
 * Input type for `Table.update()`. Excludes system-managed fields,
 * and all remaining fields are optional (partial update).
 */
export type UpdateInput<T> = Partial<Omit<T, SystemFields>>;

// ---------------------------------------------------------------------------
// Callback types for filter / sort / aggregate operations
// ---------------------------------------------------------------------------

/**
 * A predicate function for filtering rows. Receives a typed row and
 * returns a boolean.
 *
 * The SDK attempts to compile the predicate to a SQL WHERE clause for
 * performance. Simple expressions (field comparisons, &&/||, .includes())
 * compile to efficient SQL. If the predicate can't be compiled (function
 * calls, regex, computed expressions), the SDK falls back to fetching all
 * rows and evaluating in JS. Both paths produce identical results.
 */
export type Predicate<T> = (row: T) => boolean;

/**
 * A field accessor function used by sortBy(), min(), max(), groupBy().
 * Receives a typed row and returns the value to sort/aggregate by.
 *
 * @example
 * ```ts
 * .sortBy(o => o.createdAt)      // sort by createdAt
 * .min(o => o.amount)            // row with smallest amount
 * .groupBy(o => o.status)        // group rows by status
 * ```
 */
export type Accessor<T, R = unknown> = (row: T) => R;

// ---------------------------------------------------------------------------
// Table configuration — binds a Table instance to the execution layer
// ---------------------------------------------------------------------------

/**
 * Runtime configuration for a Table instance. Created by `createDb()` when
 * `defineTable()` is called. Contains everything the Table needs to execute
 * queries against the correct database.
 */
export interface TableConfig {
  /** The managed database ID (from app context metadata). */
  databaseId: string;

  /** The SQL table name (as declared in defineTable). */
  tableName: string;

  /**
   * Column schema from app context. Used to identify user-type columns
   * (which need @@user@@ prefix handling) and for validation.
   */
  columns: AppDatabaseColumnSchema[];

  /**
   * Execute a SQL query against the managed database. This is bound to
   * `agent.executeStep('queryAppDatabase', ...)` at creation time.
   *
   * @param sql - The SQL query string (fully formed, no placeholders)
   * @returns The query result: rows for SELECT, changes count for writes
   */
  executeQuery: (sql: string) => Promise<{ rows: unknown[]; changes: number }>;
}

// ---------------------------------------------------------------------------
// Predicate compilation result
// ---------------------------------------------------------------------------

/**
 * Result of attempting to compile a predicate function to SQL.
 *
 * - `type: 'sql'` — compilation succeeded. `where` is a SQL WHERE clause
 *   fragment (without the WHERE keyword).
 * - `type: 'js'` — compilation failed. The original function should be
 *   used to filter rows in JavaScript after fetching all rows.
 */
export type CompiledPredicate<T> =
  | { type: 'sql'; where: string }
  | { type: 'js'; fn: Predicate<T> };
