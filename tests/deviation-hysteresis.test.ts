import { describe, expect, it } from "vitest";

import { nextOffRouteState } from "@/lib/walk/deviation-detector";

describe("nextOffRouteState", () => {
  it("turns off-route only beyond 50 m and beyond the fix's own accuracy", () => {
    expect(nextOffRouteState(false, 60, 10)).toBe(true);
    expect(nextOffRouteState(false, 45, 10)).toBe(false);
    // 60 m off, but the fix itself is +-55... too poor to act on at all.
    expect(nextOffRouteState(false, 60, 55)).toBe(false);
    // 60 m off with a 40 m error radius: still beyond accuracy.
    expect(nextOffRouteState(false, 60, 40)).toBe(true);
    expect(nextOffRouteState(false, 60, 60)).toBe(false);
  });

  it("returns on-route only under 30 m (hysteresis band keeps the previous answer)", () => {
    expect(nextOffRouteState(true, 40, 10)).toBe(true);
    expect(nextOffRouteState(true, 29, 10)).toBe(false);
    expect(nextOffRouteState(false, 40, 10)).toBe(false);
  });

  it("a fix with accuracy over 50 m never changes the state", () => {
    expect(nextOffRouteState(true, 5, 75)).toBe(true);
    expect(nextOffRouteState(false, 200, 75)).toBe(false);
  });
});
