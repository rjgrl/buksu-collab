import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/components/page-header";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/_app/users")({
  component: UsersPage,
});

// TODO(PLAKY-RBAC): PLAKY-RBAC-017 - implement the Users admin screen.
//
// Required behaviour (see docs/rbac/manage-users.md):
//   - DataTable of name, email, roles, status; search wired to orpc.users.list
//   - create form for name, email, password and a role checkbox list from orpc.roles.list
//   - enable/disable toggle calling client.users.update; note that the server treats this
//     as users.write, so the catalog's users.delete key currently grants nothing (tracked
//     as a known catalog gap in packages/api/src/rbac.test.ts)
//   - everything above is gated on users.write / users.read through can()
function UsersPage() {
  void useSession;
  void PageHeader;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Users"
        description="TODO(PLAKY-RBAC-017): implement user administration."
      />
    </div>
  );
}