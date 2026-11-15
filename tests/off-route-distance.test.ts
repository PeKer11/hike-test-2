import { describe, expect, it } from "vitest";

import { clampDeviationDistance, DEFAULT_WALK_SETTINGS } from "@/lib/types/walk-settings";
import { nextOffRouteState } from "@/lib/walk/deviation-detector";

describe("off-route distance setting", () => {
  it("defaults to 20 m and is clamped to 10-200", () => {
    expect(DEFAULT_WALK_SETTINGS.deviationDistanceM).toBe(20);
    expect(clampDeviationDistance(2)).toBe(10);
    expect(clampDeviationDistance(900)).toBe(200);
    expect(clampDeviationDistance(NaN)).toBe(20);
  });

  it("goes off route past the set distance, and back on below 60% of it", () => {
    expect(nextOffRouteState(false, 15, 5, 20)).toBe(false);
    expect(nextOffRouteState(false, 25, 5, 20)).toBe(true);
    expect(nextOffRouteState(true, 15, 5, 20)).toBe(true);
    expect(nextOffRouteState(true, 10, 5, 20)).toBe(false);
  });
});
