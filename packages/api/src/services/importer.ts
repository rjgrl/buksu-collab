import type { Database } from "@Alumni-Tracking-Ss/db";
import { withNotDeleted } from "@Alumni-Tracking-Ss/db";

import { alumniImportRowSchema } from "../validation";

// Bulk alumni import shared by three callers:
//   - integrations.importCsv   (uploaded file)
//   - integrations.importSheets (Google Sheets)
//   - POST /api/integrations/google-forms/webhook (one submission at a time)
//
// The result shape is written straight into an ImportJob row, so
// { totalRows, successCount, errorCount, errors } must stay stable.

// TODO(PLAKY-INTEGRATIONS): PLAKY-INT-014 - implement the batch importer.
// Contract: validate each row with alumniImportRowSchema.safeParse, record per-row failures
// as { row: <1-based index>, message } and keep processing, never aborting the batch.
export async function importAlumniRows(
  db: Database,
  rows: unknown[],
  options: { markTrackedFromRow?: boolean } = {},
) {
  void db;
  void rows;
  void options;
  void alumniImportRowSchema;
  void withNotDeleted;
  throw new Error("TODO(PLAKY-INT-014): implement importAlumniRows");
}

// TODO(PLAKY-INT-014 - implement `upsertImportedAlumni(db, row, markTrackedFromRow)`:
// resolve departmentCode then programCode (both must exist and the program must belong to
// the department), then upsert on the unique studentNumber. When markTrackedFromRow is
// true a row that says isTracked also stamps lastTrackedAt.