import { NextResponse } from "next/server";

import { buildTrailIntelligenceReport } from "@/lib/trail-intelligence/build-briefing";
import type { CalculatedRoute, Coordinates } from "@/lib/types";

interface TrailIntelligenceRequest {
  route?: CalculatedRoute;
  userLocation?: Coordinates;
}

function isValidCoordinate(value: unknown): value is Coordinates {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Coordinates;
  return (
    Number.isFinite(candidate.lat) &&
    candidate.lat >= -90 &&
    candidate.lat <= 90 &&
    Number.isFinite(candidate.lng) &&
    candidate.lng >= -180 &&
    candidate.lng <= 180
  );
}

function isValidRoute(route: CalculatedRoute | undefined): route is CalculatedRoute {
  if (!route) {
    return false;
  }

  return (
    Array.isArray(route.orderedWaypoints) &&
    Array.isArray(route.segments) &&
    Array.isArray(route.geometry) &&
    Number.isFinite(route.totalDistanceMeters) &&
    Number.isFinite(route.totalDurationSeconds) &&
    Array.isArray(route.warnings)
  );
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const payload = (await request.json()) as TrailIntelligenceRequest;

    if (!isValidRoute(payload.route)) {
      return NextResponse.json(
        { error: "A valid calculated route is required." },
        { status: 400 },
      );
    }

    if (payload.userLocation && !isValidCoordinate(payload.userLocation)) {
      return NextResponse.json(
        { error: "User location must be a valid coordinate pair." },
        { status: 400 },
      );
    }

    const report = buildTrailIntelligenceReport({
      route: payload.route,
      userLocation: payload.userLocation,
    });

    return NextResponse.json(report);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate trail briefing.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
