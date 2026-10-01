import type { Context as ApiContext, IntegrationEnv } from "@Alumni-Tracking-Ss/api/context";
import { loadAuthUserFromToken } from "@Alumni-Tracking-Ss/api/server-utils";
import type { Context as HonoContext } from "hono";
import { getCookie } from "hono/cookie";

import { db } from "./services";

// Per-request wiring: Hono request -> oRPC Context.
//
// createContext() is called once by the catch-all middleware in ./index and its result is
// handed to both the RPC handler and the OpenAPI handler. Raw routes below the middleware
// read the same values through the module-level helpers in this file.

// Name of the session cookie. Keep in sync with the cookie the login routes write and with
// docs/system/installation.md.
// TODO(PLAKY-AUTH): PLAKY-AUTH-016 - keep the cookie name stable across the shadow repo.
export const SESSION_COOKIE = "ats_session";

export type CreateContextOptions = {
  context: HonoContext;
};

// TODO(PLAKY-PLATFORM): PLAKY-SRV-002 - treat blank strings as absent so an empty
// .env value reads as "not configured" and the module falls back.
function envString(key: string) {
  const value = process.env[key];
  return value && value.trim().length > 0 ? value : undefined;
}

/**
 * Reads the integration credentials straight from process.env rather than from the varlock
 * ENV object, because most of them are optional and the modules must degrade when absent.
 * TODO(PLAKY-INTEGRATIONS): PLAKY-INT-015 - every key added here must exist in
 * IntegrationEnv (packages/api/src/context.ts) and in apps/server/.env.schema.
 */
export function readIntegrationEnv(): IntegrationEnv {
  throw new Error("TODO(PLAKY-INT-015): implement readIntegrationEnv");
}

/**
 * Bearer header first, then the session cookie. The bearer path exists so the OpenAPI
 * reference handler can be called with a token.
 * TODO(PLAKY-AUTH): PLAKY-AUTH-017 - implement token extraction.
 */
export function readSessionToken(c: HonoContext) {
  void getCookie;
  void c;
  throw new Error("TODO(PLAKY-AUTH-017): implement readSessionToken");
}

/**
 * Builds the oRPC Context for one request: the shared Prisma client, the resolved session
 * token and AuthUser, the client IP / user agent, and the integration credentials.
 * TODO(PLAKY-AUTH): PLAKY-AUTH-018 - implement createContext.
 */
export async function createContext(options: CreateContextOptions): Promise<ApiContext> {
  void envString;
  void loadAuthUserFromToken;
  void db;
  void options;
  throw new Error("TODO(PLAKY-AUTH-018): implement createContext");
}

export type Context = Awaited<ReturnType<typeof createContext>>;