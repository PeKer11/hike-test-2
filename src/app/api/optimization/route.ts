import { NextResponse } from "next/server";

import { optimizeRoute } from "@/lib/api/ors-client";
import type { OrsOptimizationRequest } from "@/lib/types";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const payload = (await request.json()) as OrsOptimizationRequest;

    if (!Array.isArray(payload.jobs) || !Array.isArray(payload.vehicles)) {
      return NextResponse.json(
        {
          error:
            "Optimization requires at least one vehicle and either one job or a fixed start/end pair.",
        },
        { status: 400 },
      );
    }

    const hasVehicleWithFixedEndpoints = payload.vehicles.some(
      (vehicle) => vehicle.start && vehicle.end,
    );

    if (
      (payload.jobs.length === 0 && !hasVehicleWithFixedEndpoints) ||
      payload.vehicles.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "Optimization requires at least one vehicle and either one job or a fixed start/end pair.",
        },
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
