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
import { isPlausibleConnector } from "@/lib/walk/rejoin";

const MAX_CANDIDATES = 2;
// A way back is a local street connector, never a long route: keeps one request
// from spending ORS quota on something the client should have re-planned instead.
const MAX_CROW_METERS = 2_000;

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

/**
 * A street-snapped way from the walker back onto their planned route.
 *
 * ORS directions only (no matrix — its 500/day budget is for planning), at most
 * two calls per request, one per candidate rejoin point. Returns the first
 * connector that is not an absurd detour compared with the crow-flies gap.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const verdict = orsRateLimiter.check(callerKey(request));
  if (!verdict.allowed) {
    return rateLimitedResponse(verdict);
  }

  let payload: { from?: unknown; candidates?: unknown };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { from, candidates } = payload;
  if (
    !isCoordinate(from) ||
    !Array.isArray(candidates) ||
    candidates.length < 1 ||
    candidates.length > MAX_CANDIDATES ||
    !candidates.every(isCoordinate)
  ) {
    return NextResponse.json(
      {
        error:
          "from must be {lat,lng} and candidates 1-2 of {lat,lng}, all finite.",
      },
      { status: 400 },
    );
  }

  let lastError: string | null = null;
  let anyRouted = false;

  for (let i = 0; i < candidates.length; i += 1) {
    const candidate = candidates[i] as Coordinates;
    const crowM = haversineDistance(from, candidate);
    if (crowM > MAX_CROW_METERS) continue;

    try {
      const result = await getDirections({
        coordinates: [toOrsCoord(from), toOrsCoord(candidate)],
        profile: "foot-walking",
        instructions: false,
      });
      const route = result.routes?.[0];
      if (!route) continue;
      anyRouted = true;

      const distanceMeters = route.summary.distance;
      if (!isPlausibleConnector(distanceMeters, crowM)) continue;

      const geometry = decodePolyline(route.geometry);
      if (geometry.length < 2) continue;

      return NextResponse.json({ geometry, distanceMeters, candidateIndex: i });
    } catch (error) {
      lastError =
        error instanceof Error ? error.message : "Failed to fetch directions.";
    }
  }

  if (!anyRouted && lastError !== null) {
    return NextResponse.json({ error: lastError }, { status: 502 });
  }
  return NextResponse.json(
    { error: "No plausible way back to the route was found." },
    { status: 422 },
  );
}
