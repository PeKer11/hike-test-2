import { NextResponse } from "next/server";

import { fetchAttractions } from "@/lib/attractions/overpass-client";
import { rankAttractions, selectFeasibleAttractions } from "@/lib/attractions/attraction-ranker";
import { planWalkOrderDebug } from "@/lib/optimization/tsp-planner";
import type { AttractionCategory, WalkPlanRequest } from "@/lib/types";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = (await request.json()) as {
      lat: number;
      lng: number;
      availableMinutes: number;
      walkingPaceMinPerKm?: number;
      radiusMeters?: number;
      preferredCategories?: AttractionCategory[];
    };

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

    const origin = { lat, lng };
    const requestedPace = body.walkingPaceMinPerKm ?? 15;
    const walkingPaceMinPerKm =
      Number.isFinite(requestedPace) && requestedPace > 0 ? requestedPace : 15;
    // Clamp the Overpass search radius — an unbounded value from the client
    // turns into an enormous query against a shared public API.
    const requestedRadius = body.radiusMeters ?? 2000;
    const radiusMeters = Number.isFinite(requestedRadius)
      ? Math.min(Math.max(requestedRadius, 100), 10_000)
      : 2000;

    const raw = await fetchAttractions(origin, radiusMeters);
    const ranked = rankAttractions(raw, { origin, preferredCategories: body.preferredCategories, availableMinutes, walkingPaceMinPerKm });
    const { selected } = selectFeasibleAttractions(ranked, availableMinutes, walkingPaceMinPerKm);

    const planRequest: WalkPlanRequest = { origin, availableMinutes, walkingPaceMinPerKm, radiusMeters };
    const result = planWalkOrderDebug(planRequest, selected);

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
