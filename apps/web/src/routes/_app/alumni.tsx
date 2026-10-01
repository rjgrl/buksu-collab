import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/alumni")({
  component: AlumniLayout,
});

// Layout for the alumni subtree: /_app/alumni (list), /_app/alumni/new (form),
// /_app/alumni/$id (profile detail). It renders no chrome of its own, so the list and the
// forms share one outlet.
//
// TODO(PLAKY-WEB): PLAKY-WEB-007 - add shared alumni chrome (tabs or breadcrumbs) here
// rather than repeating it in each child route.
function AlumniLayout() {
  return <Outlet />;
}