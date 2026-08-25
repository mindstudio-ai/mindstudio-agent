/**
 * Aggregation spec types + shared logic for `Query.aggregate()` and the
 * scalar aggregate terminals (sum/avg/countDistinct).
 *
 * The spec uses STRING column names (not accessors): `by: ['questionId']`,
 * `{ sum: 'score' }`. Plain-object terms give reliable contextual typing of
 * the result (`Pick<T, By[number]> & AggregateRow<T, S>`), follow the
 * `upsert(conflictKey, ...)` string-key precedent, and can't hit the
 * accessor-extraction failure mode — an invalid identifier is a hard error
 * here, not a silent fetch-everything fallback.
 *
 * Empty-set semantics (the SQL path and the JS fallback in
 * `computeAggregateInJs` MUST stay in lockstep — see the README's
 * Aggregation section):
 *   count → 0; sum → 0 (SQL TOTAL(), never NULL); avg → null;
 *   countDistinct → 0; min/max → null. All aggregates skip NULL values.
 */

import { MindStudioError } from '../errors.js';
import type { AppDatabaseColumnSchema } from '../types.js';
import { deserializeRow, type AggregateFn } from './sql.js';

// ---------------------------------------------------------------------------
// Public spec types
// ---------------------------------------------------------------------------

/** Column keys whose value type is number (nullable allowed). */
type NumericKey<T> = {
  [K in keyof T & string]: NonNullable<T[K]> extends number ? K : never;
}[keyof T & string];

/** Column keys orderable by MIN/MAX — numbers and strings. */
type ComparableKey<T> = {
  [K in keyof T & string]: NonNullable<T[K]> extends number | string
    ? K
    : never;
}[keyof T & string];

/**
 * One aggregate in an `aggregate()` select spec. Exactly one function key
 * per term:
 *   { count: true } · { sum: 'col' } · { avg: 'col' } ·
 *   { min: 'col' } · { max: 'col' } · { countDistinct: 'col' }
 */
export type AggregateTerm<T> =
  | { count: true }
  | { sum: NumericKey<T> }
  | { avg: NumericKey<T> }
  | { min: ComparableKey<T> }
  | { max: ComparableKey<T> }
  | { countDistinct: keyof T & string };

/** The `select` map: result property name → aggregate term. */
export type AggregateSelect<T> = Record<string, AggregateTerm<T>>;

/** Result value types per term (matching the empty-set semantics above). */
export type AggregateRow<T, S extends AggregateSelect<T>> = {
  [K in keyof S]: S[K] extends { count: true }
    ? number
    : S[K] extends { sum: string }
      ? number
      : S[K] extends { avg: string }
        ? number | null
        : S[K] extends { countDistinct: string }
          ? number
          : S[K] extends { min: infer C }
            ? C extends keyof T
              ? T[C] | null
              : never
            : S[K] extends { max: infer C }
              ? C extends keyof T
                ? T[C] | null
                : never
              : never;
};

// ---------------------------------------------------------------------------
// Normalized spec — validated once at aggregate() call time
// ---------------------------------------------------------------------------

export interface NormalizedAggregateTerm {
  alias: string;
  fn: AggregateFn;
  column?: string;
}

export interface NormalizedAggregateSpec {
  by: string[];
  select: NormalizedAggregateTerm[];
  orderBy?: string;
  desc?: boolean;
  limit?: number;
}

const IDENTIFIER_RE = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;
const AGGREGATE_FNS: AggregateFn[] = [
  'count',
  'sum',
  'avg',
  'min',
  'max',
  'countDistinct',
];

/**
 * Validate + normalize an aggregate() spec. Throws MindStudioError (400)
 * on any malformed input so the agent loop self-corrects immediately,
 * instead of shipping broken SQL or silently mis-grouping in JS.
 */
export function normalizeAggregateSpec(spec: {
  by?: readonly string[];
  select: Record<string, Record<string, unknown>>;
  orderBy?: string;
  desc?: boolean;
  limit?: number;
}): NormalizedAggregateSpec {
  const by = [...(spec.by ?? [])];
  for (const col of by) {
    if (typeof col !== 'string' || !IDENTIFIER_RE.test(col)) {
      throw new MindStudioError(
        `aggregate(): invalid group-by column "${col}" — column names are plain identifiers.`,
        'invalid_column',
        400,
      );
    }
  }

  const aliases = Object.keys(spec.select ?? {});
  if (aliases.length === 0) {
    throw new MindStudioError(
      'aggregate(): select must contain at least one aggregate, e.g. { n: { count: true } }.',
      'invalid_aggregate_spec',
      400,
    );
  }

  const select: NormalizedAggregateTerm[] = aliases.map((alias) => {
    if (!IDENTIFIER_RE.test(alias)) {
      throw new MindStudioError(
        `aggregate(): invalid alias "${alias}" — result property names are plain identifiers.`,
        'invalid_aggregate_alias',
        400,
      );
    }
    if (by.includes(alias)) {
      throw new MindStudioError(
        `aggregate(): alias "${alias}" collides with a group-by column of the same name.`,
        'invalid_aggregate_alias',
        400,
      );
    }
    const term = spec.select[alias];
    const fns = AGGREGATE_FNS.filter((fn) => term && fn in term);
    if (fns.length !== 1) {
      throw new MindStudioError(
        `aggregate(): term "${alias}" must have exactly one aggregate key (count, sum, avg, min, max, countDistinct).`,
        'invalid_aggregate_spec',
        400,
      );
    }
    const fn = fns[0];
    if (fn === 'count') {
      if (term[fn] !== true) {
        throw new MindStudioError(
          `aggregate(): term "${alias}" — count takes \`true\`, e.g. { count: true }.`,
          'invalid_aggregate_spec',
          400,
        );
      }
      return { alias, fn };
    }
    const column = term[fn];
    if (typeof column !== 'string' || !IDENTIFIER_RE.test(column)) {
      throw new MindStudioError(
        `aggregate(): term "${alias}" — invalid column "${String(column)}".`,
        'invalid_column',
        400,
      );
    }
    return { alias, fn, column };
  });

  if (spec.orderBy != null) {
    if (!aliases.includes(spec.orderBy) && !by.includes(spec.orderBy)) {
      throw new MindStudioError(
        `aggregate(): orderBy "${spec.orderBy}" is neither a select alias nor a group-by column.`,
        'invalid_aggregate_order',
        400,
      );
    }
  }

  return {
    by,
    select,
    orderBy: spec.orderBy,
    desc: spec.desc,
    limit: spec.limit,
  };
}

// ---------------------------------------------------------------------------
// JS fallback — grouping/aggregating in memory over deserialized rows.
// Runs when the chain's predicates couldn't compile to SQL. Must produce
// results identical to the SQL path.
// ---------------------------------------------------------------------------

function aggregateValues(fn: AggregateFn, values: unknown[]): unknown {
  // SQL aggregates skip NULL — mirror that before applying the function.
  const present = values.filter((v) => v != null);
  switch (fn) {
    case 'count':
      return values.length;
    case 'sum':
      return present.reduce((s: number, v) => s + (v as number), 0);
    case 'avg':
      return present.length === 0
        ? null
        : present.reduce((s: number, v) => s + (v as number), 0) /
            present.length;
    case 'countDistinct':
      return new Set(present).size;
    case 'min':
      return present.length === 0
        ? null
        : present.reduce((m, v) => ((v as never) < (m as never) ? v : m));
    case 'max':
      return present.length === 0
        ? null
        : present.reduce((m, v) => ((v as never) > (m as never) ? v : m));
  }
}

/** Null-smallest comparator matching SQLite's default NULL ordering. */
function compareForOrder(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if ((a as never) < (b as never)) return -1;
  if ((a as never) > (b as never)) return 1;
  return 0;
}

export function computeAggregateInJs(
  rows: Record<string, unknown>[],
  spec: NormalizedAggregateSpec,
): Record<string, unknown> | Record<string, unknown>[] {
  // Group rows by the composite key (single group when `by` is empty).
  const groups = new Map<string, Record<string, unknown>[]>();
  for (const row of rows) {
    const key = JSON.stringify(spec.by.map((col) => row[col]));
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }
  if (spec.by.length === 0 && groups.size === 0) {
    groups.set('[]', []);
  }

  let out = Array.from(groups.values()).map((groupRows) => {
    const result: Record<string, unknown> = {};
    for (const col of spec.by) {
      result[col] = groupRows[0]?.[col];
    }
    for (const term of spec.select) {
      result[term.alias] = aggregateValues(
        term.fn,
        term.column != null
          ? groupRows.map((r) => r[term.column!])
          : groupRows,
      );
    }
    return result;
  });

  if (spec.orderBy) {
    const key = spec.orderBy;
    out.sort((a, b) => compareForOrder(a[key], b[key]));
    if (spec.desc) out.reverse();
  }
  if (spec.limit != null) {
    out = out.slice(0, spec.limit);
  }

  return spec.by.length === 0 ? out[0] : out;
}

// ---------------------------------------------------------------------------
// SQL-path result deserialization
// ---------------------------------------------------------------------------

/**
 * Deserialize grouped-aggregate result rows to match what the JS fallback
 * produces from already-deserialized rows: group-key columns go through the
 * normal column deserialization (@@user@@ strip, boolean 0/1, json), and a
 * min/max alias adopts its SOURCE column's schema (so e.g. MAX of a user
 * column loses its prefix). Other aggregate values (counts, sums, averages)
 * are raw numbers and are deliberately NOT matched against the table schema —
 * an alias that happens to share a name with, say, a boolean column must not
 * get 0/1-converted.
 */
export function deserializeAggregateRows(
  rows: unknown[],
  spec: NormalizedAggregateSpec,
  columns: AppDatabaseColumnSchema[],
): Record<string, unknown>[] {
  const schemaFor = new Map<string, AppDatabaseColumnSchema[]>();
  for (const col of spec.by) {
    schemaFor.set(
      col,
      columns.filter((c) => c.name === col),
    );
  }
  for (const term of spec.select) {
    if ((term.fn === 'min' || term.fn === 'max') && term.column != null) {
      schemaFor.set(
        term.alias,
        columns
          .filter((c) => c.name === term.column)
          .map((c) => ({ ...c, name: term.alias })),
      );
    }
  }

  return rows.map((raw) => {
    const row = raw as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      const schema = schemaFor.get(key);
      if (schema) {
        result[key] = deserializeRow({ [key]: value }, schema)[key];
      } else {
        result[key] = value;
      }
    }
    return result;
  });
}
