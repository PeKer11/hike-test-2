import { describe, expect, it } from "vitest";

import { PoiAnnouncer } from "@/lib/walk/poi-announcer";
import type { Coordinates, NearbyPlace } from "@/lib/types";

const M = 111_320;
const ORIGIN: Coordinates = { lat: 32.08, lng: 34.78 };
const at = (northM: number, eastM: number): Coordinates => ({
  lat: ORIGIN.lat + northM / M,
  lng: ORIGIN.lng + eastM / (M * Math.cos((ORIGIN.lat * Math.PI) / 180)),
});

function place(id: string, c: Coordinates, over: Partial<NearbyPlace> = {}): NearbyPlace {
  return {
    id,
    name: id,
    coordinates: c,
    category: "food",
    avgVisitMinutes: 45,
    tags: {},
    source: "osm",
    verification: "registered",
    kind: "poi",
    ...over,
  };
}

const NO_STOPS: ReadonlySet<string> = new Set();
const T0 = 1_700_000_000_000;

describe("PoiAnnouncer", () => {
  it("announces a place on the right of a north-bound walker", () => {
    const a = new PoiAnnouncer();
    const out = a.check(ORIGIN, 0, 0, [place("p", at(10, 40))], NO_STOPS, T0);
    expect(out).toHaveLength(1);
    expect(out[0].relation).toBe("right");
  });

  it("never announces the same place twice, even after dismissal", () => {
    const a = new PoiAnnouncer();
    const p = place("p", at(10, 40));
    a.check(ORIGIN, 0, 0, [p], NO_STOPS, T0);
    a.dismiss("p");
    const later = a.check(ORIGIN, 0, 0, [p], NO_STOPS, T0 + 20 * 60_000);
    expect(later).toEqual([]);
  });

  it("holds a 90 s gap between announcements", () => {
    const a = new PoiAnnouncer();
    const p1 = place("p1", at(10, 40), { category: "museum" });
    const p2 = place("p2", at(20, -40), { category: "park" });
    expect(a.check(ORIGIN, 0, 0, [p1, p2], NO_STOPS, T0).map((x) => x.place.id)).toEqual(["p1"]);
    // 25 s later p1 is still up and p2 is held back by the gap.
    expect(a.check(ORIGIN, 0, 0, [p1, p2], NO_STOPS, T0 + 25_000).map((x) => x.place.id)).toEqual(["p1"]);
    // p1 has timed out; p2 still waits for the 90 s gap to pass.
    expect(a.check(ORIGIN, 0, 0, [p2], NO_STOPS, T0 + 60_000)).toEqual([]);
    expect(a.check(ORIGIN, 0, 0, [p2], NO_STOPS, T0 + 91_000).map((x) => x.place.id)).toEqual(["p2"]);
  });

  it("holds a 10 min cooldown per category, but not for plan stops", () => {
    const a = new PoiAnnouncer();
    a.check(ORIGIN, 0, 0, [place("c1", at(10, 40))], NO_STOPS, T0);
    const second = place("c2", at(10, -40));
    expect(a.check(ORIGIN, 0, 0, [second], NO_STOPS, T0 + 100_000)).toEqual([]);
    expect(a.check(ORIGIN, 0, 0, [second], new Set(["c2"]), T0 + 100_000).map((x) => x.place.id)).toEqual(["c2"]);
    // Past the cooldown an ordinary place of that category is allowed again.
    const b = new PoiAnnouncer();
    b.check(ORIGIN, 0, 0, [place("c1", at(10, 40))], NO_STOPS, T0);
    expect(b.check(ORIGIN, 0, 0, [second], NO_STOPS, T0 + 11 * 60_000).map((x) => x.place.id)).toEqual(["c2"]);
  });

  it("caps callouts on screen at 2", () => {
    const a = new PoiAnnouncer();
    const ps = ["a", "b", "c"].map((id, i) =>
      place(id, at(10, 40 * (i % 2 === 0 ? 1 : -1)), { category: (["museum", "park", "religious"] as const)[i] }),
    );
    let out = a.check(ORIGIN, 0, 0, ps, NO_STOPS, T0);
    out = a.check(ORIGIN, 0, 0, ps, NO_STOPS, T0 + 91_000);
    out = a.check(ORIGIN, 0, 0, ps, NO_STOPS, T0 + 182_000);
    expect(out.length).toBeLessThanOrEqual(2);
  });

  it("ranks plan stops first, then preferred categories, then notable, then nearer", () => {
    const stop = place("stop", at(100, 40), { category: "shopping" });
    const fav = place("fav", at(10, 40), { category: "museum" });
    const wiki = place("wiki", at(10, -40), { category: "landmark", tags: { wikidata: "Q1" } });
    const plain = place("plain", at(5, 40), { category: "religious" });

    const withStop = new PoiAnnouncer(["museum"]);
    expect(withStop.check(ORIGIN, 0, 0, [plain, wiki, fav, stop], new Set(["stop"]), T0)[0].place.id).toBe("stop");
    const preferred = new PoiAnnouncer(["museum"]);
    expect(preferred.check(ORIGIN, 0, 0, [plain, wiki, fav], NO_STOPS, T0)[0].place.id).toBe("fav");
    const notable = new PoiAnnouncer();
    expect(notable.check(ORIGIN, 0, 0, [plain, wiki], NO_STOPS, T0)[0].place.id).toBe("wiki");
    const nearest = new PoiAnnouncer();
    expect(nearest.check(ORIGIN, 0, 0, [plain, place("far", at(10, 60), { category: "museum" })], NO_STOPS, T0)[0].place.id).toBe("plain");
  });

  it("skips places behind the walker or beyond 150 m", () => {
    const a = new PoiAnnouncer();
    const out = a.check(
      ORIGIN, 0, 0,
      [place("behind", at(-80, 0)), place("far", at(200, 0), { category: "park" })],
      NO_STOPS, T0,
    );
    expect(out).toEqual([]);
  });

  it("expires a callout after 30 s, or once it is behind and >60 m away", () => {
    const a = new PoiAnnouncer();
    const p = place("p", at(30, 20));
    a.check(ORIGIN, 0, 0, [p], NO_STOPS, T0);
    // Walker has moved 100 m north: the place is now behind and ~70 m away.
    expect(a.check(at(100, 0), 0, 0, [], NO_STOPS, T0 + 5_000)).toEqual([]);

    const b = new PoiAnnouncer();
    b.check(ORIGIN, 0, 0, [p], NO_STOPS, T0);
    expect(b.check(ORIGIN, 0, 0, [], NO_STOPS, T0 + 29_000)).toHaveLength(1);
    expect(b.check(ORIGIN, 0, 0, [], NO_STOPS, T0 + 31_000)).toEqual([]);
  });

  it("limits scenery to once per 10 minutes", () => {
    const a = new PoiAnnouncer();
    const w1 = place("w1", at(10, 40), { kind: "scenery", category: "nature", verification: "mapped-unnamed" });
    const w2 = place("w2", at(10, -40), { kind: "scenery", category: "nature", verification: "mapped-unnamed" });
    a.check(ORIGIN, 0, 0, [w1, w2], NO_STOPS, T0);
    expect(a.check(ORIGIN, 0, 0, [w2], NO_STOPS, T0 + 100_000)).toEqual([]);
    expect(a.check(ORIGIN, 0, 0, [w2], NO_STOPS, T0 + 11 * 60_000).map((x) => x.place.id)).toEqual(["w2"]);
  });
});
