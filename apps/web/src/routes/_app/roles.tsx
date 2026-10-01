import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/components/page-header";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/_app/roles")({
  component: RolesPage,
});

// TODO(PLAKY-RBAC): PLAKY-RBAC-018 - implement the Roles screen.
//
// Required behaviour (see docs/rbac/manage-roles.md and docs/rbac/manage-permissions.md):
//   - role list with user counts and their permission checkboxes, grouped by the module
//     field of each Permission row returned by orpc.permissions.list
//   - editing a system role (super_admin, staff, viewer) must be possible - the server only
//     blocks deleting them
//   - create form for key, name, description; key is immutable once created in practice
//   - a disabled role that is still assigned to a user must warn before removing a
//     permission, because access is re-resolved on the next session load
function RolesPage() {
  void useSession;
  void PageHeader;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Roles"
        description="TODO(PLAKY-RBAC-018): implement role and permission administration."
      />
    </div>
  );
}