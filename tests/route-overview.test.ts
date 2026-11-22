import { describe, expect, it } from "vitest";

import { fitPadding, OVERVIEW_HOLD_MS, overviewBounds } from "@/lib/map/route-overview";

describe("fitPadding", () => {
  it("keeps the stop-chip row clear at the top while walking", () => {
    expect(fitPadding(true, true).top).toBe(72);
    expect(fitPadding(false, true).top).toBe(24);
  });

  it("is a small margin all round on a phone, where the controls overlay the corner", () => {
    expect(fitPadding(true, true)).toEqual({ top: 72, right: 24, bottom: 24, left: 24 });
  });

  it("leaves room on both sides on a wide screen, where the zoom control sits on the end side", () => {
    const wide = fitPadding(true, false);
    expect(wide.right).toBe(64);
    expect(wide.left).toBe(64); // symmetric: the control is on the left in Hebrew
    expect(wide.right).toBeGreaterThan(fitPadding(true, true).right);
  });
});

describe("overviewBounds", () => {
  const route = [{ lat: 32.08, lng: 34.78 }, { lat: 32.09, lng: 34.79 }];

  it("frames the route ahead, the part walked, and the walker together", () => {
    const walked = [{ lat: 32.07, lng: 34.77 }, { lat: 32.075, lng: 34.775 }];
    const here = { lat: 32.0805, lng: 34.8 };
    expect(overviewBounds(route, walked, here)).toEqual({ north: 32.09, south: 32.07, east: 34.8, west: 34.77 });
  });

  it("works with the route alone, and with the walker added to a one-point route", () => {
    expect(overviewBounds(route, undefined, undefined)).toEqual({ north: 32.09, south: 32.08, east: 34.79, west: 34.78 });
    expect(overviewBounds([route[0]], undefined, route[1])).toEqual({ north: 32.09, south: 32.08, east: 34.79, west: 34.78 });
  });

  it("has nothing to frame with fewer than two points in all", () => {
    expect(overviewBounds([], undefined, undefined)).toBeNull();
    expect(overviewBounds(undefined, undefined, route[0])).toBeNull();
    expect(overviewBounds(undefined, undefined, undefined)).toBeNull();
  });

  it("holds the overview for a minute", () => {
    expect(OVERVIEW_HOLD_MS).toBe(60_000);
  });
});
