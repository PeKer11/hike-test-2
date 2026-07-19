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
      typeof lat !== "number" ||
      typeof lng !== "number" ||
      typeof availableMinutes !== "number" ||
      availableMinutes <= 0
    ) {
      return NextResponse.json(
        { error: "lat, lng, and availableMinutes (> 0) are required." },
        { status: 400 },
      );
    }

    const origin = { lat, lng };
    const walkingPaceMinPerKm = body.walkingPaceMinPerKm ?? 15;
    const radiusMeters = body.radiusMeters ?? 2000;

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
