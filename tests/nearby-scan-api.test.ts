import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockAlong = vi.fn();
const mockAround = vi.fn();
const mockScan = vi.fn();

vi.mock("@/lib/places/nearby-provider", () => ({
  getNearbyProvider: () => ({
    fetchAlongPath: mockAlong,
    fetchAround: mockAround,
    fetchScan: mockScan,
  }),
}));

import { POST } from "@/app/api/nearby/route";
import { at } from "./helpers/discovery";

const place = (id: string, c: { lat: number; lng: number }, over: Record<string, unknown> = {}) => ({
  id,
  name: id,
  coordinates: c,
  category: "park",
  avgVisitMinutes: 20,
  tags: {},
  source: "osm",
  verification: "registered",
  kind: "poi",
  ...over,
});

let ip = 0;
function request(body: unknown): Request {
  ip += 1;
  return new Request("http://localhost/api/nearby", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": `10.9.0.${ip}` },
    body: JSON.stringify(body),
  });
}

// ~6 km north-south through Tel Aviv: long enough for 4 Wikipedia sample points.
// The route handler caches by path, so each test gets its own line (nudged east: the cache key rounds to ~11 m).
let shift = 0;
function freshPath() {
  shift += 15;
  return [at(shift, 0), at(shift, 3000), at(shift, 6000)];
}

let wikiCalls: string[];
let commonsCalls: string[];
let wikiMode: "ok" | "fail";

function stubFetch() {
  wikiCalls = [];
  commonsCalls = [];
  wikiMode = "ok";
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.includes("wikipedia.org")) {
        wikiCalls.push(url);
        if (wikiMode === "fail") throw new Error("down");
        const c = at(120, 20);
        return {
          ok: true,
          json: async () => ({
            query: {
              pages: {
                "11": {
                  pageid: 11,
                  title: "Old Fountain",
                  coordinates: [{ lat: c.lat, lon: c.lng }],
                  pageprops: { wikibase_item: "Q42" },
                },
              },
            },
          }),
        };
      }
      if (url.includes("commons.wikimedia.org")) {
        commonsCalls.push(url);
        // 9 files in one 50 m cell, far from every place...
        const hot = at(-300, 500);
        // ...and 9 more right beside the Wikipedia page (75 m rule).
        const near = at(140, 20);
        const files = [
          ...Array.from({ length: 9 }, (_, i) => ({ pageid: 100 + i, lat: hot.lat, lon: hot.lng })),
          ...Array.from({ length: 9 }, (_, i) => ({ pageid: 200 + i, lat: near.lat, lon: near.lng })),
        ];
        return { ok: true, json: async () => ({ query: { geosearch: files } }) };
      }
      throw new Error(`unexpected fetch ${url}`);
    }),
  );
}

beforeEach(() => {
  mockAlong.mockReset();
  mockAround.mockReset();
  mockScan.mockReset();
  mockScan.mockResolvedValue([
    place("near", at(30, 100)),
    place("ring-park", at(500, 1000), { tags: { leisure: "park" } }),
  ]);
  stubFetch();
});

afterEach(() => vi.unstubAllGlobals());

describe("POST /api/nearby as a discovery scan", () => {
  it("answers one Overpass call and groups the response by source", async () => {
    const res = await POST(request({ path: freshPath(), ringRadiusMeters: 600, signals: true }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(mockScan).toHaveBeenCalledTimes(1);
    expect(mockAlong).not.toHaveBeenCalled();
    expect(body.places.map((p: { id: string }) => p.id)).toEqual(["near"]);
    expect(body.ring.map((p: { id: string }) => p.id)).toEqual(["ring-park"]);
    expect(body.wikipedia.map((i: { id: string }) => i.id)).toEqual(["wikidata:Q42"]);
    expect(body.calls.overpass).toBe(1);
  });

  it("keeps Wikipedia to <=8 calls and Commons to <=4, all server-side", async () => {
    await POST(request({ path: freshPath(), ringRadiusMeters: 600, signals: true }));
    expect(wikiCalls.length).toBeGreaterThan(0);
    expect(wikiCalls.length).toBeLessThanOrEqual(8);
    expect(commonsCalls.length).toBeLessThanOrEqual(4);
    // Inside Israel both languages are searched.
    expect(wikiCalls.some((u) => u.startsWith("https://he.wikipedia.org"))).toBe(true);
    expect(wikiCalls.some((u) => u.startsWith("https://en.wikipedia.org"))).toBe(true);
  });

  it("turns a Commons photo hotspot into a crowd-signal item, unless a listed place is already there", async () => {
    const body = await (
      await POST(request({ path: freshPath(), ringRadiusMeters: 600, signals: true }))
    ).json();
    const crowd = body.commons as Array<{ tier: string; photoCount: number }>;
    expect(crowd).toHaveLength(1);
    expect(crowd[0].tier).toBe("crowd-signal");
    expect(crowd[0].photoCount).toBeGreaterThanOrEqual(8);
  });

  it("clamps the ring to 600 m and never calls Wikipedia without `signals`", async () => {
    await POST(request({ path: freshPath(), ringRadiusMeters: 5000 }));
    expect(mockScan.mock.calls[0][2]).toBe(600);
    expect(wikiCalls).toHaveLength(0);
    expect(commonsCalls).toHaveLength(0);
  });

  it("ignores `signals` without a ring (the plain request is Overpass only)", async () => {
    mockAlong.mockResolvedValue([]);
    await POST(request({ path: freshPath(), signals: true }));
    expect(mockScan).not.toHaveBeenCalled();
    expect(wikiCalls).toHaveLength(0);
  });

  it("still answers the scan when Wikipedia is down", async () => {
    wikiMode = "fail";
    const res = await POST(request({ path: freshPath(), ringRadiusMeters: 600, signals: true }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.wikipedia).toEqual([]);
    expect(body.places).toHaveLength(1);
  });

  it("fails with 502 when Overpass fails, and caches a repeat scan", async () => {
    mockScan.mockRejectedValueOnce(new Error("overpass down"));
    const body = { path: freshPath(), ringRadiusMeters: 600 };
    expect((await POST(request(body))).status).toBe(502);
    await POST(request(body));
    await POST(request(body));
    expect(mockScan).toHaveBeenCalledTimes(2);
  });

  it("validates the new fields and keeps the null-body guard", async () => {
    for (const bad of [
      { path: freshPath(), ringRadiusMeters: "600" },
      { path: freshPath(), ringRadiusMeters: Number.NaN },
      { path: freshPath(), ringRadiusMeters: 600, signals: "yes" },
    ]) {
      expect((await POST(request(bad))).status).toBe(400);
    }
    for (const body of [null, 5, "x", [1]]) {
      expect((await POST(request(body))).status).toBe(400);
    }
    expect(mockScan).not.toHaveBeenCalled();
  });

  it("scans around a point too (the walker far outside the cover)", async () => {
    const res = await POST(request({ point: at(0, 0), ringRadiusMeters: 600 }));
    expect(res.status).toBe(200);
    expect(mockScan).toHaveBeenCalledTimes(1);
    expect(mockScan.mock.calls[0][0]).toHaveLength(1);
  });
});
