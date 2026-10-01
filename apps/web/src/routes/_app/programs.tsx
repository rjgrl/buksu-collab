import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/components/page-header";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/_app/programs")({
  component: ProgramsPage,
});

// TODO(PLAKY-ACADEMIC): PLAKY-ACAD-007 - implement the Programs screen.
//
// Required behaviour (see docs/academic-structure/manage-programs.md):
//   - DataTable of code, name, department, graduate count; search plus a department filter
//     (docs list programs under their department)
//   - create and edit forms; a program always belongs to exactly one department, so the
//     department picker is required on both forms
//   - create/edit require programs.write, delete is a soft delete requiring programs.delete
//   - an alumni profile can only be attached to a program that exists here, so this screen
//     is a dependency of the alumni forms
function ProgramsPage() {
  void useSession;
  void PageHeader;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Programs"
        description="TODO(PLAKY-ACAD-007): implement program management."
      />
    </div>
  );
}