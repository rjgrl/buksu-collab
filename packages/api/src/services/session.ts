import type { Database } from "@Alumni-Tracking-Ss/db";
import { createSessionToken, hashPassword, verifyPassword } from "@Alumni-Tracking-Ss/db";

import type { AuthUser } from "../context";
import { writeAudit } from "../audit";

// Session lifecycle and credential verification.
// Everything here runs server-side only; apps/server/src/index.ts reaches these functions
// through the `@Alumni-Tracking-Ss/api/server-utils` barrel.

/** Sessions last 7 days; the cookie and the stored expiresAt must agree. */
// TODO(PLAKY-AUTH): PLAKY-AUTH-008 - keep SESSION_DAYS aligned with
// cookieOptions() in apps/server/src/index.ts and docs/system/user-guide.md.
const SESSION_DAYS = 7;

// TODO(PLAKY-AUTH): PLAKY-AUTH-009 - implement loadAuthUser.
// Contract: return null for an unknown user; otherwise union the permission keys across
// every assigned role, de-duplicated, and expose the role keys alongside. This is the only
// place effective permissions are resolved, so a role change takes effect on the next call.
export async function loadAuthUser(db: Database, userId: string): Promise<AuthUser | null> {
  void db;
  void userId;
  void hashPassword;
  void verifyPassword;
  void writeAudit;
  throw new Error("TODO(PLAKY-AUTH-009): implement loadAuthUser");
}

// TODO(PLAKY-AUTH): PLAKY-AUTH-010 - implement loadAuthUserFromToken.
// Contract: null when no token; delete and return null for an expired session; otherwise
// delegate to loadAuthUser(db, session.userId).
export async function loadAuthUserFromToken(db: Database, token: string | null) {
  void db;
  void token;
  throw new Error("TODO(PLAKY-AUTH-010): implement loadAuthUserFromToken");
}

// TODO(PLAKY-AUTH): PLAKY-AUTH-011 - implement createSession.
// Contract: opaque token from createSessionToken(), expiresAt = now + SESSION_DAYS, and the
// caller's ipAddress/userAgent recorded for the audit trail.
export async function createSession(
  db: Database,
  userId: string,
  meta: { ipAddress?: string | null; userAgent?: string | null },
) {
  void db;
  void userId;
  void meta;
  void createSessionToken;
  throw new Error("TODO(PLAKY-AUTH-011): implement createSession");
}

// TODO(PLAKY-AUTH): PLAKY-AUTH-012 - implement destroySession. Must be a no-op for a null token.
export async function destroySession(db: Database, token: string | null) {
  void db;
  void token;
  throw new Error("TODO(PLAKY-AUTH-012): implement destroySession");
}

// TODO(PLAKY-AUTH): PLAKY-AUTH-013 - implement authenticateWithPassword.
// Contract: UNAUTHORIZED for a bad email/password or a missing hash (no user enumeration),
// FORBIDDEN for a disabled account or an account with no role, then an audit entry.
export async function authenticateWithPassword(
  db: Database,
  input: { email: string; password: string; ipAddress?: string | null },
) {
  void db;
  void input;
  void verifyPassword;
  void writeAudit;
  throw new Error("TODO(PLAKY-AUTH-013): implement authenticateWithPassword");
}

// TODO(PLAKY-AUTH): PLAKY-AUTH-014 - implement registerUser.
// Contract: lower-case the email, CONFLICT when taken, the first account ever created
// becomes super_admin and every later self-registration becomes viewer, then an audit entry.
export async function registerUser(
  db: Database,
  input: { name: string; email: string; password: string; ipAddress?: string | null },
) {
  void db;
  void input;
  void hashPassword;
  void writeAudit;
  throw new Error("TODO(PLAKY-AUTH-014): implement registerUser");
}

// TODO(PLAKY-AUTH): PLAKY-AUTH-015 - implement upsertGoogleUser.
// Contract: an existing account is refreshed (name, image, emailVerified) and rejected with
// FORBIDDEN when disabled; a new account follows the same super_admin/viewer rule as
// registerUser.
export async function upsertGoogleUser(
  db: Database,
  input: { email: string; name: string; image?: string | null },
) {
  void db;
  void input;
  throw new Error("TODO(PLAKY-AUTH-015): implement upsertGoogleUser");
}