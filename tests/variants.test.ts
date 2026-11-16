import { describe, expect, it, vi } from "vitest";

import type { Coordinates } from "@/lib/types";
import { routeFrame } from "@/lib/walk/route-frame";
import { cumulativeDistances } from "@/lib/walk/walk-stats";
import { haversineDistance } from "@/lib/utils/geo";
import type { SavedWalk } from "@/lib/walks/saved-walks";
import { estimateMinutes, makeVariant, waypointsOf, type RouteFn } from "@/lib/walks/variants";

const base = { status: "completed" as const, areaLabel: null, params: { walkingPaceMinPerKm: 12 }, visibility: "private" as const, createdAt: "", completedAt: null };

/** North along lng 34.8, two stops, 3.3 km, not a loop. */
const line: SavedWalk = {
  ...base,
  id: "11111111-1111-1111-1111-111111111111",
  title: "Dizengoff",
  totalMin: 90,
  distanceM: 3300,
  start: { lat: 32.0, lng: 34.8 },
  stops: [
    { name: "Cafe A", category: "food", lat: 32.01, lng: 34.8, visitMinutes: 30 },
    { name: "Museum B", category: "museum", lat: 32.02, lng: 34.8, visitMinutes: 30 },
  ],
  geometry: [{ lat: 32.0, lng: 34.8 }, { lat: 32.01, lng: 34.8 }, { lat: 32.02, lng: 34.8 }, { lat: 32.03, lng: 34.8 }],
  end: { lat: 32.03, lng: 34.8 },
  isLoop: false,
};

const ring: SavedWalk = {
  ...base,
  id: "22222222-2222-2222-2222-222222222222",
  title: "טיול טבעת",
  totalMin: 60,
  distanceM: 3000,
  start: { lat: 32.0, lng: 34.8 },
  stops: [
    { name: "East", category: "nature", lat: 32.0, lng: 34.81 },
    { name: "NE", category: "nature", lat: 32.01, lng: 34.81 },
    { name: "North", category: "nature", lat: 32.01, lng: 34.8 },
  ],
  geometry: [{ lat: 32.0, lng: 34.8 }, { lat: 32.0, lng: 34.81 }, { lat: 32.01, lng: 34.81 }, { lat: 32.01, lng: 34.8 }, { lat: 32.0, lng: 34.8 }],
  end: { lat: 32.0, lng: 34.8 },
  isLoop: true,
};

/**
 * A stand-in router: a street grid that bends every leg (so a route is never a plain polyline reversal),
 * and a fake terrain that rises with latitude (so the climb changes with direction).
 */
const route: RouteFn = vi.fn(async (waypoints: Coordinates[]) => {
  const geometry: Coordinates[] = [waypoints[0]];
  for (let i = 1; i < waypoints.length; i += 1) {
    const a = waypoints[i - 1];
    const b = waypoints[i];
    geometry.push({ lat: (a.lat + b.lat) / 2 + 0.0004, lng: (a.lng + b.lng) / 2 + 0.0004 }, b);
  }
  let distanceM = 0;
  let ascentM = 0;
  for (let i = 1; i < geometry.length; i += 1) {
    distanceM += haversineDistance(geometry[i - 1], geometry[i]);
    ascentM += Math.max(0, (geometry[i].lat - geometry[i - 1].lat) * 4000);
  }
  return { geometry, distanceM, ascentM: Math.round(ascentM) };
});

describe("reverse", () => {
  it("re-routes from the old end back to the old start through the stops in reverse order", async () => {
    const result = await makeVariant(line, { kind: "reverse" }, route);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const d = result.draft;
    expect(d.start).toEqual({ lat: 32.03, lng: 34.8 });
    expect(d.end).toEqual({ lat: 32.0, lng: 34.8 });
    expect(d.stops.map((s) => s.name)).toEqual(["Museum B", "Cafe A"]);
    expect(route).toHaveBeenLastCalledWith(waypointsOf(d.start, d.stops, d.end));
    expect(d.parentWalkId).toBe(line.id);
    expect(d.variantKind).toBe("reverse");
    expect(d.title).toBe("Dizengoff · reversed");
  });

  it("is a fresh route, not the parent's polyline read backwards, with its own time, distance and climb", async () => {
    const result = await makeVariant(line, { kind: "reverse" }, route);
    if (!result.ok) throw new Error("expected ok");
    const literal = [...line.geometry!].reverse();
    expect(result.draft.geometry).not.toEqual(literal);
    expect(result.draft.geometry.length).toBeGreaterThan(literal.length);
    expect(result.draft.distanceM).toBeGreaterThan(0);
    // Walking down the terrain: the climb differs from walking up it.
    const forward = await makeVariant({ ...line, stops: [...line.stops].reverse(), start: line.end!, end: line.start }, { kind: "reverse" }, route);
    if (!forward.ok) throw new Error("expected ok");
    expect(result.draft.ascentM).not.toBe(forward.draft.ascentM);
    // 12 min/km over the routed distance plus 60 min at the stops.
    expect(result.draft.totalMin).toBe(Math.round((result.draft.distanceM! / 1000) * 12 + 60));
  });

  it("never changes the parent", async () => {
    const before = JSON.parse(JSON.stringify(line));
    await makeVariant(line, { kind: "reverse" }, route);
    expect(line).toEqual(before);
  });

  it("a loop keeps its start and goes round the other way", async () => {
    const result = await makeVariant(ring, { kind: "reverse" }, route);
    if (!result.ok) throw new Error("expected ok");
    expect(result.draft.start).toEqual(ring.start);
    expect(result.draft.end).toEqual(ring.start);
    expect(result.draft.stops.map((s) => s.name)).toEqual(["North", "NE", "East"]);
    expect(result.draft.title).toBe("טיול טבעת · הפוך");
  });

  it("reports a router failure instead of saving a bad walk", async () => {
    const failing: RouteFn = async () => {
      throw new Error("down");
    };
    expect(await makeVariant(line, { kind: "reverse" }, failing)).toMatchObject({ ok: false });
  });
});

describe("discovery after reversing: places must switch sides", () => {
  it("a place on the right of the original route is on the LEFT of the reversed one", async () => {
    const place = { lat: 32.015, lng: 34.8005 }; // east of a north-going route = right of travel
    const forwardGeometry = line.geometry!;
    const reversed = await makeVariant(line, { kind: "reverse" }, async (wps) => ({ geometry: wps, distanceM: 3300, ascentM: null }));
    if (!reversed.ok) throw new Error("expected ok");
    const side = (g: Coordinates[]) => routeFrame(place, g, cumulativeDistances(g))?.side;
    expect(side(forwardGeometry)).toBe("right");
    expect(side(reversed.draft.geometry)).toBe("left");
  });
});

describe("start here", () => {
  it("point to point: starts at the walker, drops stops already passed, keeps the end", async () => {
    const result = await makeVariant(line, { kind: "start_here", at: { lat: 32.0125, lng: 34.8005 } }, route);
    if (!result.ok) throw new Error("expected ok");
    expect(result.draft.start).toEqual({ lat: 32.0125, lng: 34.8005 });
    expect(result.draft.stops.map((s) => s.name)).toEqual(["Museum B"]);
    expect(result.draft.end).toEqual(line.end);
    expect(result.draft.variantKind).toBe("start_here");
  });

  it("a loop goes round from the new start and comes back to it", async () => {
    const at = { lat: 32.005, lng: 34.81 };
    const result = await makeVariant(ring, { kind: "start_at", at }, route);
    if (!result.ok) throw new Error("expected ok");
    expect(result.draft.stops.map((s) => s.name)).toEqual(["NE", "North", "East"]);
    expect(result.draft.end).toEqual(at);
  });
});

describe("skip a stop", () => {
  it("drops it by name and re-routes the neighbours", async () => {
    const result = await makeVariant(line, { kind: "skip_stop", stopName: "cafe a" }, route);
    if (!result.ok) throw new Error("expected ok");
    expect(result.draft.stops.map((s) => s.name)).toEqual(["Museum B"]);
    expect(result.draft.title).toBe("Dizengoff · without cafe a");
  });

  it("refuses an unknown stop and the only stop", async () => {
    expect(await makeVariant(line, { kind: "skip_stop", stopName: "Nowhere" }, route)).toMatchObject({ ok: false });
    expect(await makeVariant({ ...line, stops: [line.stops[0]] }, { kind: "skip_stop", stopName: "Cafe A" }, route)).toMatchObject({ ok: false });
  });
});

describe("shorter", () => {
  it("drops stops until the estimate fits, then routes once", async () => {
    (route as ReturnType<typeof vi.fn>).mockClear();
    const full = estimateMinutes(waypointsOf(line.start, line.stops, line.end!), line.stops, 12);
    const result = await makeVariant(line, { kind: "shorter", minutes: Math.round(full - 20) }, route);
    if (!result.ok) throw new Error("expected ok");
    expect(result.draft.stops.length).toBe(1);
    expect(route).toHaveBeenCalledTimes(1);
    expect(result.draft.title).toBe("Dizengoff · shorter");
  });

  it("falls back to AI when dropping stops cannot reach the target", async () => {
    expect(await makeVariant(line, { kind: "shorter", minutes: 15 }, route)).toMatchObject({ ok: false, needsAi: true });
  });

  it("says so when the walk already fits", async () => {
    const result = await makeVariant(line, { kind: "shorter", minutes: 600 }, route);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.needsAi).toBeFalsy();
  });
});
