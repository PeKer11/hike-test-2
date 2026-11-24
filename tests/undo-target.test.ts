import { describe, expect, it } from "vitest";

import { undoTargetFor } from "@/lib/walk/undo-target";

describe("undoTargetFor", () => {
  it("prefers the snapshot taken before the chat edit", () => {
    expect(undoTargetFor("first", "before-edit")).toBe("before-edit");
  });
  it("a first edit with no snapshot falls back to the chain's first plan", () => {
    expect(undoTargetFor("first", null)).toBe("first");
    expect(undoTargetFor("first", undefined)).toBe("first");
  });
  it("nothing to undo to", () => {
    expect(undoTargetFor(null, null)).toBeNull();
  });
});
