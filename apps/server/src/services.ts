import { createPrismaClient } from "@Alumni-Tracking-Ss/db";

import { ENV } from "./env.server";

// Single Prisma client for the whole server process. Every router and raw Hono route
// receives it through createContext() in ./context, so there is exactly one connection pool.
//
// TODO(PLAKY-PLATFORM): PLAKY-SRV-001 - keep the singleton here. Prisma logs a warning for
// each additional client instance, so this must stay the only call to createPrismaClient.
export const db = createPrismaClient(ENV);