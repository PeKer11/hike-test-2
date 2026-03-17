import "server-only";

import type { NominatimPlace } from "@/lib/types";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

export async function searchPlaces(
  query: string,
  limit = 5,
): Promise<NominatimPlace[]> {
  const normalized = query.trim();
  if (!normalized) {
    return [];
  }

  const params = new URLSearchParams({
    q: normalized,
    format: "jsonv2",
    limit: String(limit),
    addressdetails: "1",
  });

  const response = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
    method: "GET",
    headers: {
      "User-Agent": "HikingRoutePlanner/1.0",
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Nominatim request failed (${response.status}): ${errorText}`,
    );
  }

  return (await response.json()) as NominatimPlace[];
}
