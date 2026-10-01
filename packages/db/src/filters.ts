// TODO(PLAKY-PLATFORM): PLAKY-DB-004 - implement the MongoDB soft-delete filter.
// MongoDB omits optional null fields unless they are set explicitly, so a plain
// `{ deletedAt: null }` misses unset fields. This helper is used by every list query in
// packages/api/src/routers/* and must keep returning the OR-form.
export function notDeletedFilter() {
  return {
    OR: [{ deletedAt: null }, { deletedAt: { isSet: false } }],
  };
}

export const notDeleted = notDeletedFilter();

// TODO(PLAKY-PLATFORM): PLAKY-DB-005 - implement the `where` combiner.
// Callers pass an optional Prisma `where` fragment and expect it merged with the
// soft-delete clause via AND, so `withNotDeleted(undefined)` collapses to the base filter.
export function withNotDeleted<T extends Record<string, unknown>>(where?: T) {
  const base = notDeletedFilter();
  if (!where || Object.keys(where).length === 0) {
    return base;
  }

  return {
    AND: [base, where],
  };
}