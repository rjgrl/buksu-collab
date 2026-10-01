import { z } from "zod";

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

  // TODO(PLAKY-ACAD-003 - create with an upper-cased code, then write an audit entry.
  create: requirePermission("departments.write")
    .input(departmentInputSchema)
    .handler(async () => {
      throw new Error("TODO(PLAKY-ACAD-003): implement departments.create");
    }),

  // TODO(PLAKY-ACAD-003 - update by id, then write an audit entry.
  update: requirePermission("departments.write")
    .input(departmentInputSchema.extend({ id: z.string() }))
    .handler(async () => {
      throw new Error("TODO(PLAKY-ACAD-003): implement departments.update");
    }),

  // TODO(PLAKY-ACAD-003 - soft delete (set deletedAt), then write an audit entry.
  delete: requirePermission("departments.delete")
    .input(z.object({ id: z.string() }))
    .handler(async () => {
      throw new Error("TODO(PLAKY-ACAD-003): implement departments.delete");
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