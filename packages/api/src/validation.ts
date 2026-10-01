import { z } from "zod";

// Shared input schemas and CSV helpers.
//
// The schemas below are the contract between the browser forms (apps/web) and the router
// procedures. Keep the field names, defaults, and string constraints intact; the report
// exporter and the bulk importer both rely on them.

// TODO(PLAKY-PLATFORM): PLAKY-API-001 - verify the primitive field schemas.
export const objectIdSchema = z.string().min(1);

export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
});

export const emailSchema = z.string().trim().email();

export const optionalEmailSchema = z
  .string()
  .trim()
  .email()
  .optional()
  .or(z.literal("").transform(() => undefined));

export const mobileSchema = z
  .string()
  .trim()
  .max(30)
  .regex(/^[0-9+\-() ]+$/, "Enter a valid mobile number.")
  .optional()
  .or(z.literal("").transform(() => undefined));

export const facebookSchema = z
  .string()
  .trim()
  .max(200)
  .optional()
  .or(z.literal("").transform(() => undefined));

export const codeSchema = z
  .string()
  .trim()
  .min(1)
  .max(32)
  .regex(/^[A-Za-z0-9_-]+$/, "Use letters, numbers, dashes, or underscores.");

// TODO(PLAKY-AUTH): PLAKY-AUTH-006 - auth input contracts (8..128 char password).
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(8).max(128),
  recaptchaToken: z.string().optional(),
  recaptchaFallback: z.boolean().optional(),
});

export const signupSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: emailSchema,
  password: z.string().min(8).max(128),
  recaptchaToken: z.string().optional(),
  recaptchaFallback: z.boolean().optional(),
});

// TODO(PLAKY-ACADEMIC): PLAKY-ACAD-002 - academic structure input contracts.
export const departmentInputSchema = z.object({
  code: codeSchema,
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).optional(),
});

export const programInputSchema = z.object({
  code: codeSchema,
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).optional(),
  departmentId: objectIdSchema,
});

export const facultyInputSchema = z.object({
  employeeNumber: z.string().trim().min(1).max(40),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: optionalEmailSchema,
  departmentIds: z.array(objectIdSchema).default([]),
});

// TODO(PLAKY-ALUMNI): PLAKY-ALUM-002 - alumni profile, employment, and tracking contracts.
export const alumniInputSchema = z.object({
  studentNumber: z.string().trim().min(1).max(40),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  middleName: z.string().trim().max(80).optional(),
  gender: z.string().trim().max(40).optional(),
  graduationYear: z.number().int().min(1950).max(2100).optional(),
  batch: z.string().trim().max(40).optional(),
  mobileNumber: mobileSchema,
  personalEmail: optionalEmailSchema,
  facebookAccount: facebookSchema,
  programId: objectIdSchema,
  employmentStatus: z.enum(["employed", "unemployed", "unknown"]).optional(),
});

export const employmentInputSchema = z.object({
  alumniId: objectIdSchema,
  employer: z.string().trim().min(1).max(160),
  jobTitle: z.string().trim().max(160).optional(),
  industry: z.string().trim().max(160).optional(),
  location: z.string().trim().max(160).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  isCurrent: z.boolean().default(false),
  status: z.enum(["employed", "unemployed", "unknown"]).default("employed"),
  notes: z.string().trim().max(2000).optional(),
});

export const trackingInputSchema = z.object({
  alumniId: objectIdSchema,
  isTracked: z.boolean(),
  notes: z.string().trim().max(2000).optional(),
  source: z.string().trim().max(40).optional(),
});

// TODO(PLAKY-RBAC): PLAKY-RBAC-010 - user and role admin contracts.
export const userInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: emailSchema,
  password: z.string().min(8).max(128).optional(),
  status: z.enum(["active", "disabled"]).optional(),
  roleIds: z.array(objectIdSchema).default([]),
});

export const roleInputSchema = z.object({
  key: codeSchema,
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(400).optional(),
  permissionIds: z.array(objectIdSchema).default([]),
});

// TODO(PLAKY-INTEGRATIONS): PLAKY-INT-003 - bulk import row contract.
// Columns arrive from CSV uploads, Google Sheets, and the Google Forms webhook, all of
// which supply strings; graduationYear is coerced and isTracked accepts several spellings.
export const alumniImportRowSchema = z.object({
  studentNumber: z.string().trim().min(1),
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  middleName: z.string().trim().optional(),
  gender: z.string().trim().optional(),
  graduationYear: z.coerce.number().int().optional(),
  batch: z.string().trim().optional(),
  mobileNumber: z.string().trim().optional(),
  personalEmail: z.string().trim().email().optional().or(z.literal("")),
  facebookAccount: z.string().trim().optional(),
  programCode: z.string().trim().min(1),
  departmentCode: z.string().trim().min(1),
  isTracked: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((value) => {
      if (value === true || value === "true" || value === "1" || value === "yes") {
        return true;
      }
      return false;
    }),
});

export type AlumniImportRow = z.infer<typeof alumniImportRowSchema>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// TODO(PLAKY-REPORTS): PLAKY-REPT-001 - implement the CSV helpers below.
// parseCsv: RFC4180-style tokenizer (quoted fields, escaped "" quotes, CRLF, skips
//   blank rows) -> string[][].
// csvToObjects: first row is the header; produce Record<header, cell> per row.
// quoteCsv: wrap a value in double quotes when it contains " , newline or CR.
// toCsv: header row plus rows, all quoted, newline-terminated output.
export function parseCsv(_text: string): string[][] {
  throw new Error("TODO(PLAKY-REPT-001): implement parseCsv");
}

export function csvToObjects(_text: string): Record<string, string>[] {
  throw new Error("TODO(PLAKY-REPT-001): implement csvToObjects");
}

export function quoteCsv(_value: string): string {
  throw new Error("TODO(PLAKY-REPT-001): implement quoteCsv");
}

export function toCsv(
  _headers: string[],
  _rows: Array<Array<string | number | boolean | null | undefined>>,
): string {
  throw new Error("TODO(PLAKY-REPT-001): implement toCsv");
}

// TODO(PLAKY-PLATFORM): PLAKY-API-002 - loose email check used by the importer to skip
// unusable personal emails without failing the whole row.
export function isEmail(value: string) {
  return EMAIL_RE.test(value);
}