import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { Database, PermissionKey } from "@Alumni-Tracking-Ss/db";
import { ORPCError, call } from "@orpc/server";

import { writeAudit } from "./audit";
import type { Context } from "./context";
import { departmentsRouter, programsRouter } from "./routers/academic";

type DepartmentRow = {
  id: string;
  code: string;
  name: string;
  description: string;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type ProgramRow = {
  id: string;
  code: string;
  name: string;
  description: string;
  departmentId: string;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type AuditRow = {
  id: string;
  actorId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  summary: string;
  metadata?: object;
  ipAddress: string | null;
};

class PrismaLikeError extends Error {
  code: string;

  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

function matches(row: Record<string, unknown>, where: unknown): boolean {
  if (where == null || typeof where !== "object") {
    return true;
  }

  const clause = where as Record<string, unknown>;
  if (Array.isArray(clause.AND)) {
    return clause.AND.every((part) => matches(row, part));
  }
  if (Array.isArray(clause.OR)) {
    return clause.OR.some((part) => matches(row, part));
  }

  return Object.entries(clause).every(([key, value]) => {
    if (key === "deletedAt") {
      if (value === null) {
        return row.deletedAt == null;
      }
      if (typeof value === "object" && value !== null && "isSet" in value) {
        const isSet = (value as { isSet: boolean }).isSet;
        return isSet ? row.deletedAt != null : row.deletedAt == null;
      }
    }
    return row[key] === value;
  });
}

function createMemoryDb() {
  const departments: DepartmentRow[] = [];
  const programs: ProgramRow[] = [];
  const audits: AuditRow[] = [];
  let sequence = 0;

  const nextId = () => {
    sequence += 1;
    return `00000000000000000000000${sequence}`.slice(-24);
  };

  const db = {
    department: {
      async create({ data }: { data: Omit<DepartmentRow, "id" | "createdAt" | "updatedAt"> }) {
        if (departments.some((row) => row.code === data.code)) {
          throw new PrismaLikeError("P2002");
        }
        const now = new Date();
        const row: DepartmentRow = {
          id: nextId(),
          createdAt: now,
          updatedAt: now,
          ...data,
        };
        departments.push(row);
        return row;
      },
      async findFirst({ where }: { where: unknown }) {
        return departments.find((row) => matches(row, where)) ?? null;
      },
      async update({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<DepartmentRow>;
      }) {
        const row = departments.find((item) => item.id === where.id);
        if (!row) {
          throw new PrismaLikeError("P2025");
        }
        if (data.code && departments.some((item) => item.code === data.code && item.id !== row.id)) {
          throw new PrismaLikeError("P2002");
        }
        Object.assign(row, data, { updatedAt: new Date() });
        return row;
      },
    },
    program: {
      async create({ data }: { data: Omit<ProgramRow, "id" | "createdAt" | "updatedAt"> }) {
        if (programs.some((row) => row.departmentId === data.departmentId && row.code === data.code)) {
          throw new PrismaLikeError("P2002");
        }
        const now = new Date();
        const row: ProgramRow = {
          id: nextId(),
          createdAt: now,
          updatedAt: now,
          ...data,
        };
        programs.push(row);
        return row;
      },
      async findFirst({ where }: { where: unknown }) {
        if (typeof where === "object" && where !== null) {
          const id = extractId(where);
          if (id === "bad-object-id") {
            throw new PrismaLikeError("P2023");
          }
        }
        return programs.find((row) => matches(row, where)) ?? null;
      },
      async update({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<ProgramRow>;
      }) {
        const row = programs.find((item) => item.id === where.id);
        if (!row) {
          throw new PrismaLikeError("P2025");
        }
        const nextCode = data.code ?? row.code;
        const nextDepartmentId = data.departmentId ?? row.departmentId;
        if (
          programs.some(
            (item) =>
              item.id !== row.id && item.departmentId === nextDepartmentId && item.code === nextCode,
          )
        ) {
          throw new PrismaLikeError("P2002");
        }
        Object.assign(row, data, { updatedAt: new Date() });
        return row;
      },
    },
    auditLog: {
      async create({ data }: { data: Omit<AuditRow, "id"> }) {
        const row: AuditRow = { id: nextId(), ...data };
        audits.push(row);
        return row;
      },
    },
  };

  return { db: db as unknown as Database, departments, programs, audits };
}

function extractId(where: object): string | undefined {
  if ("id" in where && typeof where.id === "string") {
    return where.id;
  }
  if ("AND" in where && Array.isArray(where.AND)) {
    for (const part of where.AND) {
      if (part && typeof part === "object" && "id" in part && typeof part.id === "string") {
        return part.id;
      }
    }
  }
  return undefined;
}

function makeContext(db: Database, permissions: PermissionKey[]): Context {
  return {
    db,
    sessionToken: "session",
    user: {
      id: "user-1",
      name: "Admin",
      email: "admin@alumni.local",
      image: null,
      status: "active",
      roles: ["super_admin"],
      permissions,
    },
    ipAddress: "127.0.0.1",
    userAgent: "test",
    integrationEnv: {},
  };
}

const academicPermissions = [
  "departments.write",
  "departments.delete",
  "programs.write",
  "programs.delete",
] as const;

async function invoke<T>(procedure: unknown, input: unknown, context: Context) {
  return (await call(procedure as Parameters<typeof call>[0], input, { context })) as T;
}

describe("departments", () => {
  it("creates a department with an upper-cased code and an audit entry", async () => {
    const memory = createMemoryDb();
    const context = makeContext(memory.db, [...academicPermissions]);

    const created = await invoke<DepartmentRow>(departmentsRouter.create, {
      code: "it",
      name: "Information Technology",
      description: "Computing programs",
    }, context);

    assert.equal(created.code, "IT");
    assert.equal(created.name, "Information Technology");
    assert.equal(created.description, "Computing programs");
    assert.equal(created.deletedAt, null);
    assert.equal(memory.audits.length, 1);
    assert.equal(memory.audits[0]?.action, "create");
    assert.equal(memory.audits[0]?.entity, "Department");
    assert.equal(memory.audits[0]?.entityId, created.id);
    assert.equal(memory.audits[0]?.actorId, "user-1");
    assert.equal(memory.audits[0]?.ipAddress, "127.0.0.1");
    assert.match(memory.audits[0]?.summary ?? "", /Created department IT/);
  });

  it("rejects a duplicate department code", async () => {
    const memory = createMemoryDb();
    const context = makeContext(memory.db, [...academicPermissions]);
    await invoke(departmentsRouter.create, { code: "IT", name: "Information Technology" }, context);

    await assert.rejects(
      () => invoke(departmentsRouter.create, { code: "it", name: "Another" }, context),
      (error: unknown) => error instanceof ORPCError && error.code === "CONFLICT",
    );
    assert.equal(memory.departments.length, 1);
  });

  it("updates code, name, and description", async () => {
    const memory = createMemoryDb();
    const context = makeContext(memory.db, [...academicPermissions]);
    const created = await invoke<DepartmentRow>(
      departmentsRouter.create,
      { code: "educ", name: "Education", description: "Old" },
      context,
    );

    const updated = await invoke<DepartmentRow>(
      departmentsRouter.update,
      { id: created.id, code: "coe", name: "College of Education", description: "Teacher education" },
      context,
    );

    assert.equal(updated.code, "COE");
    assert.equal(updated.name, "College of Education");
    assert.equal(updated.description, "Teacher education");
    assert.equal(memory.audits.at(-1)?.action, "update");
    assert.equal(memory.audits.at(-1)?.entity, "Department");
  });

  it("returns NOT_FOUND when updating a missing or soft-deleted department", async () => {
    const memory = createMemoryDb();
    const context = makeContext(memory.db, [...academicPermissions]);
    const created = await invoke<DepartmentRow>(
      departmentsRouter.create,
      { code: "IT", name: "Information Technology" },
      context,
    );
    await invoke(departmentsRouter.delete, { id: created.id }, context);

    await assert.rejects(
      () =>
        invoke(departmentsRouter.update, { id: created.id, code: "IT", name: "Renamed" }, context),
      (error: unknown) => error instanceof ORPCError && error.code === "NOT_FOUND",
    );
    await assert.rejects(
      () => invoke(departmentsRouter.update, { id: "missing", code: "IT", name: "Renamed" }, context),
      (error: unknown) => error instanceof ORPCError && error.code === "NOT_FOUND",
    );
  });

  it("soft-deletes a department so a later active lookup misses it", async () => {
    const memory = createMemoryDb();
    const context = makeContext(memory.db, [...academicPermissions]);
    const created = await invoke<DepartmentRow>(
      departmentsRouter.create,
      { code: "IT", name: "Information Technology" },
      context,
    );

    const deleted = await invoke<DepartmentRow>(departmentsRouter.delete, { id: created.id }, context);

    assert.ok(deleted.deletedAt instanceof Date);
    assert.equal(memory.audits.at(-1)?.action, "delete");
    assert.equal(memory.audits.at(-1)?.entity, "Department");
    await assert.rejects(
      () => invoke(departmentsRouter.delete, { id: created.id }, context),
      (error: unknown) => error instanceof ORPCError && error.code === "NOT_FOUND",
    );
  });
});

describe("programs", () => {
  it("creates a program on a department and writes an audit entry", async () => {
    const memory = createMemoryDb();
    const context = makeContext(memory.db, [...academicPermissions]);
    const department = await invoke<DepartmentRow>(
      departmentsRouter.create,
      { code: "it", name: "Information Technology" },
      context,
    );

    const program = await invoke<ProgramRow>(
      programsRouter.create,
      {
        code: "bsit",
        name: "BS Information Technology",
        description: "Undergraduate",
        departmentId: department.id,
      },
      context,
    );

    assert.equal(program.code, "BSIT");
    assert.equal(program.departmentId, department.id);
    assert.equal(program.description, "Undergraduate");
    assert.equal(memory.audits.at(-1)?.action, "create");
    assert.equal(memory.audits.at(-1)?.entity, "Program");
    assert.equal(memory.audits.at(-1)?.entityId, program.id);
  });

  it("rejects an unknown or inactive department", async () => {
    const memory = createMemoryDb();
    const context = makeContext(memory.db, [...academicPermissions]);
    const department = await invoke<DepartmentRow>(
      departmentsRouter.create,
      { code: "IT", name: "Information Technology" },
      context,
    );
    await invoke(departmentsRouter.delete, { id: department.id }, context);

    await assert.rejects(
      () =>
        invoke(
          programsRouter.create,
          { code: "BSIT", name: "BSIT", departmentId: "missing-department" },
          context,
        ),
      (error: unknown) => error instanceof ORPCError && error.code === "BAD_REQUEST",
    );
    await assert.rejects(
      () =>
        invoke(
          programsRouter.create,
          { code: "BSIT", name: "BSIT", departmentId: department.id },
          context,
        ),
      (error: unknown) => error instanceof ORPCError && error.code === "BAD_REQUEST",
    );
    assert.equal(memory.programs.length, 0);
  });

  it("updates program details and can move it to another department", async () => {
    const memory = createMemoryDb();
    const context = makeContext(memory.db, [...academicPermissions]);
    const it = await invoke<DepartmentRow>(
      departmentsRouter.create,
      { code: "IT", name: "Information Technology" },
      context,
    );
    const educ = await invoke<DepartmentRow>(
      departmentsRouter.create,
      { code: "EDUC", name: "Education" },
      context,
    );
    const program = await invoke<ProgramRow>(
      programsRouter.create,
      { code: "BSIT", name: "BS Information Technology", departmentId: it.id },
      context,
    );

    const updated = await invoke<ProgramRow>(
      programsRouter.update,
      {
        id: program.id,
        code: "bsed",
        name: "BS Education",
        description: "Moved",
        departmentId: educ.id,
      },
      context,
    );

    assert.equal(updated.code, "BSED");
    assert.equal(updated.name, "BS Education");
    assert.equal(updated.description, "Moved");
    assert.equal(updated.departmentId, educ.id);
    assert.equal(memory.audits.at(-1)?.action, "update");
    assert.equal(memory.audits.at(-1)?.entity, "Program");
  });

  it("rejects a move onto an unknown department and a duplicate code", async () => {
    const memory = createMemoryDb();
    const context = makeContext(memory.db, [...academicPermissions]);
    const it = await invoke<DepartmentRow>(
      departmentsRouter.create,
      { code: "IT", name: "Information Technology" },
      context,
    );
    const educ = await invoke<DepartmentRow>(
      departmentsRouter.create,
      { code: "EDUC", name: "Education" },
      context,
    );
    const bsit = await invoke<ProgramRow>(
      programsRouter.create,
      { code: "BSIT", name: "BS Information Technology", departmentId: it.id },
      context,
    );
    await invoke(
      programsRouter.create,
      { code: "BSED", name: "BS Education", departmentId: educ.id },
      context,
    );

    await assert.rejects(
      () =>
        invoke(
          programsRouter.update,
          { id: bsit.id, code: "BSIT", name: "BSIT", departmentId: "missing" },
          context,
        ),
      (error: unknown) => error instanceof ORPCError && error.code === "BAD_REQUEST",
    );
    await assert.rejects(
      () =>
        invoke(
          programsRouter.update,
          { id: bsit.id, code: "BSED", name: "BS Education", departmentId: educ.id },
          context,
        ),
      (error: unknown) => error instanceof ORPCError && error.code === "CONFLICT",
    );
    await assert.rejects(
      () => invoke(programsRouter.update, { id: "missing", code: "BSIT", name: "BSIT", departmentId: it.id }, context),
      (error: unknown) => error instanceof ORPCError && error.code === "NOT_FOUND",
    );
  });

  it("allows the same program code in a different department", async () => {
    const memory = createMemoryDb();
    const context = makeContext(memory.db, [...academicPermissions]);
    const it = await invoke<DepartmentRow>(
      departmentsRouter.create,
      { code: "IT", name: "Information Technology" },
      context,
    );
    const educ = await invoke<DepartmentRow>(
      departmentsRouter.create,
      { code: "EDUC", name: "Education" },
      context,
    );

    await invoke(programsRouter.create, { code: "GEN", name: "General IT", departmentId: it.id }, context);
    const second = await invoke<ProgramRow>(
      programsRouter.create,
      { code: "gen", name: "General Education", departmentId: educ.id },
      context,
    );

    assert.equal(second.code, "GEN");
    assert.equal(second.departmentId, educ.id);
  });

  it("soft-deletes a program", async () => {
    const memory = createMemoryDb();
    const context = makeContext(memory.db, [...academicPermissions]);
    const department = await invoke<DepartmentRow>(
      departmentsRouter.create,
      { code: "IT", name: "Information Technology" },
      context,
    );
    const program = await invoke<ProgramRow>(
      programsRouter.create,
      { code: "BSIT", name: "BS Information Technology", departmentId: department.id },
      context,
    );

    const deleted = await invoke<ProgramRow>(programsRouter.delete, { id: program.id }, context);

    assert.ok(deleted.deletedAt instanceof Date);
    assert.equal(memory.audits.at(-1)?.action, "delete");
    assert.equal(memory.audits.at(-1)?.entity, "Program");
    await assert.rejects(
      () => invoke(programsRouter.delete, { id: program.id }, context),
      (error: unknown) => error instanceof ORPCError && error.code === "NOT_FOUND",
    );
  });
});

describe("academic permission gate", () => {
  it("rejects a caller missing departments.write", async () => {
    const memory = createMemoryDb();
    const context = makeContext(memory.db, ["departments.read"]);

    await assert.rejects(
      () => invoke(departmentsRouter.create, { code: "IT", name: "Information Technology" }, context),
      (error: unknown) => error instanceof ORPCError && error.code === "FORBIDDEN",
    );
    assert.equal(memory.departments.length, 0);
    assert.equal(memory.audits.length, 0);
  });
});

describe("writeAudit", () => {
  it("does not throw when the entity is missing", async () => {
    const memory = createMemoryDb();
    await writeAudit(memory.db, { action: "create", entity: "   " });
    assert.equal(memory.audits.length, 0);
  });
});
