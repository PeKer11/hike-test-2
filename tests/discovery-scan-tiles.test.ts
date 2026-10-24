import { beforeEach, describe, expect, it, vi } from "vitest";

const runDetected = vi.fn();
const createStore = vi.fn();

vi.mock("@/lib/places/detected-scan", () => ({
  runDetectedScanCounted: (...a: unknown[]) => runDetected(...a),
}));
vi.mock("@/lib/places/osm-tile-scan", async (orig) => ({
  ...(await orig<typeof import("@/lib/places/osm-tile-scan")>()),
  createSupabaseTileStore: () => createStore(),
}));

import { runDiscoveryScan } from "@/lib/places/discovery-scan";
import type { NearbyProvider } from "@/lib/places/nearby-provider";
import type { TileStore } from "@/lib/places/osm-tile-scan";
import type { NearbyPlace } from "@/lib/types";
import { at } from "./helpers/discovery";

const PATH = [at(0, 0), at(0, 500)];

function place(id: string, c: { lat: number; lng: number }, tags: Record<string, string> = {}): NearbyPlace {
  return {
    id, name: id, coordinates: c, category: "park", avgVisitMinutes: 10,
    tags, source: "osm", verification: "registered", kind: "poi",
  };
}

function emptyStore(): TileStore {
  return { read: async () => new Map(), write: vi.fn(async () => {}) };
}

beforeEach(() => {
  runDetected.mockReset().mockResolvedValue({ items: [], overpassCalls: 0 });
  createStore.mockReset().mockResolvedValue(null);
});

describe("runDiscoveryScan: shared tile cache and language", () => {
  it("uses the plain scan when there is no tile store (service key missing)", async () => {
    const fetchScan = vi.fn(async () => [place("p", at(10, 100))]);
    const fetchInBboxes = vi.fn(async () => []);
    const provider = { fetchAlongPath: vi.fn(), fetchAround: vi.fn(), fetchScan, fetchInBboxes } as unknown as NearbyProvider;
    const scan = await runDiscoveryScan(provider, PATH, 250, 600, false);
    expect(fetchScan).toHaveBeenCalledTimes(1);
    expect(fetchInBboxes).not.toHaveBeenCalled();
    expect(scan.places.map((p) => p.id)).toEqual(["p"]);
  });

  it("fetches misses by tile box, keeps corridor places, and thins the ring to notable ones", async () => {
    createStore.mockResolvedValue(emptyStore());
    const near = place("near", at(10, 100));
    const ringNotable = place("ring-notable", at(400, 100), { historic: "ruins" });
    const ringPlain = place("ring-plain", at(400, 200), { amenity: "cafe" });
    const fetchScan = vi.fn(async () => []);
    const fetchInBboxes = vi.fn(async () => [near, ringNotable, ringPlain]);
    const provider = { fetchAlongPath: vi.fn(), fetchAround: vi.fn(), fetchScan, fetchInBboxes } as unknown as NearbyProvider;
    const scan = await runDiscoveryScan(provider, PATH, 250, 600, false);
    expect(fetchInBboxes).toHaveBeenCalledTimes(1);
    expect(fetchScan).not.toHaveBeenCalled();
    expect(scan.places.map((p) => p.id)).toEqual(["near"]);
    expect(scan.ring.map((p) => p.id)).toEqual(["ring-notable"]);
  });

});
