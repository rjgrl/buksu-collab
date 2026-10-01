import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/components/page-header";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/_app/departments")({
  component: DepartmentsPage,
});

// TODO(PLAKY-ACADEMIC): PLAKY-ACAD-006 - implement the Departments screen.
//
// Required behaviour (see docs/academic-structure/manage-departments.md):
//   - DataTable of code, name, program count, faculty count; search box wired to
//     orpc.departments.list
//   - create and edit forms for code / name / description (code is upper-cased server-side)
//   - delete is a soft delete and must read as such in the UI; it requires
//     departments.delete, while create and edit require departments.write
function DepartmentsPage() {
  void useSession;
  void PageHeader;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Departments"
        description="TODO(PLAKY-ACAD-006): implement department management."
      />
    </div>
  );
}