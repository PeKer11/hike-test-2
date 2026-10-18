import { describe, expect, it, vi } from "vitest";

import { planAmenityDetour } from "@/lib/walk/companion/amenity-route";
import { at } from "./helpers/discovery";

// A straight 1 km route going north, vertices every 100 m.
const ROUTE = Array.from({ length: 11 }, (_, i) => at(0, i * 100));

function reply(geometry: unknown, ok = true) {
  return { ok, json: async () => ({ geometry }) } as Response;
}

describe("planAmenityDetour", () => {
  const base = {
    geometry: ROUTE,
    segmentIndex: 1,
    position: at(0, 150),
    amenity: at(30, 300),
    amenityAlongM: 300,
    walkerAlongM: 150,
  };

  it("routes out and back with two reroute calls and splices past the amenity", async () => {
    const doFetch = vi
      .fn()
      .mockResolvedValueOnce(reply([at(0, 150), at(30, 300)]))
      .mockResolvedValueOnce(reply([at(30, 300), at(0, 340)]));
    const out = await planAmenityDetour({ ...base, doFetch });
    expect(doFetch).toHaveBeenCalledTimes(2);
    const first = JSON.parse(String(doFetch.mock.calls[0][1]?.body));
    expect(first.candidates).toEqual([base.amenity]);
    const second = JSON.parse(String(doFetch.mock.calls[1][1]?.body));
    // rejoin: first vertex at >= 340 m along, i.e. the 400 m vertex
    expect(second.candidates[0].lat).toBeCloseTo(ROUTE[4].lat, 6);
    expect(out).not.toBeNull();
    expect(out![0]).toEqual(at(0, 150));
    // The route after the rejoin vertex is kept to the end.
    expect(out![out!.length - 1]).toEqual(ROUTE[10]);
    expect(out!).toContainEqual(ROUTE[5]);
    // Vertices between the walker and the rejoin point are replaced by the detour.
    expect(out!).not.toContainEqual(ROUTE[2]);
  });

  it("returns null (keep the route) when a leg fails or is implausibly long", async () => {
    const fail = vi.fn().mockResolvedValue(reply(null, false));
    expect(await planAmenityDetour({ ...base, doFetch: fail })).toBeNull();
    const second = vi
      .fn()
      .mockResolvedValueOnce(reply([at(0, 150), at(30, 300)]))
      .mockResolvedValueOnce(reply([at(30, 300), at(0, 340)], false));
    expect(await planAmenityDetour({ ...base, doFetch: second })).toBeNull();
    const long = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ geometry: [at(0, 150), at(30, 300)], distanceMeters: 5000 }),
    } as Response);
    expect(await planAmenityDetour({ ...base, doFetch: long })).toBeNull();
    const boom = vi.fn().mockRejectedValue(new Error("net"));
    expect(await planAmenityDetour({ ...base, doFetch: boom })).toBeNull();
  });

  it("rejoins at the end of the route when the amenity is near the end", async () => {
    const doFetch = vi
      .fn()
      .mockResolvedValueOnce(reply([at(0, 150), at(30, 960)]))
      .mockResolvedValueOnce(reply([at(30, 960), at(0, 1000)]));
    await planAmenityDetour({ ...base, amenity: at(30, 960), amenityAlongM: 960, doFetch });
    const second = JSON.parse(String(doFetch.mock.calls[1][1]?.body));
    expect(second.candidates[0].lat).toBeCloseTo(ROUTE[10].lat, 6);
  });
});
