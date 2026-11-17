import { describe, expect, it, vi } from "vitest";

import { resolveSharedStops } from "@/lib/walks/friend-plan";
import type { SavedStop } from "@/lib/walks/saved-walks";

const PID = "ChIJabcdefghij12345";
const named: SavedStop = { name: "OSM Park", category: "park", lat: 32.02, lng: 34.8 };
const idOnly: SavedStop = { name: "", category: "food", lat: 0, lng: 0, placeId: PID };

describe("planning a friend's walk with placeId-only stops", () => {
  it("resolves Google stops through /api/places/resolve with the ids only, keeping order", async () => {
    const doFetch = vi.fn(async (_u: unknown, init?: RequestInit) => {
      expect(JSON.parse(String(init?.body))).toEqual({ ids: [PID] });
      return new Response(JSON.stringify({ places: [{ placeId: PID, name: "Cafe", coordinates: { lat: 32.1, lng: 34.9 }, category: "food" }] }));
    });
    const out = await resolveSharedStops([named, idOnly], doFetch as unknown as typeof fetch);
    expect(out.map((s) => s.name)).toEqual(["OSM Park", "Cafe"]);
    expect(out[1]).toMatchObject({ lat: 32.1, lng: 34.9, placeId: PID });
    expect(doFetch).toHaveBeenCalledTimes(1);
  });

  it("works with the old shape (everything named): no request at all", async () => {
    const doFetch = vi.fn();
    const out = await resolveSharedStops([named, { ...named, name: "B", placeId: PID }], doFetch as unknown as typeof fetch);
    expect(out).toHaveLength(2);
    expect(doFetch).not.toHaveBeenCalled();
  });

  it("drops stops it cannot resolve (offline, not found)", async () => {
    const offline = vi.fn(async () => { throw new Error("offline"); });
    expect(await resolveSharedStops([named, idOnly], offline as unknown as typeof fetch)).toEqual([named]);
    const none = vi.fn(async () => new Response(JSON.stringify({ places: [] })));
    expect(await resolveSharedStops([idOnly], none as unknown as typeof fetch)).toEqual([]);
  });
});
