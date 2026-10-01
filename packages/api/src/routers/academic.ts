import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { withNotDeleted } from "@Alumni-Tracking-Ss/db";

import { writeAudit } from "../audit";
import { requirePermission } from "../index";
import { departmentInputSchema, facultyInputSchema, programInputSchema } from "../validation";

// Academic structure module: Department <- Program, Department <- Faculty.
// Every procedure is guarded by requirePermission, so the permission key below is the
// compliance surface for this module (see docs/academic-structure/*).

// TODO(PLAKY-ACADEMIC): PLAKY-ACAD-003 - implement the departments router.
export const departmentsRouter = {
  // TODO(PLAKY-ACAD-003 - list with optional case-insensitive search on name/code,
  // soft-delete filter, `_count` of programs and faculty, ordered by name.
  list: requirePermission("departments.read")
    .input(z.object({ search: z.string().optional() }).optional())
    .handler(async ({ context, input }) => {
      const search = input?.search?.trim();
      const searchFilter = search
        ? {
            OR: [
              { name: { contains: search } },
              { code: { contains: search } },
              { name: { contains: search.toUpperCase() } },
              { code: { contains: search.toUpperCase() } },
              { name: { contains: search.toLowerCase() } },
              { code: { contains: search.toLowerCase() } },
            ],
          }
        : undefined;

      return context.db.department.findMany({
        where: withNotDeleted(searchFilter),
        orderBy: { name: "asc" },
        include: {
          _count: {
            select: {
              programs: { where: withNotDeleted() },
              facultyDepartments: true,
            },
          },
        },
      });
    }),

  // TODO(PLAKY-ACAD-003 - load one department with its programs and faculty assignments;
  // throw NOT_FOUND when missing.
  get: requirePermission("departments.read")
    .input(z.object({ id: z.string() }))
    .handler(async ({ context, input }) => {
      const department = await context.db.department.findFirst({
        where: withNotDeleted({ id: input.id }),
        include: {
          programs: {
            where: withNotDeleted(),
            orderBy: { name: "asc" },
          },
          facultyDepartments: {
            include: {
              faculty: true,
            },
            orderBy: { createdAt: "asc" },
          },
        },
      });

      if (!department) {
        throw new ORPCError("NOT_FOUND", { message: "Department not found." });
      }

      return {
        ...department,
        faculties: department.facultyDepartments
          .map((row) => row.faculty)
          .filter((faculty) => !faculty.deletedAt),
      };
    }),

  // TODO(PLAKY-ACAD-003 - create with an upper-cased code, then write an audit entry.
  create: requirePermission("departments.write")
    .input(departmentInputSchema)
    .handler(async ({ context, input }) => {
      const code = input.code.trim().toUpperCase();
      const existing = await context.db.department.findUnique({ where: { code } });
      if (existing) {
        throw new ORPCError("CONFLICT", {
          message: `Department code "${code}" is already in use.`,
        });
      }

      const department = await context.db.department.create({
        data: {
          code,
          name: input.name.trim(),
          description: input.description?.trim() ?? "",
        },
      });

      await writeAudit(context.db, {
        actorId: context.user.id,
        action: "departments.create",
        entity: "department",
        entityId: department.id,
        summary: `Created department ${department.code}`,
        ipAddress: context.ipAddress,
      });

      return department;
    }),

  // TODO(PLAKY-ACAD-003 - update by id, then write an audit entry.
  update: requirePermission("departments.write")
    .input(departmentInputSchema.extend({ id: z.string() }))
    .handler(async ({ context, input }) => {
      const current = await context.db.department.findFirst({
        where: withNotDeleted({ id: input.id }),
      });
      if (!current) {
        throw new ORPCError("NOT_FOUND", { message: "Department not found." });
      }

      const code = input.code.trim().toUpperCase();
      if (code !== current.code) {
        const clash = await context.db.department.findUnique({ where: { code } });
        if (clash) {
          throw new ORPCError("CONFLICT", {
            message: `Department code "${code}" is already in use.`,
          });
        }
      }

      const department = await context.db.department.update({
        where: { id: input.id },
        data: {
          code,
          name: input.name.trim(),
          description: input.description?.trim() ?? "",
        },
      });

      await writeAudit(context.db, {
        actorId: context.user.id,
        action: "departments.update",
        entity: "department",
        entityId: department.id,
        summary: `Updated department ${department.code}`,
        ipAddress: context.ipAddress,
      });

      return department;
    }),

  // TODO(PLAKY-ACAD-003 - soft delete (set deletedAt), then write an audit entry.
  delete: requirePermission("departments.delete")
    .input(z.object({ id: z.string() }))
    .handler(async ({ context, input }) => {
      const current = await context.db.department.findFirst({
        where: withNotDeleted({ id: input.id }),
      });
      if (!current) {
        throw new ORPCError("NOT_FOUND", { message: "Department not found." });
      }

      const department = await context.db.department.update({
        where: { id: input.id },
        data: { deletedAt: new Date() },
      });

      await writeAudit(context.db, {
        actorId: context.user.id,
        action: "departments.delete",
        entity: "department",
        entityId: department.id,
        summary: `Soft-deleted department ${department.code}`,
        ipAddress: context.ipAddress,
      });

      return { ok: true as const };
    }),
};

// TODO(PLAKY-ACADEMIC): PLAKY-ACAD-004 - implement the programs router.
// Programs are always owned by a department; `create` must reject an unknown departmentId
// with BAD_REQUEST.
export const programsRouter = {
  list: requirePermission("programs.read")
    .input(z.object({ search: z.string().optional(), departmentId: z.string().optional() }).optional())
    .handler(async () => {
      throw new Error("TODO(PLAKY-ACAD-004): implement programs.list");
    }),

  create: requirePermission("programs.write")
    .input(programInputSchema)
    .handler(async () => {
      throw new Error("TODO(PLAKY-ACAD-004): implement programs.create");
    }),

  update: requirePermission("programs.write")
    .input(programInputSchema.extend({ id: z.string() }))
    .handler(async () => {
      throw new Error("TODO(PLAKY-ACAD-004): implement programs.update");
    }),

  delete: requirePermission("programs.delete")
    .input(z.object({ id: z.string() }))
    .handler(async () => {
      throw new Error("TODO(PLAKY-ACAD-004): implement programs.delete");
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