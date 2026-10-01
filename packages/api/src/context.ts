import type { Database } from "@Alumni-Tracking-Ss/db";
import type { PermissionKey } from "@Alumni-Tracking-Ss/db";

// Shared request-scoped types for the whole API layer.
// apps/server/src/context.ts builds a value of `Context` per request and passes it to both
// the oRPC handler and the OpenAPI handler, so these shapes are the transport contract.

// TODO(PLAKY-RBAC): PLAKY-RBAC-008 - implement loadAuthUser() in
// packages/api/src/services/session.ts to produce this shape.
export type AuthUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  status: "active" | "disabled";
  roles: string[];
  permissions: PermissionKey[];
};

// TODO(PLAKY-INTEGRATIONS): PLAKY-INT-002 - every key must map to a variable in
// apps/server/.env.schema and to an entry in INTEGRATION_KEYS.
export type IntegrationEnv = {
  recaptchaSecretKey?: string;
  recaptchaSiteKey?: string;
  googleClientId?: string;
  googleClientSecret?: string;
  googleServiceAccountJson?: string;
  googleDriveFolderId?: string;
  googleSheetsSpreadsheetId?: string;
  googleFormsWebhookSecret?: string;
  smtpUrl?: string;
  smtpFrom?: string;
  imgbbApiKey?: string;
  imageHostProvider?: string;
  uploadDir?: string;
  appUrl?: string;
};

export type Context = {
  db: Database;
  sessionToken: string | null;
  user: AuthUser | null;
  ipAddress: string | null;
  userAgent: string | null;
  integrationEnv: IntegrationEnv;
};