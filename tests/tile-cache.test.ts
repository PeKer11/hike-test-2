import { describe, expect, it } from "vitest";

import {
  decompose,
  isFresh,
  MAX_TILES,
  parseTileKey,
  tileBbox,
  tileKey,
  tileOf,
  TILE_TTL_MS,
  tilesForPath,
  tilesToBboxes,
} from "@/lib/places/tile-cache";
import {
  POINT_SCAN_MIN_DISTANCE_M,
  pointScanDistanceM,
} from "@/lib/walk/discovery-cadence";

const TLV = { lat: 32.0853, lng: 34.7818 };

describe("tile keys", () => {
  it("tile of Tel Aviv at z15 is the known slippy tile", () => {
    expect(tileKey(tileOf(TLV))).toBe("15/19549/13297");
  });

  it("round-trips: the bbox of a tile contains the point and is ~1 km tall", () => {
    const key = tileKey(tileOf(TLV));
    const b = tileBbox(key)!;
    expect(TLV.lat).toBeGreaterThanOrEqual(b.south);
    expect(TLV.lat).toBeLessThanOrEqual(b.north);
    expect(TLV.lng).toBeGreaterThanOrEqual(b.west);
    expect(TLV.lng).toBeLessThanOrEqual(b.east);
    expect(((b.north - b.south) * 111_320)).toBeGreaterThan(900);
    expect(((b.north - b.south) * 111_320)).toBeLessThan(1100);
  });

  it("parses and rejects keys", () => {
    expect(parseTileKey("15/1/2")).toEqual({ z: 15, x: 1, y: 2 });
    expect(parseTileKey("15/a/2")).toBeNull();
    expect(tileBbox("garbage")).toBeNull();
  });
});

describe("tilesForPath", () => {
  it("a long straight leg yields a contiguous run of tiles (no gaps)", () => {
    const { tiles, capped } = tilesForPath(
      [TLV, { lat: TLV.lat, lng: TLV.lng + 0.03 }], // ~2.8 km east
      100,
    );
    expect(capped).toBe(false);
    const xs = tiles.map((t) => parseTileKey(t)!.x).sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i += 1) expect(xs[i] - xs[i - 1]).toBeLessThanOrEqual(1);
    expect(xs.length).toBeGreaterThanOrEqual(3);
  });

  it("buffer widens coverage", () => {
    const small = tilesForPath([TLV, { lat: TLV.lat + 0.01, lng: TLV.lng }], 10).tiles;
    const big = tilesForPath([TLV, { lat: TLV.lat + 0.01, lng: TLV.lng }], 1500).tiles;
    expect(big.length).toBeGreaterThan(small.length);
  });

  it("expands each box by half the sample step (a point near a tile edge reaches the next tile)", () => {
    const home = tileOf(TLV);
    const east = tileBbox(tileKey(home))!.east;
    const lat = (tileBbox(tileKey(home))!.north + tileBbox(tileKey(home))!.south) / 2;
    const nearEdge = { lat, lng: east - 150 / (111_320 * Math.cos((lat * Math.PI) / 180)) };
    const keys = tilesForPath([nearEdge], 100).tiles.map((t) => parseTileKey(t)!.x);
    expect(keys).toContain(home.x + 1); // 150 m to the edge < 100 m buffer + 200 m half step
  });

  it("caps instead of exploding", () => {
    const r = tilesForPath([TLV, { lat: TLV.lat + 1, lng: TLV.lng + 1 }], 500);
    expect(r.capped).toBe(true);
    expect(r.tiles).toEqual([]);
    expect(MAX_TILES).toBeGreaterThan(0);
  });
});

describe("decompose and TTL", () => {
  const now = 1_000_000_000_000;
  const H = 3_600_000;

  it("osm is fresh for 24 h, wikipedia for 7 d, landcover forever", () => {
    expect(isFresh("osm", now - 23 * H, now)).toBe(true);
    expect(isFresh("osm", now - 24 * H, now)).toBe(false);
    expect(isFresh("wikipedia", now - 6 * 24 * H, now)).toBe(true);
    expect(isFresh("wikipedia", now - 7 * 24 * H, now)).toBe(false);
    expect(isFresh("landcover", now - 9999 * 24 * H, now)).toBe(true);
    expect(isFresh("osm", undefined, now)).toBe(false);
    expect(TILE_TTL_MS.landcover).toBeNull();
  });

  it("second user on the same area needs zero fetches", () => {
    const { tiles } = tilesForPath([TLV, { lat: TLV.lat + 0.01, lng: TLV.lng }], 250);
    const cache = new Map(tiles.map((t) => [t, now - H] as const));
    const r = decompose(tiles, "osm", cache, now);
    expect(r.missing).toEqual([]);
    expect(r.fresh).toEqual(tiles);
  });

  it("only stale or absent tiles are fetched", () => {
    const cache = new Map([
      ["15/1/1", now - H],
      ["15/1/2", now - 30 * H],
    ]);
    const r = decompose(["15/1/1", "15/1/2", "15/1/3"], "osm", cache, now);
    expect(r.fresh).toEqual(["15/1/1"]);
    expect(r.missing).toEqual(["15/1/2", "15/1/3"]);
  });
});

describe("tilesToBboxes", () => {
  it("merges horizontal runs into one bbox and keeps rows apart", () => {
    const boxes = tilesToBboxes(["15/10/5", "15/11/5", "15/12/5", "15/10/6", "15/14/5"]);
    expect(boxes).toHaveLength(3);
    const run = boxes.find((b) => b.east - b.west > 0.02)!;
    const one = tileBbox("15/10/5")!;
    const three = tileBbox("15/12/5")!;
    expect(run.west).toBeCloseTo(one.west);
    expect(run.east).toBeCloseTo(three.east);
  });

  it("de-duplicates", () => {
    expect(tilesToBboxes(["15/1/1", "15/1/1"])).toHaveLength(1);
  });
});

describe("speed-adaptive point scan distance", () => {
  it("is max(450, speed x 300 s)", () => {
    expect(pointScanDistanceM(4)).toBe(1200);
    expect(pointScanDistanceM(1.35)).toBe(POINT_SCAN_MIN_DISTANCE_M);
    expect(pointScanDistanceM(1.5)).toBe(POINT_SCAN_MIN_DISTANCE_M);
    expect(pointScanDistanceM(2)).toBe(600);
  });

  it("falls back to 450 for bad speeds", () => {
    expect(pointScanDistanceM(NaN)).toBe(450);
    expect(pointScanDistanceM(-3)).toBe(450);
    expect(pointScanDistanceM(0)).toBe(450);
  });
});
