// Landing route: send signed-in users to the dashboard and everyone else to the login page.
// TODO(PLAKY-WEB): PLAKY-WEB-006 - keep the redirect table in step with src/routes/_app.tsx.
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.fetchQuery(context.orpc.auth.me.queryOptions());
    throw redirect({ to: user ? "/dashboard" : "/login" });
  },
  component: function IndexRedirect() {
    return null;
  },
});
