import { NextResponse } from "next/server";

import { fetchAttractions } from "@/lib/attractions/overpass-client";
import {
  rankAttractions,
  selectFeasibleAttractions,
} from "@/lib/attractions/attraction-ranker";
import { getDirections } from "@/lib/api/ors-client";
import { buildWalkPlan } from "@/lib/optimization/tsp-planner";
import { toOrsCoord } from "@/lib/utils/geo";
import { decodePolyline } from "@/lib/utils/polyline";
import type { AttractionCategory, Coordinates, WalkPlanRequest } from "@/lib/types";

interface WalkPlanApiRequest {
  lat: number;
  lng: number;
  availableMinutes: number;
  walkingPaceMinPerKm?: number;
  radiusMeters?: number;
  preferredCategories?: AttractionCategory[];
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = (await request.json()) as WalkPlanApiRequest;

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

    // 1. Fetch raw attractions from Overpass
    const raw = await fetchAttractions(origin, radiusMeters);

    // 2. Rank and pre-filter by time budget
    const ranked = rankAttractions(raw, {
      origin,
      preferredCategories: body.preferredCategories,
      availableMinutes,
      walkingPaceMinPerKm,
    });

    const { selected } = selectFeasibleAttractions(
      ranked,
      availableMinutes,
      walkingPaceMinPerKm,
    );

    // 3. Build walk plan with TSP ordering
    const planRequest: WalkPlanRequest = {
      origin,
      availableMinutes,
      walkingPaceMinPerKm,
      radiusMeters,
      preferredCategories: body.preferredCategories,
    };

    const plan = buildWalkPlan(planRequest, selected);

    // 4. Fetch ORS geometry for the ordered route (origin → attraction 1 → 2 → ...)
    let geometry: Coordinates[] | undefined;
    const warnings: string[] = [];

    if (plan.orderedAttractions.length > 0) {
      if (!process.env.ORS_API_KEY) {
        warnings.push(
          "No ORS_API_KEY configured — route geometry is unavailable. Start Walk is disabled until geometry is present.",
        );
      } else {
        try {
          const waypoints: Coordinates[] = [
            origin,
            ...plan.orderedAttractions.map((a) => a.coordinates),
          ];
          const orsRes = await getDirections({
            coordinates: waypoints.map(toOrsCoord),
            profile: "foot-walking",
            instructions: false,
          });
          const encoded = orsRes.routes[0]?.geometry;
          if (encoded) {
            geometry = decodePolyline(encoded);
          }
        } catch {
          // Geometry is optional — don't fail the whole plan if ORS is unavailable
          warnings.push(
            "Could not fetch route geometry from ORS. Start Walk is disabled.",
          );
        }
      }
    }

    return NextResponse.json({ ...plan, geometry, warnings });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to build walk plan.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
