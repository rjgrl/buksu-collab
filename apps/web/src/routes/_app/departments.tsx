import { Input } from "@Alumni-Tracking-Ss/ui/components/input";
import { Textarea } from "@Alumni-Tracking-Ss/ui/components/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { DataTable, QuietButton, RowActions, TableCell, TableRow } from "@/components/data-table";
import { FieldGroup } from "@/components/field";
import { EmptyState, FormField, PageHeader, PrimaryButton } from "@/components/page-header";
import { can, useSession } from "@/lib/session";
import { client, orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_app/departments")({
  component: DepartmentsPage,
});

type FormState = {
  code: string;
  name: string;
  description: string;
};

const emptyForm: FormState = { code: "", name: "", description: "" };

// TODO(PLAKY-ACADEMIC): PLAKY-ACAD-006 - implement the Departments screen.
function DepartmentsPage() {
  const session = useSession();
  const queryClient = useQueryClient();
  const permissions = session.data?.permissions;
  const canWrite = can(permissions, "departments.write");
  const canDelete = can(permissions, "departments.delete");

  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  const listQuery = useQuery(
    orpc.departments.list.queryOptions({
      input: search.trim() ? { search: search.trim() } : undefined,
    }),
  );

  const detailQuery = useQuery({
    ...orpc.departments.get.queryOptions({
      input: { id: selectedId ?? "" },
    }),
    enabled: Boolean(selectedId),
  });

  async function invalidateDepartments() {
    await queryClient.invalidateQueries({ queryKey: orpc.departments.key() });
  }

  const createMutation = useMutation({
    mutationFn: (input: FormState) =>
      client.departments.create({
        code: input.code,
        name: input.name,
        description: input.description || undefined,
      }),
    onSuccess: async () => {
      toast.success("Department created");
      setShowCreate(false);
      setForm(emptyForm);
      await invalidateDepartments();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (input: FormState & { id: string }) =>
      client.departments.update({
        id: input.id,
        code: input.code,
        name: input.name,
        description: input.description || undefined,
      }),
    onSuccess: async () => {
      toast.success("Department updated");
      setEditingId(null);
      setForm(emptyForm);
      await invalidateDepartments();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => client.departments.delete({ id }),
    onSuccess: async (_data, id) => {
      toast.success("Department soft-deleted");
      if (selectedId === id) {
        setSelectedId(null);
      }
      if (editingId === id) {
        setEditingId(null);
        setForm(emptyForm);
      }
      await invalidateDepartments();
    },
  });

  const departments = listQuery.data ?? [];
  const detail = detailQuery.data;
  const formPending = createMutation.isPending || updateMutation.isPending;

  function startCreate() {
    setShowCreate(true);
    setEditingId(null);
    setForm(emptyForm);
  }

  function startEdit(department: { id: string; code: string; name: string; description: string }) {
    setShowCreate(false);
    setEditingId(department.id);
    setSelectedId(department.id);
    setForm({
      code: department.code,
      name: department.name,
      description: department.description ?? "",
    });
  }

  function cancelForm() {
    setShowCreate(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...form });
      return;
    }
    createMutation.mutate(form);
  }

  function onDelete(id: string, code: string) {
    const confirmed = window.confirm(
      `Soft-delete department ${code}? It will be hidden from lists but not permanently removed.`,
    );
    if (!confirmed) {
      return;
    }
    deleteMutation.mutate(id);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Departments"
        description="Browse academic departments, their programs, and assigned faculties."
        actions={
          canWrite ? (
            <QuietButton type="button" onClick={startCreate}>
              Add department
            </QuietButton>
          ) : null
        }
      />

      {showCreate || editingId ? (
        <section className="border border-border/70 p-4">
          <h2 className="mb-4 text-sm font-medium">
            {editingId ? "Edit department" : "Create department"}
          </h2>
          <form onSubmit={onSubmit}>
            <FieldGroup>
              <FormField id="dept-code" label="Code">
                <Input
                  id="dept-code"
                  value={form.code}
                  onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))}
                  placeholder="IT"
                  required
                />
              </FormField>
              <FormField id="dept-name" label="Name">
                <Input
                  id="dept-name"
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Information Technology"
                  required
                />
              </FormField>
              <FormField id="dept-description" label="Description">
                <Textarea
                  id="dept-description"
                  value={form.description}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, description: event.target.value }))
                  }
                  rows={3}
                />
              </FormField>
              <div className="flex flex-wrap gap-2">
                <PrimaryButton type="submit" pending={formPending}>
                  {editingId ? "Save changes" : "Create department"}
                </PrimaryButton>
                <QuietButton type="button" onClick={cancelForm}>
                  Cancel
                </QuietButton>
              </div>
            </FieldGroup>
          </form>
        </section>
      ) : null}

      <DataTable
        headers={["Code", "Name", "Programs", "Faculties", ""]}
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search by code or name"
      >
        {departments.length === 0 ? (
          <TableRow>
            <TableCell className="px-3 py-6 text-muted-foreground">
              {listQuery.isLoading ? "Loading departments..." : "No departments found."}
            </TableCell>
            <TableCell>{null}</TableCell>
            <TableCell>{null}</TableCell>
            <TableCell>{null}</TableCell>
            <TableCell>{null}</TableCell>
          </TableRow>
        ) : (
          departments.map((department) => (
            <TableRow key={department.id}>
              <TableCell className="px-3 py-2 font-medium">{department.code}</TableCell>
              <TableCell>{department.name}</TableCell>
              <TableCell>{department._count.programs}</TableCell>
              <TableCell>{department._count.facultyDepartments}</TableCell>
              <TableCell>
                <RowActions>
                  <QuietButton type="button" onClick={() => setSelectedId(department.id)}>
                    Open
                  </QuietButton>
                  {canWrite ? (
                    <QuietButton type="button" onClick={() => startEdit(department)}>
                      Edit
                    </QuietButton>
                  ) : null}
                  {canDelete ? (
                    <QuietButton
                      type="button"
                      onClick={() => onDelete(department.id, department.code)}
                      disabled={deleteMutation.isPending}
                    >
                      Soft delete
                    </QuietButton>
                  ) : null}
                </RowActions>
              </TableCell>
            </TableRow>
          ))
        )}
      </DataTable>

      {selectedId ? (
        <section className="flex flex-col gap-4 border border-border/70 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-medium">
                {detail ? `${detail.code} — ${detail.name}` : "Department"}
              </h2>
              {detail?.description ? (
                <p className="mt-1 text-sm text-muted-foreground">{detail.description}</p>
              ) : null}
            </div>
            <RowActions>
              {canWrite && detail ? (
                <QuietButton type="button" onClick={() => startEdit(detail)}>
                  Edit
                </QuietButton>
              ) : null}
              {canDelete && detail ? (
                <QuietButton
                  type="button"
                  onClick={() => onDelete(detail.id, detail.code)}
                  disabled={deleteMutation.isPending}
                >
                  Soft delete
                </QuietButton>
              ) : null}
              <QuietButton type="button" onClick={() => setSelectedId(null)}>
                Close
              </QuietButton>
            </RowActions>
          </div>

          {detailQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading department details...</p>
          ) : detail ? (
            <div className="grid gap-6 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-medium">Programs</h3>
                {detail.programs.length === 0 ? (
                  <EmptyState title="No programs" description="This department has no programs yet." />
                ) : (
                  <ul className="space-y-2 text-sm">
                    {detail.programs.map((program) => (
                      <li key={program.id} className="border-b border-border/50 pb-2">
                        <span className="font-medium">{program.code}</span>
                        <span className="text-muted-foreground"> — {program.name}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-medium">Assigned faculties</h3>
                {detail.faculties.length === 0 ? (
                  <EmptyState
                    title="No faculties"
                    description="No faculty members are assigned to this department."
                  />
                ) : (
                  <ul className="space-y-2 text-sm">
                    {detail.faculties.map((faculty) => (
                      <li key={faculty.id} className="border-b border-border/50 pb-2">
                        <span className="font-medium">
                          {faculty.lastName}, {faculty.firstName}
                        </span>
                        <span className="text-muted-foreground">
                          {" "}
                          ({faculty.employeeNumber})
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-destructive">Department could not be loaded.</p>
          )}
        </section>
      ) : null}
    </div>
  );
}
