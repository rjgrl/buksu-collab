import type { Database } from "@Alumni-Tracking-Ss/db";
import type { PermissionKey } from "@Alumni-Tracking-Ss/db";

// TODO(PLAKY-AUDIT): PLAKY-AUD-001 - implement the audit write.
// Contract: one AuditLog row per mutation, with actorId, action, entity, entityId,
// human-readable summary, optional JSON metadata, and the caller IP.
// Every write procedure in packages/api/src/routers/* must call this.

// The Prisma client types the JSON column as an index-signature input, so a
// `Record<string, unknown>` payload needs a narrowing cast. Derived from `Database` so the
// cast cannot drift from the generated client.
type AuditLogMetadata = Parameters<Database["auditLog"]["create"]>[0]["data"] extends {
  metadata?: infer M;
}
  ? M
  : never;

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
  if (!input.action || !input.entity) {
    return;
  }

  try {
    await db.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        summary: input.summary ?? "",
        metadata: input.metadata === null || input.metadata === undefined
          ? undefined
          : (input.metadata as AuditLogMetadata),
        ipAddress: input.ipAddress ?? null,
      },
    });
  } catch {
    // Audit must never break the request path.
  }
}

// TODO(PLAKY-RBAC): PLAKY-RBAC-009 - implement the permission predicate.
// Must stay in sync with the check inside requirePermission() in ./index.ts.
export function hasPermission(permissions: PermissionKey[], needed: PermissionKey) {
  return permissions.includes(needed);
}
