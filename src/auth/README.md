# auth — Role-Based Access Control

The `auth` namespace provides synchronous access to the current user's identity and roles within a MindStudio app. It's hydrated once from app context, then all access is instant — no async calls needed.

## Quick start

```ts
import { auth, Roles } from '@mindstudio-ai/agent';

// Gate a route — throws 403 if user lacks the role
auth.requireRole(Roles.admin);

// Check permissions
if (auth.hasRole(Roles.admin, Roles.approver)) {
  // user has at least one of these roles
}

// Look up who has a role
const admins = auth.getUsersByRole(Roles.admin);
```

## API

### `auth.userId`
The current user's ID (string). Read-only.

### `auth.roles`
The current user's roles in this app (readonly string array).

### `auth.hasRole(...roles: string[]): boolean`
Returns `true` if the current user has **any** of the given roles.

### `auth.requireRole(...roles: string[]): void`
Throws `MindStudioError` (code `'forbidden'`, status 403) if the user lacks all of the given roles. Use at the top of route handlers to gate access.

### `auth.getUsersByRole(role: string): string[]`
Returns all user IDs that have the given role in this app. Synchronous — the full role map is preloaded.

## The `Roles` proxy

`Roles` is a convenience proxy where any property access returns the property name as a string:

```ts
Roles.admin      // "admin"
Roles.approver   // "approver"
Roles.anything   // "anything"
```

This gives you discoverability and typo prevention vs raw string literals. In the future, the compilation pipeline will generate a typed `Roles` object from `app.json`, giving compile-time safety. For now, any string property works.

## Context hydration

`auth` requires app context to be loaded before use. How this happens depends on the environment:

- **Inside the MindStudio sandbox**: Automatic. The platform pre-populates `globalThis.ai.auth` before your code runs.
- **Outside the sandbox**: Call `await agent.ensureContext()` explicitly, or perform any `db` operation first (which auto-hydrates context as a side effect).

If you access `auth` before context is loaded, you'll get a clear error:
```
Auth context not yet loaded. Call `await agent.ensureContext()` or perform any db operation first.
```

## How it works internally

1. **Hydration**: `ensureContext()` calls `GET /developer/v2/helpers/app-context?appId={appId}` and receives `{ auth: { userId, roleAssignments[] }, databases: [...] }`. The role assignments are the full map for the app — all users, all roles.

2. **AuthContext creation**: The `AuthContext` class filters the role assignments to extract the current user's roles, and stores the full map for `getUsersByRole()` lookups.

3. **All sync**: Since the full role map is in memory, every method is a simple array lookup. No async, no HTTP, no latency.

## Files

- `auth.ts` — `AuthContext` class and `Roles` proxy (currently at `src/auth.ts`, will move to `src/auth/` if the module grows)
