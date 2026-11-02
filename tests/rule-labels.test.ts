import { describe, expect, it } from "vitest";

import { describeRule } from "@/lib/assistant/rule-labels";

describe("describeRule", () => {
  it("never shows raw rule ids or statuses", () => {
    expect(describeRule("surface", "partial")).toBe("surface type (only partly known)");
    expect(describeRule("open_hours", "not_checked")).toBe("opening hours (no data)");
  });
  it("speaks Hebrew when asked, with no raw ids", () => {
    expect(describeRule("surface", "partial", true)).toBe("סוג המשטח (ידוע רק חלקית)");
    expect(describeRule("open_hours", "not_checked", true)).toBe("שעות פתיחה (אין נתונים)");
    expect(describeRule("some_new_rule", "not_checked", true)).toBe("some new rule (אין נתונים)");
  });
  it("falls back to a readable name for an unknown rule", () => {
    expect(describeRule("some_new_rule")).toBe("some new rule");
  });
});
