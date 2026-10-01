import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { writeAudit } from "../audit";
import type { AuthUser, Context } from "../context";
import { publicProcedure, requirePermission } from "../index";
import { loginSchema, signupSchema } from "../validation";

// password.ts uses node:crypto. Import it only when a handler runs so this router
// module does not pull Node built-ins into the browser type graph.
async function hashAccountPassword(password: string) {
  const specifier = "@Alumni-Tracking-Ss/db/password";
  const { hashPassword } = (await import(specifier)) as {
    hashPassword: (value: string) => Promise<string>;
  };
  return hashPassword(password);
}

// RBAC + authentication module.
// auth.* stays on publicProcedure because the caller has no session yet; every other router
// in this package is permission-guarded. See docs/rbac/* and docs/system/user-guide.md.

// TODO(PLAKY-AUTH): PLAKY-AUTH-007 - implement the auth router.
export const authRouter = {
  // TODO(PLAKY-AUTH-007 - report which integrations the login screen should render:
  // reCAPTCHA (enabled / live / siteKey) and Google sign-in (enabled).
  config: publicProcedure.handler(async () => {
    throw new Error("TODO(PLAKY-AUTH-007): implement auth.config");
  }),

  // TODO(PLAKY-AUTH-007 - return the current AuthUser or null. Called by the _app layout
  // guard, by the index redirect, and by useSession().
  me: publicProcedure.handler(async (): Promise<AuthUser | null> => {
    throw new Error("TODO(PLAKY-AUTH-007): implement auth.me");
  }),

  // TODO(PLAKY-AUTH-007 - verify reCAPTCHA when enabled, authenticate, create a session,
  // return { user, sessionToken, expiresAt }.
  login: publicProcedure.input(loginSchema).handler(async () => {
    throw new Error("TODO(PLAKY-AUTH-007): implement auth.login");
  }),

  // TODO(PLAKY-AUTH-007 - verify reCAPTCHA when enabled, register, create a session.
  signup: publicProcedure.input(signupSchema).handler(async () => {
    throw new Error("TODO(PLAKY-AUTH-007): implement auth.signup");
  }),

  // TODO(PLAKY-AUTH-007 - destroy the session and write an audit entry.
  logout: publicProcedure.handler(async () => {
    throw new Error("TODO(PLAKY-AUTH-007): implement auth.logout");
  }),
};

const userSelect = {
  id: true,
  name: true,
  email: true,
  status: true,
  userRoles: {
    select: {
      role: {
        select: { id: true, key: true, name: true },
      },
    },
  },
} as const;

const roleInclude = {
  rolePermissions: {
    include: {
      permission: {
        select: { id: true, key: true, name: true, description: true, module: true },
      },
    },
  },
  _count: { select: { userRoles: true } },
} as const;

type UserRecord = {
  id: string;
  name: string;
  email: string;
  status: "active" | "disabled";
  userRoles: { role: { id: string; key: string; name: string } }[];
};

type RoleRecord = {
  id: string;
  key: string;
  name: string;
  description: string;
  isSystem: boolean;
  rolePermissions: {
    permission: { id: string; key: string; name: string; description: string; module: string };
  }[];
  _count: { userRoles: number };
};

function toUser(user: UserRecord) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    status: user.status,
    roles: user.userRoles
      .map((row) => row.role)
      .sort((a, b) => a.name.localeCompare(b.name) || a.key.localeCompare(b.key)),
  };
}

function toRole(role: RoleRecord) {
  return {
    id: role.id,
    key: role.key,
    name: role.name,
    description: role.description,
    isSystem: role.isSystem,
    userCount: role._count.userRoles,
    permissions: role.rolePermissions
      .map((row) => row.permission)
      .sort((a, b) => a.module.localeCompare(b.module) || a.key.localeCompare(b.key)),
  };
}

function isPrismaCode(error: unknown, code: string) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === code
  );
}

async function assertRoleIds(db: Context["db"], roleIds: string[]) {
  if (roleIds.length === 0) {
    return;
  }

  const found = await db.role.findMany({
    where: { id: { in: roleIds } },
    select: { id: true },
  });

  if (found.length !== roleIds.length) {
    throw new ORPCError("BAD_REQUEST", { message: "One or more roles do not exist." });
  }
}

async function assertPermissionIds(db: Context["db"], permissionIds: string[]) {
  if (permissionIds.length === 0) {
    return;
  }

  const found = await db.permission.findMany({
    where: { id: { in: permissionIds } },
    select: { id: true },
  });

  if (found.length !== permissionIds.length) {
    throw new ORPCError("BAD_REQUEST", { message: "One or more permissions do not exist." });
  }
}

// Users: list accounts, create them, and update name, password, status, or roles.
// Disabling an account is users.update with status "disabled" (users.write). The
// users.delete catalog key is not consulted here.
export const usersRouter = {
  // Optional case-insensitive search on name and email. Roles come from userRoles.role.
  list: requirePermission("users.read")
    .input(z.object({ search: z.string().optional() }).optional())
    .handler(async ({ input, context }) => {
      const term = input?.search?.trim().toLowerCase() ?? "";
      const users = await context.db.user.findMany({
        select: userSelect,
        orderBy: [{ name: "asc" }, { email: "asc" }],
      });
      const visible = term
        ? users.filter(
            (user) =>
              user.name.toLowerCase().includes(term) || user.email.toLowerCase().includes(term),
          )
        : users;

      return visible.map((user) => toUser(user));
    }),

  // Lower-cased unique email (CONFLICT otherwise), hashed password, and role assignments.
  create: requirePermission("users.write")
    .input(
      z.object({
        name: z.string().trim().min(1),
        email: z.string().email(),
        password: z.string().min(8),
        roleIds: z.array(z.string()).default([]),
      }),
    )
    .handler(async ({ input, context }) => {
      const email = input.email.trim().toLowerCase();
      const roleIds = [...new Set(input.roleIds)];

      if (roleIds.length === 0) {
        throw new ORPCError("BAD_REQUEST", { message: "Assign at least one role." });
      }

      await assertRoleIds(context.db, roleIds);

      const existing = await context.db.user.findUnique({
        where: { email },
        select: { id: true },
      });
      if (existing) {
        throw new ORPCError("CONFLICT", { message: "An account with this email already exists." });
      }

      const passwordHash = await hashAccountPassword(input.password);

      try {
        const user = await context.db.user.create({
          data: {
            name: input.name,
            email,
            passwordHash,
            status: "active",
            userRoles: {
              create: roleIds.map((roleId) => ({ roleId })),
            },
          },
          select: userSelect,
        });

        await writeAudit(context.db, {
          actorId: context.user.id,
          action: "users.create",
          entity: "User",
          entityId: user.id,
          summary: `Created account ${user.email}`,
          metadata: { email: user.email, roleIds },
          ipAddress: context.ipAddress,
        });

        return toUser(user);
      } catch (error) {
        if (isPrismaCode(error, "P2002")) {
          throw new ORPCError("CONFLICT", {
            message: "An account with this email already exists.",
          });
        }
        throw error;
      }
    }),

  // Update name, status, and password. When roleIds is supplied, replace the assignments.
  // status "disabled" also drops open sessions so the account can no longer sign in.
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
    .handler(async ({ input, context }) => {
      const existing = await context.db.user.findUnique({
        where: { id: input.id },
        select: { id: true, email: true },
      });
      if (!existing) {
        throw new ORPCError("NOT_FOUND", { message: "User not found." });
      }

      const roleIds = input.roleIds ? [...new Set(input.roleIds)] : undefined;
      if (roleIds) {
        await assertRoleIds(context.db, roleIds);
      }

      const passwordHash =
        input.password !== undefined ? await hashAccountPassword(input.password) : undefined;

      if (roleIds) {
        await context.db.userRole.deleteMany({ where: { userId: input.id } });
        if (roleIds.length > 0) {
          await context.db.userRole.createMany({
            data: roleIds.map((roleId) => ({ userId: input.id, roleId })),
          });
        }
      }

      const user = await context.db.user.update({
        where: { id: input.id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(passwordHash !== undefined ? { passwordHash } : {}),
        },
        select: userSelect,
      });

      if (input.status === "disabled") {
        await context.db.session.deleteMany({ where: { userId: input.id } });
      }

      const onlyStatus =
        input.status !== undefined &&
        input.name === undefined &&
        input.password === undefined &&
        input.roleIds === undefined;
      const action =
        onlyStatus && input.status === "disabled"
          ? "users.disable"
          : onlyStatus && input.status === "active"
            ? "users.enable"
            : "users.update";
      const summary =
        action === "users.disable"
          ? `Disabled account ${user.email}`
          : action === "users.enable"
            ? `Enabled account ${user.email}`
            : `Updated account ${user.email}`;

      await writeAudit(context.db, {
        actorId: context.user.id,
        action,
        entity: "User",
        entityId: user.id,
        summary,
        metadata: {
          status: input.status ?? null,
          nameChanged: input.name !== undefined,
          passwordChanged: input.password !== undefined,
          roleIds: roleIds ?? null,
        },
        ipAddress: context.ipAddress,
      });

      return toUser(user);
    }),
};

// Roles: list with permissions and user counts, create, and update. System roles stay editable.
export const rolesRouter = {
  list: requirePermission("roles.read").handler(async ({ context }) => {
    const roles = await context.db.role.findMany({
      include: roleInclude,
      orderBy: [{ name: "asc" }, { key: "asc" }],
    });

    return roles.map((role) => toRole(role));
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
    .handler(async ({ input, context }) => {
      const key = input.key.trim();
      const permissionIds = [...new Set(input.permissionIds)];
      await assertPermissionIds(context.db, permissionIds);

      const existing = await context.db.role.findUnique({
        where: { key },
        select: { id: true },
      });
      if (existing) {
        throw new ORPCError("CONFLICT", { message: "A role with this key already exists." });
      }

      try {
        const role = await context.db.role.create({
          data: {
            key,
            name: input.name,
            description: input.description?.trim() ?? "",
            isSystem: false,
            ...(permissionIds.length > 0
              ? {
                  rolePermissions: {
                    create: permissionIds.map((permissionId) => ({ permissionId })),
                  },
                }
              : {}),
          },
          include: roleInclude,
        });

        await writeAudit(context.db, {
          actorId: context.user.id,
          action: "roles.create",
          entity: "Role",
          entityId: role.id,
          summary: `Created role ${role.key}`,
          metadata: { key: role.key, permissionIds },
          ipAddress: context.ipAddress,
        });

        return toRole(role);
      } catch (error) {
        if (isPrismaCode(error, "P2002")) {
          throw new ORPCError("CONFLICT", { message: "A role with this key already exists." });
        }
        throw error;
      }
    }),

  // Update name and description. When permissionIds is present, delete then recreate the
  // RolePermission join rows. System roles stay editable.
  update: requirePermission("roles.write")
    .input(
      z.object({
        id: z.string(),
        name: z.string().trim().min(1).optional(),
        description: z.string().optional(),
        permissionIds: z.array(z.string()).optional(),
      }),
    )
    .handler(async ({ input, context }) => {
      const existing = await context.db.role.findUnique({
        where: { id: input.id },
        select: { id: true, key: true },
      });
      if (!existing) {
        throw new ORPCError("NOT_FOUND", { message: "Role not found." });
      }

      const permissionIds = input.permissionIds ? [...new Set(input.permissionIds)] : undefined;
      if (permissionIds) {
        await assertPermissionIds(context.db, permissionIds);
        await context.db.rolePermission.deleteMany({ where: { roleId: input.id } });
        if (permissionIds.length > 0) {
          await context.db.rolePermission.createMany({
            data: permissionIds.map((permissionId) => ({
              roleId: input.id,
              permissionId,
            })),
          });
        }
      }

      const role = await context.db.role.update({
        where: { id: input.id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.description !== undefined ? { description: input.description.trim() } : {}),
        },
        include: roleInclude,
      });

      await writeAudit(context.db, {
        actorId: context.user.id,
        action: "roles.update",
        entity: "Role",
        entityId: role.id,
        summary: `Updated role ${role.key}`,
        metadata: {
          nameChanged: input.name !== undefined,
          descriptionChanged: input.description !== undefined,
          permissionIds: permissionIds ?? null,
        },
        ipAddress: context.ipAddress,
      });

      return toRole(role);
    }),

  // TODO(PLAKY-RBAC-013 - hard delete; reject with BAD_REQUEST when role.isSystem.
  delete: requirePermission("roles.delete")
    .input(z.object({ id: z.string() }))
    .handler(async () => {
      throw new Error("TODO(PLAKY-RBAC-013): implement roles.delete");
    }),
};

// Read-only permission catalog. Ordered by (module, key) so the Roles page can group
// checkboxes without re-sorting.
export const permissionsRouter = {
  list: requirePermission("permissions.read").handler(async ({ context }) => {
    return context.db.permission.findMany({
      select: { id: true, key: true, name: true, description: true, module: true },
      orderBy: [{ module: "asc" }, { key: "asc" }],
    });
  }),
};