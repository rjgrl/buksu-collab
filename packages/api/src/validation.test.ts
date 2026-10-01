import { describe, it } from "node:test";

// TODO(PLAKY-REPORTS): PLAKY-REPT-001 - un-comment the imports below once the CSV
// helpers in ./validation are implemented.
//
// import assert from "node:assert/strict";
// import { csvToObjects, parseCsv, quoteCsv, toCsv } from "./validation";
// import { mapFormPayload } from "./integrations/forms";

// Compliance checklist mirrored from the source system. Each entry becomes a real
// `it(...)` block as the corresponding module lands in Plaky.
describe("csv quoting", () => {
  it.todo("quotes commas and quotes");
  it.todo("round-trips rows");
  it.todo("parses empty input as no rows");
});

describe("google form mapping", () => {
  it.todo("maps common form titles onto alumni fields");
});