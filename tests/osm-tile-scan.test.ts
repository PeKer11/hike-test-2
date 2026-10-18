import { describe, expect, it, vi } from "vitest";

import { MAX_TILE_BBOXES, scanWithTileCache, type TileStore } from "@/lib/places/osm-tile-scan";
import { tileKey, tileOf, tilesForPath } from "@/lib/places/tile-cache";
import type { NearbyPlace } from "@/lib/types";

const A = { lat: 32.0853, lng: 34.7818 };
const B = { lat: 32.0895, lng: 34.7818 };
const NOW = Date.UTC(2026, 6, 15, 8);

function place(id: string, c = A): NearbyPlace {
  return {
    id,
    name: id,
    coordinates: c,
    category: "park",
    avgVisitMinutes: 5,
    tags: {},
    source: "osm",
    verification: "registered",
    kind: "poi",
  };
}

function memStore(initial: Record<string, { at: number; places: NearbyPlace[] }> = {}) {
  const rows = new Map(Object.entries(initial));
  const store: TileStore = {
    read: vi.fn(async (keys: string[]) => {
      const out = new Map<string, { fetchedAtMs: number; places: NearbyPlace[] }>();
      for (const k of keys) {
        const r = rows.get(k);
        if (r) out.set(k, { fetchedAtMs: r.at, places: r.places });
      }
      return out;
    }),
    write: vi.fn(async (w) => {
      for (const r of w) rows.set(r.key, { at: NOW, places: r.places });
    }),
  };
  return { store, rows };
}

const base = { points: [A, B], radiusMeters: 250, ringRadiusMeters: 600, nowMs: NOW };

describe("scanWithTileCache", () => {
  it("falls back to the plain scan without a store", async () => {
    const fallback = vi.fn(async () => [place("plain")]);
    const out = await scanWithTileCache({ ...base, store: null, fetchInBboxes: vi.fn(), fallback });
    expect(out.map((p) => p.id)).toEqual(["plain"]);
  });

  it("fetches only missing tiles, writes them back, and a repeat is served from cache", async () => {
    const { store, rows } = memStore();
    const fetchInBboxes = vi.fn(async () => [place("p1")]);
    const fallback = vi.fn(async () => []);
    const first = await scanWithTileCache({ ...base, store, fetchInBboxes, fallback });
    expect(first.map((p) => p.id)).toEqual(["p1"]);
    expect(fetchInBboxes).toHaveBeenCalledTimes(1);
    expect(fallback).not.toHaveBeenCalled();
    const { tiles } = tilesForPath(base.points, base.ringRadiusMeters);
    expect(rows.size).toBe(tiles.length);
    // The place is stored under its own tile only.
    expect(rows.get(tileKey(tileOf(A)))!.places.map((p) => p.id)).toEqual(["p1"]);

    const second = await scanWithTileCache({ ...base, store, fetchInBboxes, fallback });
    expect(second.map((p) => p.id)).toEqual(["p1"]);
    expect(fetchInBboxes).toHaveBeenCalledTimes(1);
  });

  it("refetches an expired tile (osm ttl 24 h) but not a fresh one", async () => {
    const { tiles } = tilesForPath(base.points, base.ringRadiusMeters);
    const init: Record<string, { at: number; places: NearbyPlace[] }> = {};
    for (const t of tiles) init[t] = { at: NOW - 30 * 3_600_000, places: [place("old")] };
    const { store } = memStore(init);
    const fetchInBboxes = vi.fn(async () => [place("new")]);
    const out = await scanWithTileCache({ ...base, store, fetchInBboxes, fallback: async () => [] });
    expect(fetchInBboxes).toHaveBeenCalledTimes(1);
    expect(out.map((p) => p.id)).toContain("new");
  });

  it("falls back when the store read throws or the fetch fails", async () => {
    const fallback = vi.fn(async () => [place("plain")]);
    const bad: TileStore = { read: async () => { throw new Error("down"); }, write: async () => {} };
    expect((await scanWithTileCache({ ...base, store: bad, fetchInBboxes: vi.fn(), fallback })).map((p) => p.id)).toEqual(["plain"]);
    const { store } = memStore();
    const failing = vi.fn(async () => { throw new Error("overpass"); });
    expect((await scanWithTileCache({ ...base, store, fetchInBboxes: failing, fallback })).map((p) => p.id)).toEqual(["plain"]);
  });

  it("does not let a failed write fail the scan", async () => {
    const { store } = memStore();
    store.write = async () => { throw new Error("rls"); };
    const out = await scanWithTileCache({ ...base, store, fetchInBboxes: async () => [place("p1")], fallback: async () => [] });
    expect(out.map((p) => p.id)).toEqual(["p1"]);
  });

  it("uses the plain scan when the missing tiles need too many boxes", async () => {
    const { store } = memStore();
    // A long diagonal path: many rows of tiles, one box per row.
    const points = Array.from({ length: 30 }, (_, i) => ({ lat: 32 + i * 0.01, lng: 34.7 + i * 0.001 }));
    const fallback = vi.fn(async () => [place("plain")]);
    const fetchInBboxes = vi.fn(async () => []);
    await scanWithTileCache({ ...base, points, store, fetchInBboxes, fallback });
    expect(MAX_TILE_BBOXES).toBe(12);
    expect(fetchInBboxes).not.toHaveBeenCalled();
    expect(fallback).toHaveBeenCalled();
  });

  it("never writes a place under a tile that was not requested", async () => {
    const { store, rows } = memStore();
    const far = place("far", { lat: 33.5, lng: 35.0 });
    const out = await scanWithTileCache({ ...base, store, fetchInBboxes: async () => [far], fallback: async () => [] });
    expect(out.map((p) => p.id)).toEqual(["far"]);
    expect([...rows.values()].every((r) => r.places.length === 0)).toBe(true);
  });

  it("uses the plain scan for a path with too many tiles", async () => {
    const { store } = memStore();
    const fallback = vi.fn(async () => [place("plain")]);
    const fetchInBboxes = vi.fn(async () => []);
    const points = [{ lat: 31, lng: 34.5 }, { lat: 33, lng: 35.5 }];
    const out = await scanWithTileCache({ ...base, points, store, fetchInBboxes, fallback });
    expect(out.map((p) => p.id)).toEqual(["plain"]);
    expect(fetchInBboxes).not.toHaveBeenCalled();
  });
});
