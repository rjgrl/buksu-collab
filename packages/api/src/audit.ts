import type { Database } from "@Alumni-Tracking-Ss/db";
import type { PermissionKey } from "@Alumni-Tracking-Ss/db";

// One AuditLog row per mutation, with actorId, action, entity, entityId,
// a human-readable summary, optional JSON metadata, and the caller IP.
// Every write procedure in packages/api/src/routers/* must call this.
// A missing entity is ignored so the helper never throws into the request path.
export async function writeAudit(
  db: Database,
  input: {
    actorId?: string | null;
    action: string;
    entity: string;
    entityId?: string | null;
    summary?: string;
    metadata?: Record<string, unknown> | null;
    ipAddress?: string | null;
  },
) {
  // A missing entity is a caller bug, not a failed mutation. Skip the write instead of
  // throwing into the request path.
  if (!input.entity.trim()) {
    return;
  }

  const metadata =
    input.metadata == null ? undefined : (JSON.parse(JSON.stringify(input.metadata)) as object);

  await db.auditLog.create({
    data: {
      actorId: input.actorId || null,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId || null,
      summary: input.summary ?? "",
      metadata,
      ipAddress: input.ipAddress || null,
    },
  });
}

// TODO(PLAKY-RBAC): PLAKY-RBAC-009 - implement the permission predicate.
// Must stay in sync with the check inside requirePermission() in ./index.ts.
export function hasPermission(permissions: PermissionKey[], needed: PermissionKey) {
  return permissions.includes(needed);
}