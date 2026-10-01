import { Badge } from "@Alumni-Tracking-Ss/ui/components/badge";
import { Checkbox } from "@Alumni-Tracking-Ss/ui/components/checkbox";
import { Input } from "@Alumni-Tracking-Ss/ui/components/input";
import { Switch } from "@Alumni-Tracking-Ss/ui/components/switch";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  DataTable,
  QuietButton,
  RowActions,
  TableCell,
  TableRow,
} from "@/components/data-table";
import { EmptyState, FormField, PageHeader, PrimaryButton } from "@/components/page-header";
import { can, useSession } from "@/lib/session";
import { client, orpc, queryClient } from "@/utils/orpc";

export const Route = createFileRoute("/_app/users")({
  component: UsersPage,
});

// Account administration.
// Disable and enable call users.update, which is gated by users.write. The users.delete
// catalog key grants nothing on the server (see packages/api/src/rbac.test.ts).

type RoleChoice = { id: string; key: string; name: string };

type Account = {
  id: string;
  name: string;
  email: string;
  status: "active" | "disabled";
  roles: RoleChoice[];
};

function errorMessage(error: unknown) {
  return error instanceof Error && error.message ? error.message : "Request failed";
}

function UsersPage() {
  const session = useSession();
  const permissions = session.data?.permissions;
  const canRead = can(permissions, "users.read");
  const canWrite = can(permissions, "users.write");
  const canReadRoles = can(permissions, "roles.read");
  const [search, setSearch] = useState("");
  const [applied, setApplied] = useState("");
  const [editing, setEditing] = useState<Account | null>(null);
  const [createVersion, setCreateVersion] = useState(0);

  useEffect(() => {
    const handle = window.setTimeout(() => setApplied(search.trim()), 200);
    return () => window.clearTimeout(handle);
  }, [search]);

  const usersQuery = useQuery({
    ...orpc.users.list.queryOptions({ input: { search: applied } }),
    enabled: canRead,
  });

  const rolesQuery = useQuery({
    ...orpc.roles.list.queryOptions(),
    enabled: canRead && canWrite && canReadRoles,
  });

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: orpc.users.key() });
    await queryClient.invalidateQueries({ queryKey: orpc.roles.key() });
    await queryClient.invalidateQueries({ queryKey: orpc.auth.me.key() });
  };

  const createUser = useMutation({
    mutationFn: (input: { name: string; email: string; password: string; roleIds: string[] }) =>
      client.users.create(input),
    onSuccess: async () => {
      toast.success("Account created");
      setCreateVersion((version) => version + 1);
      await invalidate();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const updateUser = useMutation({
    mutationFn: (input: {
      id: string;
      name?: string;
      password?: string;
      status?: "active" | "disabled";
      roleIds?: string[];
    }) => client.users.update(input),
    onSuccess: async (_result, input) => {
      if (input.status === "disabled" && input.name === undefined && input.roleIds === undefined) {
        toast.success("Account disabled");
      } else if (input.status === "active" && input.name === undefined && input.roleIds === undefined) {
        toast.success("Account enabled");
      } else {
        toast.success("Account updated");
        setEditing(null);
      }
      await invalidate();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const accounts = usersQuery.data ?? [];
  const roleChoices: RoleChoice[] = (rolesQuery.data ?? []).map((role) => ({
    id: role.id,
    key: role.key,
    name: role.name,
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Users"
        description="Accounts and the roles assigned to each account."
      />

      {session.isPending ? (
        <p className="text-sm text-muted-foreground">Loading accounts…</p>
      ) : session.isError ? (
        <EmptyState
          title="Session unavailable"
          description="Your account could not be loaded, so user administration stays hidden."
        />
      ) : !canRead ? (
        <EmptyState
          title="Users are restricted"
          description="You need the View users permission to list accounts."
        />
      ) : (
        <>
          {canWrite ? (
            <CreateAccountForm
              key={createVersion}
              roles={roleChoices}
              rolesReady={canReadRoles && rolesQuery.isSuccess}
              rolesMessage={
                !canReadRoles
                  ? "Assigning roles requires the View roles permission."
                  : rolesQuery.isPending
                    ? "Loading roles…"
                    : rolesQuery.isError
                      ? "Roles could not be loaded."
                      : roleChoices.length === 0
                        ? "Create a role before adding an account."
                        : undefined
              }
              pending={createUser.isPending}
              onSubmit={(input) => createUser.mutate(input)}
            />
          ) : null}

          {editing && canWrite ? (
            <EditAccountForm
              key={editing.id}
              account={editing}
              roles={roleChoices}
              canAssignRoles={canReadRoles && rolesQuery.isSuccess}
              pending={updateUser.isPending && updateUser.variables?.name !== undefined}
              onCancel={() => setEditing(null)}
              onSubmit={(input) => updateUser.mutate(input)}
            />
          ) : null}

          <DataTable
            headers={
              canWrite
                ? ["Name", "Email", "Roles", "Status", "Actions"]
                : ["Name", "Email", "Roles", "Status"]
            }
            search={search}
            onSearch={setSearch}
            searchPlaceholder="Search name or email"
          >
            {usersQuery.isPending ? (
              <TableRow>
                <TableCell>Loading accounts…</TableCell>
              </TableRow>
            ) : usersQuery.isError ? (
              <TableRow>
                <TableCell>Could not load accounts.</TableCell>
              </TableRow>
            ) : accounts.length === 0 ? (
              <TableRow>
                <TableCell>
                  {applied ? "No accounts match this search." : "No accounts yet."}
                </TableCell>
              </TableRow>
            ) : (
              accounts.map((account) => (
                <TableRow key={account.id}>
                  <TableCell>{account.name}</TableCell>
                  <TableCell>{account.email}</TableCell>
                  <TableCell>
                    {account.roles.length === 0 ? (
                      <span className="text-muted-foreground">None</span>
                    ) : (
                      <span className="flex flex-wrap gap-1">
                        {account.roles.map((role) => (
                          <Badge key={role.id} variant="outline">
                            {role.name}
                          </Badge>
                        ))}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {canWrite ? (
                      <label className="flex items-center gap-2 text-xs">
                        <Switch
                          checked={account.status === "active"}
                          disabled={updateUser.isPending && updateUser.variables?.id === account.id}
                          onCheckedChange={(checked) =>
                            updateUser.mutate({
                              id: account.id,
                              status: checked ? "active" : "disabled",
                            })
                          }
                        />
                        {account.status === "active" ? "Active" : "Disabled"}
                      </label>
                    ) : (
                      <Badge variant={account.status === "active" ? "secondary" : "outline"}>
                        {account.status === "active" ? "Active" : "Disabled"}
                      </Badge>
                    )}
                  </TableCell>
                  {canWrite ? (
                    <TableCell>
                      <RowActions>
                        <QuietButton type="button" onClick={() => setEditing(account)}>
                          Edit
                        </QuietButton>
                      </RowActions>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))
            )}
          </DataTable>
        </>
      )}
    </div>
  );
}

function RoleChecklist({
  roles,
  selected,
  onChange,
  disabled,
}: {
  roles: RoleChoice[];
  selected: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  if (roles.length === 0) {
    return <p className="text-xs text-muted-foreground">No roles are available.</p>;
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {roles.map((role) => {
        const checked = selected.includes(role.id);
        return (
          <label key={role.id} className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={checked}
              disabled={disabled}
              onCheckedChange={(value) => {
                const next = value === true;
                onChange(next ? [...selected, role.id] : selected.filter((id) => id !== role.id));
              }}
            />
            <span>{role.name}</span>
            <span className="text-xs text-muted-foreground">{role.key}</span>
          </label>
        );
      })}
    </div>
  );
}

function CreateAccountForm({
  roles,
  rolesReady,
  rolesMessage,
  pending,
  onSubmit,
}: {
  roles: RoleChoice[];
  rolesReady: boolean;
  rolesMessage?: string;
  pending: boolean;
  onSubmit: (input: { name: string; email: string; password: string; roleIds: string[] }) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const [errors, setErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    roles?: string;
  }>({});

  return (
    <form
      className="flex flex-col gap-4 ring-1 ring-foreground/10 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        const next: typeof errors = {};
        if (!name.trim()) next.name = "Name is required.";
        if (!email.trim() || !email.includes("@")) next.email = "Enter a valid email.";
        if (password.length < 8) next.password = "Password must be at least 8 characters.";
        if (!rolesReady || roleIds.length === 0) next.roles = "Assign at least one role.";
        setErrors(next);
        if (Object.keys(next).length > 0) return;
        onSubmit({
          name: name.trim(),
          email: email.trim(),
          password,
          roleIds,
        });
      }}
    >
      <div>
        <h2 className="text-sm font-medium">Create account</h2>
        <p className="text-sm text-muted-foreground">
          Name, email, password, and one or more roles.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <FormField id="create-user-name" label="Name" error={errors.name}>
          <Input
            id="create-user-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="off"
          />
        </FormField>
        <FormField id="create-user-email" label="Email" error={errors.email}>
          <Input
            id="create-user-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="off"
          />
        </FormField>
        <FormField id="create-user-password" label="Password" error={errors.password}>
          <Input
            id="create-user-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
          />
        </FormField>
      </div>
      <FormField id="create-user-roles" label="Roles" error={errors.roles}>
        {rolesMessage ? <p className="text-xs text-muted-foreground">{rolesMessage}</p> : null}
        <RoleChecklist roles={roles} selected={roleIds} onChange={setRoleIds} disabled={!rolesReady || pending} />
      </FormField>
      <div>
        <PrimaryButton type="submit" pending={pending} disabled={!rolesReady || pending}>
          Create account
        </PrimaryButton>
      </div>
    </form>
  );
}

function EditAccountForm({
  account,
  roles,
  canAssignRoles,
  pending,
  onCancel,
  onSubmit,
}: {
  account: Account;
  roles: RoleChoice[];
  canAssignRoles: boolean;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (input: { id: string; name: string; password?: string; roleIds?: string[] }) => void;
}) {
  const [name, setName] = useState(account.name);
  const [password, setPassword] = useState("");
  const [roleIds, setRoleIds] = useState(account.roles.map((role) => role.id));
  const [errors, setErrors] = useState<{ name?: string; password?: string; roles?: string }>({});

  const choices = [...roles];
  for (const role of account.roles) {
    if (!choices.some((choice) => choice.id === role.id)) {
      choices.push(role);
    }
  }

  return (
    <form
      className="flex flex-col gap-4 ring-1 ring-foreground/10 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        const next: typeof errors = {};
        if (!name.trim()) next.name = "Name is required.";
        if (password && password.length < 8) {
          next.password = "Password must be at least 8 characters.";
        }
        setErrors(next);
        if (Object.keys(next).length > 0) return;
        onSubmit({
          id: account.id,
          name: name.trim(),
          ...(password ? { password } : {}),
          ...(canAssignRoles ? { roleIds } : {}),
        });
      }}
    >
      <div>
        <h2 className="text-sm font-medium">Update {account.email}</h2>
        <p className="text-sm text-muted-foreground">
          Change the name, password, or role assignments. Leave the password blank to keep it.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <FormField id="edit-user-name" label="Name" error={errors.name}>
          <Input id="edit-user-name" value={name} onChange={(event) => setName(event.target.value)} />
        </FormField>
        <FormField id="edit-user-password" label="New password" error={errors.password}>
          <Input
            id="edit-user-password"
            type="password"
            value={password}
            placeholder="Leave blank to keep the current password"
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
          />
        </FormField>
      </div>
      <FormField id="edit-user-roles" label="Roles" error={errors.roles}>
        {canAssignRoles ? (
          <RoleChecklist roles={choices} selected={roleIds} onChange={setRoleIds} disabled={pending} />
        ) : (
          <p className="text-xs text-muted-foreground">
            Role assignments stay as they are until the View roles permission is available.
          </p>
        )}
      </FormField>
      <RowActions>
        <PrimaryButton type="submit" pending={pending}>
          Save changes
        </PrimaryButton>
        <QuietButton type="button" onClick={onCancel}>
          Cancel
        </QuietButton>
      </RowActions>
    </form>
  );
}
