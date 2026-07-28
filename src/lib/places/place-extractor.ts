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
 *
 * That context area is also asked for by name (`contextLocation`) rather than
 * just dropped: geocoding it first gives the other names a bias that matches
 * what the user typed, instead of wherever they happen to be standing.
 */
export const PLACE_EXTRACTION_SYSTEM_PROMPT = [
  "You extract place names from a walker's free-text description of where they want to go.",
  "Return two things: `places` (the destinations) and `contextLocation` (the area that only says where those destinations are, or null).",
  "Return the places in the order the user mentioned them.",
  "Keep the user's own wording (for example 'Habima Square', 'the Jaffa port').",
  "Drop leading articles, and shorten a vague description to a searchable phrase (for example 'a good market' becomes 'market').",
  "Ignore anything that is not a place: durations, pace, moods, and general chatter.",
  "A city, town, neighbourhood, or region named only to say WHERE the other places are is context, not a destination — leave it out of `places` and return it as `contextLocation`.",
  "Rule of thumb: a name introduced with 'in <name>', 'near <name>', 'around <name>', 'ב<name>' or 'ליד <name>' that locates the other named places is context.",
  "Keep such an area name in `places` only when the text names no smaller or more specific place at all — then the area itself is the one destination, and `contextLocation` is null.",
  "`contextLocation` is null whenever no area was mentioned only as context. Never repeat a name in both fields.",
  "Examples:",
  '"I want to go to Habima Square and the Carmel Market in Tel Aviv" -> places ["Habima Square", "Carmel Market"], contextLocation "Tel Aviv" — Tel Aviv only says where those stops are.',
  '"אני רוצה ללכת למדרחוב ולגן טייל בזכרון יעקב" -> places ["מדרחוב", "גן טייל"], contextLocation "זכרון יעקב" — זכרון יעקב only says where those stops are.',
  '"I want to visit Jerusalem" -> places ["Jerusalem"], contextLocation null — no smaller place is named, so the city is the destination.',
  '"תן לי טיול בעכו" -> places ["עכו"], contextLocation null — no smaller place is named, so the city is the destination.',
  "If the text names no places at all, return an empty list and a null contextLocation.",
].join("\n");

export interface GeocodedPlaceName {
  name: string;
  coordinates: Coordinates | null;
}

export interface PlaceExtractionResult {
  attractions: Attraction[];
  unresolvedNames: string[];
}

/** What one extraction pass produces: the stops, plus where they are. */
export interface PlaceExtraction {
  places: string[];
  /** Area named only as location context — used to bias the other lookups. */
  contextLocation: string | null;
}

function toStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  return value.filter((item): item is string => typeof item === "string");
}

/**
 * Turn a JSON-mode text reply — which may be wrapped in a markdown fence — into
 * a value the field readers can inspect. Already-parsed input passes through.
 */
function toCandidate(input: unknown): unknown {
  if (typeof input !== "string") {
    return input;
  }

  const stripped = input
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  try {
    return JSON.parse(stripped) as unknown;
  } catch {
    return null;
  }
}

/**
 * Pull a list of place names out of whatever the model returned — a JSON-mode
 * text reply, an already-parsed object, a bare array, or prose that may be
 * wrapped in a markdown fence. Returns an empty array rather than throwing when
 * nothing usable is found, so the caller can report "no places found" instead
 * of a 500.
 */
export function parsePlaceNames(input: unknown): string[] {
  const candidate = toCandidate(input);

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

/**
 * Read the optional context area off the same reply. Anything that isn't a
 * usable string — a missing field, null, a number, an unparseable reply —
 * becomes `null`, which the caller treats as "no context to bias with".
 */
export function parseContextLocation(input: unknown): string | null {
  const candidate = toCandidate(input);

  if (candidate === null || typeof candidate !== "object") {
    return null;
  }

  const raw = (candidate as Record<string, unknown>).contextLocation;
  if (typeof raw !== "string") {
    return null;
  }

  return raw.trim().slice(0, MAX_NAME_LENGTH) || null;
}

/**
 * Read both fields off one reply. The context area is dropped when it also
 * appears in `places` — the model occasionally returns it twice, and biasing a
 * search for a city by that same city is pointless.
 */
export function parsePlaceExtraction(input: unknown): PlaceExtraction {
  const candidate = toCandidate(input);
  const places = parsePlaceNames(candidate);
  const contextLocation = parseContextLocation(candidate);

  if (
    contextLocation &&
    places.some((name) => name.toLowerCase() === contextLocation.toLowerCase())
  ) {
    return { places, contextLocation: null };
  }

  return { places, contextLocation };
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
