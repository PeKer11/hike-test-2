import { describe, expect, it } from "vitest";

import { bestOrder, clampBoundary, insideBoundary, outsideKm, pickSpread } from "@/lib/walk/loop-search";

describe("bestOrder", () => {
  // start 0; stops on a line at 1, 2, 3 (distance = |i - j|), listed out of order
  const pos = [0, 3, 1, 2];
  const dist = pos.map((a) => pos.map((b) => Math.abs(a - b)));
  it("walks the line in order", () => {
    expect(bestOrder(dist, false)).toEqual([2, 3, 1]);
  });
  it("still finds a shortest loop", () => {
    const order = bestOrder(dist, true);
    expect([order.join(), [...order].reverse().join()]).toContain("2,3,1");
  });
});

describe("pickSpread", () => {
  const pts = [0, 1, 2, 10, 11, 20].map((x) => ({ coordinates: { lat: 0, lng: x / 100 } }));
  it("takes the one nearest the centre, then the farthest from it", () => {
    const out = pickSpread(pts, 3, { lat: 0, lng: 0.1 });
    expect(out.map((p) => p.coordinates.lng * 100)).toEqual([10, 0, 20]);
  });
});

describe("boundary", () => {
  const square = [[[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]];
  it("detects inside and outside", () => {
    expect(insideBoundary({ lat: 0.5, lng: 0.5 }, square)).toBe(true);
    expect(insideBoundary({ lat: 0.5, lng: 1.5 }, square)).toBe(false);
    // ~0.005 deg (about 550 m) outside the edge is within the slack; 0.02 deg is not
    expect(insideBoundary({ lat: 0.5, lng: 1.005 }, square)).toBe(true);
    expect(insideBoundary({ lat: 0.5, lng: 1.02 }, square)).toBe(false);
  });
  it("measures the stretch outside", () => {
    const km = outsideKm([{ lat: 0.5, lng: 0.9 }, { lat: 0.5, lng: 1.5 }], square);
    expect(km).toBeGreaterThan(5);
  });
});

describe("clampBoundary", () => {
  const big = [[[34.9, 32.4], [35.1, 32.4], [35.1, 32.6], [34.9, 32.6], [34.9, 32.4]]];
  const centre = { lat: 32.5, lng: 35.0 };
  it("cuts a municipality back to the town around its centre", () => {
    const town = clampBoundary(big, centre, 1500);
    expect(insideBoundary(centre, town, 0)).toBe(true);
    expect(insideBoundary({ lat: 32.5, lng: 35.05 }, big, 0)).toBe(true);
    expect(insideBoundary({ lat: 32.5, lng: 35.05 }, town, 0)).toBe(false);
  });
});
