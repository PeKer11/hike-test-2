import { NextRequest, NextResponse } from "next/server";

import { searchPlaces } from "@/lib/api/nominatim-client";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    const limit = Number(request.nextUrl.searchParams.get("limit") ?? "5");

    if (!query) {
      return NextResponse.json([]);
    }

    const results = await searchPlaces(query, Number.isNaN(limit) ? 5 : limit);
    return NextResponse.json(results);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to search places.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
