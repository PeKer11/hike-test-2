import "server-only";

import type {
  OrsDirectionsRequest,
  OrsDirectionsResponse,
  OrsOptimizationRequest,
  OrsOptimizationResponse,
} from "@/lib/types";

const ORS_BASE_URL = "https://api.openrouteservice.org";

function parseOrsError(errorText: string, status: number): string {
  let normalizedError = errorText.toLowerCase();

  try {
    const parsedError = JSON.parse(errorText) as {
      error?: { message?: string };
      message?: string;
    };
    const errorMessage = parsedError.error?.message ?? parsedError.message;

    if (errorMessage) {
      normalizedError = errorMessage.toLowerCase();
    }
  } catch {
    // Fall back to plain-text matching when ORS does not return structured JSON.
  }

  if (status === 401 || status === 403) {
    return "API key is missing or invalid.";
  }

  if (status === 404) {
    return "Routing service endpoint not found.";
  }

  if (
    normalizedError.includes("not routable") ||
    normalizedError.includes("could not find routable point") ||
    normalizedError.includes("could not find routable") ||
    normalizedError.includes("no routable point")
  ) {
    return "One or more waypoints are too far from a walkable road or trail. Move them closer to a path and try again.";
  }

  if (normalizedError.includes("no solution")) {
    return "No valid route could be found with these constraints. Try relaxing the constraints.";
  }

  return "Routing service error. Please try again.";
}

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
    throw new Error(parseOrsError(errorText, response.status));
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
