# auth — Role-Based Access Control

The `auth` namespace provides synchronous access to the current user's identity and roles within a MindStudio app. It's hydrated once from app context, then all access is instant — no async calls needed.

## Quick start

```ts
import { auth, Roles } from '@mindstudio-ai/agent';

// Gate a route — throws 403 if user lacks the role
auth.requireRole(Roles.admin);

// Check permissions conditionally
if (auth.hasRole(Roles.admin, Roles.approver)) {
  // user has at least one of these roles
}

// Get the current user's ID
const userId = auth.userId;

// Look up all users with a specific role
const admins = auth.getUsersByRole(Roles.admin);
```

## API

### `auth.userId: string`
The current user's ID. Read-only.

### `auth.roles: readonly string[]`
The current user's roles in this app. Read-only array. Empty if the user has no roles assigned.

### `auth.hasRole(...roles: string[]): boolean`
Returns `true` if the current user has **any** of the given roles. Accepts one or more role names. Use `Roles.xxx` for discoverability.

```ts
// Check for a single role
if (auth.hasRole(Roles.admin)) { ... }

// Check for any of multiple roles (OR logic)
if (auth.hasRole(Roles.admin, Roles.approver, Roles.reviewer)) { ... }
```

### `auth.requireRole(...roles: string[]): void`
Throws `MindStudioError` (code `'forbidden'`, status 403) if the user lacks **all** of the given roles. Use at the top of route handlers to gate access. If the user has at least one of the listed roles, execution continues normally.

```ts
// Only admins can proceed
auth.requireRole(Roles.admin);

// Admins OR approvers can proceed
auth.requireRole(Roles.admin, Roles.approver);

// Everything below this line is guaranteed to be an admin or approver
```

### `auth.getUsersByRole(role: string): string[]`
Returns all user IDs that have the given role in this app. Synchronous — the full role map is preloaded at context hydration time.

```ts
// Get all users with the 'reviewer' role
const reviewers = auth.getUsersByRole(Roles.reviewer);

// Pick the first reviewer for assignment
const assignee = reviewers[0];
```

## `Roles` proxy

`Roles` is a convenience proxy where any property access returns the property name as a string:

```ts
Roles.admin      // "admin"
Roles.approver   // "approver"
Roles.anything   // "anything" — any string works
```

Use `Roles.xxx` instead of raw string literals for discoverability and typo prevention. In the future, the compilation pipeline will generate a typed `Roles` object from `app.json`, giving compile-time safety.

## Common patterns

### Gating a route handler

```ts
export const deleteOrder = async (input: { orderId: string }) => {
  auth.requireRole(Roles.admin);
  // Only admins reach this point
  await Orders.remove(input.orderId);
};
```

### Role-based data filtering

```ts
export const getDashboard = async () => {
  const userId = auth.userId;

  // Everyone sees their own orders
  const myOrders = await Orders
    .filter(o => o.requestedBy === userId)
    .sortBy(o => o.createdAt)
    .reverse()
    .take(25);

  // Only AP team sees pending invoices
  let pendingInvoices;
  if (auth.hasRole(Roles.ap, Roles.admin)) {
    pendingInvoices = await Invoices
      .filter(inv => inv.status === 'pending_review')
      .sortBy(inv => inv.dueDate)
      .take(50);
  }

  return { myOrders, pendingInvoices };
};
```

### Assigning work by role

```ts
// Find a GRC reviewer and create an approval
const reviewer = auth.getUsersByRole(Roles.grc)[0];
if (reviewer) {
  await Approvals.push({
    entityId: vendor.id,
    assignedTo: reviewer,
    status: 'pending',
  });
}
```

## Context hydration

`auth` requires app context to be loaded before use. How this happens depends on the environment:

- **Inside the MindStudio sandbox** (managed mode): Automatic. The platform pre-populates `globalThis.ai.auth` before your code runs, or the SDK fetches context via the CALLBACK_TOKEN. No setup needed.
- **Outside the sandbox** (API key): Call `await agent.ensureContext()` explicitly, or perform any `db` operation first (which auto-hydrates context as a side effect).

If you access `auth` before context is loaded, you'll get a clear error:
```
Auth context not yet loaded. Call `await agent.ensureContext()` or perform any db operation first.
```

## Auth-managed user tables

For v2 apps with auth enabled, users are app-managed (not MindStudio users). The developer defines a user table via `defineTable`, and the platform manages the `email`, `phone`, and `roles` columns on it. The `auth` API surface is unchanged — `auth.userId` returns the app user's row ID, `auth.roles` returns their roles, and `hasRole()`/`requireRole()`/`getUsersByRole()` all work the same way.

Roles are writable from both developer code and the MindStudio dashboard:

```ts
// Update a user's roles from code — SDK syncs to platform automatically
await Users.update(userId, { roles: ['admin', 'reviewer'] });

// auth.hasRole() and getUsersByRole() reflect the change immediately
```

Email and phone columns are read-only from code — the SDK throws if you try to write to them. Use the auth API on the frontend (`@mindstudio-ai/interface`) for email/phone changes.

See `src/db/README.md` for full details on managed column behavior.

## How it works internally

1. **Hydration**: The SDK calls `GET /developer/v2/helpers/app-context` (with appId or CALLBACK_TOKEN) and receives `{ auth: { userId, roleAssignments[] }, databases: [...] }`. The role assignments contain the full map for the app — all users, all roles. For v2 apps with auth, roles are loaded from `v2_app_managed_users` in Postgres.

2. **AuthContext creation**: The `AuthContext` class filters the role assignments to extract the current user's roles, and stores the full map for `getUsersByRole()` lookups.

3. **All sync**: Since the full role map is in memory, every method is a simple array lookup. No async, no HTTP, no latency.

## Files

| File | Purpose |
|------|---------|
| `index.ts` | `AuthContext` class and `Roles` proxy |
