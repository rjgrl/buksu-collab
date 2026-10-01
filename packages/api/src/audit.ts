import type { Database } from "@Alumni-Tracking-Ss/db";
import type { PermissionKey } from "@Alumni-Tracking-Ss/db";

// TODO(PLAKY-AUDIT): PLAKY-AUD-001 - implement the audit write.
// Contract: one AuditLog row per mutation, with actorId, action, entity, entityId,
// human-readable summary, optional JSON metadata, and the caller IP.
// Every write procedure in packages/api/src/routers/* must call this.
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
  // A write with no action or no entity is a caller bug. Drop it instead of failing the
  // mutation that already succeeded.
  if (!input.action.trim() || !input.entity.trim()) {
    return;
  }

  await db.auditLog.create({
    data: {
      actorId: input.actorId ? input.actorId : null,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? null,
      summary: input.summary ?? "",
      ipAddress: input.ipAddress ?? null,
      metadata:
        input.metadata == null ? undefined : JSON.parse(JSON.stringify(input.metadata)),
    },
  });
}

// TODO(PLAKY-RBAC): PLAKY-RBAC-009 - implement the permission predicate.
// Must stay in sync with the check inside requirePermission() in ./index.ts.
export function hasPermission(permissions: PermissionKey[], needed: PermissionKey) {
  return permissions.includes(needed);
}