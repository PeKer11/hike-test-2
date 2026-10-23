import { describe, expect, it } from "vitest";

import { distanceM, namesOverlap } from "@/lib/places/match";

describe("distanceM", () => {
  it("is ~111 m per 0.001 degree of latitude", () => {
    expect(distanceM(32, 34, 32.001, 34)).toBeGreaterThan(105);
    expect(distanceM(32, 34, 32.001, 34)).toBeLessThan(117);
  });
  it("is zero for the same point", () => {
    expect(distanceM(32, 34, 32, 34)).toBe(0);
  });
});

describe("namesOverlap", () => {
  it("matches a shared word or containment", () => {
    expect(namesOverlap("Tofu An", "Tofu An Restaurant")).toBe(true);
    expect(namesOverlap("Burj Binyamina", "burj")).toBe(true);
  });
  it("rejects unrelated names and empty input", () => {
    expect(namesOverlap("Tofu An", "Glennis bakery")).toBe(false);
    expect(namesOverlap("", "x")).toBe(false);
  });
});
