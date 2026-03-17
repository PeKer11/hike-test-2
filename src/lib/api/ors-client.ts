import "server-only";

import type {
  OrsDirectionsRequest,
  OrsDirectionsResponse,
  OrsOptimizationRequest,
  OrsOptimizationResponse,
} from "@/lib/types";

const ORS_BASE_URL = "https://api.openrouteservice.org";

function getApiKey(): string {
  const key = process.env.ORS_API_KEY;
  if (!key) {
    throw new Error("ORS_API_KEY is not configured.");
  }

  return key;
}

async function fetchOrs<T>(
  url: string,
  body: unknown,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: getApiKey(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    ...init,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ORS request failed (${response.status}): ${errorText}`);
  }

  return (await response.json()) as T;
}

export async function getDirections(
  request: OrsDirectionsRequest,
): Promise<OrsDirectionsResponse> {
  const profile = request.profile ?? "foot-walking";

  return fetchOrs<OrsDirectionsResponse>(
    `${ORS_BASE_URL}/v2/directions/${profile}/json`,
    {
      coordinates: request.coordinates,
      instructions: request.instructions ?? true,
    },
    { cache: "no-store" },
  );
}

export async function optimizeRoute(
  request: OrsOptimizationRequest,
): Promise<OrsOptimizationResponse> {
  return fetchOrs<OrsOptimizationResponse>(
    `${ORS_BASE_URL}/optimization`,
    request,
    { cache: "no-store" },
  );
}
