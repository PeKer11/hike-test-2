import { describe, expect, it, vi } from "vitest";

import { NearbyLoader } from "@/lib/walk/nearby-loader";
import type { Coordinates, NearbyPlace } from "@/lib/types";

const M = 111_320;
const ROUTE: Coordinates[] = Array.from({ length: 21 }, (_, i) => ({
  lat: 32.08 + (i * 100) / M,
  lng: 34.78,
}));

function place(id: string): NearbyPlace {
  return {
    id,
    name: id,
    coordinates: ROUTE[3],
    category: "food",
    avgVisitMinutes: 45,
    tags: {},
    source: "osm",
    verification: "registered",
    kind: "poi",
  };
}

function fetchSpy(places: NearbyPlace[] = [place("a")]) {
  return vi.fn(async () => ({ ok: true, json: async () => ({ places }) }) as Response);
}

describe("NearbyLoader", () => {
  it("loads the corridor once per distinct geometry", async () => {
    const spy = fetchSpy();
    const loader = new NearbyLoader(spy);
    await loader.loadCorridor(ROUTE);
    await loader.loadCorridor(ROUTE);
    await loader.loadCorridor([...ROUTE]);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(loader.all().map((p) => p.id)).toEqual(["a"]);
  });

  it("makes no request however many fixes arrive inside the corridor", async () => {
    const spy = fetchSpy();
    const loader = new NearbyLoader(spy);
    await loader.loadCorridor(ROUTE);
    spy.mockClear();
    for (let i = 0; i < 1000; i += 1) {
      await loader.maybeLoadAround(
        { lat: 32.08 + (i % 100) / M, lng: 34.78 + 40 / 94_000 },
        i * 1000,
      );
    }
    expect(spy).not.toHaveBeenCalled();
  });

  it("fetches around a walker far outside the corridor, then throttles", async () => {
    const spy = fetchSpy();
    const loader = new NearbyLoader(spy);
    await loader.loadCorridor(ROUTE);
    spy.mockClear();
    const far: Coordinates = { lat: 32.08, lng: 34.78 + 500 / 94_000 };
    await loader.maybeLoadAround(far, 0);
    expect(spy).toHaveBeenCalledTimes(1);
    // Same cell and inside the 2-minute gap: nothing more.
    await loader.maybeLoadAround(far, 30_000);
    await loader.maybeLoadAround({ ...far, lat: far.lat + 0.0001 }, 119_000);
    expect(spy).toHaveBeenCalledTimes(1);
    // Same cell after the gap but inside the 10-minute cache: still nothing.
    await loader.maybeLoadAround(far, 200_000);
    expect(spy).toHaveBeenCalledTimes(1);
    // Cache expired: asks again.
    await loader.maybeLoadAround(far, 11 * 60_000);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("survives a failing or erroring server without throwing", async () => {
    const loader = new NearbyLoader(async () => ({ ok: false }) as Response);
    await expect(loader.loadCorridor(ROUTE)).resolves.toBeUndefined();
    const throwing = new NearbyLoader(async () => {
      throw new Error("offline");
    });
    await expect(throwing.loadCorridor(ROUTE)).resolves.toBeUndefined();
    expect(throwing.all()).toEqual([]);
  });
});
