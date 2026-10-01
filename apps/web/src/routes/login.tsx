import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

// TODO(PLAKY-AUTH): PLAKY-AUTH-027 - implement the sign-in / sign-up screen.
//
// Required behaviour (see docs/system/user-guide.md):
//   - one form, two modes, switched by a text button at the bottom
//   - POST to /api/auth/login or /api/auth/signup via postJson() (not the oRPC client,
//     because these two routes also set the session cookie server-side)
//   - read orpc.auth.config to decide whether to render the reCAPTCHA widget or, when the
//     module is enabled but not configured, the local "I am not a robot" checkbox
//   - render the Google sign-in link only when config.google.enabled
//   - invalidate the query cache after success, then navigate to /dashboard
//   - show the server's error message verbatim in a toast
//
// Seeded credentials are printed on this screen; remove that line once real accounts exist.
function LoginPage() {
  void useNavigate;
  void useQuery;
  void PageHeader;

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/30 p-4">
      <PageHeader
        title="Alumni Tracking System"
        description="TODO(PLAKY-AUTH-027): implement the sign-in and sign-up form."
      />
    </div>
  );
}