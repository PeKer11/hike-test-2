import { NextResponse } from "next/server";

import { getDirections } from "@/lib/api/ors-client";
import {
  callerKey,
  orsRateLimiter,
  rateLimitedResponse,
} from "@/lib/api/rate-limit";
import type { Coordinates } from "@/lib/types";
import { haversineDistance, toOrsCoord } from "@/lib/utils/geo";
import { decodePolyline } from "@/lib/utils/polyline";
import {
  OPTIONS_ALT_SHARE_FACTOR,
  OPTIONS_ALT_TARGET_COUNT,
  OPTIONS_ALT_WEIGHT_FACTOR,
  OPTIONS_MAX,
  OPTIONS_MAX_CROW_M,
  OPTIONS_MAX_DIRECTIONS_CALLS,
  OPTIONS_MAX_STOPS,
  OPTIONS_PLAN_MAX_POINTS,
  OPTIONS_ROUNDTRIP_MAX_M,
  OPTIONS_ROUNDTRIP_MIN_M,
  OPTIONS_ROUNDTRIP_POINTS,
  OPTIONS_SEED_MAX,
  OPTIONS_WALKED_MAX_POINTS,
  OVERLAP_MAX_PAIR,
  OVERLAP_MAX_PLAN,
  OVERLAP_MAX_WALKED,
} from "@/lib/walk/discovery-cadence";
import { buildAvoidPolygons } from "@/lib/walk/avoid-polygons";
import { overlap } from "@/lib/walk/route-overlap";

const THEMES = ["nature", "food", "short", "back"] as const;
const MODES = ["via", "roundtrip", "alternatives"] as const;
type Theme = (typeof THEMES)[number];
type Mode = (typeof MODES)[number];

interface OptionRequest {
  theme: Theme;
  stops: Coordinates[];
  mode: Mode;
  seed?: number;
  roundTripLengthM?: number;
  /** Ranking for near-duplicate removal; higher wins. */
  score?: number;
}

interface Candidate {
  req: OptionRequest;
  geometry: Coordinates[];
  distanceM: number;
  minutes: number;
  overlapWalked: number;
  overlapPlan: number;
}

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

function isCoordinateList(value: unknown, max: number, min = 0): value is Coordinates[] {
  return (
    Array.isArray(value) &&
    value.length >= min &&
    value.length <= max &&
    value.every(isCoordinate)
  );
}

function isOption(value: unknown): value is OptionRequest {
  if (typeof value !== "object" || value === null) return false;
  const o = value as Record<string, unknown>;
  const finiteOpt = (v: unknown) => v === undefined || (typeof v === "number" && Number.isFinite(v));
  return (
    THEMES.includes(o.theme as Theme) &&
    MODES.includes(o.mode as Mode) &&
    isCoordinateList(o.stops, OPTIONS_MAX_STOPS) &&
    (o.seed === undefined ||
      (Number.isInteger(o.seed) &&
        (o.seed as number) >= 0 &&
        (o.seed as number) <= OPTIONS_SEED_MAX)) &&
    (o.roundTripLengthM === undefined ||
      (typeof o.roundTripLengthM === "number" &&
        o.roundTripLengthM >= OPTIONS_ROUNDTRIP_MIN_M &&
        o.roundTripLengthM <= OPTIONS_ROUNDTRIP_MAX_M)) &&
    finiteOpt(o.score)
  );
}

/**
 * Up to three ways forward from a walker who left their plan, each a single ORS
 * directions call (no matrix). Options that retrace the walked track (> 25%),
 * mostly retrace the abandoned plan (> 60%, except "back"), or duplicate
 * another option (> 50%) are dropped. At most one retry across the request, for
 * the worst "via" option, with the walked track as avoid_polygons. At most
 * four directions calls in all.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const verdict = orsRateLimiter.check(callerKey(request));
  if (!verdict.allowed) {
    return rateLimitedResponse(verdict);
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { origin, endAnchor, walked, abandonedPlan, options } = payload;
  if (
    !isCoordinate(origin) ||
    (endAnchor !== undefined && !isCoordinate(endAnchor)) ||
    !isCoordinateList(walked, OPTIONS_WALKED_MAX_POINTS) ||
    (abandonedPlan !== undefined &&
      !isCoordinateList(abandonedPlan, OPTIONS_PLAN_MAX_POINTS)) ||
    !Array.isArray(options) ||
    options.length < 1 ||
    options.length > OPTIONS_MAX ||
    !options.every(isOption)
  ) {
    return NextResponse.json(
      {
        error:
          "origin {lat,lng}, walked <=60 points and 1-3 options (theme, mode, <=4 stops) are required, all finite.",
      },
      { status: 400 },
    );
  }
  const reqs = options as OptionRequest[];
  const end = endAnchor as Coordinates | undefined;

  const tooFar = reqs.some((o) =>
    o.stops.some((s) => haversineDistance(origin, s) > OPTIONS_MAX_CROW_M),
  );
  const needsAnchor = reqs.some((o) => o.mode === "alternatives") && !end;
  const needsLength = reqs.some((o) => o.mode === "roundtrip" && o.roundTripLengthM === undefined);
  if (tooFar || needsAnchor || needsLength) {
    return NextResponse.json(
      { error: "An option is too far, or is missing its anchor or length." },
      { status: 400 },
    );
  }

  let calls = 0;
  let lastError: string | null = null;

  async function route(
    req: OptionRequest,
    extra: Record<string, unknown> = {},
  ): Promise<Candidate | null> {
    if (calls >= OPTIONS_MAX_DIRECTIONS_CALLS) return null;
    calls += 1;

    let coordinates: Coordinates[];
    let ors: Record<string, unknown> | undefined;
    if (req.mode === "roundtrip") {
      coordinates = [origin as Coordinates];
      ors = {
        round_trip: {
          length: req.roundTripLengthM,
          points: OPTIONS_ROUNDTRIP_POINTS,
          seed: req.seed ?? 0,
        },
        // Prefers greener paths. If ORS rejects this on our key, drop it.
        profile_params: { weightings: { green: 1 } },
      };
    } else if (req.mode === "alternatives") {
      coordinates = [origin as Coordinates, end as Coordinates];
      ors = {
        alternative_routes: {
          target_count: OPTIONS_ALT_TARGET_COUNT,
          share_factor: OPTIONS_ALT_SHARE_FACTOR,
          weight_factor: OPTIONS_ALT_WEIGHT_FACTOR,
        },
      };
    } else {
      coordinates = [origin as Coordinates, ...req.stops, ...(end ? [end] : [])];
    }
    const merged = { ...(ors ?? {}), ...extra };

    try {
      const result = await getDirections({
        coordinates: coordinates.map(toOrsCoord),
        profile: "foot-walking",
        instructions: false,
        ...(Object.keys(merged).length > 0 ? { options: merged } : {}),
      });
      const candidates = (result.routes ?? []).flatMap((r) => {
        const geometry = decodePolyline(r.geometry);
        if (geometry.length < 2) return [];
        return [
          {
            req,
            geometry,
            distanceM: r.summary.distance,
            minutes: r.summary.duration / 60,
            overlapWalked: overlap(geometry, walked as Coordinates[]),
            overlapPlan: abandonedPlan
              ? overlap(geometry, abandonedPlan as Coordinates[])
              : 0,
          },
        ];
      });
      // Alternatives return several routes: keep the one that retraces least.
      candidates.sort((a, b) => a.overlapWalked - b.overlapWalked);
      return candidates[0] ?? null;
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Directions failed.";
      return null;
    }
  }

  const settled = await Promise.all(reqs.map((req) => route(req)));
  let candidates = settled.filter((c): c is Candidate => c !== null);

  if (candidates.length === 0 && lastError !== null) {
    return NextResponse.json({ error: lastError }, { status: 502 });
  }

  // One retry for the worst "via" option that retraces the walked track.
  const worst = candidates
    .filter((c) => c.overlapWalked > OVERLAP_MAX_WALKED && c.req.mode === "via")
    .sort((a, b) => b.overlapWalked - a.overlapWalked)[0];
  if (worst) {
    const avoid = buildAvoidPolygons(walked as Coordinates[], [
      origin,
      ...worst.req.stops,
      ...(end ? [end] : []),
    ]);
    if (avoid) {
      const retried = await route(worst.req, { avoid_polygons: avoid });
      if (retried && retried.overlapWalked < worst.overlapWalked) {
        candidates = candidates.map((c) => (c === worst ? retried : c));
      }
    }
  }

  candidates = candidates.filter(
    (c) =>
      c.overlapWalked <= OVERLAP_MAX_WALKED &&
      (c.req.theme === "back" || c.overlapPlan <= OVERLAP_MAX_PLAN),
  );

  // Near-duplicates: keep the higher-scored (earlier wins a tie).
  const kept: Candidate[] = [];
  for (const c of [...candidates].sort((a, b) => (b.req.score ?? 0) - (a.req.score ?? 0))) {
    const duplicate = kept.some(
      (k) =>
        Math.max(overlap(c.geometry, k.geometry), overlap(k.geometry, c.geometry)) >
        OVERLAP_MAX_PAIR,
    );
    if (!duplicate) kept.push(c);
  }
  const survivors = candidates.filter((c) => kept.includes(c));

  if (survivors.length === 0) {
    return NextResponse.json(
      { error: "No direction avoids retracing your steps." },
      { status: 422 },
    );
  }

  return NextResponse.json({
    options: survivors.map((c) => ({
      theme: c.req.theme,
      geometry: c.geometry,
      distanceM: c.distanceM,
      minutes: c.minutes,
      stops: c.req.stops,
      overlapWalked: c.overlapWalked,
    })),
  });
}
