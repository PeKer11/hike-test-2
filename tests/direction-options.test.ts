import { describe, expect, it } from "vitest";

import { bearingBetween, angleDifference, haversineDistance } from "@/lib/utils/geo";
import {
  buildDirectionOptions,
  cameFromBearing,
  sectorOf,
  sectorsAdjacent,
  type DirectionInput,
} from "@/lib/walk/direction-options";
import { at, item } from "./helpers/discovery";

const ORIGIN = at(0, 0);
const WALKED = [at(0, -900), at(0, -600), at(0, -300), ORIGIN]; // came from the south

const natureItem = (id: string, c = at(200, 1000), over = {}) =>
  item(id, c, { category: "nature", score: 2, ...over });
const foodItem = (id: string, c = at(-900, -100), over = {}) =>
  item(id, c, { category: "food", score: 2, ...over });

function input(over: Partial<DirectionInput> = {}): DirectionInput {
  return {
    origin: ORIGIN,
    endAnchor: null,
    startPoint: at(500, -300),
    walked: WALKED,
    remainingMin: 60,
    speedMpm: 80,
    items: [natureItem("n1"), foodItem("f1")],
    excludeIds: new Set(),
    ...over,
  };
}

const sectorOfItem = (i: { attraction: { coordinates: typeof ORIGIN } }) =>
  sectorOf(bearingBetween(ORIGIN, i.attraction.coordinates));

describe("sector helpers", () => {
  it("bins bearings into 60 degree sectors with a clean seam", () => {
    expect(sectorOf(0)).toBe(0);
    expect(sectorOf(359.9)).toBe(5);
    expect(sectorOf(360)).toBe(0);
    expect(sectorOf(-10)).toBe(5);
  });

  it("treats 5 and 0 as adjacent, 0 and 2 as not", () => {
    expect(sectorsAdjacent(5, 0)).toBe(true);
    expect(sectorsAdjacent(0, 1)).toBe(true);
    expect(sectorsAdjacent(0, 2)).toBe(false);
    expect(sectorsAdjacent(1, 4)).toBe(false);
  });

  it("finds the came-from bearing ~300 m back along the track", () => {
    expect(cameFromBearing(ORIGIN, WALKED)).toBeCloseTo(180, 0);
    expect(cameFromBearing(ORIGIN, [ORIGIN])).toBeNull();
  });
});

describe("buildDirectionOptions", () => {
  it("excludes the came-from sector (+-45 degrees) from every option", () => {
    const south = foodItem("south", at(0, -500), { score: 99 });
    const out = buildDirectionOptions(input({ items: [south, natureItem("n1"), foodItem("f1")] }));
    const stops = out.flatMap((o) => o.stops.map((s) => s.id));
    expect(stops).not.toContain("south");
    for (const o of out)
      for (const s of o.stops) {
        const b = bearingBetween(ORIGIN, s.attraction.coordinates);
        expect(angleDifference(b, 180)).toBeGreaterThan(45);
      }
  });

  it("allows the came-from side when the end anchor is there", () => {
    const south = foodItem("south", at(0, -500), { score: 99 });
    const out = buildDirectionOptions(
      input({ endAnchor: at(0, -900), items: [south] }),
    );
    expect(out.flatMap((o) => o.stops.map((s) => s.id))).toContain("south");
  });

  it("offers nature, food and shorter in distinct, non-adjacent sectors", () => {
    const out = buildDirectionOptions(input());
    expect(out.map((o) => o.theme).sort()).toEqual(["food", "nature", "short"]);
    const sectors = out.map((o) => o.sector as number);
    for (let i = 0; i < sectors.length; i += 1)
      for (let j = i + 1; j < sectors.length; j += 1)
        expect(sectorsAdjacent(sectors[i], sectors[j])).toBe(false);
  });

  it("never offers visited, dismissed or excluded places", () => {
    const items = [
      natureItem("n-visited", at(200, 1000), { state: "visited" }),
      natureItem("n-dismissed", at(210, 1000), { state: "dismissed" }),
      natureItem("n-excluded", at(220, 1000)),
      natureItem("n-ok", at(230, 1000), { score: 1 }),
      foodItem("f1"),
    ];
    const out = buildDirectionOptions(input({ items, excludeIds: new Set(["n-excluded"]) }));
    const ids = out.flatMap((o) => o.stops.map((s) => s.id));
    expect(ids).toContain("n-ok");
    expect(ids).not.toContain("n-visited");
    expect(ids).not.toContain("n-dismissed");
    expect(ids).not.toContain("n-excluded");
  });

  it("offers only registered or mapped places, never crowd or detected ones", () => {
    const items = [natureItem("c", at(200, 1000), { tier: "crowd-signal" }), natureItem("d", at(210, 1000), { tier: "detected" })];
    const out = buildDirectionOptions(input({ items, startPoint: undefined }));
    expect(out.flatMap((o) => o.stops)).toHaveLength(0);
  });

  it("takes at most 4 stops", () => {
    const many = Array.from({ length: 8 }, (_, i) => natureItem(`n${i}`, at(100 + i * 10, 500 + i * 10), { score: 2 }));
    const out = buildDirectionOptions(input({ items: many, remainingMin: 240 }));
    const nature = out.find((o) => o.theme === "nature")!;
    expect(nature.stops.length).toBeLessThanOrEqual(4);
    expect(nature.stops.length).toBe(4);
  });

  it("fits every option inside the time budget (shorter within 60%)", () => {
    const out = buildDirectionOptions(input({ remainingMin: 45 }));
    for (const o of out) {
      expect(o.estMinutes).toBeLessThanOrEqual(o.theme === "short" ? 45 * 0.6 + 1e-9 : 45 + 1e-9);
    }
  });

  it("drops stops that would not fit the budget", () => {
    // 2 km away and 10 min to visit: cannot fit in 20 minutes.
    const out = buildDirectionOptions(input({ remainingMin: 20, items: [natureItem("far", at(0, 1500))] }));
    expect(out.flatMap((o) => o.stops)).toHaveLength(0);
  });

  it("orders shorter-option stops so the walk ends at the end anchor", () => {
    const anchor = at(600, -300);
    const along = (f: number) => at(600 * f, -300 * f);
    const near = foodItem("near-anchor", along(0.8));
    const mid = foodItem("mid", along(0.4));
    const out = buildDirectionOptions(
      input({ endAnchor: anchor, startPoint: undefined, walked: [], items: [near, mid] }),
    );
    const short = out.find((o) => o.theme === "short")!;
    expect(short.mode).toBe("via");
    expect(short.stops.map((s) => s.id)).toEqual(["mid", "near-anchor"]);
    expect(sectorOfItem(near)).toBe(short.sector);
  });

  it("falls back to a route-engine round trip for nature when nothing is mapped", () => {
    const out = buildDirectionOptions(input({ items: [], startPoint: undefined }));
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ theme: "nature", mode: "roundtrip", stops: [] });
    expect(out[0].roundTripLengthM).toBeCloseTo(60 * 80 * 0.8, 5);
  });

  it("uses route alternatives for a shorter way home when no stop is on the way", () => {
    const out = buildDirectionOptions(
      input({ items: [], endAnchor: at(600, -300), walked: [] }),
    );
    const short = out.find((o) => o.theme === "short")!;
    expect(short.mode).toBe("alternatives");
    expect(haversineDistance(ORIGIN, at(600, -300))).toBeGreaterThan(300);
    // a nature round trip is not offered while the old plan's end is far away
    expect(out.find((o) => o.theme === "nature")).toBeUndefined();
  });

  it("offers a stop-less shorter way only when the direct route fits 60% of the time left", () => {
    const base = { items: [], endAnchor: at(600, -300), walked: [] };
    // direct route is about 10.9 min: 60% of 15 is 9, 60% of 20 is 12
    const tight = buildDirectionOptions(input({ ...base, remainingMin: 15 }));
    expect(tight.find((o) => o.theme === "short")).toBeUndefined();
    const roomy = buildDirectionOptions(input({ ...base, remainingMin: 20 }));
    expect(roomy.find((o) => o.theme === "short")).toBeDefined();
  });

  it("offers nothing with no time left", () => {
    expect(buildDirectionOptions(input({ remainingMin: 0 }))).toEqual([]);
  });
});
