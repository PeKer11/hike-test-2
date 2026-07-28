import type { Attraction, Coordinates } from "@/lib/types";

// The model is asked for a fixed JSON shape, but the reply is still untyped
// JSON coming off the wire — parse defensively rather than trusting it.
const MAX_PLACE_NAMES = 8;
const MAX_NAME_LENGTH = 120;

// Explicit-mode places carry no OSM tags, so there is nothing to infer a
// category or a realistic dwell time from. 30 minutes matches the mid-range of
// the Overpass category defaults.
const DEFAULT_VISIT_MINUTES = 30;

export interface GeocodedPlaceName {
  name: string;
  coordinates: Coordinates | null;
}

export interface PlaceExtractionResult {
  attractions: Attraction[];
  unresolvedNames: string[];
}

function toStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  return value.filter((item): item is string => typeof item === "string");
}

/**
 * Pull a list of place names out of whatever the model returned — a JSON-mode
 * text reply, an already-parsed object, a bare array, or prose that may be
 * wrapped in a markdown fence. Returns an empty array rather than throwing when
 * nothing usable is found, so the caller can report "no places found" instead
 * of a 500.
 */
export function parsePlaceNames(input: unknown): string[] {
  let candidate: unknown = input;

  if (typeof candidate === "string") {
    const stripped = candidate
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();
    try {
      candidate = JSON.parse(stripped) as unknown;
    } catch {
      return [];
    }
  }

  let names = toStringArray(candidate);

  if (!names && candidate !== null && typeof candidate === "object") {
    const record = candidate as Record<string, unknown>;
    names = toStringArray(record.places) ?? toStringArray(record.names);
  }

  if (!names) {
    return [];
  }

  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of names) {
    const name = raw.trim().slice(0, MAX_NAME_LENGTH);
    if (!name) continue;

    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    result.push(name);
    if (result.length >= MAX_PLACE_NAMES) break;
  }

  return result;
}

function toSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "place"
  );
}

/**
 * Shape a geocoded name into the `Attraction` the walk-plan API accepts as
 * `explicitAttractions`. The user's own wording is kept as the display name —
 * a Nominatim `display_name` is far too verbose for a walk plan.
 */
export function toExplicitAttraction(
  name: string,
  coordinates: Coordinates,
  index: number,
): Attraction {
  return {
    id: `prompt-${index}-${toSlug(name)}`,
    name,
    coordinates,
    category: "other",
    avgVisitMinutes: DEFAULT_VISIT_MINUTES,
    tags: { source: "prompt" },
  };
}

/**
 * Split geocoded names into usable attractions and names we recognised but
 * could not locate. Unresolved names are returned rather than dropped so the
 * user can see that we heard them and correct the wording.
 */
export function buildExtractionResult(
  entries: GeocodedPlaceName[],
): PlaceExtractionResult {
  const attractions: Attraction[] = [];
  const unresolvedNames: string[] = [];

  for (const entry of entries) {
    if (entry.coordinates) {
      attractions.push(
        toExplicitAttraction(entry.name, entry.coordinates, attractions.length),
      );
    } else {
      unresolvedNames.push(entry.name);
    }
  }

  return { attractions, unresolvedNames };
}
