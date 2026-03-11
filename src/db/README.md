# db — Chainable Collection API over Managed SQLite

The `db` namespace provides a typed, chainable collection API for MindStudio's managed SQLite databases. It feels like working with JS collections — filter, sort, push, update, remove — but every operation is a database query. The `await` is the only signal that you're crossing the wire.

## Quick start

```ts
import { db } from '@mindstudio-ai/agent';

// Define a typed table (module scope — lazy, no HTTP)
interface Order {
  id: string;
  createdAt: number;
  updatedAt: number;
  lastUpdatedBy: string;
  item: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
}

const Orders = db.defineTable<Order>('orders');

// If the app has multiple databases, specify which one:
const Orders = db.defineTable<Order>('orders', { database: 'main' });

// Read
const active = await Orders.filter(o => o.status === 'approved').take(10);
const order = await Orders.get('abc-123');
const count = await Orders.count(o => o.status === 'pending');

// Chain
const recent = await Orders
  .filter(o => o.status === 'approved')
  .sortBy(o => o.createdAt)
  .reverse()
  .take(20);

// Write
const created = await Orders.push({ item: 'Laptop', amount: 999, status: 'pending' });
const updated = await Orders.update(created.id, { status: 'approved' });
await Orders.remove(updated.id);
```

## How it works

```
User code                          SDK internals                    Platform
─────────                          ─────────────                    ────────
Orders.filter(pred).take(10)
  │
  ├─ Query accumulates operations  (lazy, nothing executes)
  │
  └─ await ──────────────────────► compilePredicate(pred)
                                    │
                                    ├─ Success: SQL WHERE clause
                                    │  buildSelect('orders', { where, limit: 10 })
                                    │  ──► executeStep('queryAppDatabase', { sql })
                                    │                                     ──► SQLite
                                    │
                                    └─ Failure: JS fallback
                                       buildSelect('orders', {})  ← fetch ALL rows
                                       rows.filter(pred).slice(0, 10)
                                       ⚠ warning logged to stderr
```

### SQL fast path vs JS fallback

When you write a filter predicate, the SDK attempts to compile it to a SQL WHERE clause:

**Compiles to SQL** (efficient, single query):
```ts
.filter(o => o.status === 'active')           // WHERE status = 'active'
.filter(o => o.amount > 5000)                 // WHERE amount > 5000
.filter(o => o.a === 1 && o.b === 2)          // WHERE a = 1 AND b = 2
.filter(o => ['a','b'].includes(o.status))    // WHERE status IN ('a', 'b')
.filter(o => o.name.includes('test'))         // WHERE name LIKE '%test%'
.filter(o => o.field != null)                 // WHERE field IS NOT NULL
```

**Falls back to JS** (fetches all rows, filters in memory):
```ts
.filter(o => o.name.startsWith('A'))          // function call
.filter(o => /^PO-\d+/.test(o.poNumber))      // regex
.filter(o => o.a + o.b > 100)                 // computed expression
.filter(o => someSet.has(o.id))               // complex closure
```

Both paths produce identical results. The fallback logs a warning:
```
[mindstudio] Filter on orders could not be compiled to SQL — scanning 342 rows in JS
```

For most apps (hundreds to low thousands of rows), the fallback is fast enough. The warning helps you optimize when it matters.

## Table API

### Reads — direct (return Promises)

| Method | Description | SQL |
|--------|-------------|-----|
| `get(id)` | Single row by ID | `SELECT * WHERE id = ?` |
| `findOne(pred)` | First matching row | `SELECT * WHERE ... LIMIT 1` |
| `count(pred?)` | Count rows | `SELECT COUNT(*)` |
| `some(pred)` | Any row matches? | `SELECT EXISTS(...)` |
| `every(pred)` | All rows match? | `SELECT NOT EXISTS(... WHERE NOT ...)` |
| `isEmpty()` | Table empty? | `SELECT NOT EXISTS(SELECT 1 ...)` |
| `min(fn)` | Row with min value | `ORDER BY field ASC LIMIT 1` |
| `max(fn)` | Row with max value | `ORDER BY field DESC LIMIT 1` |
| `groupBy(fn)` | Group into Map | Fetch all, group in JS |

### Reads — chainable (return `Query<T>`)

| Method | Description |
|--------|-------------|
| `filter(pred)` | Add a WHERE condition |
| `sortBy(fn)` | Set ORDER BY field |

### Query chain methods

| Method | Description |
|--------|-------------|
| `.filter(pred)` | Add another WHERE condition (ANDed) |
| `.sortBy(fn)` | Set ORDER BY field |
| `.reverse()` | Flip ASC/DESC |
| `.take(n)` | Set LIMIT |
| `.skip(n)` | Set OFFSET |
| `.first()` | First row (LIMIT 1) |
| `.last()` | Last row (flip sort + LIMIT 1) |
| `.count()` | Count matching rows |
| `.some()` | Any matching? |
| `.every()` | All matching? |
| `.min(fn)` | Row with min value |
| `.max(fn)` | Row with max value |
| `.groupBy(fn)` | Group into Map |

Queries are **lazy** and **immutable** — every chain method returns a new Query. Nothing executes until you `await`.

### Writes

| Method | Description | SQL |
|--------|-------------|-----|
| `push(data)` | Insert one row | `INSERT INTO ... VALUES (...)` |
| `push(data[])` | Insert multiple rows | Multiple INSERTs |
| `update(id, partial)` | Partial update by ID | `UPDATE ... SET ... WHERE id = ?` |
| `remove(id)` | Delete by ID | `DELETE WHERE id = ?` |
| `removeAll(pred)` | Delete matching rows | `DELETE WHERE ...` |
| `clear()` | Delete all rows | `DELETE FROM table` |

`push()` and `update()` return the created/updated row with system fields populated.

## System columns

Every row has platform-managed columns that are **included in read results** but **excluded from write inputs**:

| Column | Type | Description |
|--------|------|-------------|
| `id` | string | UUID primary key, generated on INSERT |
| `createdAt` | number | Unix timestamp (ms), set on INSERT |
| `updatedAt` | number | Unix timestamp (ms), set on INSERT and every UPDATE |
| `lastUpdatedBy` | string | Run ID that last wrote this row |

TypeScript enforces this via `PushInput<T>` and `UpdateInput<T>` types. The runtime also strips system columns from write inputs as a safety net.

## Time helpers

All timestamps are unix milliseconds. The `db` namespace includes helpers to avoid `Date.now() - 48 * 60 * 60 * 1000` arithmetic:

```ts
db.now()                    // Date.now()
db.days(2)                  // 172800000 (ms)
db.hours(48)                // 172800000 (ms)
db.minutes(30)              // 1800000 (ms)
db.ago(db.days(2))          // unix ms for 2 days ago
db.fromNow(db.hours(48))   // unix ms for 48 hours from now

// Composable
const cutoff = db.ago(db.days(7) + db.hours(12));
```

## User type

Columns with schema type `'user'` store user IDs with a `@@user@@` prefix in SQLite. The SDK handles this transparently:

- **On read**: `@@user@@550e8400-...` becomes `550e8400-...`
- **On write**: `550e8400-...` becomes `@@user@@550e8400-...`

Application code always works with clean UUID strings.

## Database resolution

`defineTable()` needs to know which database contains the table. Resolution works as follows:

1. **Explicit database** — pass `{ database: 'name-or-id' }` as the second argument. Matches against both the database display name and its ID.
2. **Single database** (common case) — if the app has only one database, it's used automatically. No need to specify.
3. **Multiple databases, no hint** — the SDK searches all databases by table name. Works as long as table names are unique across databases.

If the table or database can't be found, a descriptive error is thrown listing what's available.

```ts
// Single database — just works
const Orders = db.defineTable<Order>('orders');

// Multiple databases — specify which one
const Orders = db.defineTable<Order>('orders', { database: 'main' });
const Logs = db.defineTable<LogEntry>('entries', { database: 'analytics' });
```

## Context hydration

`db.defineTable()` is lazy — it doesn't trigger any HTTP. Context (database metadata, column schemas) is fetched automatically on the first query execution via `GET /developer/v2/helpers/app-context`. Inside the MindStudio sandbox, context comes from pre-populated globals with no HTTP needed.

## Files

| File | Purpose |
|------|---------|
| `index.ts` | `createDb()` factory, `Db` interface, time helpers, table name resolution |
| `table.ts` | `Table<T>` class — the full read/write collection API |
| `query.ts` | `Query<T>` class — lazy chainable builder, SQL/JS dual execution |
| `predicate.ts` | Predicate compiler — tokenizer + recursive descent → SQL WHERE |
| `sql.ts` | SQL string builders, value escaping, row deserialization |
| `types.ts` | Internal types (Predicate, Accessor, TableConfig, SystemFields, etc.) |
