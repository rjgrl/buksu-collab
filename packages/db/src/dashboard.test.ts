import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { percentTracked } from "./dashboard";

describe("percentTracked", () => {
  // TODO(PLAKY-DASHBOARD): PLAKY-DASH-001 - implement and assert the metric.
  it("returns 0 when there are no graduates", () => {
    // TODO(PLAKY-DASH-001 - graduates <= 0 must short-circuit to 0.
    assert.equal(percentTracked(0, 0), 0);
    assert.equal(percentTracked(0, 10), 0);
  });

  it("uses tracked / graduates * 100", () => {
    // TODO(PLAKY-DASH-001 - rounding must be to 2 decimals.
    assert.equal(percentTracked(14750, 10000), 67.8);
    assert.equal(percentTracked(4, 1), 25);
    assert.equal(percentTracked(3, 1), 33.33);
  });
});