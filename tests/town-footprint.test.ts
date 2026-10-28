import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchTownBoundary, fetchTownFootprint } from "@/lib/walk/town-boundary";
import { insideBoundary } from "@/lib/walk/loop-search";

const ring = [[34.92, 32.49], [35.02, 32.49], [35.02, 32.56], [34.92, 32.56], [34.92, 32.49]];
const hit = { lat: "32.518", lon: "34.95", addresstype: "municipality", geojson: { type: "Polygon", coordinates: [ring] } };

afterEach(() => vi.unstubAllGlobals());

describe("town footprint", () => {
  it("shares the lookup but keeps municipal membership independent of the routing-radius clamp", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify([hit])));
    vi.stubGlobal("fetch", fetch);
    const routing = await fetchTownBoundary("footprint-test-town");
    const footprint = await fetchTownFootprint("footprint-test-town");
    const elsewhereInTown = { lat: 32.54, lng: 34.94 };
    expect(insideBoundary(elsewhereInTown, footprint!, 0)).toBe(true);
    expect(insideBoundary(elsewhereInTown, routing!, 0)).toBe(false);
    expect(footprint).toEqual([ring]);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("keeps every part of a compound municipality", async () => {
    const other = ring.map(([lng, lat]) => [lng + 0.2, lat]);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify([{ ...hit, geojson: { type: "MultiPolygon", coordinates: [[ring], [other]] } }]))));
    const footprint = await fetchTownFootprint("footprint-test-multi");
    expect(footprint).toEqual([ring, other]);
    expect(insideBoundary({ lat: 32.54, lng: 35.14 }, footprint!, 0)).toBe(true);
  });

  it("returns unknown for missing, empty, malformed or unavailable outlines", async () => {
    const rows = [[], [{ ...hit, geojson: { type: "Polygon", coordinates: [[]] } }], [{ ...hit, geojson: { type: "Point", coordinates: [34.95, 32.518] } }]];
    for (let i = 0; i < rows.length; i++) {
      vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(rows[i]))));
      expect(await fetchTownFootprint(`footprint-test-unknown-${i}`)).toBeNull();
    }
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    expect(await fetchTownFootprint("footprint-test-offline")).toBeNull();
  });
});
