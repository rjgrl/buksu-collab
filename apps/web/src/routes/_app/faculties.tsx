import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/components/page-header";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/_app/faculties")({
  component: FacultiesPage,
});

// TODO(PLAKY-ACADEMIC): PLAKY-ACAD-008 - implement the Faculties screen.
//
// Required behaviour (see docs/academic-structure/manage-faculties.md and
// docs/academic-structure/assign-faculty-to-department.md):
//   - DataTable of employee number, name, email, assigned departments; search wired to
//     orpc.faculties.list
//   - create and edit forms for employeeNumber, firstName, lastName, email, and a
//     multi-select of departmentIds
//   - saving replaces the department assignments wholesale (the server deletes then
//     recreates the join rows), so the editor must always submit the full selection
//   - create/edit require faculties.write; delete is a soft delete requiring faculties.delete
function FacultiesPage() {
  void useSession;
  void PageHeader;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Faculties"
        description="TODO(PLAKY-ACAD-008): implement faculty management and department assignment."
      />
    </div>
  );
}