import type { RouterClient } from "@orpc/server";

import { publicProcedure } from "../index";
import { departmentsRouter, facultiesRouter, programsRouter } from "./academic";
import { alumniRouter } from "./alumni";
import { auditRouter, dashboardRouter, filesRouter, integrationsRouter, reportsRouter } from "./dashboard";
import { authRouter, permissionsRouter, rolesRouter, usersRouter } from "./rbac";

// The application router tree. This object is the single source of truth for the API
// surface and is consumed three ways:
//   1. apps/server/src/index.ts  -> RPCHandler   at /rpc           (browser data path)
//   2. apps/server/src/index.ts  -> OpenAPIHandler at /api-reference (human + docs)
//   3. apps/web/src/utils/orpc.ts -> AppRouterClient (typed browser client)
//
// TODO(PLAKY-PLATFORM): PLAKY-API-003 - keep this tree and the two exported types in sync.
// `AppRouterClient` is the type the web client is typed against; adding a key here is the
// only step needed to make a module reachable from the browser.
export const appRouter = {
  healthCheck: publicProcedure.handler(() => {
    // TODO(PLAKY-PLATFORM): PLAKY-API-003 - liveness probe used by the server root route.
    return "OK";
  }),
  auth: authRouter,
  users: usersRouter,
  roles: rolesRouter,
  permissions: permissionsRouter,
  departments: departmentsRouter,
  programs: programsRouter,
  faculties: facultiesRouter,
  alumni: alumniRouter,
  dashboard: dashboardRouter,
  reports: reportsRouter,
  integrations: integrationsRouter,
  audit: auditRouter,
  files: filesRouter,
};

export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;