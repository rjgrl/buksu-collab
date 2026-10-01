import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { notDeleted, notDeletedFilter, withNotDeleted } from "./filters";

describe("withNotDeleted", () => {
  // TODO(PLAKY-PLATFORM): PLAKY-DB-005 - implement and assert the soft-delete helpers.
  it("includes unset MongoDB deletedAt fields", () => {
    // TODO(PLAKY-DB-005 - the OR-form is required so legacy unset rows are matched.
    assert.deepEqual(notDeleted.OR, [{ deletedAt: null }, { deletedAt: { isSet: false } }]);
  });

  it("returns the base filter when no extra where is provided", () => {
    assert.deepEqual(withNotDeleted(), notDeletedFilter());
    assert.deepEqual(withNotDeleted({}), notDeletedFilter());
  });

  it("combines extra filters with AND so search OR cannot overwrite deletedAt", () => {
    const where = withNotDeleted({
      OR: [{ name: { contains: "IT" } }],
    });
    assert.deepEqual(where, {
      AND: [notDeleted, { OR: [{ name: { contains: "IT" } }] }],
    });
  });
});