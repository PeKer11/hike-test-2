import { describe, it, expect, beforeEach } from "vitest";
import {
  VisitTracker,
  excludeVisited,
  VISIT_RADIUS_METERS,
} from "@/lib/walk/visit-tracker";
import type { Attraction, Coordinates } from "@/lib/types";

const START: Coordinates = { lat: 32.08, lng: 34.78 };

// Meters → degrees of longitude at the test latitude.
function eastOf(base: Coordinates, meters: number): Coordinates {
  const metersPerDegree = 111_320 * Math.cos((base.lat * Math.PI) / 180);
  return { lat: base.lat, lng: base.lng + meters / metersPerDegree };
}

function attraction(id: string, coordinates: Coordinates): Attraction {
  return {
    id,
    name: `Stop ${id}`,
    coordinates,
    category: "landmark",
    avgVisitMinutes: 10,
    tags: {},
  };
}

const museum = attraction("a1", START);
const park = attraction("a2", eastOf(START, 1000));
const attractions = [museum, park];

describe("VisitTracker", () => {
  let tracker: VisitTracker;

  beforeEach(() => {
    tracker = new VisitTracker();
  });

  it("marks an attraction visited once the walker comes within the radius", () => {
    const newlyVisited = tracker.recordPosition(
      eastOf(START, VISIT_RADIUS_METERS - 20),
      attractions,
    );

    expect(newlyVisited).toEqual(["a1"]);
    expect(tracker.has("a1")).toBe(true);
    expect(tracker.has("a2")).toBe(false);
  });

  it("does not mark an attraction the walker only passed far from", () => {
    const newlyVisited = tracker.recordPosition(
      eastOf(START, VISIT_RADIUS_METERS + 50),
      attractions,
    );

    expect(newlyVisited).toEqual([]);
    expect(tracker.visitedIds.size).toBe(0);
  });

  it("reports each attraction as newly visited only once", () => {
    const close = eastOf(START, 10);
    expect(tracker.recordPosition(close, attractions)).toEqual(["a1"]);
    expect(tracker.recordPosition(close, attractions)).toEqual([]);
    expect(tracker.visitedIds.size).toBe(1);
  });

  it("keeps a stop visited after the walker has moved away again", () => {
    tracker.recordPosition(START, attractions);
    tracker.recordPosition(eastOf(START, 900), attractions);

    expect(tracker.has("a1")).toBe(true);
  });

  it("accumulates visits across several positions", () => {
    tracker.recordPosition(START, attractions);
    tracker.recordPosition(eastOf(START, 1000), attractions);

    expect([...tracker.visitedIds].sort()).toEqual(["a1", "a2"]);
  });

  it("forgets everything on reset (new walk)", () => {
    tracker.recordPosition(START, attractions);
    tracker.reset();

    expect(tracker.has("a1")).toBe(false);
    expect(tracker.visitedIds.size).toBe(0);
  });
});

describe("excludeVisited", () => {
  it("drops visited attractions and keeps the order of the rest", () => {
    const tracker = new VisitTracker();
    tracker.recordPosition(START, attractions);

    expect(excludeVisited(attractions, tracker.visitedIds)).toEqual([park]);
  });

  it("returns the full list when nothing has been visited", () => {
    expect(excludeVisited(attractions, new Set<string>())).toEqual(attractions);
  });

  it("returns an empty list when every attraction was visited", () => {
    expect(excludeVisited(attractions, new Set(["a1", "a2"]))).toEqual([]);
  });
});
