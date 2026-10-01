import "varlock/auto-load";

import { createPrismaClient } from "./index";
import { hashPassword } from "./password";
import { PERMISSIONS, ROLE_PRESETS } from "./permissions";
import { ENV } from "./env";

const db = createPrismaClient(ENV);

// TODO(PLAKY-PLATFORM): PLAKY-DB-006 - keep in sync with INTEGRATION_KEYS in
// packages/api/src/integrations/registry.ts. The seed must provision a row for every key.
const INTEGRATION_KEYS = [
  "recaptcha",
  "google_auth",
  "google_drive",
  "email",
  "image_host",
  "google_forms",
  "google_sheets",
] as const;

// TODO(PLAKY-RBAC): PLAKY-RBAC-004 - implement idempotent permission seeding (upsert by key).
async function seedPermissions() {
  for (const permission of PERMISSIONS) {
    // TODO(PLAKY-RBAC): PLAKY-RBAC-004 - write the upsert payload.
    void permission;
  }
}

// TODO(PLAKY-RBAC): PLAKY-RBAC-005 - implement idempotent role seeding from ROLE_PRESETS.
async function seedRoles() {
  // TODO(PLAKY-RBAC): PLAKY-RBAC-005 - load permissions, resolve them by key, upsert each
  // system role (isSystem = true), then replace its rolePermissions join rows.
  void db;
}

// TODO(PLAKY-AUTH): PLAKY-AUTH-004 - implement the seeded Super Admin account.
async function seedAdmin() {
  // TODO(PLAKY-AUTH): PLAKY-AUTH-004 - create admin@alumni.local only when no user exists,
  // hashing the password with hashPassword() and assigning the `super_admin` role.
  void hashPassword;
}

// TODO(PLAKY-INTEGRATIONS): PLAKY-INT-001 - implement default integration settings seeding.
async function seedIntegrations() {
  // TODO(PLAKY-INTEGRATIONS): PLAKY-INT-001 - upsert one IntegrationSetting row per
  // INTEGRATION_KEYS entry, defaulting `enabled` to true.
}

// TODO(PLAKY-PLATFORM): PLAKY-DB-007 - implement the soft-delete backfill.
async function backfillDeletedAt() {
  // TODO(PLAKY-PLATFORM): PLAKY-DB-007 - set deletedAt = null on legacy rows where the
  // MongoDB field is unset, so notDeletedFilter() matches them.
}

// TODO(PLAKY-ACADEMIC): PLAKY-ACAD-001 - implement sample academic structure seeding.
async function seedAcademicStructure() {
  // TODO(PLAKY-ACADEMIC): PLAKY-ACAD-001 - upsert two departments (IT, EDUC), two programs
  // (BSIT, BSED) attached to them, and two faculty records with department assignments.
  // Must return the created program ids for seedAlumni() below.
  throw new Error("TODO(PLAKY-ACAD-001): implement seedAcademicStructure");
}

// TODO(PLAKY-ALUMNI): PLAKY-ALUM-001 - implement sample alumni seeding.
async function seedAlumni(_programIds: { bsit: string; bsed: string }) {
  // TODO(PLAKY-ALUM-001 - create sample alumni records with contact info, employment
  // status, and mixed isTracked values so the dashboard has non-zero counts.
}

async function main() {
  await seedPermissions();
  await seedRoles();
  await seedAdmin();
  await seedIntegrations();
  const academic = await seedAcademicStructure();
  await seedAlumni({ bsit: academic.bsit.id, bsed: academic.bsed.id });
  await backfillDeletedAt();
}

main()
  .then(async () => {
    await db.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await db.$disconnect();
    process.exit(1);
  });