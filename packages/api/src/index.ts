import { ORPCError, os } from "@orpc/server";

import type { PermissionKey } from "@Alumni-Tracking-Ss/db";

import type { AuthUser, Context } from "./context";

// Root oRPC builder. Every router composes procedures from this file, so this is the
// architectural seam between the transport (Hono), the router tree, and the data layer.
export const o = os.$context<Context>();

export const publicProcedure = o;

// TODO(PLAKY-AUTH): PLAKY-AUTH-005 - implement the authentication gate.
// Contract: anonymous callers get UNAUTHORIZED (never FORBIDDEN); a signed-in but
// `disabled` account gets FORBIDDEN. Denials must short-circuit before any db access.
export const authenticated = o.use(async ({ context, next }) => {
  if (!context.user) {
    throw new ORPCError("UNAUTHORIZED", { message: "Sign in required." });
  }

  if (context.user.status !== "active") {
    throw new ORPCError("FORBIDDEN", { message: "This account is disabled." });
  }

  return next({
    context: {
      ...context,
      user: context.user,
    },
  });
});

// TODO(PLAKY-RBAC): PLAKY-RBAC-007 - implement the permission gate.
// Contract: layered on `authenticated`, so it can only ever narrow access.
// A missing key must throw FORBIDDEN with the key named in the message.
export function requirePermission(permission: PermissionKey) {
  return authenticated.use(async ({ context, next }) => {
    if (!context.user.permissions.includes(permission)) {
      throw new ORPCError("FORBIDDEN", {
        message: `Missing permission: ${permission}`,
      });
    }

    return next({
      context: {
        ...context,
        user: context.user as AuthUser,
      },
    });
  });
}