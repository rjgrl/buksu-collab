import { useQuery } from "@tanstack/react-query";

import { orpc } from "@/utils/orpc";

// Session and raw-fetch helpers shared by every screen.
//
// `useSession` is the client-side source of truth for the current user and their resolved
// permission list; `can()` is the client mirror of requirePermission() on the server. The
// server remains authoritative - these only decide what to render.
//
// `postJson` exists for the raw /api/auth/* routes, which are not part of the oRPC router.

// TODO(PLAKY-WEB): PLAKY-WEB-003 - implement useSession.
// Contract: orpc.auth.me query with a 30s staleTime so permission-gated navigation does not
// flicker, and so a revoked role disappears within 30 seconds.
export function useSession() {
  return useQuery({
    ...orpc.auth.me.queryOptions(),
    staleTime: 30_000,
  });
}

// TODO(PLAKY-RBAC): PLAKY-RBAC-015 - implement `can`. Must treat an undefined permission
// list as "no access" so the UI hides controls while the session is still loading.
export function can(permissions: string[] | undefined, permission: string) {
  if (!permissions) {
    return false;
  }
  return permissions.includes(permission);
}

// TODO(PLAKY-AUTH): PLAKY-AUTH-026 - implement postJson.
// Contract: POST JSON with credentials included; on a non-2xx response throw an Error
// carrying the server's `error` field so callers can show it verbatim in a toast.
export async function postJson<T>(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  let payload: { error?: string } & T = {} as { error?: string } & T;
  try {
    payload = (await response.json()) as { error?: string } & T;
  } catch {
    // Non-JSON error bodies still become a generic failure below.
  }

  if (!response.ok) {
    throw new Error(payload.error || "Request failed.");
  }

  return payload;
}
