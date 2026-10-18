import { afterEach, describe, expect, it, vi } from "vitest";

import type { Coordinates, NearbyPlace } from "@/lib/types";
import type { DiscoveryItem } from "@/lib/types/discovery";
import {
  acceptDetected,
  DiscoveryLoader,
  itemToPlace,
} from "@/lib/walk/discovery-loader";
import { at, item as discoveryItem } from "./helpers/discovery";

const T0 = Date.UTC(2026, 6, 15, 9, 0, 0); // 12:00 in Israel, daytime
const NIGHT = Date.UTC(2026, 6, 15, 22, 0, 0);
const ROUTE: Coordinates[] = [at(0, 0), at(0, 2000)];

function detected(over: Partial<DiscoveryItem> = {}): DiscoveryItem {
  return discoveryItem("detected:1", { lat: 32.08, lng: 34.78 }, {
    tier: "detected",
    kind: "scenery",
    sources: ["worldcover"],
    ...over,
  });
}

function place(id: string, c: Coordinates, tags: Record<string, string> = {}): NearbyPlace {
  return {
    id, name: id, coordinates: c, category: "food", avgVisitMinutes: 20,
    tags, source: "osm", verification: "registered", kind: "poi",
  };
}

const spyFor = (body: unknown) =>
  vi.fn(async (_u: string, _i?: RequestInit) => ({ ok: true, json: async () => body }) as Response);

afterEach(() => vi.unstubAllEnvs());

describe("detected tier on the client", () => {
  it("keeps nothing while the flag is off", () => {
    expect(acceptDetected([detected()], T0, false)).toEqual([]);
  });
  it("keeps a daytime detected item and drops it at night (client re-check)", () => {
    expect(acceptDetected([detected()], T0, true)).toHaveLength(1);
    expect(acceptDetected([detected()], NIGHT, true)).toEqual([]);
  });
  it("drops items that are not detected-tier or lack coordinates", () => {
    const registered = detected({ tier: "registered" });
    const broken = detected({ attraction: { ...detected().attraction, coordinates: { lat: NaN, lng: 1 } } });
    expect(acceptDetected([registered, broken], T0, true)).toEqual([]);
  });
  it("itemToPlace keeps verification detected and a valid worldcover source", () => {
    const p = itemToPlace(detected());
    expect(p.verification).toBe("detected");
    expect(p.source).toBe("worldcover");
  });
  it("a scan with the flag off adds no detected item; with it on and daytime it does", async () => {
    const body = { places: [], ring: [], detected: [detected()] };
    const off = new DiscoveryLoader(spyFor(body));
    await off.ensureCovered(ROUTE, T0);
    expect(off.items().some((i) => i.tier === "detected")).toBe(false);

    vi.stubEnv("NEXT_PUBLIC_DETECTED_TIER", "1");
    const on = new DiscoveryLoader(spyFor(body));
    await on.ensureCovered(ROUTE, T0);
    expect(on.items().some((i) => i.tier === "detected")).toBe(true);
    const nightLoader = new DiscoveryLoader(spyFor(body));
    await nightLoader.ensureCovered(ROUTE, NIGHT);
    expect(nightLoader.items().some((i) => i.tier === "detected")).toBe(false);
  });
  it("sends the UI language to the scan", async () => {
    const spy = spyFor({});
    const loader = new DiscoveryLoader(spy);
    loader.setLang("he");
    await loader.ensureCovered(ROUTE, T0);
    expect(JSON.parse(String(spy.mock.calls[0][1]?.body)).lang).toBe("he");
  });
});

describe("speed-adaptive point scan", () => {
  async function scansWhenAt(distanceM: number, speedMps?: number) {
    const spy = spyFor({});
    const loader = new DiscoveryLoader(spy);
    loader.setRoute(ROUTE, 80);
    await loader.ensureCovered(ROUTE, T0);
    spy.mockClear();
    // The route is scanned out to its ring; stand `distanceM` from the line.
    await loader.maybeScanAround(at(distanceM, 1000), T0 + 700_000, speedMps);
    return spy.mock.calls.length;
  }
  it("on foot, 500 m from every scan triggers one", async () => {
    expect(await scansWhenAt(500)).toBe(1);
  });
  it("at cycling speed the same spot is still 'inside' (needs speed x 300 s)", async () => {
    expect(await scansWhenAt(500, 4)).toBe(0);
    expect(await scansWhenAt(1300, 4)).toBe(1);
  });
});

describe("amenities and memory", () => {
  it("keeps amenities out of the collection but available to the companion", async () => {
    const water = place("osm-node-9", at(30, 500), { amenity: "drinking_water" });
    const cafe = place("osm-node-1", at(30, 600));
    const loader = new DiscoveryLoader(spyFor({ places: [water, cafe] }));
    await loader.ensureCovered(ROUTE, T0);
    expect(loader.items().map((i) => i.id)).toEqual(["osm-node-1"]);
    expect(loader.amenities().map((p) => p.id)).toEqual(["osm-node-9"]);
  });
  it("seeds dismissed state from remembered interactions, but not for a notable place", async () => {
    const seen = place("osm-node-5", at(30, 500));
    const keep = place("osm-node-6", at(30, 700), { wikidata: "Q1" });
    const loader = new DiscoveryLoader(spyFor({ places: [seen, keep] }));
    loader.setMemory(
      [
        { poi_key: "osm-node-5", kind: "dismissed", count: 1, last_session: 9 },
        { poi_key: "osm-node-6", kind: "visited", count: 1, last_session: 9 },
      ],
      10,
    );
    await loader.ensureCovered(ROUTE, T0);
    expect(loader.collection.items.get("osm-node-5")?.state).toBe("dismissed");
    expect(loader.collection.items.get("osm-node-6")?.state).toBe("new");
  });
  it("reports blocked detour offers from declines", () => {
    const loader = new DiscoveryLoader(spyFor({}));
    expect(loader.detourOffersBlocked).toBe(false);
    loader.setMemory([{ poi_key: "x", kind: "declined_detour", count: 2, last_session: 9 }], 10);
    expect(loader.detourOffersBlocked).toBe(true);
  });
});
