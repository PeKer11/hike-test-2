import { describe, expect, it } from "vitest";

import {
  isPlausibleConnector,
  pathLengthM,
  rejoinBlock,
  rejoinCandidates,
  spliceRoute,
  turnInstruction,
  withOutcomeTag,
  type RejoinGateInput,
} from "@/lib/walk/rejoin";
import { LOCAL_REJOIN_COOLDOWN_MS } from "@/lib/walk/walk-cadence";
import { walkCopy } from "@/lib/walk/walk-copy";
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

describe("rejoinBlock: why a way-back attempt does not run", () => {
  const free: RejoinGateInput = { manual: true, inFlight: false, collapsed: false, fixStale: false, sinceLastRejoinMs: Infinity };

  it("lets a tap through when nothing is in the way", () => {
    expect(rejoinBlock(free)).toBeNull();
    expect(rejoinBlock({ ...free, manual: false })).toBeNull();
  });

  it("says busy while a way back is already being routed, for a tap and for an automatic attempt", () => {
    expect(rejoinBlock({ ...free, inFlight: true })).toBe("busy");
    expect(rejoinBlock({ ...free, manual: false, inFlight: true })).toBe("busy");
  });

  it("a tap inside the one-a-minute cooldown still runs; an automatic attempt stands aside", () => {
    const justNow = { sinceLastRejoinMs: LOCAL_REJOIN_COOLDOWN_MS - 1 };
    expect(rejoinBlock({ ...free, ...justNow })).toBeNull();
    expect(rejoinBlock({ ...free, ...justNow, manual: false })).toBe("cooldown");
    expect(rejoinBlock({ ...free, manual: false, sinceLastRejoinMs: LOCAL_REJOIN_COOLDOWN_MS })).toBeNull();
  });

  it("a tap is not refused by pending direction options (the caller cancels them); an automatic attempt is", () => {
    expect(rejoinBlock({ ...free, collapsed: true })).toBeNull();
    expect(rejoinBlock({ ...free, collapsed: true, manual: false })).toBe("collapsing");
  });

  it("never splices from a stale fix on a tap", () => {
    expect(rejoinBlock({ ...free, fixStale: true })).toBe("stale");
    // An automatic attempt is checked for staleness by its caller, as before.
    expect(rejoinBlock({ ...free, fixStale: true, manual: false })).toBeNull();
  });

  it("busy outranks stale, and a stale tap does not wait behind a collapse", () => {
    expect(rejoinBlock({ ...free, inFlight: true, fixStale: true })).toBe("busy");
    expect(rejoinBlock({ ...free, collapsed: true, fixStale: true })).toBe("stale");
  });
});

describe("way-back notices", () => {
  it("measures a connector and tags the outcome only on a preview build", () => {
    expect(Math.round(pathLengthM([north(0), north(100), north(250)]))).toBe(250);
    expect(pathLengthM([north(0)])).toBe(0);
    expect(withOutcomeTag("Way back drawn.", "routed", false)).toBe("Way back drawn.");
    expect(withOutcomeTag("Way back drawn.", "routed", true)).toBe("Way back drawn. [routed]");
  });

  it("has an English and a Hebrew line for every outcome that draws nothing", () => {
    for (const lang of ["en", "he"] as const) {
      const n = walkCopy.notice[lang];
      for (const text of [n.wayBackBusy, n.wayBackStale, n.wayBackFailedOptions, n.wayBackFailedRebuild, n.wayBackFarRebuild, n.wayBackRebuild]) {
        expect(text.length).toBeGreaterThan(10);
      }
      expect(n.wayBackDrawn(120)).toContain("120");
      expect(n.wayBackDrawnFar(120)).toContain("120");
    }
    expect(walkCopy.notice.he.wayBackDrawn(120)).toMatch(/[א-ת]/);
    expect(walkCopy.notice.en.wayBackDrawnFar(120)).toContain("Walk to the road first");
  });
});
