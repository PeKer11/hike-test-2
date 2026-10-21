import { describe, expect, it } from "vitest";
import type { Coordinates } from "@/lib/types";
import { analyzeRoute } from "@/lib/walk/route-quality";

// ~111 m per 0.001 degree of latitude.
const p = (lat: number, lng: number): Coordinates => ({ lat, lng });

describe("analyzeRoute", () => {
  it("finds no repeats in a square loop that closes", () => {
    const square = [p(32, 34), p(32.01, 34), p(32.01, 34.012), p(32, 34.012), p(32, 34)];
    const q = analyzeRoute(square);
    expect(q.closesLoop).toBe(true);
    expect(q.repeatedKm).toBe(0);
  });

  it("flags an out-and-back as walking the same street twice", () => {
    const outAndBack = [p(32, 34), p(32.01, 34), p(32, 34)];
    const q = analyzeRoute(outAndBack);
    expect(q.closesLoop).toBe(true);
    expect(q.repeatedKm).toBeGreaterThan(0.8);
    expect(q.repeatedPaths.length).toBeGreaterThan(0);
  });

  it("does not count a parallel street 100 m away as a repeat", () => {
    const rectangle = [p(32, 34), p(32.01, 34), p(32.01, 34.001), p(32, 34.001), p(32, 34)];
    expect(analyzeRoute(rectangle).repeatedKm).toBe(0);
  });

  it("reports a route that ends away from the start as not closed", () => {
    const q = analyzeRoute([p(32, 34), p(32.01, 34)]);
    expect(q.closesLoop).toBe(false);
    expect(q.endGapM).toBeGreaterThan(1000);
  });
});
