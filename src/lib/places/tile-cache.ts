import type { Coordinates } from "@/lib/types";
import { haversineDistance } from "@/lib/utils/geo";

/**
 * Pure helpers for the shared POI tile cache (roadmap E1). z15 slippy tiles are
 * about 1 km at Israel's latitude. Nothing here touches the network or the
 * database: phase 2 wires `discovery-scan.ts` to look up `poi_tile_cache`, fetch
 * only `missing` tiles as ONE Overpass union of `bboxes`, then filter to the
 * corridor in memory.
 */

export const TILE_ZOOM = 15;
/** Stop decomposing past this many tiles; the caller falls back to a plain scan. */
export const MAX_TILES = 150;
const SAMPLE_STEP_M = 400;

export type TileSource = "osm" | "wikipedia" | "commons" | "landcover";

/** `null` = never expires (landcover). */
export const TILE_TTL_MS: Record<TileSource, number | null> = {
  osm: 24 * 3_600_000,
  wikipedia: 7 * 24 * 3_600_000,
  commons: 7 * 24 * 3_600_000,
  landcover: null,
};

export interface Tile {
  x: number;
  y: number;
}

export interface Bbox {
  south: number;
  west: number;
  north: number;
  east: number;
}

export function tileOf(p: Coordinates, z = TILE_ZOOM): Tile {
  const n = 2 ** z;
  const latR = (p.lat * Math.PI) / 180;
  const x = Math.floor(((p.lng + 180) / 360) * n);
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latR) + 1 / Math.cos(latR)) / Math.PI) / 2) * n,
  );
  return { x: Math.min(n - 1, Math.max(0, x)), y: Math.min(n - 1, Math.max(0, y)) };
}

export function tileKey(t: Tile, z = TILE_ZOOM): string {
  return `${z}/${t.x}/${t.y}`;
}

export function parseTileKey(key: string): { z: number; x: number; y: number } | null {
  const m = /^(\d{1,2})\/(\d+)\/(\d+)$/.exec(key);
  if (!m) return null;
  return { z: Number(m[1]), x: Number(m[2]), y: Number(m[3]) };
}

function tileLng(x: number, z: number): number {
  return (x / 2 ** z) * 360 - 180;
}
function tileLat(y: number, z: number): number {
  const n = Math.PI - (2 * Math.PI * y) / 2 ** z;
  return (180 / Math.PI) * Math.atan(Math.sinh(n));
}

export function tileBbox(key: string): Bbox | null {
  const t = parseTileKey(key);
  if (!t) return null;
  return {
    south: tileLat(t.y + 1, t.z),
    north: tileLat(t.y, t.z),
    west: tileLng(t.x, t.z),
    east: tileLng(t.x + 1, t.z),
  };
}

/** Densify a path so no gap exceeds `SAMPLE_STEP_M` (a long straight leg would skip tiles). */
function densify(path: Coordinates[]): Coordinates[] {
  const out: Coordinates[] = [];
  for (let i = 0; i < path.length; i += 1) {
    out.push(path[i]);
    if (i === path.length - 1) break;
    const d = haversineDistance(path[i], path[i + 1]);
    const steps = Math.floor(d / SAMPLE_STEP_M);
    for (let s = 1; s <= steps; s += 1) {
      const t = s / (steps + 1);
      out.push({
        lat: path[i].lat + t * (path[i + 1].lat - path[i].lat),
        lng: path[i].lng + t * (path[i + 1].lng - path[i].lng),
      });
    }
  }
  return out;
}

/** Tiles covering every point of `path` buffered by `bufferM`. Sorted, de-duplicated. */
export function tilesForPath(
  path: Coordinates[],
  bufferM: number,
): { tiles: string[]; capped: boolean } {
  const keys = new Set<string>();
  // Samples are up to SAMPLE_STEP_M apart, so widen each box by half a step.
  const reachM = bufferM + SAMPLE_STEP_M / 2;
  const dLat = reachM / 111_320;
  for (const p of densify(path)) {
    const dLng = reachM / (111_320 * Math.max(0.01, Math.cos((p.lat * Math.PI) / 180)));
    const a = tileOf({ lat: p.lat - dLat, lng: p.lng - dLng });
    const b = tileOf({ lat: p.lat + dLat, lng: p.lng + dLng });
    for (let x = Math.min(a.x, b.x); x <= Math.max(a.x, b.x); x += 1) {
      for (let y = Math.min(a.y, b.y); y <= Math.max(a.y, b.y); y += 1) {
        keys.add(tileKey({ x, y }));
        if (keys.size > MAX_TILES) return { tiles: [], capped: true };
      }
    }
  }
  return { tiles: [...keys].sort(), capped: false };
}

/** Whether a cached tile is still usable. A missing `fetchedAtMs` is never fresh. */
export function isFresh(
  source: TileSource,
  fetchedAtMs: number | undefined,
  nowMs: number,
): boolean {
  if (fetchedAtMs === undefined) return false;
  const ttl = TILE_TTL_MS[source];
  return ttl === null || nowMs - fetchedAtMs < ttl;
}

/** Split `tiles` into those the cache can serve and those to fetch. */
export function decompose(
  tiles: string[],
  source: TileSource,
  cachedAtMs: ReadonlyMap<string, number>,
  nowMs: number,
): { fresh: string[]; missing: string[] } {
  const fresh: string[] = [];
  const missing: string[] = [];
  for (const t of tiles) {
    (isFresh(source, cachedAtMs.get(t), nowMs) ? fresh : missing).push(t);
  }
  return { fresh, missing };
}

/**
 * One bbox per run of horizontally adjacent tiles, so a union query stays
 * small. Input tile keys must all be at the same zoom.
 */
export function tilesToBboxes(tiles: string[]): Bbox[] {
  const parsed = tiles
    .map((k) => parseTileKey(k))
    .filter((t): t is { z: number; x: number; y: number } => t !== null)
    .sort((a, b) => a.y - b.y || a.x - b.x);
  const boxes: Bbox[] = [];
  let run: { z: number; y: number; x0: number; x1: number } | null = null;
  const flush = () => {
    if (!run) return;
    const lo = tileBbox(tileKey({ x: run.x0, y: run.y }, run.z))!;
    const hi = tileBbox(tileKey({ x: run.x1, y: run.y }, run.z))!;
    boxes.push({ south: lo.south, north: lo.north, west: lo.west, east: hi.east });
    run = null;
  };
  for (const t of parsed) {
    if (run && run.y === t.y && run.z === t.z && t.x === run.x1 + 1) {
      run.x1 = t.x;
    } else if (run && run.y === t.y && run.x1 === t.x) {
      continue;
    } else {
      flush();
      run = { z: t.z, y: t.y, x0: t.x, x1: t.x };
    }
  }
  flush();
  return boxes;
}
