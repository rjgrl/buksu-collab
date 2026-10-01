// Server-only barrel for the API package.
//
// apps/server/src/index.ts imports exclusively from this entry point so the oRPC router
// tree (which also runs in the browser bundle) never pulls in node-only code such as
// fs/promises, node:crypto, or the Prisma client.
//
// Keep the export list in sync with the files listed below.
//   ./services/session    - auth + session lifecycle
//   ./integrations/files  - evidence storage providers
//   ./integrations/registry - integration toggle + configuration status
//   ./integrations/forms  - Google Forms payload mapping
//   ./integrations/recaptcha - reCAPTCHA verification
//   ./integrations/sheets - Google Sheets read/append
//   ./integrations/email  - SMTP send
//   ./services/importer   - bulk alumni import
//   ./audit               - audit trail writes
export { loadAuthUser, loadAuthUserFromToken, createSession, destroySession, authenticateWithPassword, registerUser, upsertGoogleUser } from "./services/session";
export { ALLOWED_EVIDENCE_TYPES, MAX_EVIDENCE_BYTES, storeFile } from "./integrations/files";
export { isIntegrationEnabled } from "./integrations/registry";
export { mapFormPayload } from "./integrations/forms";
export { importAlumniRows } from "./services/importer";
export { writeAudit } from "./audit";
export { verifyRecaptcha } from "./integrations/recaptcha";