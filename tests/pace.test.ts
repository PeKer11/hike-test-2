import { describe, expect, it } from "vitest";

import { clampPace, DEFAULT_PACE_MIN_PER_KM, PACE_FACTOR } from "@/lib/walk/pace";

describe("pace", () => {
  it("presets around the default match brisk/normal/slow", () => {
    expect(Math.round(DEFAULT_PACE_MIN_PER_KM * PACE_FACTOR.brisk)).toBe(12);
    expect(DEFAULT_PACE_MIN_PER_KM * PACE_FACTOR.normal).toBe(15);
    expect(Math.round(DEFAULT_PACE_MIN_PER_KM * PACE_FACTOR.stroll)).toBe(20);
  });
  it("clamps to 6-40 min/km", () => {
    expect(clampPace(3)).toBe(6);
    expect(clampPace(90)).toBe(40);
    expect(clampPace(14)).toBe(14);
  });
});
