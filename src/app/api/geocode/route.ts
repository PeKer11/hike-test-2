import { NextRequest, NextResponse } from "next/server";

import { searchPlaces } from "@/lib/api/nominatim-client";
import {
  callerKey,
  nominatimRateLimiter,
  rateLimitedResponse,
} from "@/lib/api/rate-limit";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const verdict = nominatimRateLimiter.check(callerKey(request));
  if (!verdict.allowed) {
    return rateLimitedResponse(verdict);
  }

  try {
    const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    const limit = Number(request.nextUrl.searchParams.get("limit") ?? "5");

    if (!query) {
      return NextResponse.json([]);
    }

    // Nominatim is a rate-limited shared service — never forward an arbitrary limit.
    const safeLimit = Number.isFinite(limit)
      ? Math.min(Math.max(Math.floor(limit), 1), 10)
      : 5;
    const results = await searchPlaces(query, safeLimit);
    return NextResponse.json(results);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to search places.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
