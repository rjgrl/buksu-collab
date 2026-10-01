import type { IntegrationEnv } from "../context";
import type { AlumniImportRow } from "../validation";
import { alumniImportRowSchema } from "../validation";

// Google Forms ingestion.
//
// The webhook in apps/server/src/index.ts cannot know a form's question titles, so the
// payload keys are normalised (lowercased, punctuation stripped) and matched against a list
// of accepted aliases per field. Adding a new form question means adding its alias here.

// TODO(PLAKY-INTEGRATIONS): PLAKY-INT-009 - implement the form payload mapping.
// Contract: build a candidate object from the alias lists below and hand it to
// alumniImportRowSchema.parse() so a malformed submission is rejected with BAD_REQUEST by
// the caller rather than partially imported.
export function mapFormPayload(payload: Record<string, unknown>): AlumniImportRow {
  void payload;
  void lowerKeys;
  void pick;
  void alumniImportRowSchema;
  throw new Error("TODO(PLAKY-INT-009): implement mapFormPayload");
}

// TODO(PLAKY-INT-009 - strip every non-alphanumeric character and lowercase the key so
// "Student Number", "student_number", and "Student#Number" all collapse to one lookup key.
function lowerKeys(payload: Record<string, unknown>) {
  throw new Error("TODO(PLAKY-INT-009): implement lowerKeys");
}

// TODO(PLAKY-INT-009 - return the first non-empty value among the candidate keys.
function pick(source: Record<string, unknown>, keys: string[]) {
  throw new Error("TODO(PLAKY-INT-009): implement pick");
}

/**
 * Accepted form question titles per alumni field. Keep in sync with
 * docs/integrations/google-forms.md.
 */
export const FORM_FIELD_ALIASES = {
  studentNumber: ["studentnumber", "student_number", "student no", "id number"],
  firstName: ["firstname", "first_name", "given name"],
  lastName: ["lastname", "last_name", "surname", "family name"],
  middleName: ["middlename", "middle_name"],
  gender: ["gender", "sex"],
  graduationYear: ["graduationyear", "graduation_year", "year graduated"],
  batch: ["batch", "year level"],
  mobileNumber: ["mobilenumber", "mobile", "mobile #", "phone"],
  personalEmail: ["personalemail", "email", "personal email"],
  facebookAccount: ["facebookaccount", "facebook", "facebook account"],
  programCode: ["programcode", "program_code", "program"],
  departmentCode: ["departmentcode", "department_code", "department"],
  isTracked: ["istracked", "tracked", "is_tracked"],
} as const;