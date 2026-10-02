import type { Database, PermissionKey } from "@Alumni-Tracking-Ss/db";
import { createSessionToken, hashPassword, verifyPassword } from "@Alumni-Tracking-Ss/db";
import { ORPCError } from "@orpc/server";

import type { AuthUser } from "../context";
import { writeAudit } from "../audit";

// Session lifecycle and credential verification.
// Everything here runs server-side only; apps/server/src/index.ts reaches these functions
// through the `@Alumni-Tracking-Ss/api/server-utils` barrel.

/** Sessions last 7 days; the cookie and the stored expiresAt must agree. */
// TODO(PLAKY-AUTH): PLAKY-AUTH-008 - keep SESSION_DAYS aligned with
// cookieOptions() in apps/server/src/index.ts and docs/system/user-guide.md.
const SESSION_DAYS = 7;

function toAuthUser(user: {
  id: string;
  name: string;
  email: string;
  image: string | null;
  status: "active" | "disabled";
  userRoles: Array<{
    role: {
      key: string;
      rolePermissions: Array<{ permission: { key: string } }>;
    };
  }>;
}): AuthUser {
  const roles = user.userRoles.map((row) => row.role.key);
  const permissionSet = new Set<PermissionKey>();
  for (const row of user.userRoles) {
    for (const join of row.role.rolePermissions) {
      permissionSet.add(join.permission.key as PermissionKey);
    }
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    status: user.status,
    roles,
    permissions: [...permissionSet],
  };
}

const authUserInclude = {
  userRoles: {
    include: {
      role: {
        include: {
          rolePermissions: {
            include: { permission: true },
          },
        },
      },
    },
  },
} as const;

async function assignBootstrapRole(db: Database, userId: string) {
  const userCount = await db.user.count();
  const roleKey = userCount <= 1 ? "super_admin" : "viewer";
  const role = await db.role.findUnique({ where: { key: roleKey } });
  if (!role) {
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: `System role "${roleKey}" is missing. Run the database seed.`,
    });
  }

  await db.userRole.create({
    data: { userId, roleId: role.id },
  });
}

// TODO(PLAKY-AUTH): PLAKY-AUTH-009 - implement loadAuthUser.
// Contract: return null for an unknown user; otherwise union the permission keys across
// every assigned role, de-duplicated, and expose the role keys alongside. This is the only
// place effective permissions are resolved, so a role change takes effect on the next call.
export async function loadAuthUser(db: Database, userId: string): Promise<AuthUser | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: authUserInclude,
  });

  if (!user) {
    return null;
  }

  return toAuthUser(user);
}

// TODO(PLAKY-AUTH): PLAKY-AUTH-010 - implement loadAuthUserFromToken.
// Contract: null when no token; delete and return null for an expired session; otherwise
// delegate to loadAuthUser(db, session.userId).
export async function loadAuthUserFromToken(db: Database, token: string | null) {
  if (!token) {
    return null;
  }

  const session = await db.session.findUnique({ where: { token } });
  if (!session) {
    return null;
  }

  if (session.expiresAt.getTime() <= Date.now()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }

  return loadAuthUser(db, session.userId);
}

// TODO(PLAKY-AUTH): PLAKY-AUTH-011 - implement createSession.
// Contract: opaque token from createSessionToken(), expiresAt = now + SESSION_DAYS, and the
// caller's ipAddress/userAgent recorded for the audit trail.
export async function createSession(
  db: Database,
  userId: string,
  meta: { ipAddress?: string | null; userAgent?: string | null },
) {
  const token = createSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  const session = await db.session.create({
    data: {
      token,
      userId,
      expiresAt,
      ipAddress: meta.ipAddress ?? null,
      userAgent: meta.userAgent ?? null,
    },
  });

  return session;
}

// TODO(PLAKY-AUTH): PLAKY-AUTH-012 - implement destroySession. Must be a no-op for a null token.
export async function destroySession(db: Database, token: string | null) {
  if (!token) {
    return;
  }

  await db.session.deleteMany({ where: { token } });
}

// TODO(PLAKY-AUTH): PLAKY-AUTH-013 - implement authenticateWithPassword.
// Contract: UNAUTHORIZED for a bad email/password or a missing hash (no user enumeration),
// FORBIDDEN for a disabled account or an account with no role, then an audit entry.
export async function authenticateWithPassword(
  db: Database,
  input: { email: string; password: string; ipAddress?: string | null },
) {
  const email = input.email.trim().toLowerCase();
  const user = await db.user.findUnique({
    where: { email },
    include: { userRoles: true },
  });

  if (!user || !user.passwordHash) {
    throw new ORPCError("UNAUTHORIZED", { message: "Invalid email or password." });
  }

  const valid = await verifyPassword(input.password, user.passwordHash);
  if (!valid) {
    throw new ORPCError("UNAUTHORIZED", { message: "Invalid email or password." });
  }

  if (user.status !== "active") {
    throw new ORPCError("FORBIDDEN", { message: "This account is disabled." });
  }

  if (user.userRoles.length === 0) {
    throw new ORPCError("FORBIDDEN", { message: "This account has no assigned role." });
  }

  await writeAudit(db, {
    actorId: user.id,
    action: "auth.login",
    entity: "user",
    entityId: user.id,
    summary: `${user.email} signed in`,
    ipAddress: input.ipAddress ?? null,
  });

  return user;
}

// TODO(PLAKY-AUTH): PLAKY-AUTH-014 - implement registerUser.
// Contract: lower-case the email, CONFLICT when taken, the first account ever created
// becomes super_admin and every later self-registration becomes viewer, then an audit entry.
export async function registerUser(
  db: Database,
  input: { name: string; email: string; password: string; ipAddress?: string | null },
) {
  const email = input.email.trim().toLowerCase();
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    throw new ORPCError("CONFLICT", { message: "An account with this email already exists." });
  }

  const passwordHash = await hashPassword(input.password);
  const user = await db.user.create({
    data: {
      name: input.name.trim(),
      email,
      passwordHash,
      emailVerified: false,
      status: "active",
    },
  });

  await assignBootstrapRole(db, user.id);

  await writeAudit(db, {
    actorId: user.id,
    action: "auth.signup",
    entity: "user",
    entityId: user.id,
    summary: `${user.email} registered`,
    ipAddress: input.ipAddress ?? null,
  });

  return user;
}

// TODO(PLAKY-AUTH): PLAKY-AUTH-015 - implement upsertGoogleUser.
// Contract: an existing account is refreshed (name, image, emailVerified) and rejected with
// FORBIDDEN when disabled; a new account follows the same super_admin/viewer rule as
// registerUser.
export async function upsertGoogleUser(
  db: Database,
  input: { email: string; name: string; image?: string | null },
) {
  const email = input.email.trim().toLowerCase();
  const existing = await db.user.findUnique({ where: { email } });

  if (existing) {
    if (existing.status !== "active") {
      throw new ORPCError("FORBIDDEN", { message: "This account is disabled." });
    }

    return db.user.update({
      where: { id: existing.id },
      data: {
        name: input.name.trim() || existing.name,
        image: input.image ?? existing.image,
        emailVerified: true,
      },
    });
  }

  const user = await db.user.create({
    data: {
      name: input.name.trim() || email,
      email,
      image: input.image ?? null,
      emailVerified: true,
      status: "active",
    },
  });

  await assignBootstrapRole(db, user.id);
  return user;
}
