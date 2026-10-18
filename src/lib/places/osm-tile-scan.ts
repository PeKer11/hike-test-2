import {
  decompose,
  tileKey,
  tileOf,
  tilesForPath,
  tilesToBboxes,
  type Bbox,
} from "@/lib/places/tile-cache";
import type { Coordinates, NearbyPlace } from "@/lib/types";

/**
 * The OSM half of a discovery scan, served from the shared `poi_tile_cache`
 * where it can be: look up the z15 tiles under the path, fetch only the missing
 * ones as ONE union of boxes, write them back, and let the caller filter to its
 * corridor in memory. Every failure (no store, store error, too many tiles, a
 * failed fetch) falls back to the plain scan, so the cache is never a new way
 * for a scan to fail.
 */

/** Bump when the Overpass statements change; old rows are then ignored. */
export const OSM_TILE_QUERY_VERSION = 1;
/** More boxes than this make an unwieldy union: use the plain scan instead. */
export const MAX_TILE_BBOXES = 12;

export interface TileStore {
  /** Fetch time (ms) and places of every tile found; absent keys are simply missing. */
  read(keys: string[]): Promise<Map<string, { fetchedAtMs: number; places: NearbyPlace[] }>>;
  write(rows: Array<{ key: string; places: NearbyPlace[] }>): Promise<void>;
}

export async function scanWithTileCache(args: {
  points: Coordinates[];
  radiusMeters: number;
  ringRadiusMeters: number;
  nowMs: number;
  store: TileStore | null;
  fetchInBboxes: ((bboxes: Bbox[]) => Promise<NearbyPlace[]>) | undefined;
  /** The plain corridor + ring scan. */
  fallback: () => Promise<NearbyPlace[]>;
}): Promise<NearbyPlace[]> {
  const { store, fetchInBboxes } = args;
  if (!store || !fetchInBboxes) return args.fallback();
  const { tiles, capped } = tilesForPath(args.points, args.ringRadiusMeters);
  if (capped || tiles.length === 0) return args.fallback();

  let cached: Awaited<ReturnType<TileStore["read"]>>;
  try {
    cached = await store.read(tiles);
  } catch {
    return args.fallback();
  }
  const ages = new Map([...cached].map(([k, v]) => [k, v.fetchedAtMs]));
  const { fresh, missing } = decompose(tiles, "osm", ages, args.nowMs);

  const byId = new Map<string, NearbyPlace>();
  for (const key of fresh) {
    for (const p of cached.get(key)?.places ?? []) byId.set(p.id, p);
  }
  if (missing.length === 0) return [...byId.values()];

  const bboxes = tilesToBboxes(missing);
  if (bboxes.length > MAX_TILE_BBOXES) return args.fallback();
  let fetched: NearbyPlace[];
  try {
    fetched = await fetchInBboxes(bboxes);
  } catch {
    return args.fallback();
  }

  // A place belongs to the tile its coordinates fall in; only tiles that were
  // actually requested are written (the others were not queried completely).
  const missingSet = new Set(missing);
  const perTile = new Map<string, NearbyPlace[]>(missing.map((k) => [k, []]));
  for (const place of fetched) {
    byId.set(place.id, place);
    const key = tileKey(tileOf(place.coordinates));
    if (missingSet.has(key)) perTile.get(key)!.push(place);
  }
  try {
    await store.write([...perTile].map(([key, places]) => ({ key, places })));
  } catch {
    // A failed write only means the next scan asks again.
  }
  return [...byId.values()];
}

/** Service-role store over `poi_tile_cache`, or null when the server has no service key. */
export async function createSupabaseTileStore(): Promise<TileStore | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const { createClient } = await import("@supabase/supabase-js");
  const client = createClient(url, key, { auth: { persistSession: false } });
  return {
    async read(keys) {
      const out = new Map<string, { fetchedAtMs: number; places: NearbyPlace[] }>();
      const { data, error } = await client
        .from("poi_tile_cache")
        .select("tile_key, payload, fetched_at")
        .eq("source", "osm")
        .eq("query_version", OSM_TILE_QUERY_VERSION)
        .in("tile_key", keys);
      if (error) throw new Error(error.message);
      for (const row of (data ?? []) as Array<{
        tile_key: string;
        payload: unknown;
        fetched_at: string;
      }>) {
        const at = Date.parse(row.fetched_at);
        if (Array.isArray(row.payload) && Number.isFinite(at)) {
          out.set(row.tile_key, { fetchedAtMs: at, places: row.payload as NearbyPlace[] });
        }
      }
      return out;
    },
    async write(rows) {
      const { error } = await client.from("poi_tile_cache").upsert(
        rows.map((r) => ({
          tile_key: r.key,
          source: "osm",
          query_version: OSM_TILE_QUERY_VERSION,
          payload: r.places,
          fetched_at: new Date().toISOString(),
        })),
        { onConflict: "tile_key,source,query_version" },
      );
      if (error) throw new Error(error.message);
    },
  };
}
