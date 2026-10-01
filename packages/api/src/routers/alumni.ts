import { z } from "zod";

import { requirePermission } from "../index";
import { alumniInputSchema, employmentInputSchema, trackingInputSchema } from "../validation";

// Alumni profile module: student details, contact info, employment, and tracking.
// Tracking is a separate permission (`tracking.write`) from profile editing so that a
// data-entry role can be given one without the other - see docs/alumni-profile/*.

// TODO(PLAKY-ALUMNI): PLAKY-ALUM-003 - implement the alumni router.
export const alumniRouter = {
  // TODO(PLAKY-ALUM-003 - filters: free-text search over studentNumber/firstName/lastName/
  // personalEmail, departmentId via program relation, programId, tracked flag, graduationYear.
  // Must compose every clause through withNotDeleted() so search OR cannot drop the filter.
  list: requirePermission("alumni.read")
    .input(
      z
        .object({
          search: z.string().optional(),
          departmentId: z.string().optional(),
          programId: z.string().optional(),
          tracked: z.enum(["all", "tracked", "untracked"]).optional(),
          graduationYear: z.number().int().optional(),
        })
        .optional(),
    )
    .handler(async () => {
      throw new Error("TODO(PLAKY-ALUM-003): implement alumni.list");
    }),

  // TODO(PLAKY-ALUM-003 - load one profile with program + department, employments, tracking
  // events, and evidence files; throw NOT_FOUND when missing.
  get: requirePermission("alumni.read")
    .input(z.object({ id: z.string() }))
    .handler(async () => {
      throw new Error("TODO(PLAKY-ALUM-003): implement alumni.get");
    }),

  // TODO(PLAKY-ALUM-003 - validate programId (BAD_REQUEST when unknown) and reject a
  // duplicate studentNumber (CONFLICT), then write an audit entry.
  create: requirePermission("alumni.write")
    .input(alumniInputSchema)
    .handler(async () => {
      throw new Error("TODO(PLAKY-ALUM-003): implement alumni.create");
    }),

  // TODO(PLAKY-ALUM-003 - update profile and contact fields, then write an audit entry.
  update: requirePermission("alumni.write")
    .input(alumniInputSchema.extend({ id: z.string() }))
    .handler(async () => {
      throw new Error("TODO(PLAKY-ALUM-003): implement alumni.update");
    }),

  // TODO(PLAKY-ALUM-003 - soft delete (set deletedAt), then write an audit entry.
  delete: requirePermission("alumni.delete")
    .input(z.object({ id: z.string() }))
    .handler(async () => {
      throw new Error("TODO(PLAKY-ALUM-003): implement alumni.delete");
    }),

  // TODO(PLAKY-ALUM-006 - employment history. `isCurrent` must demote the previous current
  // row first so an alumnus has at most one current employment.
  addEmployment: requirePermission("alumni.write")
    .input(employmentInputSchema)
    .handler(async () => {
      throw new Error("TODO(PLAKY-ALUM-006): implement alumni.addEmployment");
    }),

  // TODO(PLAKY-ALUM-006 - hard delete of a single employment row, then an audit entry.
  deleteEmployment: requirePermission("alumni.write")
    .input(z.object({ id: z.string() }))
    .handler(async () => {
      throw new Error("TODO(PLAKY-ALUM-006): implement alumni.deleteEmployment");
    }),

  // TODO(PLAKY-ALUM-007 - tracking. Each call records a TrackingEvent, flips Alumni.isTracked,
  // and stamps lastTrackedAt. This is the write path the dashboard percentage reads.
  addTracking: requirePermission("tracking.write")
    .input(trackingInputSchema)
    .handler(async () => {
      throw new Error("TODO(PLAKY-ALUM-007): implement alumni.addTracking");
    }),
};