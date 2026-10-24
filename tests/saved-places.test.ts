import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { addFromWalk, addPlaces, clearVisited, keysFromStops, listPlaces, markVisited, osmRef, placesFromStops, removePlace, sanitizePlace } from "@/lib/places/saved-places";
import type { SavedStop } from "@/lib/walks/saved-walks";

function mockClient(result: { data?: unknown; error?: unknown } = {}) {
  const calls: Array<[string, unknown[]]> = [];
  const q: Record<string, unknown> = {};
  for (const m of ["from", "insert", "upsert", "update", "delete", "select", "eq", "in", "not", "order", "limit"]) {
    q[m] = (...args: unknown[]) => {
      calls.push([m, args]);
      return q;
    };
  }
  q.then = (res: (v: unknown) => unknown) => Promise.resolve({ data: result.data ?? null, error: result.error ?? null }).then(res);
  return { client: q as unknown as SupabaseClient, calls };
}

const stops: SavedStop[] = [
  { name: "Pizza", category: "food", lat: 32.5, lng: 34.9, placeId: "gp1" },
  { name: "Park", category: "park", lat: 32.51, lng: 34.91 },
];

describe("saved-places", () => {
  it("google rows never keep coordinates, osm rows require them", () => {
    expect(sanitizePlace("u", { source: "google", placeRef: "gp1", label: "Pizza", coordinates: { lat: 1, lng: 2 } })).toMatchObject({ lat: null, lng: null, source: "google" });
    expect(sanitizePlace("u", { source: "osm", placeRef: "r", label: "Park" })).toBeNull();
    expect(sanitizePlace("u", { source: "osm", placeRef: "r", label: "Park", coordinates: { lat: 91, lng: 0 } })).toBeNull();
    expect(sanitizePlace("u", { source: "osm", placeRef: "r", label: "Park", coordinates: { lat: 3, lng: 4 } })).toMatchObject({ lat: 3, lng: 4 });
  });
  it("rejects empty labels/refs and unknown sources, trims and caps", () => {
    expect(sanitizePlace("u", { source: "google", placeRef: " ", label: "x" })).toBeNull();
    expect(sanitizePlace("u", { source: "google", placeRef: "a", label: "  " })).toBeNull();
    expect(sanitizePlace("u", { source: "bing" as never, placeRef: "a", label: "x" })).toBeNull();
    const row = sanitizePlace("u", { source: "google", placeRef: "a", label: "x".repeat(500), category: "c".repeat(99) })!;
    expect((row.label as string).length).toBe(120);
    expect((row.category as string).length).toBe(40);
  });
  it("maps stops: google by place id, others as osm with a rounded key", () => {
    expect(placesFromStops(stops)).toEqual([
      { source: "google", placeRef: "gp1", label: "Pizza", category: "food" },
      { source: "osm", placeRef: "32.51000,34.91000", label: "Park", category: "park", coordinates: { lat: 32.51, lng: 34.91 } },
    ]);
    expect(osmRef({ lat: 1.123456789, lng: 2 })).toBe("1.12346,2.00000");
    expect(keysFromStops(stops)).toEqual([{ source: "google", placeRef: "gp1" }, { source: "osm", placeRef: "32.51000,34.91000" }]);
  });
  it("add is an upsert that ignores duplicates; empty input sends nothing", async () => {
    const { client, calls } = mockClient();
    expect(await addFromWalk(client, "u1", stops)).toBe(2);
    const up = calls.find(([m]) => m === "upsert")!;
    expect(up[1][1]).toEqual({ onConflict: "user_id,source,place_ref", ignoreDuplicates: true });
    expect((up[1][0] as unknown[]).length).toBe(2);
    const empty = mockClient();
    expect(await addPlaces(empty.client, "u1", [])).toBe(0);
    expect(empty.calls.length).toBe(0);
  });
  it("add returns null on error", async () => {
    expect(await addFromWalk(mockClient({ error: { message: "x" } }).client, "u1", stops)).toBeNull();
  });
  it("markVisited updates per source; clearVisited deletes only marked rows", async () => {
    const m = mockClient();
    expect(await markVisited(m.client, "u1", keysFromStops(stops), new Date("2026-10-24T00:00:00Z"))).toBe(true);
    expect(m.calls.filter(([c]) => c === "update").length).toBe(2);
    expect(m.calls.find(([c]) => c === "update")![1][0]).toEqual({ visited_at: "2026-10-24T00:00:00.000Z" });
    const c = mockClient();
    expect(await clearVisited(c.client, "u1")).toBe(true);
    expect(c.calls.find(([x]) => x === "not")![1]).toEqual(["visited_at", "is", null]);
    expect(await clearVisited(mockClient({ error: { message: "x" } }).client, "u1")).toBe(false);
  });
  it("list maps rows; remove is scoped to the user", async () => {
    const { client } = mockClient({ data: [{ id: "i", source: "osm", place_ref: "r", label: "L", category: "park", lat: "1.5", lng: 2, visited_at: null, created_at: "c" }] });
    expect(await listPlaces(client, "u1")).toEqual([{ id: "i", source: "osm", placeRef: "r", label: "L", category: "park", coordinates: { lat: 1.5, lng: 2 }, visitedAt: null, createdAt: "c" }]);
    const r = mockClient();
    expect(await removePlace(r.client, "u1", "i")).toBe(true);
    expect(r.calls.filter(([c]) => c === "eq").map(([, a]) => a)).toEqual([["id", "i"], ["user_id", "u1"]]);
  });
});
