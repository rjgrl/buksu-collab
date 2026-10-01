// Authenticated layout. beforeLoad resolves the session through the oRPC client and
// redirects anonymous visitors to /login, so every route nested under /_app is already
// guaranteed to have a user by the time it renders.
// TODO(PLAKY-WEB): PLAKY-WEB-006 - keep this guard as the single client-side auth gate; do
// not duplicate the redirect inside individual screens.
import { createFileRoute, redirect } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.fetchQuery(context.orpc.auth.me.queryOptions());
    if (!user) {
      throw redirect({ to: "/login" });
    }
    return { user };
  },
  component: AppShell,
});
