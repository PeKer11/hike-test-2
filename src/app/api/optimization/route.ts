import { NextResponse } from "next/server";

import { optimizeRoute } from "@/lib/api/ors-client";
import type { OrsOptimizationRequest } from "@/lib/types";

function isValidCoordinateTuple(value: unknown): value is [number, number] {
  if (!Array.isArray(value) || value.length !== 2) {
    return false;
  }

  const [lng, lat] = value;
  return (
    typeof lng === "number" &&
    Number.isFinite(lng) &&
    lng >= -180 &&
    lng <= 180 &&
    typeof lat === "number" &&
    Number.isFinite(lat) &&
    lat >= -90 &&
    lat <= 90
  );
}

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
      (vehicle) =>
        isValidCoordinateTuple(vehicle.start) &&
        isValidCoordinateTuple(vehicle.end),
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
