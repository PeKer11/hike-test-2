import { describe, expect, it, vi } from "vitest";

import type { Coordinates, NearbyPlace } from "@/lib/types";
import type { DiscoveryItem } from "@/lib/types/discovery";
import { frameRelation } from "@/lib/walk/callout-gate";
import * as cadence from "@/lib/walk/walk-cadence";
import {
  DISCOVERY_TTL_MS,
  DiscoveryLoader,
  itemToPlace,
  placeToItem,
  uncoveredSubPath,
} from "@/lib/walk/discovery-loader";
import { PoiAnnouncer } from "@/lib/walk/poi-announcer";
import { relatePlace } from "@/lib/walk/poi-relation";
import { at, item as discoveryItem } from "./helpers/discovery";

const ROUTE: Coordinates[] = [at(0, 0), at(0, 2000)];
const T0 = 1_700_000_000_000;

function place(
  id: string,
  c: Coordinates,
  over: Partial<NearbyPlace> = {},
): NearbyPlace {
  return {
    id,
    name: id,
    coordinates: c,
    category: "food",
    avgVisitMinutes: 20,
    tags: {},
    source: "osm",
    verification: "registered",
    kind: "poi",
    ...over,
  };
}

type Scan = {
  places?: NearbyPlace[];
  ring?: NearbyPlace[];
  wikipedia?: DiscoveryItem[];
  commons?: DiscoveryItem[];
};

function fetchSpy(scan: Scan = {}, ok = true) {
  return vi.fn(async (_url: string, init?: RequestInit) => {
    void init;
    return { ok, json: async () => scan } as Response;
  });
}

const bodyOf = (spy: ReturnType<typeof fetchSpy>, call = 0) =>
  JSON.parse(String(spy.mock.calls[call][1]?.body)) as Record<string, unknown>;

const ctx = {
  nearTurn: false,
  nearStop: false,
  cardVisible: false,
  paused: false,
  offRoute: false,
  onScreen: 0,
  planStopIds: new Set<string>(),
  preferred: [] as never[],
};

/** A route with enough mapped places per km to count as urban. */
async function urbanLoader(extra: NearbyPlace[]) {
  const dense = Array.from({ length: 14 }, (_, i) =>
    place(`dense-${i}`, at(200, 40 + i * 70), { category: "food" }),
  );
  const spy = fetchSpy({ places: [...dense, ...extra] });
  const loader = new DiscoveryLoader(spy);
  loader.setRoute([at(0, 0), at(0, 1000)], 80);
  await loader.ensureCovered([at(0, 0), at(0, 1000)], T0);
  return { loader, spy };
}

const eligibleIds = (loader: DiscoveryLoader, level: "quiet" | "normal" | "chatty", now = T0 + 1000) =>
  loader
    .eligible({ alongM: 480, speedMps: 1.35, level, nowFixMs: now, ctx })
    .map((i) => i.id);

describe("the scan budget", () => {
  it("scans a route once, with the ring and the signals asked for", async () => {
    const spy = fetchSpy();
    const loader = new DiscoveryLoader(spy);
    expect(await loader.ensureCovered(ROUTE, T0)).toBe(true);
    expect(await loader.ensureCovered(ROUTE, T0 + 5000)).toBe(false);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toBe("/api/nearby");
    expect(bodyOf(spy)).toMatchObject({ radiusMeters: 250, ringRadiusMeters: 600, signals: true });
  });

  it("makes no request however many fixes are evaluated inside the cover", async () => {
    const spy = fetchSpy({ places: [place("p", at(30, 500))] });
    const loader = new DiscoveryLoader(spy);
    loader.setRoute(ROUTE, 80);
    await loader.ensureCovered(ROUTE, T0);
    spy.mockClear();
    for (let i = 0; i < 1000; i += 1) {
      const pos = at(0, (i * 2) % 2000);
      await loader.maybeScanAround(pos, T0 + i * 1000);
      loader.eligible({ alongM: (i * 2) % 2000, speedMps: 1.35, level: "normal", nowFixMs: T0 + i * 1000, ctx });
      loader.relationOf("p", (i * 2) % 2000, pos);
      loader.isNearTurn((i * 2) % 2000);
    }
    expect(spy).not.toHaveBeenCalled();
  });

  it("a splice inside the cover causes no new scan, and re-frames locally", async () => {
    const spy = fetchSpy();
    const loader = new DiscoveryLoader(spy);
    loader.setRoute(ROUTE, 80);
    await loader.ensureCovered(ROUTE, T0);
    const version = loader.collection.routeVersion;
    // A connector off to the side, then back onto the route.
    const spliced = [at(0, 0), at(60, 200), at(0, 400), at(0, 2000)];
    loader.setRoute(spliced, 80);
    expect(await loader.ensureCovered(spliced, T0 + 60_000)).toBe(false);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(loader.collection.routeVersion).toBeGreaterThan(version);
  });

  it("scans only the stretch a new route adds beyond the cover", async () => {
    const spy = fetchSpy();
    const loader = new DiscoveryLoader(spy);
    await loader.ensureCovered(ROUTE, T0);
    const longer = [at(0, 0), at(0, 5000)];
    await loader.ensureCovered(longer, T0 + 1000);
    expect(spy).toHaveBeenCalledTimes(2);
    const path = bodyOf(spy, 1).path as Coordinates[];
    const northM = (p: Coordinates) => (p.lat - at(0, 0).lat) * 111_195;
    expect(northM(path[0])).toBeGreaterThan(2000);
    expect(northM(path[path.length - 1])).toBeGreaterThan(4900);
  });

  it("a simulated walk makes at most 3 scans: plan, splice (0), rebuild, one point scan", async () => {
    const spy = fetchSpy();
    const loader = new DiscoveryLoader(spy);
    // 1. plan shown
    loader.setRoute(ROUTE, 80);
    await loader.ensureCovered(ROUTE, T0);
    // 2. a local-rejoin splice
    const spliced = [at(0, 0), at(50, 150), at(0, 300), at(0, 2000)];
    loader.setRoute(spliced, 80);
    await loader.ensureCovered(spliced, T0 + 60_000);
    // 3. a full rebuild far from everything scanned
    const farRoute = [at(3000, 3000), at(3000, 5000)];
    loader.setRoute(farRoute, 80);
    await loader.ensureCovered(farRoute, T0 + 600_000);
    // 4. a fix well outside every cover, then more of them within the 2 min gap
    const lost = at(-3000, -3000);
    await loader.maybeScanAround(lost, T0 + 700_000);
    await loader.maybeScanAround(at(-3010, -3000), T0 + 760_000);
    await loader.maybeScanAround(at(-3200, -3000), T0 + 790_000);
    const urls = spy.mock.calls.map((c) => c[0]);
    expect(urls.every((u) => u === "/api/nearby")).toBe(true);
    expect(spy.mock.calls.length).toBeLessThanOrEqual(4);
    // Plan + rebuild + one point scan; the splice and the repeats cost nothing.
    expect(spy).toHaveBeenCalledTimes(3);
  });

  it("forgets a failed scan's cover so the next route retries it, and never throws", async () => {
    const spy = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue({ ok: true, json: async () => ({}) } as Response);
    const loader = new DiscoveryLoader(spy);
    await expect(loader.ensureCovered(ROUTE, T0)).resolves.toBe(true);
    expect(loader.collection.coverage).toHaveLength(0);
    await loader.ensureCovered(ROUTE, T0 + 1000);
    expect(spy).toHaveBeenCalledTimes(2);
    const notOk = new DiscoveryLoader(fetchSpy({}, false));
    await notOk.ensureCovered(ROUTE, T0);
    expect(notOk.collection.coverage).toHaveLength(0);
  });

  it("scans the whole path again once the collection is an hour old", async () => {
    const spy = fetchSpy();
    const loader = new DiscoveryLoader(spy);
    await loader.ensureCovered(ROUTE, T0);
    await loader.ensureCovered(ROUTE, T0 + DISCOVERY_TTL_MS - 1000);
    expect(spy).toHaveBeenCalledTimes(1);
    await loader.ensureCovered(ROUTE, T0 + DISCOVERY_TTL_MS + 1000);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("drops the answer of a scan that was in flight when the walk was reset", async () => {
    let release: (r: Response) => void = () => {};
    const spy = vi.fn(
      () => new Promise<Response>((resolve) => (release = resolve)),
    );
    const loader = new DiscoveryLoader(spy);
    const pending = loader.ensureCovered(ROUTE, T0);
    loader.reset();
    release({ ok: true, json: async () => ({ places: [place("late", at(10, 10))] }) } as Response);
    await pending;
    expect(loader.items()).toEqual([]);
  });
});

describe("what a scan fills the collection with", () => {
  it("merges corridor, ring, Wikipedia and Commons items by source and tier", async () => {
    const wiki: DiscoveryItem = discoveryItem("wikidata:Q42", at(120, 500), {
      name: "Old Fountain",
      sources: ["wikipedia", "wikidata"],
      notable: true,
      tags: { wikidata: "Q42" },
    });
    const crowd: DiscoveryItem = discoveryItem("commons:1", at(-300, 800), {
      tier: "crowd-signal",
      sources: ["commons"],
      photoCount: 12,
    });
    const spy = fetchSpy({
      places: [place("near", at(30, 300))],
      ring: [place("ring", at(500, 1000), { tags: { leisure: "park" }, category: "park" })],
      wikipedia: [wiki],
      commons: [crowd],
    });
    const loader = new DiscoveryLoader(spy);
    loader.setRoute(ROUTE, 80);
    await loader.ensureCovered(ROUTE, T0);
    const byId = new Map(loader.items().map((i) => [i.id, i]));
    expect([...byId.keys()].sort()).toEqual(["commons:1", "near", "ring", "wikidata:Q42"]);
    expect(byId.get("commons:1")?.tier).toBe("crowd-signal");
    expect(byId.get("wikidata:Q42")?.sources).toContain("wikipedia");
    expect(byId.get("near")?.frame).not.toBeNull();
    expect(byId.get("ring")?.frame?.side).toBe("right");
  });

  it("maps places to items and back without losing the tier", () => {
    const p = place("x", at(0, 0), { verification: "crowd-signal", source: "commons", tags: { historic: "ruins" } });
    const it = placeToItem(p);
    expect(it.tier).toBe("crowd-signal");
    expect(it.notable).toBe(true);
    expect(itemToPlace(it)).toMatchObject({ id: "x", verification: "crowd-signal", source: "commons" });
    expect(placeToItem(place("y", at(0, 0))).notable).toBe(false);
  });

  it("finds the uncovered stretch of a path", async () => {
    const loader = new DiscoveryLoader(fetchSpy());
    await loader.ensureCovered(ROUTE, T0);
    expect(uncoveredSubPath(loader.collection, ROUTE)).toEqual([]);
    expect(uncoveredSubPath(loader.collection, [at(0, 0), at(0, 5000)]).length).toBeGreaterThan(2);
  });
});

describe("callouts from the collection", () => {
  it("keeps cross-track left/right whatever the GPS heading does", () => {
    // Two places level with the walker, 40 m either side of a north-bound route.
    const east = place("east", at(40, 500));
    const west = place("west", at(-40, 500));
    const loader = new DiscoveryLoader(fetchSpy({ places: [east, west] }));
    loader.setRoute(ROUTE, 80);
    return loader.ensureCovered(ROUTE, T0).then(() => {
      const pos = at(3, 480);
      const along = 480;
      const wrongHeadings = [180, 150, 200, 90];
      let legacyDisagrees = 0;
      const sideOf = (p: NearbyPlace, heading: number) =>
        new PoiAnnouncer().check(pos, heading, 0, [p], new Set(), T0, {
          trusted: true,
          frameOf: (id) => loader.relationOf(id, along, pos),
        })[0]?.relation;
      for (const heading of [0, 20, 340, ...wrongHeadings]) {
        expect(sideOf(east, heading)).toBe("right");
        expect(sideOf(west, heading)).toBe("left");
        if (relatePlace(pos, heading, null, east.coordinates).relation !== "right") {
          legacyDisagrees += 1;
        }
      }
      // The old heading-based answer would have flipped sides for some of these.
      expect(legacyDisagrees).toBeGreaterThan(0);
    });
  });

  it("frameRelation says ahead / behind / side from the frame alone", () => {
    const frame = { alongM: 600, lateralM: 40, side: "right" as const, segIdx: 0 };
    expect(frameRelation(frame, 480, 140)).toBe("ahead");
    expect(frameRelation(frame, 590, 40)).toBe("right");
    expect(frameRelation(frame, 800, 220)).toBe("behind");
    expect(frameRelation({ ...frame, side: "left", lateralM: -40 }, 590, 40)).toBe("left");
    expect(frameRelation(frame, 590, 10)).toBe("here");
  });

  it("announces nothing for a place 70 m aside in urban mode, but a place 30 m aside", async () => {
    const { loader } = await urbanLoader([
      place("close", at(30, 500)),
      place("far", at(70, 505), { category: "museum" }),
    ]);
    expect(loader.environment).toBe("urban");
    const ids = eligibleIds(loader, "normal");
    expect(ids).toContain("close");
    expect(ids).not.toContain("far");
  });

  it("applies the callout level: quiet < normal < chatty", async () => {
    const { loader } = await urbanLoader([
      place("scenery", at(30, 500), {
        kind: "scenery",
        verification: "mapped-unnamed",
        category: "nature",
      }),
      // 60 m from the scenery: closer and a photo spot is absorbed into it.
      place("crowd", at(-30, 505), {
        verification: "crowd-signal",
        category: "other",
        source: "commons",
      }),
    ]);
    const quiet = eligibleIds(loader, "quiet");
    const normal = eligibleIds(loader, "normal");
    const chatty = eligibleIds(loader, "chatty");
    expect(quiet).not.toContain("scenery");
    expect(quiet).not.toContain("crowd");
    expect(normal).toContain("scenery");
    expect(normal).not.toContain("crowd");
    expect(chatty).toContain("crowd");
  });

  it("counts an announced place against the budget and never offers it twice", async () => {
    const { loader } = await urbanLoader([place("a", at(30, 500), { category: "museum" })]);
    expect(eligibleIds(loader, "normal")).toContain("a");
    loader.recordAnnounced("a", T0 + 1000);
    expect(loader.collection.items.get("a")?.state).toBe("announced");
    // Gone from the list, and the 90 s global gap holds everything else back.
    expect(eligibleIds(loader, "normal", T0 + 30_000)).toEqual([]);
    expect(eligibleIds(loader, "normal", T0 + 200_000)).not.toContain("a");
  });

  it("is silent while paused, near a turn, off route, or with a card up (one slot)", async () => {
    const { loader } = await urbanLoader([place("a", at(30, 500), { category: "museum" })]);
    const run = (over: Partial<typeof ctx>) =>
      loader
        .eligible({ alongM: 480, speedMps: 1.35, level: "normal", nowFixMs: T0 + 1000, ctx: { ...ctx, ...over } })
        .map((i) => i.id);
    expect(run({})).toContain("a");
    expect(run({ paused: true })).toEqual([]);
    expect(run({ offRoute: true })).toEqual([]);
    expect(run({ nearTurn: true })).toEqual([]);
    // Normal shows one callout while a card is visible, so a second is refused.
    expect(run({ cardVisible: true, onScreen: 1 })).toEqual([]);
  });
});

describe("the off-route line", () => {
  it("offers the single best registered place right here, never a photo spot or a dismissed one", async () => {
    const spy = fetchSpy({
      places: [
        place("fountain", at(150, 100), { tags: { historic: "fountain" } }),
        place("cafe", at(160, 110)),
        place("hotspot", at(155, 105), { verification: "crowd-signal", source: "commons" }),
      ],
    });
    const loader = new DiscoveryLoader(spy);
    loader.setRoute(ROUTE, 80);
    await loader.ensureCovered(ROUTE, T0);
    const here = loader.whileHere(at(150, 90));
    expect(here?.item.id).toBe("fountain");
    loader.setState("fountain", "dismissed");
    expect(loader.whileHere(at(150, 90))?.item.id).toBe("cafe");
    expect(loader.whileHere(at(2000, 2000))).toBeNull();
  });
});

describe("cadence wiring", () => {
  it("re-exports the discovery numbers from walk-cadence, and the collapse distance matches the rejoin limit", () => {
    expect(cadence.RING_RADIUS_M).toBe(600);
    expect(cadence.COLLAPSE_SUSTAIN_MS).toBe(60_000);
    expect(cadence.ENV_LIMITS.urban.seeItPoiM).toBe(40);
    expect(cadence.COLLAPSE_DEVIATION_M).toBe(cadence.LOCAL_REJOIN_MAX_DEVIATION_M);
  });

  it("applies the `discoveryItem` helper shape (sanity for the fixtures)", () => {
    expect(discoveryItem("z", at(0, 0)).state).toBe("new");
  });
});
