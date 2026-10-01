import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { writeAudit } from "../audit";
import { publicProcedure, requirePermission } from "../index";
import { isConfigured, isIntegrationEnabled } from "../integrations/registry";
import { verifyRecaptcha } from "../integrations/recaptcha";
import {
  authenticateWithPassword,
  createSession,
  destroySession,
  loadAuthUser,
  registerUser,
} from "../services/session";
import { loginSchema, signupSchema } from "../validation";

// RBAC + authentication module.
// auth.* stays on publicProcedure because the caller has no session yet; every other router
// in this package is permission-guarded. See docs/rbac/* and docs/system/user-guide.md.

async function requireRecaptchaWhenEnabled(
  context: {
    db: Parameters<typeof isIntegrationEnabled>[0];
    integrationEnv: Parameters<typeof verifyRecaptcha>[0];
  },
  input: { recaptchaToken?: string; recaptchaFallback?: boolean },
) {
  const enabled = await isIntegrationEnabled(context.db, "recaptcha");
  if (!enabled) {
    return;
  }

  const live = isConfigured("recaptcha", context.integrationEnv);
  const result = await verifyRecaptcha(context.integrationEnv, {
    token: input.recaptchaToken,
    fallback: !live && Boolean(input.recaptchaFallback),
  });

  if (!result.ok) {
    throw new ORPCError("BAD_REQUEST", { message: "reCAPTCHA verification failed." });
  }
}

// TODO(PLAKY-AUTH): PLAKY-AUTH-007 - implement the auth router.
export const authRouter = {
  // TODO(PLAKY-AUTH-007 - report which integrations the login screen should render:
  // reCAPTCHA (enabled / live / siteKey) and Google sign-in (enabled).
  config: publicProcedure.handler(async ({ context }) => {
    const [recaptchaEnabled, googleEnabled] = await Promise.all([
      isIntegrationEnabled(context.db, "recaptcha"),
      isIntegrationEnabled(context.db, "google_auth"),
    ]);
    const recaptchaLive = isConfigured("recaptcha", context.integrationEnv);
    const googleLive = isConfigured("google_auth", context.integrationEnv);

    return {
      recaptcha: {
        enabled: recaptchaEnabled,
        live: recaptchaEnabled && recaptchaLive,
        siteKey: context.integrationEnv.recaptchaSiteKey ?? null,
      },
      google: {
        enabled: googleEnabled && googleLive,
      },
    };
  }),

  // TODO(PLAKY-AUTH-007 - return the current AuthUser or null. Called by the _app layout
  // guard, by the index redirect, and by useSession().
  me: publicProcedure.handler(async ({ context }) => {
    return context.user;
  }),

  // TODO(PLAKY-AUTH-007 - verify reCAPTCHA when enabled, authenticate, create a session,
  // return { user, sessionToken, expiresAt }.
  login: publicProcedure.input(loginSchema).handler(async ({ context, input }) => {
    await requireRecaptchaWhenEnabled(context, input);

    const account = await authenticateWithPassword(context.db, {
      email: input.email,
      password: input.password,
      ipAddress: context.ipAddress,
    });

    const session = await createSession(context.db, account.id, {
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    const user = await loadAuthUser(context.db, account.id);
    if (!user) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Unable to load signed-in user." });
    }

    return {
      user,
      sessionToken: session.token,
      expiresAt: session.expiresAt,
    };
  }),

  // TODO(PLAKY-AUTH-007 - verify reCAPTCHA when enabled, register, create a session.
  signup: publicProcedure.input(signupSchema).handler(async ({ context, input }) => {
    await requireRecaptchaWhenEnabled(context, input);

    const account = await registerUser(context.db, {
      name: input.name,
      email: input.email,
      password: input.password,
      ipAddress: context.ipAddress,
    });

    const session = await createSession(context.db, account.id, {
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    const user = await loadAuthUser(context.db, account.id);
    if (!user) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Unable to load signed-in user." });
    }

    return {
      user,
      sessionToken: session.token,
      expiresAt: session.expiresAt,
    };
  }),

  // TODO(PLAKY-AUTH-007 - destroy the session and write an audit entry.
  logout: publicProcedure.handler(async ({ context }) => {
    await destroySession(context.db, context.sessionToken);
    if (context.user) {
      await writeAudit(context.db, {
        actorId: context.user.id,
        action: "auth.logout",
        entity: "user",
        entityId: context.user.id,
        summary: `${context.user.email} signed out`,
        ipAddress: context.ipAddress,
      });
    }
    return { ok: true as const };
  }),
};

// TODO(PLAKY-RBAC): PLAKY-RBAC-012 - implement the users router.
export const usersRouter = {
  // TODO(PLAKY-RBAC-012 - list with optional search on name/email, include userRoles.role.
  list: requirePermission("users.read")
    .input(z.object({ search: z.string().optional() }).optional())
    .handler(async () => {
      throw new Error("TODO(PLAKY-RBAC-012): implement users.list");
    }),

  // TODO(PLAKY-RBAC-012 - create with a lower-cased unique email (CONFLICT otherwise),
  // hashed password, and role assignments; then write an audit entry.
  create: requirePermission("users.write")
    .input(
      z.object({
        name: z.string().trim().min(1),
        email: z.string().email(),
        password: z.string().min(8),
        roleIds: z.array(z.string()).default([]),
      }),
    )
    .handler(async () => {
      throw new Error("TODO(PLAKY-RBAC-012): implement users.create");
    }),

  // TODO(PLAKY-RBAC-012 - update name / status / password, replace role assignments when
  // roleIds is supplied, then write an audit entry.
  update: requirePermission("users.write")
    .input(
      z.object({
        id: z.string(),
        name: z.string().trim().min(1).optional(),
        status: z.enum(["active", "disabled"]).optional(),
        roleIds: z.array(z.string()).optional(),
        password: z.string().min(8).optional(),
      }),
    )
    .handler(async () => {
      throw new Error("TODO(PLAKY-RBAC-012): implement users.update");
    }),
};

// TODO(PLAKY-RBAC): PLAKY-RBAC-013 - implement the roles router.
export const rolesRouter = {
  // TODO(PLAKY-RBAC-013 - list roles with their permission join rows and user counts.
  list: requirePermission("roles.read").handler(async () => {
    throw new Error("TODO(PLAKY-RBAC-013): implement roles.list");
  }),

  create: requirePermission("roles.write")
    .input(
      z.object({
        key: z.string().trim().min(1),
        name: z.string().trim().min(1),
        description: z.string().optional(),
        permissionIds: z.array(z.string()).default([]),
      }),
    )
    .handler(async () => {
      throw new Error("TODO(PLAKY-RBAC-013): implement roles.create");
    }),

  // TODO(PLAKY-RBAC-013 - update name/description and, when permissionIds is present,
  // delete then recreate the RolePermission join rows. System roles stay editable.
  update: requirePermission("roles.write")
    .input(
      z.object({
        id: z.string(),
        name: z.string().trim().min(1).optional(),
        description: z.string().optional(),
        permissionIds: z.array(z.string()).optional(),
      }),
    )
    .handler(async () => {
      throw new Error("TODO(PLAKY-RBAC-013): implement roles.update");
    }),

  // TODO(PLAKY-RBAC-013 - hard delete; reject with BAD_REQUEST when role.isSystem.
  delete: requirePermission("roles.delete")
    .input(z.object({ id: z.string() }))
    .handler(async () => {
      throw new Error("TODO(PLAKY-RBAC-013): implement roles.delete");
    }),
};

// TODO(PLAKY-RBAC): PLAKY-RBAC-014 - implement the permissions router (read-only catalog).
export const permissionsRouter = {
  // TODO(PLAKY-RBAC-014 - list the Permission model grouped by module, ordered by
  // (module, key) so the Roles page renders a stable grouping.
  list: requirePermission("permissions.read").handler(async () => {
    throw new Error("TODO(PLAKY-RBAC-014): implement permissions.list");
  }),
};