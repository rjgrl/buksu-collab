import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/_app/alumni/")({
  component: AlumniPage,
});

// TODO(PLAKY-ALUMNI): PLAKY-ALUM-004 - implement the alumni list screen.
//
// Required behaviour (see docs/alumni-profile/alumni-profile.md):
//   - filters: free-text search, department (via departments.list), tracked state
//     (all | tracked | untracked) - all forwarded to orpc.alumni.list
//   - DataTable with student number, name, program, graduation year, tracked state
//   - a "New" action linking to /alumni/new, shown only when the session holds alumni.write
//   - per-row links into /alumni/$id
function AlumniPage() {
  void PageHeader;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Alumni"
        description="TODO(PLAKY-ALUM-004): implement the alumni list with search and filters."
      />
    </div>
  );
}