import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fetchPlacesAlongPath,
  fetchPlacesAround,
  fetchPlacesInBboxes,
  isRingNotable,
} from "@/lib/attractions/overpass-client";

function mockOverpass(elements: unknown[]) {
  const spy = vi.fn(async () => ({ ok: true, json: async () => ({ elements }) }) as Response);
  vi.stubGlobal("fetch", spy);
  return spy;
}

afterEach(() => vi.unstubAllGlobals());

describe("fetchPlacesAlongPath", () => {
  it("queries with the corridor line form and one request", async () => {
    const spy = mockOverpass([]);
    await fetchPlacesAlongPath(
      [
        { lat: 32.08, lng: 34.78 },
        { lat: 32.09, lng: 34.79 },
      ],
      250,
    );
    expect(spy).toHaveBeenCalledTimes(1);
    const init = (spy.mock.calls[0] as unknown as [string, RequestInit])[1];
    const body = decodeURIComponent(String(init.body));
    expect(body).toContain("around:250,32.08000,34.78000,32.09000,34.79000");
    expect(body).toContain('"landuse"="forest"');
  });

  it("returns named POIs as registered, unnamed woods as mapped-unnamed scenery, drops unnamed POIs", async () => {
    mockOverpass([
      { type: "node", id: 1, lat: 32.08, lon: 34.78, tags: { amenity: "cafe", name: "Café Nola" } },
      { type: "node", id: 2, lat: 32.08, lon: 34.78, tags: { amenity: "restaurant" } },
      { type: "way", id: 3, center: { lat: 32.081, lon: 34.78 }, tags: { natural: "wood" } },
    ]);
    const places = await fetchPlacesAround({ lat: 32.08, lng: 34.78 }, 300);
    const byId = Object.fromEntries(places.map((p) => [p.id, p]));
    expect(Object.keys(byId).sort()).toEqual(["osm-node-1", "osm-way-3"]);
    expect(byId["osm-node-1"]).toMatchObject({ kind: "poi", verification: "registered", source: "osm" });
    expect(byId["osm-way-3"]).toMatchObject({
      kind: "scenery",
      verification: "mapped-unnamed",
      name: "Wooded area (mapped)",
    });
  });
});

describe("amenities and tile boxes", () => {
  it("asks for drinking water and toilets, and returns them as unannounced scenery", async () => {
    const spy = mockOverpass([
      { type: "node", id: 7, lat: 32.08, lon: 34.78, tags: { amenity: "drinking_water" } },
      { type: "node", id: 8, lat: 32.08, lon: 34.78, tags: { amenity: "toilets", name: "Park WC" } },
    ]);
    const places = await fetchPlacesAround({ lat: 32.08, lng: 34.78 }, 300);
    const body = decodeURIComponent(String((spy.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(body).toContain('"amenity"~"drinking_water|toilets"');
    expect(places.map((p) => [p.id, p.tags.amenity, p.verification, p.kind])).toEqual([
      ["osm-node-7", "drinking_water", "mapped-unnamed", "scenery"],
      ["osm-node-8", "toilets", "mapped-unnamed", "scenery"],
    ]);
    expect(places[1].name).toBe("Park WC");
  });

  it("fetchPlacesInBboxes unions every box with the corridor and ring statements", async () => {
    const spy = mockOverpass([{ type: "node", id: 1, lat: 32.08, lon: 34.78, tags: { amenity: "cafe", name: "Nola" } }]);
    const places = await fetchPlacesInBboxes([
      { south: 32.0, west: 34.7, north: 32.01, east: 34.72 },
      { south: 32.1, west: 34.7, north: 32.11, east: 34.72 },
    ]);
    const body = decodeURIComponent(String((spy.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(body).toContain("(32.00000,34.70000,32.01000,34.72000)");
    expect(body).toContain("(32.10000,34.70000,32.11000,34.72000)");
    expect(body).toContain('nwr["wikidata"](32.10000');
    expect(places.map((p) => p.id)).toEqual(["osm-node-1"]);
  });

  it("isRingNotable mirrors the ring statements", () => {
    expect(isRingNotable({ tourism: "viewpoint" })).toBe(true);
    expect(isRingNotable({ historic: "ruins" })).toBe(true);
    expect(isRingNotable({ leisure: "park", name: "Yarkon" })).toBe(true);
    expect(isRingNotable({ leisure: "park" })).toBe(false);
    expect(isRingNotable({ natural: "water" })).toBe(true);
    expect(isRingNotable({ wikidata: "Q1" })).toBe(true);
    expect(isRingNotable({ amenity: "cafe" })).toBe(false);
    expect(isRingNotable({ tourism: "hotel" })).toBe(false);
  });
});
