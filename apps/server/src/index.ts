import { appRouter } from "@Alumni-Tracking-Ss/api/routers/index";
import {
  ALLOWED_EVIDENCE_TYPES,
  MAX_EVIDENCE_BYTES,
  authenticateWithPassword,
  createSession,
  destroySession,
  importAlumniRows,
  isIntegrationEnabled,
  loadAuthUser,
  loadAuthUserFromToken,
  mapFormPayload,
  registerUser,
  storeFile,
  upsertGoogleUser,
  verifyRecaptcha,
  writeAudit,
} from "@Alumni-Tracking-Ss/api/server-utils";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ORPCError, onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { withNotDeleted } from "@Alumni-Tracking-Ss/db";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import type { Context as HonoContext } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import { SESSION_COOKIE, createContext, readIntegrationEnv, readSessionToken } from "./context";
import { ENV } from "./env.server";
import { db } from "./services";

// Server entry point.
//
// Route layout (Hono, matched top to bottom):
//   middleware          logger, CORS, then the RPC/OpenAPI dispatcher
//   POST /api/auth/*    login, signup, logout, google, google/callback   (raw, sets cookies)
//   POST /api/files/evidence   multipart upload                          (raw)
//   GET  /api/files/:id        binary or redirect download               (raw)
//   POST /api/integrations/google-forms/webhook                          (raw, secret header)
//   /rpc                      oRPC RPC handler   (the browser data path)
//   /api-reference            OpenAPI handler + docs UI
//   GET /                     liveness text
//
// The raw routes above exist because cookies, multipart bodies, and binary responses do
// not fit the oRPC JSON contract. Permission checks for those routes are enforced inline;
// note that files.read / files.write are enforced here rather than in packages/api, which
// is why they are excluded from the catalog-coverage test in packages/api/src/rbac.test.ts.

const app = new Hono();
const isProduction = ENV.NODE_ENV === "production";

app.use(logger());

// TODO(PLAKY-PLATFORM): PLAKY-SRV-003 - CORS policy. The browser origin comes from
// CORS_ORIGIN and credentials must stay enabled because auth rides on a cookie.
app.use(
  "/*",
  cors({
    origin: ENV.CORS_ORIGIN,
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

/** Session cookie flags. `secure` follows NODE_ENV; SameSite is Lax. */
// TODO(PLAKY-AUTH): PLAKY-AUTH-019 - implement cookieOptions and reuse it for every
// setCookie call so login, signup, and the Google callback cannot drift apart.
function cookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "Lax" as const,
    secure: isProduction,
    expires: expiresAt,
  };
}

function clientMeta(c: HonoContext) {
  const forwarded = c.req.header("x-forwarded-for");
  const ipAddress = forwarded?.split(",")[0]?.trim() || c.req.header("x-real-ip") || null;
  return {
    ipAddress,
    userAgent: c.req.header("user-agent") ?? null,
  };
}

function orpcStatus(code: string): number {
  switch (code) {
    case "BAD_REQUEST":
      return 400;
    case "UNAUTHORIZED":
      return 401;
    case "FORBIDDEN":
      return 403;
    case "NOT_FOUND":
      return 404;
    case "CONFLICT":
      return 409;
    default:
      return 500;
  }
}

function authErrorResponse(c: HonoContext, error: unknown, fallbackStatus = 400) {
  if (error instanceof ORPCError) {
    return c.json({ error: error.message }, orpcStatus(error.code));
  }
  if (error instanceof Error) {
    return c.json({ error: error.message }, fallbackStatus);
  }
  return c.json({ error: "Request failed." }, fallbackStatus);
}

async function gateRecaptcha(
  c: HonoContext,
  body: { recaptchaToken?: string; recaptchaFallback?: boolean },
) {
  if (!(await isIntegrationEnabled(db, "recaptcha"))) {
    return;
  }

  const env = readIntegrationEnv();
  const live = Boolean(env.recaptchaSecretKey);
  const result = await verifyRecaptcha(env, {
    token: body.recaptchaToken,
    fallback: !live && Boolean(body.recaptchaFallback),
  });

  if (!result.ok) {
    throw new ORPCError("BAD_REQUEST", { message: "reCAPTCHA verification failed." });
  }
}

// TODO(PLAKY-AUTH): PLAKY-AUTH-020 - implement currentUser for the raw file routes.
async function currentUser(c: Parameters<typeof readSessionToken>[0]) {
  return loadAuthUserFromToken(db, readSessionToken(c));
}

/** OpenAPI handler with a generated reference document, served under /api-reference. */
// TODO(PLAKY-PLATFORM): PLAKY-SRV-004 - keep both handlers built from the same appRouter.
export const apiHandler = new OpenAPIHandler(appRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()],
    }),
  ],
  interceptors: [
    onError((error) => {
      console.error(error);
    }),
  ],
});

/** oRPC RPC handler, the transport the browser client in apps/web actually calls. */
export const rpcHandler = new RPCHandler(appRouter, {
  interceptors: [
    onError((error) => {
      console.error(error);
    }),
  ],
});

// TODO(PLAKY-AUTH): PLAKY-AUTH-021 - implement email + password sign-in.
// Contract: require email and password (400), verify reCAPTCHA when the module is enabled
// (400 on failure), authenticate, create a session, set the session cookie, return the
// AuthUser. Invalid credentials answer 401.
app.post("/api/auth/login", async (c) => {
  try {
    const body = await c.req.json<{
      email?: string;
      password?: string;
      recaptchaToken?: string;
      recaptchaFallback?: boolean;
    }>();

    if (!body.email || !body.password) {
      return c.json({ error: "Email and password are required." }, 400);
    }

    await gateRecaptcha(c, body);

    const meta = clientMeta(c);
    const account = await authenticateWithPassword(db, {
      email: body.email,
      password: body.password,
      ipAddress: meta.ipAddress,
    });

    const session = await createSession(db, account.id, meta);
    setCookie(c, SESSION_COOKIE, session.token, cookieOptions(session.expiresAt));

    const user = await loadAuthUser(db, account.id);
    return c.json({ user });
  } catch (error) {
    return authErrorResponse(c, error, 401);
  }
});

// TODO(PLAKY-AUTH): PLAKY-AUTH-022 - implement self-registration. Same reCAPTCHA gate as
// login; failures answer 400 (as opposed to 401 for login).
app.post("/api/auth/signup", async (c) => {
  try {
    const body = await c.req.json<{
      name?: string;
      email?: string;
      password?: string;
      recaptchaToken?: string;
      recaptchaFallback?: boolean;
    }>();

    if (!body.name || !body.email || !body.password) {
      return c.json({ error: "Name, email, and password are required." }, 400);
    }

    await gateRecaptcha(c, body);

    const meta = clientMeta(c);
    const account = await registerUser(db, {
      name: body.name,
      email: body.email,
      password: body.password,
      ipAddress: meta.ipAddress,
    });

    const session = await createSession(db, account.id, meta);
    setCookie(c, SESSION_COOKIE, session.token, cookieOptions(session.expiresAt));

    const user = await loadAuthUser(db, account.id);
    return c.json({ user });
  } catch (error) {
    return authErrorResponse(c, error, 400);
  }
});

// TODO(PLAKY-AUTH): PLAKY-AUTH-023 - implement sign-out: destroy the session, clear the
// cookie, return { ok: true }.
app.post("/api/auth/logout", async (c) => {
  const token = readSessionToken(c);
  const user = await loadAuthUserFromToken(db, token);
  await destroySession(db, token);
  deleteCookie(c, SESSION_COOKIE, { path: "/" });

  if (user) {
    await writeAudit(db, {
      actorId: user.id,
      action: "auth.logout",
      entity: "user",
      entityId: user.id,
      summary: `${user.email} signed out`,
      ipAddress: clientMeta(c).ipAddress,
    });
  }

  return c.json({ ok: true });
});

// TODO(PLAKY-AUTH): PLAKY-AUTH-024 - implement the Google OAuth start: redirect to
// accounts.google.com with openid/email/profile scopes and prompt=select_account.
// Answer 400 when the module is disabled or its credentials are missing.
app.get("/api/auth/google", async (c) => {
  if (!(await isIntegrationEnabled(db, "google_auth"))) {
    return c.json({ error: "Google sign-in is disabled." }, 400);
  }

  const env = readIntegrationEnv();
  if (!env.googleClientId || !env.googleClientSecret || !env.appUrl) {
    return c.json({ error: "Google sign-in is not configured." }, 400);
  }

  const redirectUri = `${env.appUrl.replace(/\/$/, "")}/api/auth/google/callback`;
  const params = new URLSearchParams({
    client_id: env.googleClientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    prompt: "select_account",
    access_type: "online",
  });

  return c.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

// TODO(PLAKY-AUTH): PLAKY-AUTH-025 - implement the Google OAuth callback: exchange the code
// for tokens, read the profile, upsert the user, set the session cookie, write an
// auth.google audit entry, then redirect to /dashboard. Every failure redirects to
// /login?error=google rather than leaking an error page.
app.get("/api/auth/google/callback", async (c) => {
  const env = readIntegrationEnv();
  const apiBase = (env.appUrl ?? ENV.APP_URL).replace(/\/$/, "");
  const webBase = ENV.CORS_ORIGIN.replace(/\/$/, "");
  const fail = () => c.redirect(`${webBase}/login?error=google`);

  try {
    if (!(await isIntegrationEnabled(db, "google_auth"))) {
      return fail();
    }

    if (!env.googleClientId || !env.googleClientSecret) {
      return fail();
    }

    const code = c.req.query("code");
    if (!code) {
      return fail();
    }

    const redirectUri = `${apiBase}/api/auth/google/callback`;
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: env.googleClientId,
        client_secret: env.googleClientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      return fail();
    }

    const tokens = (await tokenResponse.json()) as { access_token?: string };
    if (!tokens.access_token) {
      return fail();
    }

    const profileResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!profileResponse.ok) {
      return fail();
    }

    const profile = (await profileResponse.json()) as {
      email?: string;
      name?: string;
      picture?: string;
    };

    if (!profile.email) {
      return fail();
    }

    const account = await upsertGoogleUser(db, {
      email: profile.email,
      name: profile.name ?? profile.email,
      image: profile.picture ?? null,
    });

    const meta = clientMeta(c);
    const session = await createSession(db, account.id, meta);
    setCookie(c, SESSION_COOKIE, session.token, cookieOptions(session.expiresAt));

    await writeAudit(db, {
      actorId: account.id,
      action: "auth.google",
      entity: "user",
      entityId: account.id,
      summary: `${account.email} signed in with Google`,
      ipAddress: meta.ipAddress,
    });

    return c.redirect(`${webBase}/dashboard`);
  } catch {
    return fail();
  }
});

// TODO(PLAKY-FILES): PLAKY-FILE-001 - implement multipart evidence upload.
// Contract: require a signed-in user holding files.write (401/403), read alumniId /
// trackingEventId / kind / file from the form, reject a mime type outside
// ALLOWED_EVIDENCE_TYPES and anything over MAX_EVIDENCE_BYTES (400), verify the alumni
// record exists and is not soft-deleted (404), store through storeFile(), create the
// EvidenceFile, mirror an image upload onto Alumni.photoUrl, then write an audit entry.
app.post("/api/files/evidence", async (c) => {
  void currentUser;
  void ALLOWED_EVIDENCE_TYPES;
  void MAX_EVIDENCE_BYTES;
  void withNotDeleted;
  void db;
  void storeFile;
  void readIntegrationEnv;
  void writeAudit;
  void c;
  throw new Error("TODO(PLAKY-FILE-001): implement POST /api/files/evidence");
});

// TODO(PLAKY-FILE-002 - implement evidence download: require files.read, load the
// non-deleted EvidenceFile (404 when missing), redirect to evidence.url when present,
// stream from local disk when provider is `local`, and answer 404 for a remote provider
// whose url is gone.
app.get("/api/files/:id", async (c) => {
  void currentUser;
  void withNotDeleted;
  void db;
  void readIntegrationEnv;
  void c;
  throw new Error("TODO(PLAKY-FILE-002): implement GET /api/files/:id");
});

// TODO(PLAKY-INT-009 - implement the Google Forms webhook: require the module to be enabled
// (403), verify the x-webhook-secret header (401; mandatory in production), map the payload
// through mapFormPayload, import the single row with isTracked forced true, and record an
// ImportJob with source "google_forms".
app.post("/api/integrations/google-forms/webhook", async (c) => {
  void isIntegrationEnabled;
  void readIntegrationEnv;
  void mapFormPayload;
  void importAlumniRows;
  void db;
  void c;
  throw new Error("TODO(PLAKY-INT-009): implement the Google Forms webhook");
});

/**
 * Dispatcher: try the oRPC RPC handler, then the OpenAPI handler, then fall through.
 * TODO(PLAKY-PLATFORM): PLAKY-SRV-005 - keep the prefix literals in sync with
 * apps/web/src/utils/orpc.ts (RPCLink url) and apps/web/vite.config.ts (dev proxy).
 */
app.use("/*", async (c, next) => {
  const context = await createContext({ context: c });

  const rpcResult = await rpcHandler.handle(c.req.raw, {
    prefix: "/rpc",
    context,
  });

  if (rpcResult.matched) {
    return c.newResponse(rpcResult.response.body, rpcResult.response);
  }

  const apiResult = await apiHandler.handle(c.req.raw, {
    prefix: "/api-reference",
    context,
  });

  if (apiResult.matched) {
    return c.newResponse(apiResult.response.body, apiResult.response);
  }

  await next();
});

app.get("/", (c) => {
  return c.text("OK");
});

// TODO(PLAKY-PLATFORM): PLAKY-SRV-006 - the port is hard-coded to match the CORS origin and
// the Vite dev proxy in apps/web/vite.config.ts.
serve(
  {
    fetch: app.fetch,
    port: 3000,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  },
);