import type { Attraction, Coordinates } from "@/lib/types";

// The model is asked for a fixed JSON shape, but the reply is still untyped
// JSON coming off the wire — parse defensively rather than trusting it.
const MAX_PLACE_NAMES = 8;
const MAX_NAME_LENGTH = 120;

// Explicit-mode places carry no OSM tags, so there is nothing to infer a
// category or a realistic dwell time from. 30 minutes matches the mid-range of
// the Overpass category defaults.
const DEFAULT_VISIT_MINUTES = 30;

/**
 * System instruction for the Gemini extraction pass. It lives here rather than
 * in `gemini-client.ts` so it can be asserted on in tests — that module is
 * `server-only` and cannot be imported from the test runner.
 *
 * The general-vs-specific block exists because live testing showed the model
 * returning the city ("זכרון יעקב" in "the מדרחוב and גן טייל in זכרון יעקב")
 * as a stop of its own. The distinction is fuzzy, so it is taught by example.
 */
export const PLACE_EXTRACTION_SYSTEM_PROMPT = [
  "You extract place names from a walker's free-text description of where they want to go.",
  "Return the places in the order the user mentioned them.",
  "Keep the user's own wording (for example 'Habima Square', 'the Jaffa port').",
  "Drop leading articles, and shorten a vague description to a searchable phrase (for example 'a good market' becomes 'market').",
  "Ignore anything that is not a place: durations, pace, moods, and general chatter.",
  "A city, town, neighbourhood, or region named only to say WHERE the other places are is context, not a destination — leave it out.",
  "Rule of thumb: a name introduced with 'in <name>', 'near <name>', 'around <name>', 'ב<name>' or 'ליד <name>' that locates the other named places is context.",
  "Keep such an area name only when the text names no smaller or more specific place at all — then the area itself is the one destination.",
  "Examples:",
  '"I want to go to Habima Square and the Carmel Market in Tel Aviv" -> ["Habima Square", "Carmel Market"] — Tel Aviv only says where those stops are.',
  '"אני רוצה ללכת למדרחוב ולגן טייל בזכרון יעקב" -> ["מדרחוב", "גן טייל"] — זכרון יעקב only says where those stops are.',
  '"I want to visit Jerusalem" -> ["Jerusalem"] — no smaller place is named, so the city is the destination.',
  '"תן לי טיול בעכו" -> ["עכו"] — no smaller place is named, so the city is the destination.',
  "If the text names no places at all, return an empty list.",
].join("\n");

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
