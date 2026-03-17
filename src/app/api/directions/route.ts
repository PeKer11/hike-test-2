import { NextResponse } from "next/server";

import { getDirections } from "@/lib/api/ors-client";
import type { OrsDirectionsRequest } from "@/lib/types";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const payload = (await request.json()) as OrsDirectionsRequest;

    if (!Array.isArray(payload.coordinates) || payload.coordinates.length < 2) {
      return NextResponse.json(
        { error: "At least two coordinates are required." },
        { status: 400 },
      );
    }

    const result = await getDirections(payload);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch directions.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
