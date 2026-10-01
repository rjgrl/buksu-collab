import { Badge } from "@Alumni-Tracking-Ss/ui/components/badge";
import { Checkbox } from "@Alumni-Tracking-Ss/ui/components/checkbox";
import { Input } from "@Alumni-Tracking-Ss/ui/components/input";
import { Textarea } from "@Alumni-Tracking-Ss/ui/components/textarea";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { QuietButton, RowActions } from "@/components/data-table";
import { EmptyState, FormField, PageHeader, PrimaryButton } from "@/components/page-header";
import { can, useSession } from "@/lib/session";
import { client, orpc, queryClient } from "@/utils/orpc";

export const Route = createFileRoute("/_app/roles")({
  component: RolesPage,
});

type PermissionRow = {
  id: string;
  key: string;
  name: string;
  description: string;
  module: string;
};

type RoleRow = {
  id: string;
  key: string;
  name: string;
  description: string;
  isSystem: boolean;
  userCount: number;
  permissions: PermissionRow[];
};

function errorMessage(error: unknown) {
  return error instanceof Error && error.message ? error.message : "Request failed";
}

function moduleLabel(module: string) {
  return module.charAt(0).toUpperCase() + module.slice(1);
}

function groupPermissions(permissions: PermissionRow[]) {
  const groups: { module: string; items: PermissionRow[] }[] = [];
  for (const permission of permissions) {
    const current = groups.find((group) => group.module === permission.module);
    if (current) current.items.push(permission);
    else groups.push({ module: permission.module, items: [permission] });
  }
  return groups;
}

function RolesPage() {
  const session = useSession();
  const permissions = session.data?.permissions;
  const canRead = can(permissions, "roles.read");
  const canWrite = can(permissions, "roles.write");
  const canReadPermissions = can(permissions, "permissions.read");
  const [createVersion, setCreateVersion] = useState(0);

  const rolesQuery = useQuery({
    ...orpc.roles.list.queryOptions(),
    enabled: canRead,
  });

  const permissionsQuery = useQuery({
    ...orpc.permissions.list.queryOptions(),
    enabled: canRead && canReadPermissions,
  });

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: orpc.roles.key() });
    await queryClient.invalidateQueries({ queryKey: orpc.auth.me.key() });
  };

  const createRole = useMutation({
    mutationFn: (input: {
      key: string;
      name: string;
      description?: string;
      permissionIds: string[];
    }) => client.roles.create(input),
    onSuccess: async () => {
      toast.success("Role created");
      setCreateVersion((version) => version + 1);
      await invalidate();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const updateRole = useMutation({
    mutationFn: (input: {
      id: string;
      name?: string;
      description?: string;
      permissionIds?: string[];
    }) => client.roles.update(input),
    onSuccess: async () => {
      toast.success("Role updated");
      await invalidate();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const roles = rolesQuery.data ?? [];
  const catalog = permissionsQuery.data;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Roles"
        description="Roles and the permissions attached to each role."
      />

      {session.isPending ? (
        <p className="text-sm text-muted-foreground">Loading roles…</p>
      ) : session.isError ? (
        <EmptyState
          title="Session unavailable"
          description="Your account could not be loaded, so role administration stays hidden."
        />
      ) : !canRead ? (
        <EmptyState
          title="Roles are restricted"
          description="You need the View roles permission to list roles."
        />
      ) : (
        <>
          {canWrite ? (
            <CreateRoleForm
              key={createVersion}
              catalog={catalog}
              catalogLoading={canReadPermissions && permissionsQuery.isPending}
              catalogMessage={
                !canReadPermissions
                  ? "Choosing permissions requires the View permissions permission."
                  : permissionsQuery.isPending
                    ? "Loading permissions…"
                    : permissionsQuery.isError
                      ? "Permissions could not be loaded."
                      : undefined
              }
              pending={createRole.isPending}
              onSubmit={(input) => createRole.mutate(input)}
            />
          ) : null}

          {rolesQuery.isPending ? (
            <p className="text-sm text-muted-foreground">Loading roles…</p>
          ) : rolesQuery.isError ? (
            <p className="text-sm text-muted-foreground">Could not load roles.</p>
          ) : roles.length === 0 ? (
            <EmptyState title="No roles yet" description="Create a role to start assigning permissions." />
          ) : (
            <div className="flex flex-col gap-4">
              {roles.map((role) => (
                <RoleCard
                  key={role.id}
                  role={role}
                  catalog={catalog}
                  canWrite={canWrite}
                  canEditPermissions={canWrite && catalog != null}
                  pending={updateRole.isPending && updateRole.variables?.id === role.id}
                  onSave={(input) => updateRole.mutate(input)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PermissionGroups({
  permissions,
  selected,
  editable,
  onToggle,
}: {
  permissions: PermissionRow[];
  selected?: string[];
  editable: boolean;
  onToggle?: (permission: PermissionRow, checked: boolean) => void;
}) {
  const groups = groupPermissions(permissions);
  if (groups.length === 0) {
    return <p className="text-xs text-muted-foreground">No permissions attached.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => (
        <fieldset key={group.module} className="flex flex-col gap-2">
          <legend className="text-xs font-medium">{moduleLabel(group.module)}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {group.items.map((permission) =>
              editable ? (
                <label key={permission.id} className="flex items-start gap-2 text-sm">
                  <Checkbox
                    checked={selected?.includes(permission.id) ?? false}
                    onCheckedChange={(value) => onToggle?.(permission, value === true)}
                  />
                  <span>
                    <span className="block">{permission.name}</span>
                    <span className="block text-xs text-muted-foreground">{permission.key}</span>
                  </span>
                </label>
              ) : (
                <div key={permission.id} className="text-sm">
                  <span className="block">{permission.name}</span>
                  <span className="block text-xs text-muted-foreground">{permission.key}</span>
                </div>
              ),
            )}
          </div>
        </fieldset>
      ))}
    </div>
  );
}

function CreateRoleForm({
  catalog,
  catalogLoading,
  catalogMessage,
  pending,
  onSubmit,
}: {
  catalog: PermissionRow[] | undefined;
  catalogLoading: boolean;
  catalogMessage?: string;
  pending: boolean;
  onSubmit: (input: { key: string; name: string; description: string; permissionIds: string[] }) => void;
}) {
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [permissionIds, setPermissionIds] = useState<string[]>([]);
  const [errors, setErrors] = useState<{ key?: string; name?: string }>({});

  return (
    <form
      className="flex flex-col gap-4 p-4 ring-1 ring-foreground/10"
      onSubmit={(event) => {
        event.preventDefault();
        if (catalogLoading) return;
        const next: typeof errors = {};
        if (!key.trim()) next.key = "Key is required.";
        if (!name.trim()) next.name = "Name is required.";
        setErrors(next);
        if (Object.keys(next).length > 0) return;
        onSubmit({
          key: key.trim(),
          name: name.trim(),
          description: description.trim(),
          permissionIds,
        });
      }}
    >
      <div>
        <h2 className="text-sm font-medium">Create role</h2>
        <p className="text-sm text-muted-foreground">
          A key, name, description, and the permissions this role grants.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <FormField id="create-role-key" label="Key" error={errors.key}>
          <Input
            id="create-role-key"
            value={key}
            placeholder="staff"
            onChange={(event) => setKey(event.target.value)}
            autoComplete="off"
          />
          <p className="text-xs text-muted-foreground">The key cannot be changed after the role is created.</p>
        </FormField>
        <FormField id="create-role-name" label="Name" error={errors.name}>
          <Input id="create-role-name" value={name} onChange={(event) => setName(event.target.value)} />
        </FormField>
      </div>
      <FormField id="create-role-description" label="Description">
        <Textarea
          id="create-role-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </FormField>
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium">Permissions</p>
        {catalogMessage ? <p className="text-xs text-muted-foreground">{catalogMessage}</p> : null}
        {catalog ? (
          <PermissionGroups
            permissions={catalog}
            selected={permissionIds}
            editable
            onToggle={(permission, checked) =>
              setPermissionIds((current) =>
                checked
                  ? current.includes(permission.id)
                    ? current
                    : [...current, permission.id]
                  : current.filter((id) => id !== permission.id),
              )
            }
          />
        ) : null}
      </div>
      <div>
        <PrimaryButton type="submit" pending={pending} disabled={catalogLoading || pending}>
          Create role
        </PrimaryButton>
      </div>
    </form>
  );
}

function RoleCard({
  role,
  catalog,
  canWrite,
  canEditPermissions,
  pending,
  onSave,
}: {
  role: RoleRow;
  catalog: PermissionRow[] | undefined;
  canWrite: boolean;
  canEditPermissions: boolean;
  pending: boolean;
  onSave: (input: { id: string; name: string; description: string; permissionIds?: string[] }) => void;
}) {
  const [name, setName] = useState(role.name);
  const [description, setDescription] = useState(role.description);
  const [permissionIds, setPermissionIds] = useState(role.permissions.map((permission) => permission.id));
  const [nameError, setNameError] = useState<string | undefined>();

  function togglePermission(permission: PermissionRow, checked: boolean) {
    const currently = permissionIds.includes(permission.id);
    if (currently && !checked && role.userCount > 0) {
      const proceed = window.confirm(
        `${role.name} is still assigned to ${role.userCount} account${role.userCount === 1 ? "" : "s"}. Removing "${permission.name}" takes effect the next time those accounts load a session. Continue?`,
      );
      if (!proceed) return;
    }

    setPermissionIds((current) =>
      checked
        ? current.includes(permission.id)
          ? current
          : [...current, permission.id]
        : current.filter((id) => id !== permission.id),
    );
  }

  const assigned =
    role.userCount === 1 ? "Assigned to 1 account." : `Assigned to ${role.userCount} accounts.`;

  return (
    <section className="flex flex-col gap-4 p-4 ring-1 ring-foreground/10">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-medium">{role.name}</h2>
        <Badge variant="outline">{role.key}</Badge>
        {role.isSystem ? <Badge variant="secondary">System</Badge> : null}
      </div>
      <p className="text-xs text-muted-foreground">
        {assigned}
        {role.userCount > 0
          ? " Removing a permission takes effect the next time those accounts load a session."
          : ""}
      </p>

      {canWrite ? (
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!name.trim()) {
              setNameError("Name is required.");
              return;
            }
            setNameError(undefined);
            onSave({
              id: role.id,
              name: name.trim(),
              description: description.trim(),
              ...(canEditPermissions ? { permissionIds } : {}),
            });
          }}
        >
          {role.isSystem ? (
            <p className="text-xs text-muted-foreground">
              System roles can be edited. Their key stays fixed.
            </p>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            <FormField id={`role-name-${role.id}`} label="Name" error={nameError}>
              <Input
                id={`role-name-${role.id}`}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </FormField>
            <FormField id={`role-key-${role.id}`} label="Key">
              <Input id={`role-key-${role.id}`} value={role.key} disabled />
            </FormField>
          </div>
          <FormField id={`role-description-${role.id}`} label="Description">
            <Textarea
              id={`role-description-${role.id}`}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </FormField>
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium">Permissions</p>
            {canEditPermissions && catalog ? (
              <PermissionGroups
                permissions={catalog}
                selected={permissionIds}
                editable
                onToggle={togglePermission}
              />
            ) : (
              <PermissionGroups permissions={role.permissions} editable={false} />
            )}
          </div>
          <RowActions>
            <PrimaryButton type="submit" pending={pending}>
              Save role
            </PrimaryButton>
          </RowActions>
        </form>
      ) : (
        <>
          {role.description ? <p className="text-sm">{role.description}</p> : null}
          <PermissionGroups permissions={role.permissions} editable={false} />
        </>
      )}
    </section>
  );
}
