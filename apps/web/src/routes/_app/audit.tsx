import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/components/page-header";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/_app/audit")({
  component: AuditPage,
});

// TODO(PLAKY-AUDIT): PLAKY-AUD-003 - implement the audit log screen.
//
// Required behaviour:
//   - newest-first table from orpc.audit.list: timestamp, actor, action, entity, summary
//   - search over action / entity / summary (the server already searches those three fields
//     and caps the page at 200 rows)
//   - read-only; the server exposes no audit write procedure to the browser
//   - requires audit.read, which super_admin and staff-with-RBAC do not hold by default
function AuditPage() {
  void useSession;
  void PageHeader;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Audit log"
        description="TODO(PLAKY-AUD-003): implement the activity history screen."
      />
    </div>
  );
}