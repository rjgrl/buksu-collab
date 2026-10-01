import { useQuery } from "@tanstack/react-query";

import { orpc } from "@/utils/orpc";

// Session and raw-fetch helpers shared by every screen.
//
// `useSession` is the client-side source of truth for the current user and their resolved
// permission list; `can()` is the client mirror of requirePermission() on the server. The
// server remains authoritative - these only decide what to render.
//
// `postJson` exists for the raw /api/auth/* routes, which are not part of the oRPC router.

// Contract: orpc.auth.me query with a 30s staleTime so permission-gated navigation does not
// flicker, and so a revoked role disappears within 30 seconds.
export function useSession() {
  return useQuery({
    ...orpc.auth.me.queryOptions(),
    staleTime: 30_000,
  });
}

// Treat an undefined permission list as "no access" so the UI hides controls while the
// session is still loading.
export function can(permissions: string[] | undefined, permission: string) {
  return permissions?.includes(permission) ?? false;
}

// TODO(PLAKY-AUTH): PLAKY-AUTH-026 - implement postJson.
// Contract: POST JSON with credentials included; on a non-2xx response throw an Error
// carrying the server's `error` field so callers can show it verbatim in a toast.
export async function postJson<T>(url: string, body: unknown) {
  void url;
  void body;
  throw new Error("TODO(PLAKY-AUTH-026): implement postJson");
}