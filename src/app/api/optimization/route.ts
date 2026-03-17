import { NextResponse } from "next/server";

import { optimizeRoute } from "@/lib/api/ors-client";
import type { OrsOptimizationRequest } from "@/lib/types";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const payload = (await request.json()) as OrsOptimizationRequest;

    if (!Array.isArray(payload.jobs) || !Array.isArray(payload.vehicles)) {
      return NextResponse.json(
        { error: "Invalid optimization payload." },
        { status: 400 },
      );
    }

    const result = await optimizeRoute(payload);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to optimize route.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
