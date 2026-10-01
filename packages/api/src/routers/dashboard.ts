import { z } from "zod";

import { requirePermission } from "../index";

// Aggregated module: dashboard statistics, reports/exports, integration management,
// audit log, and evidence file removal. Kept in one file because the source system groups
// these in the "operations" surface; the permission keys remain separate.

// TODO(PLAKY-DASHBOARD): PLAKY-DASH-002 - implement the dashboard summary.
// Contract: graduates / tracked / untracked / percentTracked overall plus a per-department
// breakdown, filtered by departmentId. `percentTracked` comes from @Alumni-Tracking-Ss/db.
export const dashboardRouter = {
  summary: requirePermission("dashboard.read")
    .input(z.object({ departmentId: z.string().optional() }).optional())
    .handler(async () => {
      throw new Error("TODO(PLAKY-DASH-002): implement dashboard.summary");
    }),
};

// TODO(PLAKY-REPORTS): PLAKY-REPT-002 - implement report exports.
export const reportsRouter = {
  // TODO(PLAKY-REPT-002 - build a CSV via toCsv() over alumni rows joined to program and
  // department, honouring the tracked filter; return { csv, fileName, count }.
  alumniCsv: requirePermission("reports.export")
    .input(
      z
        .object({
          departmentId: z.string().optional(),
          tracked: z.enum(["all", "tracked", "untracked"]).optional(),
        })
        .optional(),
    )
    .handler(async () => {
      throw new Error("TODO(PLAKY-REPT-002): implement reports.alumniCsv");
    }),
};

// TODO(PLAKY-INTEGRATIONS): PLAKY-INT-004 - implement integration management.
export const integrationsRouter = {
  // TODO(PLAKY-INT-004 - return listIntegrations(db, env): per key, whether it is enabled in
  // the database, whether credentials are configured, and the resulting mode
  // (live | fallback | disabled).
  list: requirePermission("integrations.read").handler(async () => {
    throw new Error("TODO(PLAKY-INT-004): implement integrations.list");
  }),

  // TODO(PLAKY-INT-004 - upsert IntegrationSetting by key, then write an audit entry.
  toggle: requirePermission("integrations.write")
    .input(z.object({ key: z.string(), enabled: z.boolean() }))
    .handler(async () => {
      throw new Error("TODO(PLAKY-INT-004): implement integrations.toggle");
    }),

  // TODO(PLAKY-INT-004 - send a fixed test message through the SMTP integration.
  sendTestEmail: requirePermission("integrations.write")
    .input(z.object({ to: z.string().email() }))
    .handler(async () => {
      throw new Error("TODO(PLAKY-INT-004): implement integrations.sendTestEmail");
    }),

  // TODO(PLAKY-INT-004 - send a message to one alumnus; BAD_REQUEST when they have no
  // personal email.
  notifyAlumni: requirePermission("integrations.write")
    .input(z.object({ alumniId: z.string(), subject: z.string(), text: z.string() }))
    .handler(async () => {
      throw new Error("TODO(PLAKY-INT-004): implement integrations.notifyAlumni");
    }),

  // TODO(PLAKY-INT-005 - parse the CSV, run importAlumniRows, and record an ImportJob with
  // source "csv" plus the per-row errors.
  importCsv: requirePermission("integrations.write")
    .input(z.object({ csv: z.string().min(1) }))
    .handler(async () => {
      throw new Error("TODO(PLAKY-INT-005): implement integrations.importCsv");
    }),

  // TODO(PLAKY-INT-005 - read the configured Google Sheet, map header rows to objects, run
  // importAlumniRows, and record an ImportJob with source "google_sheets".
  importSheets: requirePermission("integrations.write").handler(async () => {
    throw new Error("TODO(PLAKY-INT-005): implement integrations.importSheets");
  }),

  // TODO(PLAKY-REPT-003 - append the alumni roster to Google Sheets; requires reports.export.
  exportSheets: requirePermission("reports.export").handler(async () => {
    throw new Error("TODO(PLAKY-REPT-003): implement integrations.exportSheets");
  }),
};

// TODO(PLAKY-AUDIT): PLAKY-AUD-002 - implement the audit log reader.
export const auditRouter = {
  // TODO(PLAKY-AUD-002 - newest-first page of AuditLog rows with the actor's id/name/email,
  // optional search over action/entity/summary, capped at 200 rows.
  list: requirePermission("audit.read")
    .input(z.object({ search: z.string().optional() }).optional())
    .handler(async () => {
      throw new Error("TODO(PLAKY-AUD-002): implement audit.list");
    }),
};

// TODO(PLAKY-FILES): PLAKY-FILE-002 - implement evidence removal.
// Upload and download live in apps/server as raw multipart/binary Hono routes; this router
// only owns the soft delete.
export const filesRouter = {
  // TODO(PLAKY-FILE-002 - set deletedAt on the EvidenceFile, then write an audit entry.
  remove: requirePermission("files.delete")
    .input(z.object({ id: z.string() }))
    .handler(async () => {
      throw new Error("TODO(PLAKY-FILE-002): implement files.remove");
    }),
};