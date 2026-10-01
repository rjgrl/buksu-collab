import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/components/page-header";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/_app/reports")({
  component: ReportsPage,
});

// TODO(PLAKY-REPORTS): PLAKY-REPT-004 - implement the Reports screen.
//
// Required behaviour:
//   - graduate report: call client.reports.alumniCsv with an optional department filter and a
//     tracked filter (all | tracked | untracked), then offer the returned CSV as a download
//     named after the server's fileName
//   - Google Sheets export when the google_sheets module reports mode "live"; otherwise the
//     button must explain that the module is not configured instead of failing
//   - requires reports.export for the export actions
//   - note that reports.read exists in the catalog but guards no procedure today
function ReportsPage() {
  void useSession;
  void PageHeader;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Reports"
        description="TODO(PLAKY-REPT-004): implement the export screens."
      />
    </div>
  );
}