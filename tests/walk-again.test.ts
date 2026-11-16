import { beforeEach, describe, expect, it } from "vitest";

import { decodePolyline, encodePolyline } from "@/lib/walks/polyline";
import { backfillWalkGeometry, insertWalk, listMyWalksOrThrow, resetColumnProbe, type SavedWalk } from "@/lib/walks/saved-walks";
import { decideWalkAgain, isLoopWalk, splitStopsAtJoin, startAsStop, stopsForJoin, transitLinkTo } from "@/lib/walks/walk-again";

const base = {
  id: "w1",
  title: "Dizengoff",
  status: "completed" as const,
  areaLabel: null,
  totalMin: 60,
  distanceM: 3000,
  params: {},
  visibility: "private" as const,
  createdAt: "",
  completedAt: null,
};

/** A line walk going north, 3.3 km, with two stops. */
const line: SavedWalk = {
  ...base,
  start: { lat: 32.0, lng: 34.8 },
  stops: [
    { name: "A", category: "landmark", lat: 32.01, lng: 34.8 },
    { name: "B", category: "landmark", lat: 32.02, lng: 34.8 },
  ],
  geometry: [
    { lat: 32.0, lng: 34.8 },
    { lat: 32.01, lng: 34.8 },
    { lat: 32.02, lng: 34.8 },
    { lat: 32.03, lng: 34.8 },
  ],
  end: { lat: 32.03, lng: 34.8 },
  isLoop: false,
};

/** A ring: east, north-east, north, and back to the start. */
const ring: SavedWalk = {
  ...base,
  start: { lat: 32.0, lng: 34.8 },
  stops: [
    { name: "East", category: "landmark", lat: 32.0, lng: 34.81 },
    { name: "NE", category: "landmark", lat: 32.01, lng: 34.81 },
    { name: "North", category: "landmark", lat: 32.01, lng: 34.8 },
  ],
  geometry: [
    { lat: 32.0, lng: 34.8 },
    { lat: 32.0, lng: 34.81 },
    { lat: 32.01, lng: 34.81 },
    { lat: 32.01, lng: 34.8 },
    { lat: 32.0, lng: 34.8 },
  ],
  end: { lat: 32.0, lng: 34.8 },
  isLoop: true,
};

describe("decideWalkAgain: the situations of the plan, one by one", () => {
  it("1. no location: start from the original start, no chooser", () => {
    const d = decideWalkAgain(line, null);
    expect(d.chooser).toBe(false);
    expect(d.primary.mode).toBe("original_start_no_location");
  });

  it("2. within 250 m of the start: start right away, no sheet", () => {
    const d = decideWalkAgain(line, { lat: 32.001, lng: 34.8 });
    expect(d).toMatchObject({ chooser: false, primary: { mode: "start_now" }, alternatives: [] });
  });

  it("3. an unfinished run near its next stop: continue where I stopped", () => {
    const d = decideWalkAgain(line, { lat: 32.0155, lng: 34.8005 }, { finished: false, nextStopIndex: 1 });
    expect(d.primary.mode).toBe("resume");
    expect(d.alternatives.map((a) => a.mode)).toEqual(["walk_to_start", "join_nearest"]);
  });

  it("3b. an unfinished run far from its next stop is not offered", () => {
    const d = decideWalkAgain(line, { lat: 32.0, lng: 34.9 }, { finished: false, nextStopIndex: 1 });
    expect(d.primary.mode).not.toBe("resume");
  });

  it("4. a loop with the route near: join at the nearest point, with start/reverse as the other ways", () => {
    const d = decideWalkAgain(ring, { lat: 32.005, lng: 34.8105 });
    expect(d.primary.mode).toBe("join_nearest");
    expect(d.alternatives.map((a) => a.mode)).toEqual(["walk_to_start", "reverse"]);
  });

  it("5. point to point, start within 1.5 km: walk to the start (with minutes), join as the alternative", () => {
    const d = decideWalkAgain(line, { lat: 32.0, lng: 34.81 });
    expect(d.primary.mode).toBe("walk_to_start");
    expect(d.primary.approachMin).toBeGreaterThan(0);
    expect(d.alternatives.map((a) => a.mode)).toEqual(["join_nearest"]);
  });

  it("6. point to point, start far but the route near: join; reverse only when the end is closer", () => {
    const d = decideWalkAgain(line, { lat: 32.0275, lng: 34.8085 });
    expect(d.primary.mode).toBe("join_nearest");
    expect(d.alternatives.map((a) => a.mode)).toEqual(["walk_to_start", "reverse"]);
    const nearStart = decideWalkAgain(line, { lat: 32.0, lng: 34.8 + 0.0 }).primary.mode;
    expect(nearStart).toBe("start_now");
  });

  it("7. 1.5 to 15 km away: the same route from here (best order), or walk to / transit to the start", () => {
    const d = decideWalkAgain(line, { lat: 32.0, lng: 34.9 });
    expect(d.primary.mode).toBe("reroute_from_here");
    expect(d.alternatives.map((a) => a.mode)).toEqual(["walk_to_start", "transit_to_start"]);
  });

  it("8. another city: a walk in the same style here, or get there", () => {
    const d = decideWalkAgain(line, { lat: 32.5, lng: 34.8 });
    expect(d.primary.mode).toBe("same_style_here");
    expect(d.alternatives.map((a) => a.mode)).toEqual(["transit_to_start"]);
  });

  it("never offers more than two alternatives, and says once when the approach blows the time budget", () => {
    const d = decideWalkAgain({ ...line, totalMin: 20 }, { lat: 32.0, lng: 34.81 });
    expect(d.alternatives.length).toBeLessThanOrEqual(2);
    expect(d.overBudget).toBe(true);
    expect(decideWalkAgain({ ...line, totalMin: 600 }, { lat: 32.0, lng: 34.81 }).overBudget).toBe(false);
  });

  it("a walk saved without geometry is measured against its start and stops", () => {
    const { geometry, end, isLoop, ...old } = line;
    void geometry;
    void end;
    void isLoop;
    const d = decideWalkAgain(old as SavedWalk, { lat: 32.0, lng: 34.81 });
    expect(d.primary.mode).toBe("walk_to_start");
  });
});

describe("joining a walk", () => {
  it("a point-to-point join skips the stops already passed", () => {
    const here = { lat: 32.0125, lng: 34.8005 };
    const { ahead, passed } = splitStopsAtJoin(line, here);
    expect(passed.map((s) => s.name)).toEqual(["A"]);
    expect(ahead.map((s) => s.name)).toEqual(["B"]);
    expect(stopsForJoin(line, here).map((s) => s.name)).toEqual(["B"]);
    expect(decideWalkAgain(line, here).primary.mode).not.toBe("start_now");
  });

  it("a loop joined mid-way goes round: what is ahead, then what was passed", () => {
    const here = { lat: 32.0, lng: 34.805 };
    expect(isLoopWalk(ring)).toBe(true);
    expect(stopsForJoin(ring, here).map((s) => s.name)).toEqual(["East", "NE", "North"]);
    const afterEast = { lat: 32.005, lng: 34.81 };
    expect(stopsForJoin(ring, afterEast).map((s) => s.name)).toEqual(["NE", "North", "East"]);
  });

  it("walking to the start first is a zero-minute stop at the start", () => {
    expect(startAsStop(line)).toMatchObject({ lat: 32.0, lng: 34.8, visitMinutes: 0 });
  });

  it("the transit link goes to the start", () => {
    expect(transitLinkTo({ lat: 32.1, lng: 34.9 })).toContain("destination=32.1,34.9");
  });
});

describe("polyline", () => {
  it("round-trips to 5 decimals", () => {
    const pts = [
      { lat: 32.07791, lng: 34.77421 },
      { lat: 32.0791, lng: 34.7736 },
      { lat: -33.8568, lng: 151.2153 },
    ];
    const back = decodePolyline(encodePolyline(pts));
    expect(back).toHaveLength(3);
    back.forEach((p, i) => {
      expect(p.lat).toBeCloseTo(pts[i].lat, 5);
      expect(p.lng).toBeCloseTo(pts[i].lng, 5);
    });
  });
});

/** A fake Supabase client: queries naming the new columns fail until `migrated`. */
function fakeClient(state: { migrated: boolean; inserted: Record<string, unknown>[]; selects: string[] }) {
  const rows = [
    {
      id: "r1", title: "T", status: "planned", area_label: null, start_lat: 32, start_lng: 34.8, total_min: 30, distance_m: 2000,
      stops: [], params: {}, visibility: "private", created_at: "", completed_at: null,
      geometry: encodePolyline(line.geometry!), end_lat: 32.03, end_lng: 34.8, is_loop: false, parent_walk_id: null, variant_kind: null,
    },
  ];
  const needsNew = (s: string) => s.includes("geometry");
  const chain = (cols: string) => ({
    eq: () => ({ order: () => ({ limit: async () => (needsNew(cols) && !state.migrated ? { data: null, error: new Error("column does not exist") } : { data: needsNew(cols) ? rows : rows.map(({ geometry, end_lat, end_lng, is_loop, parent_walk_id, variant_kind, ...old }) => (void [geometry, end_lat, end_lng, is_loop, parent_walk_id, variant_kind], old)), error: null }) }) }),
  });
  return {
    from: () => ({
      select: (cols: string) => {
        state.selects.push(cols);
        return chain(cols);
      },
      insert: (row: Record<string, unknown>) => ({
        select: () => ({
          single: async () => {
            const bad = "geometry" in row && !state.migrated;
            if (bad) return { data: null, error: new Error("no column") };
            state.inserted.push(row);
            return { data: { id: "new" }, error: null };
          },
        }),
      }),
      update: () => ({ eq: async () => ({ error: state.migrated ? null : new Error("no column") }) }),
    }),
  } as never;
}

describe("saved walks tolerate the migration not being applied", () => {
  beforeEach(() => resetColumnProbe());

  it("lists with the old columns when the new ones are missing, and remembers", async () => {
    const state = { migrated: false, inserted: [], selects: [] as string[] };
    const walks = await listMyWalksOrThrow(fakeClient(state), "u");
    expect(walks).toHaveLength(1);
    expect(walks[0].geometry).toBeUndefined();
    await listMyWalksOrThrow(fakeClient(state), "u");
    expect(state.selects.filter((c) => c.includes("geometry"))).toHaveLength(1); // asked once, not every time
  });

  it("reads geometry, end and loop once the columns exist", async () => {
    const state = { migrated: true, inserted: [], selects: [] as string[] };
    const [walk] = await listMyWalksOrThrow(fakeClient(state), "u");
    expect(walk.geometry).toHaveLength(4);
    expect(walk.end).toEqual({ lat: 32.03, lng: 34.8 });
    expect(walk.isLoop).toBe(false);
  });

  it("saves a walk without the new columns when they are missing, with them when present", async () => {
    const before = { migrated: false, inserted: [] as Record<string, unknown>[], selects: [] };
    const id = await insertWalk(fakeClient(before), "u", { title: "T", start: { lat: 1, lng: 1 }, stops: [], geometry: line.geometry, end: line.end, isLoop: false });
    expect(id).toBe("new");
    expect(before.inserted[0]).not.toHaveProperty("geometry");

    resetColumnProbe();
    const after = { migrated: true, inserted: [] as Record<string, unknown>[], selects: [] };
    await insertWalk(fakeClient(after), "u", { title: "T", start: { lat: 1, lng: 1 }, stops: [], geometry: line.geometry, end: line.end, isLoop: false });
    expect(after.inserted[0]).toHaveProperty("geometry");
    expect(after.inserted[0]).toMatchObject({ end_lat: 32.03, is_loop: false });
  });

  it("backfill is a quiet no-op before the migration", async () => {
    const state = { migrated: false, inserted: [], selects: [] as string[] };
    await listMyWalksOrThrow(fakeClient(state), "u"); // learns the columns are missing
    expect(await backfillWalkGeometry(fakeClient(state), "r1", line.geometry!, line.end, false)).toBe(false);
  });
});
