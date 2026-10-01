import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/components/page-header";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/_app/alumni/$id")({
  component: AlumniDetailPage,
});

// TODO(PLAKY-ALUMNI): PLAKY-ALUM-008 - implement the alumni profile detail screen.
// This is the screen that assembles every alumni-profile doc section into one record.
//
// Required behaviour:
//   student details  - editable profile fields, saved through client.alumni.update
//                     (docs/alumni-profile/student-details.md)
//   contact info     - mobile number, personal email, Facebook account
//                     (docs/alumni-profile/contact-info.md)
//   employment       - history list plus an add form through client.alumni.addEmployment;
//                     at most one row may be current
//                     (docs/alumni-profile/employment.md)
//   tracking         - the tracked toggle and notes through client.alumni.addTracking, which
//                     is the only write path that changes Alumni.isTracked
//                     (docs/alumni-profile/tracking.md)
//   evidence         - upload to POST /api/files/evidence (multipart) and download through
//                     GET /api/files/:id
//                     (docs/integrations/google-drive-evidence.md)
//   soft delete      - shown only with alumni.delete, then navigate back to /alumni
//
// Permission-gate every section with can(session.data?.permissions, key); each write
// button uses its own permission rather than one coarse "can edit" check.
function AlumniDetailPage() {
  void useSession;
  void PageHeader;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Alumni profile"
        description="TODO(PLAKY-ALUM-008): implement the profile detail screen."
      />
    </div>
  );
}