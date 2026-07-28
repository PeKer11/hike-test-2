import "server-only";

import type { Coordinates, NominatimPlace } from "@/lib/types";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

// Roughly 25 km around the bias point. Nominatim treats an unbounded viewbox
// as a preference, not a filter, so out-of-box matches still come back.
const BIAS_BOX_DEGREES = 0.25;

export async function searchPlaces(
  query: string,
  limit = 5,
  bias?: Coordinates,
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

  if (bias && Number.isFinite(bias.lat) && Number.isFinite(bias.lng)) {
    const minLng = bias.lng - BIAS_BOX_DEGREES;
    const minLat = bias.lat - BIAS_BOX_DEGREES;
    const maxLng = bias.lng + BIAS_BOX_DEGREES;
    const maxLat = bias.lat + BIAS_BOX_DEGREES;
    params.set("viewbox", `${minLng},${minLat},${maxLng},${maxLat}`);
  }

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
