import { PrismaClient } from "../prisma/generated/client";
import type { DatabaseConfig } from "./config";

// TODO(PLAKY-PLATFORM): PLAKY-DB-001 - confirm the Prisma client factory signature and
// datasource wiring match the source system before implementing data-layer behaviour.
export function createPrismaClient(env: DatabaseConfig) {
  return new PrismaClient({ datasourceUrl: env.DATABASE_URL });
}

export type Database = ReturnType<typeof createPrismaClient>;

// TODO(PLAKY-PLATFORM): PLAKY-DB-002 - re-export surface must stay stable; the API layer
// imports these symbols directly and type-checking of the whole workspace depends on them.
export { PERMISSIONS, PERMISSION_KEYS, ROLE_PRESETS } from "./permissions";
export type { PermissionKey } from "./permissions";
export { hashPassword, verifyPassword, createSessionToken } from "./password";
export { percentTracked } from "./dashboard";
export { notDeleted, notDeletedFilter, withNotDeleted } from "./filters";