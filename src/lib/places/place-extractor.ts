// Imported for the value check inside `parseCategoryNeeds` only. This module and
// `preference-extractor` import from each other (it takes `toCandidate` from
// here), so nothing at module-evaluation time may touch this binding — see the
// note on `PLACE_EXTRACTION_SYSTEM_PROMPT`.
import { ATTRACTION_CATEGORIES } from "@/lib/preferences/preference-extractor";
import type { Attraction, AttractionCategory, Coordinates } from "@/lib/types";

// The model is asked for a fixed JSON shape, but the reply is still untyped
// JSON coming off the wire — parse defensively rather than trusting it.
const MAX_PLACE_NAMES = 8;
const MAX_NAME_LENGTH = 120;

// One prompt can reasonably say "I also want to eat and see a synagogue"; more
// than a handful is the model over-reading, and each one costs a POI search.
// Exported because the clarification chips are bound by it too: offering the
// walker more selections than the parser would keep is a promise the extraction
// silently breaks.
export const MAX_CATEGORY_NEEDS = 3;

// Bounds on a stated walk length. Anything outside them is the model having
// misread a number (a year, a street number, a price) rather than a walk.
const MIN_DURATION_MINUTES = 5;
const MAX_DURATION_MINUTES = 600;

/**
 * Bounds on a stated stop count. One is the smallest walk anybody can ask for;
 * the ceiling is `MAX_WALK_STOPS`, spelled out rather than imported because the
 * ranker imports nothing from here and this module is already tangled with
 * `preference-extractor` — see the circular-import note above. A count outside
 * the range is clamped rather than dropped: "give me 20 famous places" is a
 * real request for as many as the walk can hold, and dropping it is the exact
 * bug this field exists to fix.
 */
const MIN_STOP_COUNT = 1;
const MAX_STOP_COUNT = 8;

/**
 * Bounds on a stated finish distance, in kilometres. They are the form field's
 * own `min`/`max` rather than a second opinion — this only ever pre-fills that
 * input, and a value the field would reject is not worth pre-filling it with.
 * Clamped rather than dropped, as the stop count is: "finish within 100 metres
 * of here" is a real request for as tight a finish as the app allows.
 */
const MIN_END_DISTANCE_KM = 0.1;
const MAX_END_DISTANCE_KM = 50;

/**
 * Bounds on a stated search radius, in kilometres. Same reasoning as the finish
 * distance's: they are the "Search radius (km)" field's own `min`/`max`, since
 * this only ever pre-fills that input. Clamped rather than dropped — "look up
 * to 30 km out" is a real request for as wide a search as the app allows.
 */
const MIN_SEARCH_RADIUS_KM = 0.5;
const MAX_SEARCH_RADIUS_KM = 10;

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
 *
 * `durationMinutes` and `categoryNeeds` ride along on the same call rather than
 * getting one of their own: both are stated in the same sentence as the places,
 * so reading them costs nothing extra. (The preference pass is separate for a
 * different reason — it is opt-in and only runs for a signed-in walker.)
 *
 * The category list is spelled out literally instead of interpolated from
 * `ATTRACTION_CATEGORIES`: this module and `preference-extractor` import from
 * each other, so reading that binding while this string is built would be a
 * circular-import TDZ crash. A test asserts the two stay in sync.
 */
export const PLACE_EXTRACTION_SYSTEM_PROMPT = [
  "You extract place names from a walker's free-text description of where they want to go.",
  "Return `places` (the destinations), `contextLocation` (the area that only says where those destinations are, or null), `durationMinutes` (how long the walk is, or null), and `categoryNeeds` (kinds of stop they asked for without naming one).",
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
  "",
  // Live testing (2026-08-21, real Gemini through /api/extract-places, real
  // Nominatim) found the model already passes an address through untouched —
  // it invents nothing — but that it keeps the walker's street-type word, and
  // that word is what the geocoder cannot match: OpenStreetMap names the
  // street "דיזנגוף", never "רחוב דיזנגוף", so "רחוב דיזנגוף 50, תל אביב"
  // returned zero results while "דיזנגוף 50" resolved. Same for "12 Ben Yehuda
  // St, Jerusalem" (zero) against "12 Ben Yehuda" (resolves) — an Israeli
  // street is mapped in Hebrew, so an anglicised "St" matches nothing.
  // The rule is about the word the walker *added*, not about street words in
  // general, because a street whose mapped name really does carry one
  // ("שדרות רוטשילד", "Pennsylvania Avenue") resolves as written and dropping
  // it would break the case that already works.
  "A street address is a destination: put it in `places` as written, keeping the house number with the street name.",
  "Drop only a street-type word the walker added that is not part of the street's own name — 'רחוב', \"רח'\", 'St', 'Street' in front of a street mapped under a bare name.",
  "Keep a street-type word that IS part of the name: 'שדרות רוטשילד 20', 'Pennsylvania Avenue', 'Baker Street'.",
  "The city or town in an address is context exactly as it is for a named place — it belongs in `contextLocation`, not in `places`.",
  "Examples:",
  '"רחוב דיזנגוף 50, תל אביב" -> places ["דיזנגוף 50"], contextLocation "תל אביב" — the street is mapped as "דיזנגוף", so the added "רחוב" comes off.',
  '"קח אותי לרחוב הרצל 15 בחיפה" -> places ["הרצל 15"], contextLocation "חיפה".',
  '"a walk starting from 12 Ben Yehuda St, Jerusalem" -> places ["12 Ben Yehuda"], contextLocation "Jerusalem" — an Israeli street is mapped under its bare name, so "St" comes off.',
  '"take me to 1600 Pennsylvania Avenue NW, Washington DC" -> places ["1600 Pennsylvania Avenue NW"], contextLocation "Washington DC" — the avenue is mapped with that word in its name, so nothing comes off.',
  "",
  "`durationMinutes`: the total time the walker says they have, in whole minutes.",
  "Only fill it in when the text states a total time budget unambiguously — 'three hours' -> 180, '90 minutes' -> 90, 'an hour and a half' -> 90, 'יש לי שלוש שעות' -> 180.",
  "Return null for vague phrasing ('a short walk', 'not too long', 'a few hours'), for a time of day ('at 3pm'), and for a duration that belongs to one stop rather than the whole walk ('half an hour at the museum').",
  "Never guess a duration that was not stated. null is the normal answer.",
  "",
  "`categoryNeeds`: kinds of stop the walker asks for WITHOUT naming a place — a need for this walk, expressed as a wish.",
  "Use only these values: landmark, museum, park, food, viewpoint, religious, shopping, entertainment, nature.",
  "Include a category only when the walker asks to do or see that kind of thing on this walk.",
  "Do NOT add a category for a place already named in `places` — that stop is handled.",
  "Do NOT add a category for a general taste or standing preference ('I love natural things', 'museums bore me'), only for a request for a stop on this walk.",
  "Return an empty list when nothing of the sort is asked for. That is the normal answer.",
  "Examples:",
  '"אני גם רוצה לאכול משהו" -> categoryNeeds ["food"] — a wish for a stop, with no place named.',
  '"תביא לי גם לראות בית כנסת באיזור" -> categoryNeeds ["religious"] — a kind of place, not a named one.',
  '"אני אוהב דברים טבעיים" -> categoryNeeds [] — a taste, not a request for a stop on this walk.',
  '"I want to see Habima Square" -> categoryNeeds [] — the stop is named, so it is in `places` instead.',
  "",
  "`stopCount`: how many stops the walker asked for, as a whole number.",
  "Only fill it in when the text states a count of places to visit unambiguously — 'bring me 3 famous places' -> 3, 'four stops' -> 4, 'תביא לי 5 מקומות' -> 5.",
  "Return null for a vague quantity ('a few places', 'some stops'), for a number that counts something else (a duration, a distance, a street number, a party size), and whenever the walker named the places themselves — a list of names already says how many there are.",
  "Never guess a count that was not stated. null is the normal answer.",
  "",
  "`notableOnly`: true only when the walker asks specifically for well-known places — 'famous', 'iconic', 'the highlights', 'must-see', 'the best-known', 'מפורסמים', 'הכי מפורסם'.",
  "It is a quality asked of every stop on the walk, not a kind of place, so it never belongs in `categoryNeeds`.",
  "Return null for a plain request with no such wording, and for praise of a place the walker already named ('the famous Carmel Market' — they named it, so there is nothing to select for).",
  "null is the normal answer.",
  "Examples:",
  '"bring me 3 famous places in Tel Aviv" -> places ["Tel Aviv"], contextLocation null, stopCount 3, notableOnly true.',
  '"תן לי 90 דקות בתל אביב" -> stopCount null, notableOnly null, durationMinutes 90 — a time budget is not a stop count.',
  "",
  "`maxEndDistanceKm`: how far from where the walker is or started the walk is allowed to FINISH, in kilometres.",
  "Only fill it in when the text states such a distance unambiguously — 'finish within 1km of here' -> 1, 'עד 1 ק\"מ ממה שאני נמצא' -> 1, 'keep it within 500m of my start' -> 0.5, 'תחזיר אותי עד חצי ק\"מ ממה שהתחלתי' -> 0.5.",
  "This is about where the walk ENDS, not how far to look for attractions — 'find me things within 2km' is a search radius, not a finish distance, and returns null here.",
  "It is also not a walk length: 'a 5km walk' and 'שלוש שעות' say how long the walk is, not where it ends, and return null here.",
  "Return null for vague phrasing ('finish near where I started', 'not too far from here') and whenever no such distance was stated.",
  "Never guess a finish distance that was not stated. null is the normal answer.",
  "Examples:",
  '"תן לי טיול של שעתיים שמסתיים עד 500 מטר ממה שאני נמצא" -> durationMinutes 120, maxEndDistanceKm 0.5.',
  '"find me attractions within 2km" -> maxEndDistanceKm null — that is how far to search, not where to finish.',
  "",
  "`searchRadiusKm`: how far from where the walker is or starts to LOOK for places to stop at, in kilometres.",
  "Only fill it in when the text states such a distance unambiguously — 'search up to 10km from here' -> 10, 'look within 5km of my start' -> 5, 'מאיפה שאני נמצא עכשיו עד 10 ק\"מ' -> 10, 'תחפש לי מקומות עד 3 ק\"מ ממני' -> 3.",
  "This is about where to look for stops, not where the walk has to END — 'finish within 1km of here' is a `maxEndDistanceKm`, and returns null here.",
  "It is a distance, not a time budget: 'three hours' and 'שעתיים' are `durationMinutes`, and return null here.",
  "It is a distance, not a count: 'bring me 3 places' is a `stopCount`, and returns null here.",
  "Return null for vague phrasing ('somewhere around here', 'nothing too far away') and whenever no such distance was stated.",
  "Never guess a search distance that was not stated. null is the normal answer.",
  "Examples:",
  '"אני רוצה טיול בזכרון יעקב, להתחיל מאיפה שאני נמצא עכשיו עד 10 ק\"מ, לסיים עד 1 ק\"מ מאיפה שאני נמצא עכשיו" -> searchRadiusKm 10, maxEndDistanceKm 1 — two different distances in one sentence.',
  '"search up to 5km from here" -> searchRadiusKm 5, maxEndDistanceKm null.',
  '"finish within 1km of where I am" -> searchRadiusKm null, maxEndDistanceKm 1.',
  '"תן לי טיול של שעתיים" -> searchRadiusKm null, durationMinutes 120 — a time budget is not a search distance.',
  "",
  // Without this rule the model helpfully invents a dog park. Standing facts
  // are there to disambiguate what the walker asked for, not to add to it.
  "You may be given standing facts about the walker before their request.",
  "Standing facts are context for interpreting the request. They never add places or category needs on their own.",
  "The walker's current text always wins where the two conflict.",
  'Example: with the fact "does not eat meat" and the request "a walk in Jaffa", return places ["Jaffa"] and categoryNeeds [] — the fact adds nothing to this walk.',
].join("\n");

/**
 * System instruction for the fallback lookup that runs only after a name failed
 * to geocode. Lives here for the same reason as the extraction prompt: tests
 * can read it, `gemini-client.ts` cannot be imported from the test runner.
 *
 * Live testing found the gap it exists for: "מדרחוב" in "זכרון יעקב" is a real,
 * well-known place, but OpenStreetMap only tags it under its street name
 * ("המייסדים"), so Nominatim returns nothing for the colloquial term. Gemini
 * already knows that mapping; this asks for it.
 *
 * The instruction leans hard on returning null, because a confident-sounding
 * wrong name is worse than no name: it geocodes cleanly and drops the walker at
 * the wrong place with no sign anything went wrong.
 */
export const CANONICAL_NAME_SYSTEM_PROMPT = [
  "You are given a place term a walker used, and the area it was mentioned in.",
  "Return `canonicalName`: the formal, official, or commonly-mapped name of that place — the name a map or OpenStreetMap would label it with — when it is more specific than the term the walker used.",
  "For example, a generic term for a pedestrian mall in a town whose pedestrian mall is officially a named street should return that street's name.",
  "Return null when the term is already specific or formal, when no such place is known to you in that area, or when you are not confident which place is meant.",
  "Prefer null over a plausible-sounding guess. A wrong name still geocodes, and would silently send the walker to the wrong place; returning null just tells them we could not find it.",
  "Never invent a name, and never return a name you cannot place in the given area.",
  "Answer in the same language as the term you were given.",
  "Return the bare mapped name ONLY — do not keep the walker's generic word attached to it.",
  'For example, if the walker said "מדרחוב" (a generic word for pedestrian street) and the officially mapped street is called "המייסדים", return exactly "המייסדים" — not "מדרחוב המייסדים". A geocoder matches the bare official name, not the generic word plus the name.',
  "Return the name only — no street numbers, no city, no country, no explanation.",
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
  /** Total walk length the text states, or null when none was stated. */
  durationMinutes: number | null;
  /**
   * Kinds of stop asked for without naming one ("I also want to eat"). A need
   * for this walk only — standing tastes are the preference pass's job.
   */
  categoryNeeds: AttractionCategory[];
  /**
   * How many stops the text asked for, or null when it stated no count. Caps
   * the discovery selection instead of the time budget doing it alone: "3
   * famous places in Tel Aviv" is a request for three stops, and a 90-minute
   * budget would otherwise hand back eight.
   */
  stopCount: number | null;
  /**
   * Set when the walker asked for well-known places rather than just places.
   * Null, not false, for the same reason `durationMinutes` is nullable: absent
   * and "explicitly not" are the same request here, and a tri-state keeps the
   * "don't guess" instruction honest in the schema itself.
   */
  notableOnly: boolean | null;
  /**
   * How far from the start the walk may finish, in kilometres, or null when the
   * text stated no such limit. Distinct from the search radius: a walk built
   * from POIs 2 km out can still end 2 km the other side of the start.
   */
  maxEndDistanceKm: number | null;
  /**
   * How far from the origin to look for candidate stops, in kilometres, or null
   * when the text stated no such distance. The other side of
   * `maxEndDistanceKm`: one says where to search, the other where to finish,
   * and a single sentence can state both and mean two different numbers.
   */
  searchRadiusKm: number | null;
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
export function toCandidate(input: unknown): unknown {
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
 * Read the stated walk length off the same reply, in whole minutes. Returns
 * `null` for anything that isn't a plausible walk: a missing field, a non-number
 * (the model sometimes answers "three hours"), zero, or a value outside
 * `MIN_DURATION_MINUTES`..`MAX_DURATION_MINUTES`. The field only ever pre-fills
 * a form the walker can edit, so refusing a doubtful value costs them one typed
 * number and saves them a silently wrong walk.
 */
export function parseDurationMinutes(input: unknown): number | null {
  const candidate = toCandidate(input);

  if (candidate === null || typeof candidate !== "object") {
    return null;
  }

  const raw = (candidate as Record<string, unknown>).durationMinutes;
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return null;
  }

  const minutes = Math.round(raw);
  if (minutes < MIN_DURATION_MINUTES || minutes > MAX_DURATION_MINUTES) {
    return null;
  }

  return minutes;
}

/**
 * Read the one-off category needs off the same reply, dropping anything that
 * isn't a known category. `other` is dropped as it is in the preference parser:
 * every unclassified POI lands in it, so searching for it means "find me
 * anything", which is not what the walker asked for.
 */
export function parseCategoryNeeds(input: unknown): AttractionCategory[] {
  const candidate = toCandidate(input);

  if (candidate === null || typeof candidate !== "object") {
    return [];
  }

  const list = (candidate as Record<string, unknown>).categoryNeeds;
  if (!Array.isArray(list)) {
    return [];
  }

  const result: AttractionCategory[] = [];
  for (const raw of list) {
    if (typeof raw !== "string") continue;
    if (raw === "other") continue;
    if (!(ATTRACTION_CATEGORIES as string[]).includes(raw)) continue;

    const category = raw as AttractionCategory;
    if (result.includes(category)) continue;

    result.push(category);
    if (result.length >= MAX_CATEGORY_NEEDS) break;
  }

  return result;
}

/**
 * Read a stated stop count off the reply. Out-of-range counts are clamped, not
 * dropped — see `MIN_STOP_COUNT`/`MAX_STOP_COUNT`. A non-number is dropped: the
 * model was told to answer null when no count was stated, and anything else
 * arriving in that field is not a count.
 */
export function parseStopCount(input: unknown): number | null {
  const candidate = toCandidate(input);

  if (candidate === null || typeof candidate !== "object") {
    return null;
  }

  const raw = (candidate as Record<string, unknown>).stopCount;
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return null;
  }

  const count = Math.round(raw);
  if (count < 1) return null;

  return Math.min(Math.max(count, MIN_STOP_COUNT), MAX_STOP_COUNT);
}

/**
 * Read a stated finish distance off the reply, in kilometres. Out-of-range
 * values are clamped, not dropped — see `MIN_END_DISTANCE_KM`/
 * `MAX_END_DISTANCE_KM`. A non-number is dropped, and so is zero or less: the
 * model was told to answer null when no distance was stated, and a zero limit
 * would mean a walk that has to end exactly where it began.
 */
export function parseMaxEndDistanceKm(input: unknown): number | null {
  const candidate = toCandidate(input);

  if (candidate === null || typeof candidate !== "object") {
    return null;
  }

  const raw = (candidate as Record<string, unknown>).maxEndDistanceKm;
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return null;
  }

  if (raw <= 0) return null;

  return Math.min(Math.max(raw, MIN_END_DISTANCE_KM), MAX_END_DISTANCE_KM);
}

/**
 * Read a stated search radius off the reply, in kilometres. Shaped exactly like
 * `parseMaxEndDistanceKm`: out-of-range values are clamped to the form field's
 * own range rather than dropped, a non-number is dropped, and so is zero or
 * less — the model was told to answer null when no distance was stated, and a
 * zero radius would mean searching nowhere.
 */
export function parseSearchRadiusKm(input: unknown): number | null {
  const candidate = toCandidate(input);

  if (candidate === null || typeof candidate !== "object") {
    return null;
  }

  const raw = (candidate as Record<string, unknown>).searchRadiusKm;
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return null;
  }

  if (raw <= 0) return null;

  return Math.min(Math.max(raw, MIN_SEARCH_RADIUS_KM), MAX_SEARCH_RADIUS_KM);
}

/**
 * Read the "famous places only" signal off the reply. Only a literal `true`
 * counts: a string "true", a 1, or a missing field are all read as "not asked
 * for", which is the answer that changes nothing.
 */
export function parseNotableOnly(input: unknown): boolean | null {
  const candidate = toCandidate(input);

  if (candidate === null || typeof candidate !== "object") {
    return null;
  }

  return (candidate as Record<string, unknown>).notableOnly === true
    ? true
    : null;
}

/**
 * Read every field off one reply. The context area is dropped when it also
 * appears in `places` — the model occasionally returns it twice, and biasing a
 * search for a city by that same city is pointless.
 */
export function parsePlaceExtraction(input: unknown): PlaceExtraction {
  const candidate = toCandidate(input);
  const places = parsePlaceNames(candidate);
  const durationMinutes = parseDurationMinutes(candidate);
  const categoryNeeds = parseCategoryNeeds(candidate);
  const contextLocation = parseContextLocation(candidate);

  const repeatsAPlace =
    contextLocation !== null &&
    places.some((name) => name.toLowerCase() === contextLocation.toLowerCase());

  return {
    places,
    contextLocation: repeatsAPlace ? null : contextLocation,
    durationMinutes,
    categoryNeeds,
    // A count only means anything for a walk the app has to choose stops for.
    // When the walker named the places, the list is the count, and a model that
    // also filled this in would be capping their own named stops.
    stopCount: places.length > 1 ? null : parseStopCount(candidate),
    notableOnly: parseNotableOnly(candidate),
    // Unconditional, unlike `stopCount`: where the walk has to finish is the
    // walker's own constraint either way, and naming the stops says nothing
    // about how far from the start the last one may be.
    maxEndDistanceKm: parseMaxEndDistanceKm(candidate),
    // Unconditional for the same reason: how far to search is the walker's own
    // constraint whether or not they named the stops themselves.
    searchRadiusKm: parseSearchRadiusKm(candidate),
  };
}

/**
 * Read the fallback lookup's single field. Anything that isn't a usable string
 * — a missing field, an explicit null, prose, an unparseable reply — becomes
 * `null`, which the caller treats as "no better name to retry with".
 */
export function parseCanonicalName(input: unknown): string | null {
  const candidate = toCandidate(input);

  if (candidate === null || typeof candidate !== "object") {
    return null;
  }

  const raw = (candidate as Record<string, unknown>).canonicalName;
  if (typeof raw !== "string") {
    return null;
  }

  return raw.trim().slice(0, MAX_NAME_LENGTH) || null;
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
 * Pick one stop per stated need out of already-ranked nearby POIs — the best
 * match for "I also want to eat something", chosen from what is actually mapped
 * around the walk instead of from a name the walker never gave.
 *
 * The result is the same `Attraction` shape as a named stop, so it flows into
 * `explicitAttractions` identically; only `tags.source` tells them apart, which
 * is enough to explain the stop later without building any UI for it now.
 * A category with nothing nearby simply contributes no stop.
 */
export function pickNeedAttractions(
  ranked: Attraction[],
  categories: AttractionCategory[],
): Attraction[] {
  const picked: Attraction[] = [];
  const usedIds = new Set<string>();

  for (const category of categories) {
    const match = ranked.find(
      (attraction) =>
        attraction.category === category && !usedIds.has(attraction.id),
    );
    if (!match) continue;

    usedIds.add(match.id);
    picked.push({
      ...match,
      tags: { ...match.tags, source: "prompt-need", needCategory: category },
    });
  }

  return picked;
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

// ---------------------------------------------------------------------------
// Under-specified prompts
// ---------------------------------------------------------------------------

/**
 * Nominatim place kinds (`addresstype`, else `type`) that describe an AREA
 * rather than somewhere you can stand in front of.
 *
 * This is the signal that separates "bring me a walk in Zichron Yaakov" from
 * "bring me a walk to Habima Square". The extraction schema cannot tell them
 * apart — both come back as one entry in `places` with a null `contextLocation`,
 * because the prompt's own rule is that an area stays in `places` when nothing
 * smaller was named. The geocode already ran, and it knows which one it found.
 */
const AREA_PLACE_KINDS = new Set([
  "administrative",
  "borough",
  "city",
  "city_district",
  "county",
  "district",
  "hamlet",
  "island",
  "locality",
  "municipality",
  "neighbourhood",
  "province",
  "quarter",
  "region",
  "state",
  "suburb",
  "town",
  "village",
]);

/**
 * The kinds of walk worth offering someone who named a place and nothing else.
 *
 * Deliberately short and deliberately not `ATTRACTION_CATEGORIES`: this is a
 * question, and a question with ten options is a form. These are the ones that
 * describe a walk rather than a stop on one — nobody sets out for an afternoon
 * of "other", and "shopping" or "entertainment" are things you do somewhere,
 * not reasons to walk a town. They still reach a walker who has told us they
 * like them, through the preferred-first ordering below.
 */
export const CLARIFICATION_CATEGORIES: AttractionCategory[] = [
  "landmark",
  "nature",
  "food",
  "museum",
  "viewpoint",
  "park",
];

/** How many chips to offer. Four fits one row on a phone and still asks a real question. */
export const MAX_CLARIFICATION_CATEGORIES = 4;

/**
 * Whether the walker named a town and nothing more specific — "a walk in
 * Zichron Yaakov" rather than "a walk to Habima Square".
 *
 * A `contextLocation` means something smaller was named alongside the area;
 * more than one place means they have a route in mind; and a place that
 * geocoded to something other than an area is a real destination, however bare
 * the sentence around it was.
 *
 * Separate from `isUnderSpecifiedPrompt` because it stays true after the walker
 * answers the clarifying question. They picked a kind of walk, not a stop —
 * there is still no named list, which is what decides whether leftover time is
 * an invitation to discover more.
 */
export function isAreaOnlyPrompt(input: {
  places: string[];
  contextLocation: string | null;
  /** `addresstype` (else `type`) of the one geocoded place, or null if it never resolved. */
  placeKind: string | null;
}): boolean {
  return (
    input.contextLocation === null &&
    input.places.length === 1 &&
    input.placeKind !== null &&
    AREA_PLACE_KINDS.has(input.placeKind)
  );
}

/**
 * Whether the walker named a place and gave us nothing else to go on — an area
 * and no stated intent.
 *
 * A `categoryNeed` is a stated intent already ("somewhere to eat"), whether it
 * came out of the text or off a chip they just tapped, so there is nothing left
 * to ask.
 */
export function isUnderSpecifiedPrompt(input: {
  places: string[];
  contextLocation: string | null;
  categoryNeeds: AttractionCategory[];
  placeKind: string | null;
}): boolean {
  return isAreaOnlyPrompt(input) && input.categoryNeeds.length === 0;
}

/**
 * What to ask about, for this walker rather than for walkers in general.
 *
 * Two rules, and they are not the same rule mirrored. A downvoted category is
 * removed outright: asking someone whether they want the thing they have
 * already told us they do not is the app not listening, and it costs one of
 * only four slots. A liked category is moved to the front rather than being the
 * whole answer — the question is what they want *today*, and someone who
 * usually likes museums may still be out for a walk by the sea.
 *
 * Preferences the short list does not contain are still offered when the walker
 * has one, which is the point of leading with them rather than filtering the
 * fixed list by them.
 *
 * The empty case falls back to the plain list: if every suggestion has been
 * voted down, asking something is still better than asking nothing, and the
 * walker can ignore the chips and just build the walk.
 */
export function suggestClarificationCategories(
  preferredCategories: AttractionCategory[],
  downvotedCategories: Iterable<AttractionCategory>,
  limit: number = MAX_CLARIFICATION_CATEGORIES,
): AttractionCategory[] {
  const downvoted = new Set(downvotedCategories);
  const ordered: AttractionCategory[] = [];

  for (const category of [...preferredCategories, ...CLARIFICATION_CATEGORIES]) {
    if (category === "other") continue;
    if (downvoted.has(category)) continue;
    if (ordered.includes(category)) continue;
    ordered.push(category);
  }

  if (ordered.length === 0) {
    return CLARIFICATION_CATEGORIES.slice(0, limit);
  }

  return ordered.slice(0, limit);
}
