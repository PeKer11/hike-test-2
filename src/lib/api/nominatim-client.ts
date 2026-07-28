import "server-only";

import type { Coordinates, NominatimPlace } from "@/lib/types";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

// Roughly 10 km around the bias point. Generic names ("מדרחוב", "גן טייל")
// exist in every town, so a preference-only viewbox silently returned matches
// tens of km away. With `bounded=1` the box is a hard filter instead.
const BIAS_BOX_DEGREES = 0.1;

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

  // A bias turns this into a hard "near this point" search: no match inside the
  // box is a real answer, and the caller reports that name as unresolved rather
  // than retrying unbounded and accepting a place in another town.
  if (bias && Number.isFinite(bias.lat) && Number.isFinite(bias.lng)) {
    const minLng = bias.lng - BIAS_BOX_DEGREES;
    const minLat = bias.lat - BIAS_BOX_DEGREES;
    const maxLng = bias.lng + BIAS_BOX_DEGREES;
    const maxLat = bias.lat + BIAS_BOX_DEGREES;
    params.set("viewbox", `${minLng},${minLat},${maxLng},${maxLat}`);
    params.set("bounded", "1");
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
