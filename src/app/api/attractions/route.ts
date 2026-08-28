import { NextResponse } from "next/server";

import {
  callerKey,
  overpassRateLimiter,
  rateLimitedResponse,
} from "@/lib/api/rate-limit";
import { fetchAttractions } from "@/lib/attractions/overpass-client";
import {
  rankAttractions,
  selectFeasibleAttractions,
} from "@/lib/attractions/attraction-ranker";
import type { AttractionCategory } from "@/lib/types";

interface AttractionRequest {
  lat: number;
  lng: number;
  radiusMeters?: number;
  availableMinutes: number;
  walkingPaceMinPerKm?: number;
  preferredCategories?: AttractionCategory[];
}

export async function POST(request: Request): Promise<NextResponse> {
  const verdict = overpassRateLimiter.check(callerKey(request));
  if (!verdict.allowed) {
    return rateLimitedResponse(verdict);
  }

  try {
    const body = (await request.json()) as AttractionRequest;

    const { lat, lng, availableMinutes } = body;

    if (
      !Number.isFinite(lat) ||
      lat < -90 ||
      lat > 90 ||
      !Number.isFinite(lng) ||
      lng < -180 ||
      lng > 180 ||
      !Number.isFinite(availableMinutes) ||
      availableMinutes <= 0
    ) {
      return NextResponse.json(
        { error: "lat, lng, and availableMinutes (> 0) are required." },
        { status: 400 },
      );
    }

    // Clamp the Overpass search radius — an unbounded value from the client
    // turns into an enormous query against a shared public API.
    const requestedRadius = body.radiusMeters ?? 2000;
    const radiusMeters = Number.isFinite(requestedRadius)
      ? Math.min(Math.max(requestedRadius, 100), 10_000)
      : 2000;
    const requestedPace = body.walkingPaceMinPerKm ?? 15;
    const walkingPaceMinPerKm =
      Number.isFinite(requestedPace) && requestedPace > 0 ? requestedPace : 15;
    const origin = { lat, lng };

    const raw = await fetchAttractions(origin, radiusMeters);

    const ranked = rankAttractions(raw, {
      origin,
      preferredCategories: body.preferredCategories,
      availableMinutes,
      walkingPaceMinPerKm,
    });

    const { selected, dropped } = selectFeasibleAttractions(
      ranked,
      availableMinutes,
      walkingPaceMinPerKm,
    );

    return NextResponse.json({ selected, dropped, total: raw.length });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch attractions.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
