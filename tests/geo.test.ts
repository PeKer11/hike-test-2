import { describe, expect, it } from "vitest";
import {
  haversineDistance,
  toOrsCoord,
  fromOrsCoord,
  formatDistance,
} from "@/lib/utils/geo";

describe("haversineDistance", () => {
  it("returns 0 for identical points", () => {
    const point = { lat: 47.3769, lng: 8.5417 };
    expect(haversineDistance(point, point)).toBe(0);
  });

  it("calculates distance between Zurich and Bern (~95 km)", () => {
    const zurich = { lat: 47.3769, lng: 8.5417 };
    const bern = { lat: 46.948, lng: 7.4474 };
    const distance = haversineDistance(zurich, bern);
    expect(distance).toBeGreaterThan(90000);
    expect(distance).toBeLessThan(100000);
  });

  it("returns same distance regardless of direction", () => {
    const a = { lat: 40.7128, lng: -74.006 };
    const b = { lat: 51.5074, lng: -0.1278 };
    expect(haversineDistance(a, b)).toBeCloseTo(haversineDistance(b, a), 5);
  });
});

describe("toOrsCoord", () => {
  it("converts { lat, lng } to [lng, lat]", () => {
    const coord = { lat: 47.3769, lng: 8.5417 };
    expect(toOrsCoord(coord)).toEqual([8.5417, 47.3769]);
  });
});

describe("fromOrsCoord", () => {
  it("converts [lng, lat] to { lat, lng }", () => {
    expect(fromOrsCoord([8.5417, 47.3769])).toEqual({
      lat: 47.3769,
      lng: 8.5417,
    });
  });

  it("round-trips with toOrsCoord", () => {
    const original = { lat: 51.5074, lng: -0.1278 };
    expect(fromOrsCoord(toOrsCoord(original))).toEqual(original);
  });
});

describe("formatDistance", () => {
  it("formats meters for short distances", () => {
    expect(formatDistance(450)).toBe("450 m");
  });

  it("formats kilometers for long distances", () => {
    expect(formatDistance(2500)).toBe("2.5 km");
  });

  it("rounds meters to whole numbers", () => {
    expect(formatDistance(123.7)).toBe("124 m");
  });

  it("shows one decimal for km", () => {
    expect(formatDistance(15340)).toBe("15.3 km");
  });
});
