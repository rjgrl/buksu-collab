import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/components/page-header";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/_app/integrations")({
  component: IntegrationsPage,
});

// TODO(PLAKY-INTEGRATIONS): PLAKY-INT-016 - implement the Integrations screen.
// One row per module in INTEGRATION_KEYS (packages/api/src/integrations/registry.ts).
//
// Required behaviour (each module also has its own doc page under docs/integrations/):
//   recaptcha      - toggle; shows whether the site/secret keys are configured, and that
//                    the login form falls back to a local checkbox when they are not
//   google_auth    - toggle; toggle is inert unless GOOGLE_CLIENT_ID/SECRET are set
//   google_drive   - toggle; evidence falls back to local disk storage
//   email          - toggle plus a "send test email" action addressed to a chosen recipient
//   image_host     - toggle; picks imgbb or Drive for image uploads
//   google_forms   - toggle plus the webhook URL to paste into the form trigger, and a
//                    reminder that the secret is mandatory in production
//   google_sheets  - toggle plus both import and export actions
//
// Render the server-provided `summary` string verbatim for each row so the fallback
// behaviour is visible to the administrator rather than implied.
function IntegrationsPage() {
  void useSession;
  void PageHeader;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Integrations"
        description="TODO(PLAKY-INT-016): implement the modular integration settings screen."
      />
    </div>
  );
}