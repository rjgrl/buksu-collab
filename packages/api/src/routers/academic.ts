import { ORPCError } from "@orpc/server";
import type { Database } from "@Alumni-Tracking-Ss/db";
import { withNotDeleted } from "@Alumni-Tracking-Ss/db";
import { z } from "zod";

import { writeAudit } from "../audit";
import { requirePermission } from "../index";
import { departmentInputSchema, facultyInputSchema, programInputSchema } from "../validation";

function normalizeCode(code: string) {
  return code.toUpperCase();
}

function prismaCode(error: unknown) {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return null;
  }
  const code = (error as { code: unknown }).code;
  return typeof code === "string" ? code : null;
}

function isInvalidObjectId(error: unknown) {
  return prismaCode(error) === "P2023";
}

async function findActiveDepartment(db: Database, id: string) {
  try {
    return await db.department.findFirst({
      where: withNotDeleted({ id }),
    });
  } catch (error) {
    if (isInvalidObjectId(error)) {
      return null;
    }
    throw error;
  }
}

async function findActiveProgram(db: Database, id: string) {
  try {
    return await db.program.findFirst({
      where: withNotDeleted({ id }),
    });
  } catch (error) {
    if (isInvalidObjectId(error)) {
      return null;
    }
    throw error;
  }
}

async function requireActiveDepartment(db: Database, departmentId: string) {
  const department = await findActiveDepartment(db, departmentId);
  if (!department) {
    throw new ORPCError("BAD_REQUEST", { message: "Unknown department." });
  }
  return department;
}

// Academic structure module: Department <- Program, Department <- Faculty.
// Every procedure is guarded by requirePermission, so the permission key below is the
// compliance surface for this module (see docs/academic-structure/*).

// TODO(PLAKY-ACADEMIC): PLAKY-ACAD-003 - departments.list and departments.get are still open.
export const departmentsRouter = {
  // TODO(PLAKY-ACAD-003 - list with optional case-insensitive search on name/code,
  // soft-delete filter, `_count` of programs and faculty, ordered by name.
  list: requirePermission("departments.read")
    .input(z.object({ search: z.string().optional() }).optional())
    .handler(async () => {
      throw new Error("TODO(PLAKY-ACAD-003): implement departments.list");
    }),

  // TODO(PLAKY-ACAD-003 - load one department with its programs and faculty assignments;
  // throw NOT_FOUND when missing.
  get: requirePermission("departments.read")
    .input(z.object({ id: z.string() }))
    .handler(async () => {
      throw new Error("TODO(PLAKY-ACAD-003): implement departments.get");
    }),

  // Create with an upper-cased code, then write an audit entry.
  create: requirePermission("departments.write")
    .input(departmentInputSchema)
    .handler(async ({ input, context }) => {
      const code = normalizeCode(input.code);
      try {
        const department = await context.db.department.create({
          data: {
            code,
            name: input.name,
            description: input.description ?? "",
            deletedAt: null,
          },
        });

        await writeAudit(context.db, {
          actorId: context.user.id,
          action: "create",
          entity: "Department",
          entityId: department.id,
          summary: `Created department ${department.code} (${department.name}).`,
          metadata: {
            code: department.code,
            name: department.name,
            description: department.description,
          },
          ipAddress: context.ipAddress,
        });

        return department;
      } catch (error) {
        if (prismaCode(error) === "P2002") {
          throw new ORPCError("CONFLICT", {
            message: "A department with this code already exists.",
          });
        }
        throw error;
      }
    }),

  // Update code, name, or description by id, then write an audit entry.
  update: requirePermission("departments.write")
    .input(departmentInputSchema.extend({ id: z.string() }))
    .handler(async ({ input, context }) => {
      const existing = await findActiveDepartment(context.db, input.id);
      if (!existing) {
        throw new ORPCError("NOT_FOUND", { message: "Department not found." });
      }

      const code = normalizeCode(input.code);
      try {
        const department = await context.db.department.update({
          where: { id: existing.id },
          data: {
            code,
            name: input.name,
            description: input.description ?? existing.description,
          },
        });

        await writeAudit(context.db, {
          actorId: context.user.id,
          action: "update",
          entity: "Department",
          entityId: department.id,
          summary: `Updated department ${department.code} (${department.name}).`,
          metadata: {
            code: department.code,
            name: department.name,
            description: department.description,
          },
          ipAddress: context.ipAddress,
        });

        return department;
      } catch (error) {
        if (prismaCode(error) === "P2002") {
          throw new ORPCError("CONFLICT", {
            message: "A department with this code already exists.",
          });
        }
        throw error;
      }
    }),

  // Soft delete (set deletedAt) so the department drops out of active lists.
  delete: requirePermission("departments.delete")
    .input(z.object({ id: z.string() }))
    .handler(async ({ input, context }) => {
      const existing = await findActiveDepartment(context.db, input.id);
      if (!existing) {
        throw new ORPCError("NOT_FOUND", { message: "Department not found." });
      }

      const department = await context.db.department.update({
        where: { id: existing.id },
        data: { deletedAt: new Date() },
      });

      await writeAudit(context.db, {
        actorId: context.user.id,
        action: "delete",
        entity: "Department",
        entityId: department.id,
        summary: `Soft-deleted department ${existing.code} (${existing.name}).`,
        metadata: { code: existing.code, name: existing.name },
        ipAddress: context.ipAddress,
      });

      return department;
    }),
};

// TODO(PLAKY-ACADEMIC): PLAKY-ACAD-004 - programs.list is still open.
// Programs are always owned by a department; `create` and `update` reject an unknown
// departmentId with BAD_REQUEST.
export const programsRouter = {
  list: requirePermission("programs.read")
    .input(z.object({ search: z.string().optional(), departmentId: z.string().optional() }).optional())
    .handler(async () => {
      throw new Error("TODO(PLAKY-ACAD-004): implement programs.list");
    }),

  // Attach the program to an active department. Unknown departmentId is BAD_REQUEST.
  create: requirePermission("programs.write")
    .input(programInputSchema)
    .handler(async ({ input, context }) => {
      await requireActiveDepartment(context.db, input.departmentId);
      const code = normalizeCode(input.code);

      try {
        const program = await context.db.program.create({
          data: {
            code,
            name: input.name,
            description: input.description ?? "",
            departmentId: input.departmentId,
            deletedAt: null,
          },
        });

        await writeAudit(context.db, {
          actorId: context.user.id,
          action: "create",
          entity: "Program",
          entityId: program.id,
          summary: `Created program ${program.code} (${program.name}).`,
          metadata: {
            code: program.code,
            name: program.name,
            description: program.description,
            departmentId: program.departmentId,
          },
          ipAddress: context.ipAddress,
        });

        return program;
      } catch (error) {
        if (prismaCode(error) === "P2002") {
          throw new ORPCError("CONFLICT", {
            message: "A program with this code already exists in this department.",
          });
        }
        throw error;
      }
    }),

  // Update details or move the program to another active department.
  update: requirePermission("programs.write")
    .input(programInputSchema.extend({ id: z.string() }))
    .handler(async ({ input, context }) => {
      const existing = await findActiveProgram(context.db, input.id);
      if (!existing) {
        throw new ORPCError("NOT_FOUND", { message: "Program not found." });
      }

      await requireActiveDepartment(context.db, input.departmentId);
      const code = normalizeCode(input.code);

      try {
        const program = await context.db.program.update({
          where: { id: existing.id },
          data: {
            code,
            name: input.name,
            description: input.description ?? existing.description,
            departmentId: input.departmentId,
          },
        });

        await writeAudit(context.db, {
          actorId: context.user.id,
          action: "update",
          entity: "Program",
          entityId: program.id,
          summary: `Updated program ${program.code} (${program.name}).`,
          metadata: {
            code: program.code,
            name: program.name,
            description: program.description,
            departmentId: program.departmentId,
          },
          ipAddress: context.ipAddress,
        });

        return program;
      } catch (error) {
        if (prismaCode(error) === "P2002") {
          throw new ORPCError("CONFLICT", {
            message: "A program with this code already exists in this department.",
          });
        }
        throw error;
      }
    }),

  // Soft delete (set deletedAt) so the program drops out of active lists.
  delete: requirePermission("programs.delete")
    .input(z.object({ id: z.string() }))
    .handler(async ({ input, context }) => {
      const existing = await findActiveProgram(context.db, input.id);
      if (!existing) {
        throw new ORPCError("NOT_FOUND", { message: "Program not found." });
      }

      const program = await context.db.program.update({
        where: { id: existing.id },
        data: { deletedAt: new Date() },
      });

      await writeAudit(context.db, {
        actorId: context.user.id,
        action: "delete",
        entity: "Program",
        entityId: program.id,
        summary: `Soft-deleted program ${existing.code} (${existing.name}).`,
        metadata: {
          code: existing.code,
          name: existing.name,
          departmentId: existing.departmentId,
        },
        ipAddress: context.ipAddress,
      });

      return program;
    }),
};

// TODO(PLAKY-ACADEMIC): PLAKY-ACAD-005 - implement the faculties router.
// Faculty membership is many-to-many through FacultyDepartment; `update` must replace the
// join rows rather than append.
export const facultiesRouter = {
  list: requirePermission("faculties.read")
    .input(z.object({ search: z.string().optional() }).optional())
    .handler(async () => {
      throw new Error("TODO(PLAKY-ACAD-005): implement faculties.list");
    }),

  create: requirePermission("faculties.write")
    .input(facultyInputSchema)
    .handler(async () => {
      throw new Error("TODO(PLAKY-ACAD-005): implement faculties.create");
    }),

  update: requirePermission("faculties.write")
    .input(facultyInputSchema.extend({ id: z.string() }))
    .handler(async () => {
      throw new Error("TODO(PLAKY-ACAD-005): implement faculties.update");
    }),

  delete: requirePermission("faculties.delete")
    .input(z.object({ id: z.string() }))
    .handler(async () => {
      throw new Error("TODO(PLAKY-ACAD-005): implement faculties.delete");
    }),
};