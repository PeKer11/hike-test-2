import { describe, it, expect, beforeEach } from "vitest";
import { detectDeviation, remainingRoute } from "@/lib/walk/deviation-detector";
import { PoiAlerter } from "@/lib/walk/poi-alerter";
import type { Attraction } from "@/lib/types";

// Tel Aviv area coords
const onRoute = { lat: 32.080, lng: 34.780 };
const routeCoords = [
  { lat: 32.079, lng: 34.779 },
  { lat: 32.081, lng: 34.781 },
  { lat: 32.083, lng: 34.783 },
];

describe("detectDeviation", () => {
  it("returns near-zero deviation when user is on the route", () => {
    const result = detectDeviation(onRoute, routeCoords);
    expect(result.deviationMeters).toBeLessThan(10);
    expect(result.needsReroute).toBe(false);
  });

  it("flags reroute when user is > 50m off route", () => {
    const farOff = { lat: 32.080, lng: 34.830 }; // ~4 km east
    const result = detectDeviation(farOff, routeCoords);
    expect(result.deviationMeters).toBeGreaterThan(50);
    expect(result.needsReroute).toBe(true);
  });

  it("handles a single-point route without crashing", () => {
    const result = detectDeviation(onRoute, [routeCoords[0]]);
    expect(result.needsReroute).toBe(false);
  });
});

describe("remainingRoute", () => {
  it("prepends current position and slices from segment index onward", () => {
    const current = { lat: 32.080, lng: 34.780 };
    const remaining = remainingRoute(routeCoords, 1, current);
    expect(remaining[0]).toEqual(current);
    expect(remaining).toHaveLength(2); // current + routeCoords[2]
  });
});

describe("PoiAlerter", () => {
  let alerter: PoiAlerter;

  function makePoi(id: string, lat: number, lng: number): Attraction {
    return {
      id,
      name: id,
      coordinates: { lat, lng },
      category: "landmark",
      avgVisitMinutes: 20,
      tags: {},
    };
  }

  beforeEach(() => {
    alerter = new PoiAlerter();
  });

  it("returns null when no POIs are nearby", () => {
    const farPoi = makePoi("far", 32.090, 34.790); // ~1.2 km away
    const result = alerter.check(onRoute, null, [farPoi]);
    expect(result).toBeNull();
  });

  it("returns an alert for a nearby POI", () => {
    const nearPoi = makePoi("near", 32.0802, 34.7802); // ~30m away
    const result = alerter.check(onRoute, null, [nearPoi], 0);
    expect(result).not.toBeNull();
    expect(result?.attraction.id).toBe("near");
  });

  it("does not alert for the same POI twice", () => {
    const nearPoi = makePoi("near", 32.0802, 34.7802);
    const first = alerter.check(onRoute, null, [nearPoi], 0);
    const second = alerter.check(onRoute, null, [nearPoi], 10 * 60 * 1000);
    expect(first).not.toBeNull();
    expect(second).toBeNull();
  });

  it("rate-limits alerts to one per 5 minutes", () => {
    const poi1 = makePoi("a", 32.0802, 34.7802);
    const poi2 = makePoi("b", 32.0803, 34.7803);
    const first = alerter.check(onRoute, null, [poi1], 0);
    const second = alerter.check(onRoute, null, [poi2], 1000); // 1 second later
    expect(first).not.toBeNull();
    expect(second).toBeNull(); // rate-limited
  });

  it("allows a new alert after 5 minutes", () => {
    const poi1 = makePoi("a", 32.0802, 34.7802);
    const poi2 = makePoi("b", 32.0803, 34.7803);
    alerter.check(onRoute, null, [poi1], 0);
    const second = alerter.check(onRoute, null, [poi2], 6 * 60 * 1000);
    expect(second).not.toBeNull();
  });
});
