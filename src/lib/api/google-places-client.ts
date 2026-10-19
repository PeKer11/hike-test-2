import "server-only";

import type { AttractionCategory, Coordinates } from "@/lib/types";

const SEARCH_TEXT_URL = "https://places.googleapis.com/v1/places:searchText";
const SEARCH_NEARBY_URL = "https://places.googleapis.com/v1/places:searchNearby";

// Pro-tier fields only. `rating` / `userRatingCount` would move every request to
// the Enterprise SKU (1,000 free a month instead of 5,000), so ranking by
// reviews is deliberately not done here.
const FIELD_MASK = "places.id,places.displayName,places.location,places.primaryType,places.types";

const REQUEST_TIMEOUT_MS = 6000;
// Google's per-day quota in Cloud Console is the real cap; this is the in-process
// belt for one server instance, so a loop can never run up a bill on its own.
const DEFAULT_DAILY_CAP = 150;

/** Google place types to ask for, per kind of stop. */
const CATEGORY_TYPES: Record<AttractionCategory, string[]> = {
  food: ["restaurant", "cafe", "bakery"],
  nature: ["national_park", "hiking_area", "nature_preserve"],
  park: ["park", "garden"],
  museum: ["museum", "art_gallery"],
  landmark: ["tourist_attraction", "historical_landmark", "monument"],
  viewpoint: ["observation_deck", "scenic_spot"],
  religious: ["synagogue", "church", "mosque"],
  shopping: ["market", "shopping_mall"],
  entertainment: ["movie_theater", "performing_arts_theater", "amusement_park"],
  other: ["tourist_attraction"],
};

export interface GooglePlace {
  placeId: string;
  name: string;
  coordinates: Coordinates;
  primaryType: string | null;
  types: string[];
}

interface RawPlace {
  id?: string;
  displayName?: { text?: string };
  location?: { latitude?: number; longitude?: number };
  primaryType?: string;
  types?: string[];
}

let usageDay = "";
let usageCount = 0;

function dailyCap(): number {
  const raw = Number(process.env.GOOGLE_PLACES_DAILY_CAP);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_DAILY_CAP;
}

/** True when a key is set and today's in-process cap is not used up. */
export function googlePlacesAvailable(): boolean {
  if (!process.env.GOOGLE_PLACES_API_KEY?.trim()) return false;
  const today = new Date().toISOString().slice(0, 10);
  if (today !== usageDay) {
    usageDay = today;
    usageCount = 0;
  }
  return usageCount < dailyCap();
}

export function categoryTypes(category: AttractionCategory): string[] {
  return CATEGORY_TYPES[category];
}

async function post(url: string, body: unknown): Promise<GooglePlace[]> {
  if (!googlePlacesAvailable()) {
    throw new Error("Google Places unavailable (no key or daily cap reached).");
  }
  usageCount += 1;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": process.env.GOOGLE_PLACES_API_KEY!.trim(),
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Google Places request failed (${response.status}).`);
  }
  const json = (await response.json()) as { places?: RawPlace[] };
  const places: GooglePlace[] = [];
  for (const p of json.places ?? []) {
    const lat = p.location?.latitude;
    const lng = p.location?.longitude;
    if (!p.id || !p.displayName?.text || typeof lat !== "number" || typeof lng !== "number") continue;
    places.push({
      placeId: p.id,
      name: p.displayName.text,
      coordinates: { lat, lng },
      primaryType: p.primaryType ?? null,
      types: p.types ?? [],
    });
  }
  return places;
}

/**
 * Find a place by name. `bias` only prefers results near a point (it does not
 * exclude the rest), so "Habima Theatre Tel Aviv" is found even when the
 * walker is standing in another town.
 */
export function searchTextPlaces(
  query: string,
  bias?: Coordinates,
  maxResults = 1,
): Promise<GooglePlace[]> {
  return post(SEARCH_TEXT_URL, {
    textQuery: query,
    maxResultCount: maxResults,
    languageCode: "he",
    ...(bias
      ? {
          locationBias: {
            circle: { center: { latitude: bias.lat, longitude: bias.lng }, radius: 20000 },
          },
        }
      : {}),
  });
}

/** Up to 20 places of one kind within `radiusMeters` of `center`. */
export function searchNearbyPlaces(
  category: AttractionCategory,
  center: Coordinates,
  radiusMeters: number,
  maxResults = 20,
): Promise<GooglePlace[]> {
  return post(SEARCH_NEARBY_URL, {
    includedTypes: categoryTypes(category),
    maxResultCount: maxResults,
    languageCode: "he",
    locationRestriction: {
      circle: {
        center: { latitude: center.lat, longitude: center.lng },
        radius: Math.min(50000, Math.max(100, radiusMeters)),
      },
    },
  });
}

/** Every kind a walker might be told about, in one nearby request (Google caps it at 20). */
const ALL_KINDS_TYPES = Array.from(
  new Set(Object.values(CATEGORY_TYPES).flat()),
).slice(0, 50);

/** Up to 20 places of any walk-worthy kind within `radiusMeters` of `center`. */
export function searchNearbyAnyPlaces(
  center: Coordinates,
  radiusMeters: number,
  maxResults = 20,
): Promise<GooglePlace[]> {
  return post(SEARCH_NEARBY_URL, {
    includedTypes: ALL_KINDS_TYPES,
    maxResultCount: maxResults,
    languageCode: "he",
    locationRestriction: {
      circle: {
        center: { latitude: center.lat, longitude: center.lng },
        radius: Math.min(50000, Math.max(100, radiusMeters)),
      },
    },
  });
}

/** Which of our kinds a Google place is, from its types (first match wins). */
export function categoryOfGooglePlace(place: GooglePlace): AttractionCategory {
  const types = new Set([place.primaryType, ...place.types]);
  for (const [category, list] of Object.entries(CATEGORY_TYPES) as Array<[AttractionCategory, string[]]>) {
    if (category !== "other" && list.some((t) => types.has(t))) return category;
  }
  return "other";
}
