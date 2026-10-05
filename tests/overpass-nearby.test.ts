import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchPlacesAlongPath, fetchPlacesAround } from "@/lib/attractions/overpass-client";

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
