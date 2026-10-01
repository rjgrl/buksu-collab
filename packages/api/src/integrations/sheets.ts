import type { IntegrationEnv } from "../context";

import { googleAccessToken } from "./files";

// Google Sheets import/export. Both directions reuse the service-account token minted by
// googleAccessToken() in ./files, so there is one JWT implementation for both modules.

// TODO(PLAKY-INTEGRATIONS): PLAKY-INT-010 - implement Google Sheets writes.
// Contract: mint a token with the spreadsheets scope, then POST a values:append request to
// the spreadsheet id in IntegrationEnv. Throws when the module is not configured.
export async function appendSheetRows(
  env: IntegrationEnv,
  rows: string[][],
): Promise<{ updatedRows: number }> {
  void env;
  void rows;
  void googleAccessToken;
  throw new Error("TODO(PLAKY-INT-010): implement appendSheetRows");
}

// TODO(PLAKY-INT-010 - implement Google Sheets reads.
// Contract: GET the first sheet's A:Z range and return the raw value matrix; an empty
// spreadsheet must resolve to an empty array rather than throwing, because the importer
// treats row 0 as the header.
export async function readSheetRows(env: IntegrationEnv): Promise<string[][]> {
  void env;
  void googleAccessToken;
  throw new Error("TODO(PLAKY-INT-010): implement readSheetRows");
}