import { NextResponse } from "next/server";

import {
  callerKey,
  overpassRateLimiter,
  rateLimitedResponse,
} from "@/lib/api/rate-limit";
import { runDiscoveryScan, type DiscoveryScan } from "@/lib/places/discovery-scan";
import { getNearbyProvider } from "@/lib/places/nearby-provider";
import { distanceToPath, simplifyPath } from "@/lib/places/path";
import type { Coordinates } from "@/lib/types";
import { RING_RADIUS_M } from "@/lib/walk/discovery-cadence";
import {
  NEARBY_CORRIDOR_RADIUS_M,
  NEARBY_PATH_MAX_POINTS,
  NEARBY_POINT_RADIUS_M,
} from "@/lib/walk/walk-cadence";

const MAX_PATH_INPUT_POINTS = 5_000;
const MIN_RADIUS_M = 50;
const CACHE_TTL_MS = 5 * 60_000;
const CACHE_MAX_ENTRIES = 50;

// In-process, like the rate limiter: it spares Overpass the repeat of a request
// a walker's re-plan or a page reload just made, nothing more.
// Plain requests cache `{ places }`; scans cache the whole grouped response.
const cache = new Map<string, { at: number; body: Record<string, unknown> }>();

function isCoordinate(value: unknown): value is Coordinates {
  if (typeof value !== "object" || value === null) return false;
  const { lat, lng } = value as Record<string, unknown>;
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

function clampRadius(value: unknown, max: number): number {
  const n = typeof value === "number" && Number.isFinite(value) ? value : max;
  return Math.min(max, Math.max(MIN_RADIUS_M, Math.round(n)));
}

function cacheKey(
  kind: string,
  radius: number,
  ring: number | null,
  signals: boolean,
  points: Coordinates[],
): string {
  return `${kind}|${radius}|${ring ?? "-"}|${signals ? "s" : "-"}|${points
    .map((p) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`)
    .join(";")}`;
}

/**
 * Places near the walker: along a path (the route corridor, once per route) or
 * around a point (a walker far off the route). Rate limited, never called per
 * GPS fix — the client fetches a corridor once and classifies left/right/ahead
 * locally.
 *
 * Plain request: Overpass only, `{ places }`. With `ringRadiusMeters` (<=600) it
 * is the discovery scan: one Overpass union (corridor + notable ring) and, with
 * `signals`, Wikipedia + Commons merged in server-side, answered grouped by
 * source as `{ places, ring, wikipedia, commons, calls }`. Wikipedia/Commons are
 * never called from the browser.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const verdict = overpassRateLimiter.check(callerKey(request));
  if (!verdict.allowed) {
    return rateLimitedResponse(verdict);
  }

  let payload: {
    path?: unknown;
    point?: unknown;
    radiusMeters?: unknown;
    ringRadiusMeters?: unknown;
    signals?: unknown;
  };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  let kind: "path" | "point";
  let radius: number;
  let points: Coordinates[];
  if (payload.path !== undefined) {
    if (
      !Array.isArray(payload.path) ||
      payload.path.length < 2 ||
      payload.path.length > MAX_PATH_INPUT_POINTS ||
      !payload.path.every(isCoordinate)
    ) {
      return NextResponse.json(
        { error: "path must be 2-5000 finite {lat,lng} points." },
        { status: 400 },
      );
    }
    kind = "path";
    radius = clampRadius(payload.radiusMeters, NEARBY_CORRIDOR_RADIUS_M);
    points = simplifyPath(payload.path as Coordinates[], NEARBY_PATH_MAX_POINTS);
  } else if (isCoordinate(payload.point)) {
    kind = "point";
    radius = clampRadius(payload.radiusMeters, NEARBY_POINT_RADIUS_M);
    points = [payload.point];
  } else {
    return NextResponse.json(
      { error: "Provide a path or a point of finite {lat,lng}." },
      { status: 400 },
    );
  }

  if (
    payload.ringRadiusMeters !== undefined &&
    (typeof payload.ringRadiusMeters !== "number" ||
      !Number.isFinite(payload.ringRadiusMeters))
  ) {
    return NextResponse.json({ error: "ringRadiusMeters must be a number." }, { status: 400 });
  }
  if (payload.signals !== undefined && typeof payload.signals !== "boolean") {
    return NextResponse.json({ error: "signals must be a boolean." }, { status: 400 });
  }
  const ring =
    payload.ringRadiusMeters === undefined
      ? null
      : Math.min(RING_RADIUS_M, Math.max(radius, Math.round(payload.ringRadiusMeters as number)));
  const signals = payload.signals === true && ring !== null;

  const key = cacheKey(kind, radius, ring, signals, points);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return NextResponse.json(hit.body);
  }

  try {
    const provider = getNearbyProvider();
    let body: Record<string, unknown>;
    if (ring !== null) {
      const scan: DiscoveryScan = await runDiscoveryScan(
        provider,
        points,
        radius,
        ring,
        signals,
      );
      body = { ...scan };
    } else {
      const found =
        kind === "path"
          ? await provider.fetchAlongPath(points, radius)
          : await provider.fetchAround(points[0], radius);
      // `around` matches an element with any node in range, but a big polygon's
      // centre can be far outside it — keep only places actually near the walk.
      body = {
        places: found.filter((p) => distanceToPath(p.coordinates, points) <= radius + 50),
      };
    }

    if (cache.size >= CACHE_MAX_ENTRIES) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    cache.set(key, { at: Date.now(), body });
    return NextResponse.json(body);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch nearby places." },
      { status: 502 },
    );
  }
}
