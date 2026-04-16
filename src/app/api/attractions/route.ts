import { NextResponse } from "next/server";

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
  try {
    const body = (await request.json()) as AttractionRequest;

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

    const radiusMeters = body.radiusMeters ?? 2000;
    const walkingPaceMinPerKm = body.walkingPaceMinPerKm ?? 15;
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
