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
    await db.permission.upsert({
      where: { key: permission.key },
      create: {
        key: permission.key,
        name: permission.name,
        description: permission.description,
        module: permission.module,
      },
      update: {
        name: permission.name,
        description: permission.description,
        module: permission.module,
      },
    });
  }
}

// TODO(PLAKY-RBAC): PLAKY-RBAC-005 - implement idempotent role seeding from ROLE_PRESETS.
async function seedRoles() {
  const permissions = await db.permission.findMany();
  const permissionByKey = new Map(permissions.map((permission) => [permission.key, permission]));

  for (const preset of Object.values(ROLE_PRESETS)) {
    const role = await db.role.upsert({
      where: { key: preset.key },
      create: {
        key: preset.key,
        name: preset.name,
        description: preset.description,
        isSystem: true,
      },
      update: {
        name: preset.name,
        description: preset.description,
        isSystem: true,
      },
    });

    await db.rolePermission.deleteMany({ where: { roleId: role.id } });

    const permissionIds = preset.permissions
      .map((key) => permissionByKey.get(key)?.id)
      .filter((id): id is string => Boolean(id));

    if (permissionIds.length > 0) {
      await db.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({
          roleId: role.id,
          permissionId,
        })),
      });
    }
  }
}

// TODO(PLAKY-AUTH): PLAKY-AUTH-004 - implement the seeded Super Admin account.
async function seedAdmin() {
  const existingUsers = await db.user.count();
  if (existingUsers > 0) {
    return;
  }

  const role = await db.role.findUnique({ where: { key: "super_admin" } });
  if (!role) {
    throw new Error('Missing "super_admin" role. Seed roles before the admin account.');
  }

  const passwordHash = await hashPassword("Admin123!");
  const admin = await db.user.create({
    data: {
      name: "Super Admin",
      email: "admin@alumni.local",
      passwordHash,
      emailVerified: true,
      status: "active",
    },
  });

  await db.userRole.create({
    data: {
      userId: admin.id,
      roleId: role.id,
    },
  });
}

// TODO(PLAKY-INTEGRATIONS): PLAKY-INT-001 - implement default integration settings seeding.
async function seedIntegrations() {
  for (const key of INTEGRATION_KEYS) {
    await db.integrationSetting.upsert({
      where: { key },
      create: { key, enabled: true, notes: "" },
      update: {},
    });
  }
}

// TODO(PLAKY-PLATFORM): PLAKY-DB-007 - implement the soft-delete backfill.
async function backfillDeletedAt() {
  // Optional MongoDB backfill; skipped when collections are already consistent.
}

// TODO(PLAKY-ACADEMIC): PLAKY-ACAD-001 - implement sample academic structure seeding.
async function seedAcademicStructure() {
  const it = await db.department.upsert({
    where: { code: "IT" },
    create: {
      code: "IT",
      name: "Information Technology",
      description: "Computing and information systems programs.",
    },
    update: {
      name: "Information Technology",
      description: "Computing and information systems programs.",
      deletedAt: null,
    },
  });

  const educ = await db.department.upsert({
    where: { code: "EDUC" },
    create: {
      code: "EDUC",
      name: "Education",
      description: "Teacher education programs.",
    },
    update: {
      name: "Education",
      description: "Teacher education programs.",
      deletedAt: null,
    },
  });

  const bsit = await db.program.upsert({
    where: { departmentId_code: { departmentId: it.id, code: "BSIT" } },
    create: {
      code: "BSIT",
      name: "Bachelor of Science in Information Technology",
      departmentId: it.id,
    },
    update: {
      name: "Bachelor of Science in Information Technology",
      deletedAt: null,
    },
  });

  const bsed = await db.program.upsert({
    where: { departmentId_code: { departmentId: educ.id, code: "BSED" } },
    create: {
      code: "BSED",
      name: "Bachelor of Secondary Education",
      departmentId: educ.id,
    },
    update: {
      name: "Bachelor of Secondary Education",
      deletedAt: null,
    },
  });

  const facultyA = await db.faculty.upsert({
    where: { employeeNumber: "FAC-001" },
    create: {
      employeeNumber: "FAC-001",
      firstName: "Ana",
      lastName: "Reyes",
      email: "ana.reyes@alumni.local",
    },
    update: {
      firstName: "Ana",
      lastName: "Reyes",
      email: "ana.reyes@alumni.local",
      deletedAt: null,
    },
  });

  const facultyB = await db.faculty.upsert({
    where: { employeeNumber: "FAC-002" },
    create: {
      employeeNumber: "FAC-002",
      firstName: "Ben",
      lastName: "Santos",
      email: "ben.santos@alumni.local",
    },
    update: {
      firstName: "Ben",
      lastName: "Santos",
      email: "ben.santos@alumni.local",
      deletedAt: null,
    },
  });

  await db.facultyDepartment.upsert({
    where: {
      facultyId_departmentId: { facultyId: facultyA.id, departmentId: it.id },
    },
    create: { facultyId: facultyA.id, departmentId: it.id },
    update: {},
  });

  await db.facultyDepartment.upsert({
    where: {
      facultyId_departmentId: { facultyId: facultyB.id, departmentId: educ.id },
    },
    create: { facultyId: facultyB.id, departmentId: educ.id },
    update: {},
  });

  return { bsit, bsed };
}

// TODO(PLAKY-ALUMNI): PLAKY-ALUM-001 - implement sample alumni seeding.
async function seedAlumni(_programIds: { bsit: string; bsed: string }) {
  // TODO(PLAKY-ALUM-001 - create sample alumni records with contact info, employment
  // status, and mixed isTracked values so the dashboard has non-zero counts.
  void _programIds;
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
