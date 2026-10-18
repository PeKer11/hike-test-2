import { describe, expect, it, vi } from "vitest";

import {
  classifyComponent,
  isDaytime,
  sunElevationDeg,
} from "@/lib/places/detected-classifier";
import type { LandcoverComponent, OsmFeature } from "@/lib/types/landcover";

const SPRING_DAY = new Date("2026-03-15T09:00:00Z");
const SUMMER_DAY = new Date("2026-07-15T09:00:00Z");
const NIGHT = new Date("2026-03-15T22:00:00Z");

// Open land near Latrun (allowed, outside every deny zone).
const C = { lat: 31.9, lng: 34.85 };
const D = 0.001;
const comp = (over: Partial<LandcoverComponent> = {}): LandcoverComponent => ({
  cls: "tree",
  areaM2: 20_000,
  centroid: C,
  bbox: { south: C.lat - D, north: C.lat + D, west: C.lng - D, east: C.lng + D },
  canopyShare: null,
  ...over,
});
const ring = (r: number): OsmFeature["geometry"] => [
  { lat: C.lat - r, lng: C.lng - r },
  { lat: C.lat - r, lng: C.lng + r },
  { lat: C.lat + r, lng: C.lng + r },
  { lat: C.lat + r, lng: C.lng - r },
  { lat: C.lat - r, lng: C.lng - r },
];
const poly = (tags: Record<string, string>, r = 0.01): OsmFeature => ({
  tags,
  geometry: ring(r),
  closed: true,
});
/** A line `northM` metres north of the patch centre, 400 m long. */
const lineAt = (tags: Record<string, string>, northM: number): OsmFeature => {
  const lat = C.lat + northM / 111_000;
  return {
    tags,
    geometry: [
      { lat, lng: C.lng - 0.002 },
      { lat, lng: C.lng + 0.002 },
    ],
    closed: false,
  };
};
const trail = lineAt({ highway: "path" }, 150); // ~40 m from bbox top edge
const ctx = (...features: OsmFeature[]) => ({ features });
const run = (features: OsmFeature[], over: Partial<LandcoverComponent> = {}, now = SPRING_DAY, o = {}) =>
  classifyComponent(comp(over), ctx(...features), { now, ...o });
const suppressed = (d: ReturnType<typeof run>, reason: string) => {
  expect(d.action).toBe("suppress");
  expect((d as { reason: string }).reason).toContain(reason);
};

describe("detected classifier", () => {
  it("happy path: shows with the private floor warning, confidence <= 0.8", () => {
    const d = run([trail]);
    expect(d.action).toBe("show");
    if (d.action !== "show") return;
    expect(d.hazards).toContain("private");
    expect(d.hazards.length).toBeGreaterThanOrEqual(1);
    expect(d.confidence).toBeLessThanOrEqual(0.8);
  });

  it("confidence is capped at 0.8 even with every bonus", () => {
    const d = run([trail], { canopyShare: 0.9, areaM2: 90_000 }, SPRING_DAY, { photoCount: 9 });
    expect(d.action === "show" && d.confidence).toBe(0.8);
  });

  it("fails closed with unknown OSM context", () => {
    suppressed(classifyComponent(comp(), null, { now: SPRING_DAY }), "no-context");
  });

  it("suppresses inside a deny zone (Gaza)", () => {
    const g = { lat: 31.45, lng: 34.4 };
    const d = classifyComponent(
      comp({ centroid: g, bbox: { south: g.lat - D, north: g.lat + D, west: g.lng - D, east: g.lng + D } }),
      ctx(trail),
      { now: SPRING_DAY },
    );
    suppressed(d, "zone");
  });

  it("suppresses at night, shows by day", () => {
    suppressed(run([trail], {}, NIGHT), "night");
    expect(run([trail]).action).toBe("show");
  });

  it("military landuse overlapping -> suppress", () => {
    suppressed(run([trail, poly({ landuse: "military" })]), "military");
  });
  it("military=* / danger area near (open way within margin) -> suppress", () => {
    suppressed(run([trail, lineAt({ military: "danger_area" }, 100)]), "military");
  });
  it("mine hazard tag -> suppress", () => {
    suppressed(run([trail, poly({ hazard: "landmine" })]), "military");
  });
  it("any hazard=* area (danger_area, unexploded_ordnance, shooting_range) -> suppress", () => {
    for (const hazard of ["danger_area", "unexploded_ordnance", "shooting_range"]) {
      suppressed(run([trail, poly({ hazard })]), "military");
    }
  });
  it("military far away does not suppress", () => {
    expect(run([trail, lineAt({ military: "range" }, 2000)]).action).toBe("show");
  });

  it.each([["orchard"], ["farmland"], ["vineyard"], ["cemetery"], ["residential"]])(
    "landuse=%s containing the patch -> suppress (private likely)",
    (landuse) => suppressed(run([trail, poly({ landuse })]), "private"),
  );
  it("access=private area -> suppress", () => {
    suppressed(run([trail, poly({ access: "private" })]), "private");
  });

  it("fence within 30 m -> suppress; fence far away -> show", () => {
    suppressed(run([trail, lineAt({ barrier: "fence" }, 130)]), "fenced");
    expect(run([trail, lineAt({ barrier: "fence" }, 600)]).action).toBe("show");
  });

  it("already mapped (park containing it) -> merge, no new card", () => {
    expect(run([trail, poly({ leisure: "park" })]).action).toBe("merge");
  });
  it("a Wikipedia page on top of it -> merge", () => {
    const d = run([trail], {}, SPRING_DAY, { wikiMatch: true });
    expect(d.action).toBe("merge");
  });

  describe("reachability rule", () => {
    it("no mapped way at all -> suppress", () => suppressed(run([]), "no-path"));
    it("way 500 m away -> suppress", () =>
      suppressed(run([lineAt({ highway: "path" }, 600)]), "no-path"));
    it("way at ~100 m -> show", () => {
      expect(run([lineAt({ highway: "footway" }, 210)]).action).toBe("show");
    });
    it("motorway / foot=no / private track do not count", () => {
      suppressed(run([lineAt({ highway: "motorway" }, 120)]), "no-path");
      suppressed(run([lineAt({ highway: "primary" }, 120)]), "no-path");
      suppressed(run([lineAt({ highway: "secondary" }, 120)]), "no-path");
      suppressed(run([lineAt({ highway: "path", foot: "no" }, 120)]), "no-path");
      suppressed(run([lineAt({ highway: "track", access: "private" }, 120)]), "no-path");
    });
  });

  describe("warnings", () => {
    const hazards = (d: ReturnType<typeof run>) => (d.action === "show" ? d.hazards : []);
    it("nature reserve -> reserve", () => {
      expect(hazards(run([trail, poly({ leisure: "nature_reserve" })]))).toContain("reserve");
    });
    it("wadi nearby -> flood; intermittent stream too; permanent stream no", () => {
      expect(hazards(run([trail, lineAt({ waterway: "wadi" }, 90)]))).toContain("flood");
      expect(hazards(run([trail, lineAt({ waterway: "stream", intermittent: "yes" }, 90)]))).toContain("flood");
      expect(hazards(run([trail, lineAt({ waterway: "stream" }, 90)]))).not.toContain("flood");
    });
    it("any intermittent / seasonal water nearby -> flood (canal, pond, wetland), not just streams", () => {
      expect(hazards(run([trail, lineAt({ waterway: "canal", intermittent: "yes" }, 90)]))).toContain("flood");
      expect(hazards(run([trail, lineAt({ natural: "water", intermittent: "yes" }, 90)]))).toContain("flood");
      expect(hazards(run([trail, lineAt({ waterway: "ditch", seasonal: "yes" }, 90)]))).toContain("flood");
      expect(hazards(run([trail, lineAt({ natural: "water" }, 90)]))).not.toContain("flood");
    });
    it("cliff nearby -> cliff", () => {
      expect(hazards(run([trail, lineAt({ natural: "cliff" }, 110)]))).toContain("cliff");
    });
    it("fire season (Jun-Oct) for trees; not in March; not for water", () => {
      expect(hazards(run([trail], {}, SUMMER_DAY))).toContain("fire");
      expect(hazards(run([trail]))).not.toContain("fire");
      expect(hazards(run([trail], { cls: "water" }, SUMMER_DAY))).not.toContain("fire");
    });
    it("water patch touching the coastline (sea) is suppressed; inland water is not", () => {
      const coast = lineAt({ natural: "coastline" }, 0);
      expect(run([trail, coast], { cls: "water" }).action).toBe("suppress");
      expect(run([trail], { cls: "water" }).action).toBe("show");
    });
    it("water patch with the coastline 150 m from its bbox is sea even with a promenade nearby", () => {
      const coast = lineAt({ natural: "coastline" }, 260); // ~150 m beyond the bbox top edge
      suppressed(run([trail, coast], { cls: "water" }), "coast");
    });
    it("aquaculture, salt ponds and wastewater plants are private and suppress", () => {
      for (const t of [{ landuse: "aquaculture" } as Record<string, string>, { landuse: "salt_pond" }, { man_made: "wastewater_plant" }]) {
        suppressed(run([trail, poly(t)]), "private");
      }
    });
    it("East Jerusalem / beyond the barrier is suppressed, not shown with a warning", () => {
      for (const j of [{ lat: 31.78, lng: 35.26 }, { lat: 31.77, lng: 35.26 }, { lat: 31.85, lng: 35.23 }]) {
        const d = classifyComponent(
          comp({ centroid: j, bbox: { south: j.lat - D, north: j.lat + D, west: j.lng - D, east: j.lng + D } }),
          ctx({ tags: { highway: "footway" }, geometry: [{ lat: j.lat + 0.0015, lng: j.lng - 0.002 }, { lat: j.lat + 0.0015, lng: j.lng + 0.002 }], closed: false }),
          { now: SPRING_DAY },
        );
        expect(d.action).toBe("suppress");
      }
    });
    it("a 'mixed' zone verdict is treated as denied", async () => {
      const sz = await import("@/lib/places/safety-zones");
      const spy = vi.spyOn(sz, "classifyArea").mockReturnValue({ status: "mixed", zones: ["x"] });
      const d = classifyComponent(comp(), ctx(trail), { now: SPRING_DAY });
      spy.mockRestore();
      expect(d.action).toBe("suppress");
    });
  });
});

describe("sun", () => {
  it("noon in Israel is day, midnight is night", () => {
    expect(isDaytime(new Date("2026-06-21T09:30:00Z"), C)).toBe(true);
    expect(sunElevationDeg(new Date("2026-06-21T09:30:00Z"), C)).toBeGreaterThan(70);
    expect(isDaytime(new Date("2026-06-21T21:00:00Z"), C)).toBe(false);
  });
});
