/**
 * Auth namespace — role-based access control for MindStudio apps.
 *
 * Provides synchronous access to the current user's identity and roles
 * within an app. Hydrated once from app context (either sandbox globals
 * or the `GET /helpers/app-context` endpoint), then all access is sync.
 *
 * ## How it works
 *
 * 1. The platform stores role assignments per app: `{ userId, roleName }[]`
 * 2. On context hydration, the full role map is loaded into memory
 * 3. `auth.hasRole()` / `auth.requireRole()` are simple array lookups
 * 4. `auth.getUsersByRole()` scans the preloaded assignments
 *
 * ## Usage
 *
 * ```ts
 * import { auth, Roles } from '@mindstudio-ai/agent';
 *
 * // Check permissions
 * if (auth.hasRole(Roles.admin, Roles.approver)) {
 *   // user has at least one of these roles
 * }
 *
 * // Gate a route — throws 403 if user lacks the role
 * auth.requireRole(Roles.admin);
 *
 * // Look up who has a role
 * const admins = auth.getUsersByRole(Roles.admin);
 * ```
 *
 * ## Roles proxy
 *
 * `Roles` is a convenience proxy: `Roles.admin` === `"admin"`. It provides
 * discoverability and typo prevention. In the future, the compilation
 * pipeline will generate a typed `Roles` object from `app.json`, giving
 * compile-time safety. For now, any string property access works.
 */

import { MindStudioError } from '../errors.js';
import type { AppAuthContext, AppRoleAssignment } from '../types.js';

// ---------------------------------------------------------------------------
// AuthContext — the runtime auth object
// ---------------------------------------------------------------------------

/**
 * Auth context for the current execution. Created from the app's role
 * assignments and the current user's identity.
 *
 * All methods are synchronous — the full role map is preloaded at
 * context hydration time.
 */
export class AuthContext {
  /** The current user's ID, or null for unauthenticated users. */
  readonly userId: string | null;

  /** The current user's roles in this app. */
  readonly roles: readonly string[];

  /** All role assignments for this app (all users, all roles). */
  private readonly _roleAssignments: readonly AppRoleAssignment[];

  constructor(ctx: AppAuthContext) {
    this.userId = ctx.userId;
    this._roleAssignments = ctx.roleAssignments;

    // Extract the current user's roles from the full assignment list
    this.roles = ctx.roleAssignments
      .filter((a) => a.userId === ctx.userId)
      .map((a) => a.roleName);
  }

  /**
   * Check if the current user has **any** of the given roles.
   * Returns true if at least one matches.
   *
   * @example
   * ```ts
   * if (auth.hasRole(Roles.admin, Roles.approver)) {
   *   // user is an admin OR an approver
   * }
   * ```
   */
  hasRole(...roles: string[]): boolean {
    return roles.some((r) => this.roles.includes(r));
  }

  /**
   * Require the current user to have at least one of the given roles.
   * Throws a `MindStudioError` with code `'forbidden'` and status 403
   * if the user lacks all of the specified roles.
   *
   * Use this at the top of route handlers to gate access.
   *
   * @example
   * ```ts
   * auth.requireRole(Roles.admin);
   * // code below only runs if user is an admin
   * ```
   */
  requireRole(...roles: string[]): void {
    if (this.userId == null) {
      throw new MindStudioError(
        'No authenticated user',
        'unauthenticated',
        401,
      );
    }
    if (!this.hasRole(...roles)) {
      throw new MindStudioError(
        `User has role(s) [${this.roles.join(', ') || 'none'}] but requires one of: [${roles.join(', ')}]`,
        'forbidden',
        403,
      );
    }
  }

  /**
   * Get all user IDs that have the given role in this app.
   * Synchronous — scans the preloaded role assignments.
   *
   * @example
   * ```ts
   * const reviewers = auth.getUsersByRole(Roles.reviewer);
   * // ['user-id-1', 'user-id-2', ...]
   * ```
   */
  getUsersByRole(role: string): string[] {
    return this._roleAssignments
      .filter((a) => a.roleName === role)
      .map((a) => a.userId);
  }
}

// ---------------------------------------------------------------------------
// Roles proxy — string passthrough for role names
// ---------------------------------------------------------------------------

/**
 * Convenience proxy for referencing role names. Any property access
 * returns the property name as a string: `Roles.admin === "admin"`.
 *
 * This provides:
 * - Discoverability via autocomplete (in typed environments)
 * - Typo prevention (vs raw string literals)
 * - Forward compatibility with the future typed Roles generation
 *
 * In the future, the compilation pipeline will generate a typed `Roles`
 * object from `app.json` roles, replacing this proxy with compile-time
 * checked constants.
 *
 * @example
 * ```ts
 * Roles.admin      // "admin"
 * Roles.approver   // "approver"
 * Roles.anything   // "anything" (no runtime error, any string works)
 * ```
 */
export const Roles: Record<string, string> = new Proxy(
  {} as Record<string, string>,
  {
    get(_, prop: string | symbol): string | undefined {
      // Only handle string property access (not Symbols like Symbol.toPrimitive)
      if (typeof prop === 'string') return prop;
      return undefined;
    },
  },
);
