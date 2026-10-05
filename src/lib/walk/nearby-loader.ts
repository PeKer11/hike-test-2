import { distanceToPath, simplifyPath } from "@/lib/places/path";
import type { Coordinates, NearbyPlace } from "@/lib/types";
import {
  NEARBY_CORRIDOR_RADIUS_M,
  NEARBY_PATH_MAX_POINTS,
  NEARBY_POINT_CACHE_MS,
  NEARBY_POINT_CELL_DEG,
  NEARBY_POINT_MIN_GAP_MS,
  NEARBY_POINT_RADIUS_M,
  NEARBY_POINT_TRIGGER_M,
} from "@/lib/walk/walk-cadence";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

function pathKey(path: Coordinates[]): string {
  const first = path[0];
  const last = path[path.length - 1];
  const r = (n: number) => n.toFixed(4);
  return `${path.length}|${r(first.lat)},${r(first.lng)}|${r(last.lat)},${r(last.lng)}`;
}

/**
 * The client's store of "what is near the route", and the only thing that
 * decides when to ask the server for more. Network calls happen at most:
 * once per route geometry (the corridor), and — for a walker more than 200 m
 * outside everything already loaded — once per ~200 m cell per 10 minutes and
 * no more than once per 2 minutes. Never once per GPS fix.
 *
 * Time arguments are fix timestamps, not the wall clock.
 */
export class NearbyLoader {
  private readonly store = new Map<string, NearbyPlace>();
  private corridor: Coordinates[] = [];
  private loadedCorridorKey: string | null = null;
  private readonly cellFetchedAt = new Map<string, number>();
  private lastPointFetchAt = Number.NEGATIVE_INFINITY;
  private pointFetchInFlight = false;

  constructor(private readonly doFetch: FetchLike = (input, init) => fetch(input, init)) {}

  /** Every place loaded so far, across re-plans. */
  all(): NearbyPlace[] {
    return [...this.store.values()];
  }

  /** Load the corridor around `geometry`, once per distinct geometry. */
  async loadCorridor(geometry: Coordinates[]): Promise<void> {
    if (geometry.length < 2) return;
    const key = pathKey(geometry);
    if (key === this.loadedCorridorKey) return;
    // Marked before the request: a failure is retried on the next new geometry,
    // not on every fix.
    this.loadedCorridorKey = key;
    const path = simplifyPath(geometry, NEARBY_PATH_MAX_POINTS);
    this.corridor = path;
    await this.post({ path, radiusMeters: NEARBY_CORRIDOR_RADIUS_M });
  }

  /** Fetch around `position` if it is well outside the loaded corridor. */
  async maybeLoadAround(position: Coordinates, now: number): Promise<void> {
    if (this.pointFetchInFlight) return;
    if (distanceToPath(position, this.corridor) <= NEARBY_POINT_TRIGGER_M) return;
    if (now - this.lastPointFetchAt < NEARBY_POINT_MIN_GAP_MS) return;

    const cell = `${Math.round(position.lat / NEARBY_POINT_CELL_DEG)},${Math.round(
      position.lng / NEARBY_POINT_CELL_DEG,
    )}`;
    const fetchedAt = this.cellFetchedAt.get(cell);
    if (fetchedAt !== undefined && now - fetchedAt < NEARBY_POINT_CACHE_MS) return;

    this.cellFetchedAt.set(cell, now);
    this.lastPointFetchAt = now;
    this.pointFetchInFlight = true;
    try {
      await this.post({ point: position, radiusMeters: NEARBY_POINT_RADIUS_M });
    } finally {
      this.pointFetchInFlight = false;
    }
  }

  reset(): void {
    this.store.clear();
    this.corridor = [];
    this.loadedCorridorKey = null;
    this.cellFetchedAt.clear();
    this.lastPointFetchAt = Number.NEGATIVE_INFINITY;
  }

  private async post(body: unknown): Promise<void> {
    try {
      const res = await this.doFetch("/api/nearby", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { places?: NearbyPlace[] };
      for (const place of data.places ?? []) this.store.set(place.id, place);
    } catch {
      // Nearby places are an extra; a failed lookup must never touch the walk.
    }
  }
}
