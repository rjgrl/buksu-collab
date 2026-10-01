import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { DataTable, QuietButton, TableCell, TableRow } from "@/components/data-table";
import { EmptyState, PageHeader } from "@/components/page-header";
import { useSession } from "@/lib/session";
import { orpc } from "@/utils/orpc";

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
//
// ALM-007 scope for this pass: list + open (programs and assigned faculties).
function DepartmentsPage() {
  useSession();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

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

  const departments = listQuery.data ?? [];
  const detail = detailQuery.data;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Departments"
        description="Browse academic departments, their programs, and assigned faculties."
      />

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
                <QuietButton type="button" onClick={() => setSelectedId(department.id)}>
                  Open
                </QuietButton>
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
            <QuietButton type="button" onClick={() => setSelectedId(null)}>
              Close
            </QuietButton>
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
