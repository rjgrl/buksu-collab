// Root route: document head, theme, toaster, and devtools. This is the outermost shell -
// it renders for the login screen as well as the authenticated area.
// TODO(PLAKY-WEB): PLAKY-WEB-005 - keep the storageKey ("vite-ui-theme") in sync with
// src/components/mode-toggle.tsx, and keep the Toaster mounted here so any screen can raise
// a toast through sonner.
import { Toaster } from "@Alumni-Tracking-Ss/ui/components/sonner";
import type { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { HeadContent, Outlet, createRootRouteWithContext } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

import { ThemeProvider } from "@/components/theme-provider";
import { orpc } from "@/utils/orpc";

import "../index.css";

export interface RouterAppContext {
  orpc: typeof orpc;
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
  component: RootComponent,
  head: () => ({
    meta: [
      {
        title: "Alumni Tracking System",
      },
      {
        name: "description",
        content: "Graduate tracking, academic structure, and RBAC for alumni records",
      },
    ],
    links: [
      {
        rel: "icon",
        href: "/favicon.ico",
      },
    ],
  }),
});

function RootComponent() {
  return (
    <>
      <HeadContent />
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        disableTransitionOnChange
        storageKey="vite-ui-theme"
      >
        <Outlet />
        <Toaster richColors />
      </ThemeProvider>
      <TanStackRouterDevtools position="bottom-left" />
      <ReactQueryDevtools position="bottom" buttonPosition="bottom-right" />
    </>
  );
}
