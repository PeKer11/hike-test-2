import { describe, expect, it } from "vitest";

import {
  isPlausibleConnector,
  rejoinCandidates,
  spliceRoute,
  turnInstruction,
} from "@/lib/walk/rejoin";
import type { Coordinates } from "@/lib/types";
import { haversineDistance } from "@/lib/utils/geo";

const M = 111_320;
const ORIGIN: Coordinates = { lat: 32.08, lng: 34.78 };
const north = (m: number, eastM = 0): Coordinates => ({
  lat: ORIGIN.lat + m / M,
  lng: ORIGIN.lng + eastM / (M * Math.cos((ORIGIN.lat * Math.PI) / 180)),
});

// A straight 1 km north-bound route with a vertex every 100 m.
const ROUTE: Coordinates[] = Array.from({ length: 11 }, (_, i) => north(i * 100));

describe("rejoinCandidates", () => {
  it("returns at most two, all on the route and ahead of the matched segment", () => {
    const pos = north(250, 200); // 200 m east of the route
    const found = rejoinCandidates(pos, ROUTE, 2, null);
    expect(found.length).toBeGreaterThan(0);
    expect(found.length).toBeLessThanOrEqual(2);
    for (const c of found) {
      expect(c.segmentIndex).toBeGreaterThanOrEqual(2);
      expect(c.alongM).toBeGreaterThanOrEqual(0);
      expect(c.alongM).toBeLessThanOrEqual(500);
    }
  });

  it("prefers a point ahead of the walker over the closest one", () => {
    const pos = north(250, 120);
    const best = rejoinCandidates(pos, ROUTE, 2, null)[0];
    expect(best.alongM).toBeGreaterThan(20);
  });

  it("never goes past the next unvisited stop", () => {
    const pos = north(250, 120);
    const found = rejoinCandidates(pos, ROUTE, 2, 60);
    for (const c of found) expect(c.alongM).toBeLessThanOrEqual(60);
  });

  it("keeps its two candidates at least 60 m apart along the route", () => {
    const found = rejoinCandidates(north(250, 120), ROUTE, 2, null);
    expect(found).toHaveLength(2);
    expect(Math.abs(found[0].alongM - found[1].alongM)).toBeGreaterThanOrEqual(60);
  });

  it("is empty for a degenerate route", () => {
    expect(rejoinCandidates(ORIGIN, [ORIGIN], 0, null)).toEqual([]);
  });
});

describe("isPlausibleConnector", () => {
  it("accepts up to 2x crow-flies + 100 m", () => {
    expect(isPlausibleConnector(300, 100)).toBe(true);
    expect(isPlausibleConnector(301, 100)).toBe(false);
  });
});

describe("spliceRoute", () => {
  it("starts on the connector, passes the rejoin point, then the old route", () => {
    const candidate = { point: north(350), segmentIndex: 3, alongM: 100 };
    const connector = [north(250, 100), north(300, 40), north(350)];
    const spliced = spliceRoute(ROUTE, candidate, connector);
    expect(spliced[0]).toEqual(connector[0]);
    expect(spliced.slice(0, 3)).toEqual(connector);
    expect(spliced[spliced.length - 1]).toEqual(ROUTE[ROUTE.length - 1]);
    // Nothing from before the rejoin segment survives.
    expect(spliced).not.toContainEqual(ROUTE[2]);
    // No jump longer than the 100 m route spacing + connector bits.
    for (let i = 1; i < spliced.length; i += 1) {
      expect(haversineDistance(spliced[i - 1], spliced[i])).toBeLessThan(150);
    }
  });
});

describe("turnInstruction", () => {
  const pos = ORIGIN;
  it("straight / right / left / around relative to heading", () => {
    expect(turnInstruction(0, pos, north(80)).kind).toBe("straight");
    expect(turnInstruction(0, pos, north(0, 80)).kind).toBe("right");
    expect(turnInstruction(0, pos, north(0, -80)).kind).toBe("left");
    expect(turnInstruction(0, pos, north(-80)).kind).toBe("around");
  });

  it("handles the 0/360 seam", () => {
    // heading 350, target due east (90): rel = +100 -> right
    expect(turnInstruction(350, pos, north(0, 80)).kind).toBe("right");
    // heading 10, target due west (270): rel = -100 -> left
    expect(turnInstruction(10, pos, north(0, -80)).kind).toBe("left");
    // heading 355, target slightly east of north: still straight
    expect(turnInstruction(355, pos, north(80, 5)).kind).toBe("straight");
  });

  it("falls back to a compass direction without a heading", () => {
    const t = turnInstruction(null, pos, north(80, 80));
    expect(t.kind).toBe("compass");
    expect(t.text).toContain("north-east");
  });
});
