import type { Database } from "@Alumni-Tracking-Ss/db";

import type { IntegrationEnv } from "../context";

// Integration registry.
//
// Every third-party capability in the system is a "module" behind this registry. A module
// has three independent switches that combine into a `mode`:
//   enabled     - the administrator's toggle, stored in IntegrationSetting
//   configured  - the required environment variables are present
//   mode        - live (both), fallback (enabled but not configured), disabled (off)
//
// Adding a module means: add its key here, add its env keys to IntegrationEnv
// (packages/api/src/context.ts), add them to apps/server/.env.schema and to
// readIntegrationEnv() in apps/server/src/context.ts, add a case to isConfigured(), and
// add a fallback line to summarize(). Then seed the row in packages/db/src/seed.ts.

// TODO(PLAKY-INTEGRATIONS): PLAKY-INT-006 - extend this list as modules land in Plaky.
export const INTEGRATION_KEYS = [
  "recaptcha",
  "google_auth",
  "google_drive",
  "email",
  "image_host",
  "google_forms",
  "google_sheets",
] as const;

export type IntegrationKey = (typeof INTEGRATION_KEYS)[number];

export type IntegrationStatus = {
  key: IntegrationKey;
  enabled: boolean;
  configured: boolean;
  mode: "live" | "fallback" | "disabled";
  summary: string;
};

// TODO(PLAKY-INT-006 - read IntegrationSetting rows, then map every key in INTEGRATION_KEYS
// to an IntegrationStatus. A key with no stored row defaults to enabled = true.
export async function listIntegrations(db: Database, env: IntegrationEnv): Promise<IntegrationStatus[]> {
  void db;
  void env;
  // TODO(PLAKY-INT-006 - each entry is built from isConfigured(key, env) and summarize(key, mode).
  void isConfigured;
  void summarize;
  throw new Error("TODO(PLAKY-INT-006): implement listIntegrations");
}

// TODO(PLAKY-INT-006 - declarative contract: which env keys make each module "configured".
// This mapping is also the checklist each module's docs page is written against.
export function isConfigured(key: IntegrationKey, env: IntegrationEnv) {
  switch (key) {
    case "recaptcha":
      return Boolean(env.recaptchaSecretKey);
    case "google_auth":
      return Boolean(env.googleClientId && env.googleClientSecret);
    case "google_drive":
      return Boolean(env.googleServiceAccountJson);
    case "email":
      return Boolean(env.smtpUrl);
    case "image_host":
      return Boolean(env.imgbbApiKey || env.googleServiceAccountJson);
    case "google_forms":
      return Boolean(env.googleFormsWebhookSecret);
    case "google_sheets":
      return Boolean(env.googleServiceAccountJson && env.googleSheetsSpreadsheetId);
    default:
      return false;
  }
}

// TODO(PLAKY-INT-006 - user-facing status copy. The `fallback` lines are the contractual
// behaviour the system degrades to when a module is not configured.
function summarize(key: IntegrationKey, mode: IntegrationStatus["mode"]) {
  const fallbacks: Record<IntegrationKey, string> = {
    recaptcha: "Local checkbox on login/signup",
    google_auth: "Email and password sign-in only",
    google_drive: "Local disk evidence storage",
    email: "Messages written to the server log",
    image_host: "Local disk image storage",
    google_forms: "Signed webhook still accepted in development without a secret",
    google_sheets: "CSV import and export",
  };

  if (mode === "disabled") {
    return "Turned off in Settings";
  }

  if (mode === "live") {
    return "Using live credentials";
  }

  return fallbacks[key];
}

// TODO(PLAKY-INT-006 - single-module check used by the auth and webhook paths. A missing
// row means enabled, matching the seed defaults.
export async function isIntegrationEnabled(db: Database, key: IntegrationKey) {
  throw new Error("TODO(PLAKY-INT-006): implement isIntegrationEnabled");
}