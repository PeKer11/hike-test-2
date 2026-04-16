import type { Attraction, AttractionCategory } from "@/lib/types";
import type { Coordinates } from "@/lib/types";

// Primary + mirror — tried in order if the previous one times out or fails
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

// How long a visitor typically spends at each category (minutes)
const AVG_VISIT_MINUTES: Record<AttractionCategory, number> = {
  landmark: 20,
  museum: 60,
  park: 30,
  food: 45,
  viewpoint: 15,
  religious: 20,
  shopping: 30,
  entertainment: 60,
  nature: 40,
  other: 15,
};

// OSM tag → category mapping
function inferCategory(tags: Record<string, string>): AttractionCategory {
  const { tourism, amenity, leisure, historic, natural, shop } = tags;

  if (tourism === "museum") return "museum";
  if (tourism === "viewpoint") return "viewpoint";
  if (
    tourism === "attraction" ||
    tourism === "artwork" ||
    tourism === "theme_park" ||
    tourism === "zoo" ||
    tourism === "aquarium"
  )
    return "landmark";
  if (historic) return "landmark";
  if (amenity === "place_of_worship") return "religious";
  if (amenity === "restaurant" || amenity === "cafe" || amenity === "bar")
    return "food";
  if (amenity === "theatre" || amenity === "cinema") return "entertainment";
  if (leisure === "park" || leisure === "garden") return "park";
  if (
    leisure === "miniature_golf" ||
    leisure === "water_park" ||
    leisure === "amusement_arcade" ||
    leisure === "escape_game" ||
    leisure === "bowling_alley"
  )
    return "entertainment";
  if (natural === "peak" || natural === "waterfall" || natural === "cave_entrance")
    return "nature";
  if (shop) return "shopping";
  return "other";
}

interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements: OverpassElement[];
}

interface EndpointAttempt {
  endpoint: string;
  method: "GET" | "POST";
}

const REQUEST_HEADERS = {
  Accept: "application/json,text/plain,*/*",
  "Accept-Language": "en-US,en;q=0.9",
  "User-Agent": "hiking-route-planner/0.1 (+local-dev)",
};

function buildOverpassQuery(center: Coordinates, radiusMeters: number): string {
  const { lat, lng } = center;
  const r = radiusMeters;

  // Query for the most relevant tourism/cultural POI types within radius
  return `
[out:json][timeout:25];
(
  node["tourism"~"museum|attraction|viewpoint|artwork|gallery|theme_park|zoo|aquarium"](around:${r},${lat},${lng});
  node["historic"](around:${r},${lat},${lng});
  node["amenity"~"place_of_worship|theatre|cinema|restaurant|cafe"](around:${r},${lat},${lng});
  node["leisure"~"park|garden|miniature_golf|water_park|amusement_arcade|escape_game|bowling_alley"](around:${r},${lat},${lng});
  node["natural"~"peak|waterfall|cave_entrance"](around:${r},${lat},${lng});
  way["tourism"~"museum|attraction|viewpoint|theme_park|zoo|aquarium"](around:${r},${lat},${lng});
  way["historic"](around:${r},${lat},${lng});
  way["leisure"~"park|garden|miniature_golf|water_park|amusement_arcade|escape_game|bowling_alley"](around:${r},${lat},${lng});
);
out center;
`.trim();
}

function elementToAttraction(el: OverpassElement): Attraction | null {
  const tags = el.tags ?? {};
  const name = tags.name ?? tags["name:en"] ?? tags["name:he"];
  if (!name) return null;

  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (lat === undefined || lng === undefined) return null;

  const category = inferCategory(tags);
  return {
    id: `osm-${el.type}-${el.id}`,
    name,
    coordinates: { lat, lng },
    category,
    avgVisitMinutes: AVG_VISIT_MINUTES[category],
    tags,
  };
}

export async function fetchAttractions(
  center: Coordinates,
  radiusMeters: number,
): Promise<Attraction[]> {
  const query = buildOverpassQuery(center, radiusMeters);
  const body = `data=${encodeURIComponent(query)}`;
  const attempts: EndpointAttempt[] = OVERPASS_ENDPOINTS.flatMap((endpoint) => [
    { endpoint, method: "POST" as const },
    { endpoint, method: "GET" as const },
  ]);

  let lastError: Error = new Error("Overpass API unavailable.");

  for (const attempt of attempts) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20_000);
      const response =
        attempt.method === "POST"
          ? await fetch(attempt.endpoint, {
              method: "POST",
              headers: {
                ...REQUEST_HEADERS,
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body,
              signal: controller.signal,
            })
          : await fetch(`${attempt.endpoint}?data=${encodeURIComponent(query)}`, {
              method: "GET",
              headers: REQUEST_HEADERS,
              signal: controller.signal,
            });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        const detail = errorText.trim().slice(0, 160);
        lastError = new Error(
          `Overpass API error: ${response.status} ${response.statusText}${detail ? ` - ${detail}` : ""}`,
        );
        continue; // try next mirror
      }

      const data = (await response.json()) as OverpassResponse;

      const attractions: Attraction[] = [];
      const seenIds = new Set<string>();

      for (const el of data.elements) {
        const attraction = elementToAttraction(el);
        if (!attraction) continue;
        if (seenIds.has(attraction.id)) continue;
        seenIds.add(attraction.id);
        attractions.push(attraction);
      }

      return attractions;
    } catch (err) {
      lastError =
        err instanceof Error ? err : new Error("Overpass request failed.");
      // try next mirror
    }
  }

  if (
    lastError.message.includes("403") ||
    lastError.message.toLowerCase().includes("forbidden")
  ) {
    throw new Error(
      "Public map data service temporarily rejected the walk request. Please try again in a moment or adjust the area slightly.",
    );
  }

  throw lastError;
}
