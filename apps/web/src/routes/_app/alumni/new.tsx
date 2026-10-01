import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { FormField, PageHeader, PrimaryButton } from "@/components/page-header";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/_app/alumni/new")({
  component: NewAlumniPage,
});

// TODO(PLAKY-ALUMNI): PLAKY-ALUM-005 - implement the "create alumni" form.
//
// Required behaviour (see docs/alumni-profile/student-details.md and
// docs/alumni-profile/contact-info.md):
//   - program picker fed by orpc.programs.list; the program decides the owning department
//   - student details: studentNumber, firstName, lastName, middleName, gender,
//     graduationYear, batch
//   - contact info: mobileNumber, personalEmail, facebookAccount
//   - submit through client.alumni.create (a mutation, not a query) and show server
//     validation messages field-by-field
//   - on success invalidate the query cache and navigate back to /alumni
//   - the whole form is hidden unless the session holds alumni.write
function NewAlumniPage() {
  void useNavigate;
  void useSession;
  void FormField;
  void PrimaryButton;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="New alumni"
        description="TODO(PLAKY-ALUM-005): implement the create-alumni form."
      />
    </div>
  );
}