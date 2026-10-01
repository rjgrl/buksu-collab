import type { AppRouterClient } from "@Alumni-Tracking-Ss/api/routers/index";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { QueryCache, QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ENV } from "../env";

// Browser transport and cache.
//
// `orpc` is the object every screen uses (`orpc.users.list.queryOptions()`), and it is also
// placed on the router context in ./main.tsx so loaders can prefetch. `client` is the raw
// typed client used inside useMutation callbacks.
//
// The link must keep credentials: "include" because authentication is a cookie, and the
// target must stay `${VITE_SERVER_URL}/rpc`, which is what the dev proxy in vite.config.ts
// forwards to the Hono server.

// Contract: every failed query raises a toast with a retry action that invalidates the
// query, so no screen has to render its own global error state.
export function createQueryClient() {
  const client = new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        const message = error instanceof Error && error.message ? error.message : "Request failed";
        toast.error(message, {
          action: {
            label: "Retry",
            onClick: () => {
              void client.invalidateQueries({ queryKey: query.queryKey });
            },
          },
        });
      },
    }),
  });

  return client;
}

export const queryClient = createQueryClient();

/** Typed oRPC link. Trailing slashes are stripped from VITE_SERVER_URL. */
// TODO(PLAKY-PLATFORM): PLAKY-SRV-007 - keep the `/rpc` suffix in sync with the handler
// prefix in apps/server/src/index.ts.
export const link = new RPCLink({
  url: `${ENV.VITE_SERVER_URL.replace(/\/$/, "")}/rpc`,
  fetch: (input, init) => fetch(input, { ...init, credentials: "include" }),
});

// TODO(PLAKY-WEB): PLAKY-WEB-002 - `client` and `orpc` are thin wrappers over `link`; wire
// them once the router tree in packages/api is implemented.
export const client: AppRouterClient = createORPCClient(link);

export const orpc = createTanstackQueryUtils(client);