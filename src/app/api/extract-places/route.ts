import { NextResponse } from "next/server";

import {
  extractPlaceNames,
  resolveCanonicalName,
} from "@/lib/api/gemini-client";
import { searchPlaces } from "@/lib/api/nominatim-client";
import { rankAttractions } from "@/lib/attractions/attraction-ranker";
import { fetchAttractions } from "@/lib/attractions/overpass-client";
import {
  buildExtractionResult,
  isAreaOnlyPrompt,
  isUnderSpecifiedPrompt,
  pickNeedAttractions,
  suggestClarificationCategories,
  type GeocodedPlaceName,
} from "@/lib/places/place-extractor";
import { ATTRACTION_CATEGORIES } from "@/lib/preferences/preference-extractor";
import {
  getDownvotedCategories,
  getPreferredCategories,
  learnPreferencesFromText,
} from "@/lib/preferences/preference-store";
import { createClient } from "@/lib/supabase/server";
import type { Attraction, AttractionCategory, Coordinates } from "@/lib/types";

interface ExtractPlacesRequest {
  prompt: string;
  nearLocation?: Coordinates;
  /** Client-side "Remember my preferences" setting. Absent means off. */
  learnPreferences?: boolean;
  /**
   * Set only by the clarifying-question chips: the walker answered "what kind
   * of walk?" by tapping one, and this re-runs the same prompt with that answer
   * supplied. It replaces what the model read out of the text rather than
   * adding to it — the text said nothing, which is why we asked.
   */
  categoryNeeds?: AttractionCategory[];
}

function toRequestedNeeds(value: unknown): AttractionCategory[] | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }

  const needs = value.filter((category): category is AttractionCategory =>
    (ATTRACTION_CATEGORIES as string[]).includes(category as string),
  );

  return needs.length > 0 ? needs : null;
}

const MAX_PROMPT_LENGTH = 1000;
// Nominatim allows 1 request/sec — geocode the names serially with a margin.
const GEOCODE_DELAY_MS = 1100;

// Same 2 km the City Walk Companion form defaults to, so a stop found for a
// stated need is as reachable as one the open-mode search would have offered.
const NEED_SEARCH_RADIUS_METERS = 2000;
// Only used to bound how far the ranker will look when the walker did not say
// how long they have; matches the form's default walk length and pace.
const FALLBACK_WALK_MINUTES = 90;
const NEED_RANKING_PACE_MIN_PER_KM = 15;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toBias(value: Coordinates | undefined): Coordinates | undefined {
  if (!value) return undefined;
  const { lat, lng } = value;
  if (
    !Number.isFinite(lat) ||
    lat < -90 ||
    lat > 90 ||
    !Number.isFinite(lng) ||
    lng < -180 ||
    lng > 180
  ) {
    return undefined;
  }
  return { lat, lng };
}

/** A located name, plus what Nominatim thinks it is. */
interface GeocodeMatch {
  coordinates: Coordinates;
  kind: string | null;
}

/**
 * Best-effort geocode of a single name. Returns null instead of throwing — one
 * failed lookup shouldn't sink the whole prompt, the name falls through to
 * `unresolvedNames` instead.
 */
async function geocode(
  name: string,
  bias: Coordinates | undefined,
): Promise<GeocodeMatch | null> {
  try {
    const [match] = await searchPlaces(name, 1, bias);
    const lat = Number(match?.lat);
    const lng = Number(match?.lon);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return {
        coordinates: { lat, lng },
        // `addresstype` is the more specific of the two and is what says
        // "city" for a city; `type` is the fallback for older replies.
        kind: match?.addresstype ?? match?.type ?? null,
      };
    }
  } catch {
    // Fall through to null.
  }
  return null;
}

/**
 * Best-effort "what is this place actually called on a map?" lookup, used only
 * once a name has already failed to geocode. Returns null on any failure for the
 * same reason as `geocode`: a name we cannot improve just stays unresolved,
 * rather than turning the whole prompt into a 500.
 */
async function canonicalNameFor(
  name: string,
  contextLocation: string | null,
): Promise<string | null> {
  try {
    const canonical = await resolveCanonicalName(name, contextLocation);
    if (!canonical || canonical.toLowerCase() === name.toLowerCase()) {
      return null;
    }
    return canonical;
  } catch {
    return null;
  }
}

/**
 * Find one real stop for each kind of place the walker asked for without naming
 * one ("I also want to eat something"). Unlike the preference pass this is not
 * about who the walker is — it is a one-off need for THIS walk, so it runs for
 * everyone, signed in or not, and nothing is written anywhere.
 *
 * One Overpass call covers every need: the same POI set is ranked once and the
 * best match per category is taken from it, so three needs still cost one
 * request. Anything that goes wrong — no origin to search around, Overpass down,
 * nothing of that kind nearby — silently contributes no stop, exactly like a
 * name we could not geocode.
 */
async function findNeedAttractions(
  categories: AttractionCategory[],
  origin: Coordinates | undefined,
  durationMinutes: number | null,
): Promise<Attraction[]> {
  if (categories.length === 0 || !origin) {
    return [];
  }

  try {
    const nearby = await fetchAttractions(origin, NEED_SEARCH_RADIUS_METERS);
    const ranked = rankAttractions(nearby, {
      origin,
      preferredCategories: categories,
      availableMinutes: durationMinutes ?? FALLBACK_WALK_MINUTES,
      walkingPaceMinPerKm: NEED_RANKING_PACE_MIN_PER_KM,
    });
    return pickNeedAttractions(ranked, categories);
  } catch {
    return [];
  }
}

/**
 * Third, optional job of this endpoint: notice what the walker likes, not just
 * where they want to go. Runs only for a signed-in walker who has left
 * preference learning on — a logged-out prompt is answered exactly as before,
 * with no session lookup turning into an error and no model call made.
 *
 * Nothing here can fail the request: the walker asked for places, and getting
 * them must not depend on the profile write succeeding.
 */
async function learnPreferences(
  prompt: string,
  enabled: boolean | undefined,
): Promise<void> {
  if (enabled !== true) {
    return;
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return;
    }

    await learnPreferencesFromText(supabase, user.id, prompt);
  } catch {
    // Supabase not configured, no session, or a failed write — all silent.
  }
}

/**
 * The categories to offer when the prompt named a place and nothing else, or
 * null when there is nothing to ask.
 *
 * Read from the walker's saved profile so the question is theirs rather than a
 * generic one: what they have said they like leads, what they have voted down
 * is not asked about at all. Best effort like every other profile read on this
 * path — signed out, unconfigured or a failed read all fall back to the plain
 * list, because a preference-blind question still beats silently guessing a
 * walk, which is what this replaces.
 */
async function clarificationFor(
  underSpecified: boolean,
): Promise<AttractionCategory[] | null> {
  if (!underSpecified) {
    return null;
  }

  let preferred: AttractionCategory[] = [];
  let downvoted: Map<AttractionCategory, number> = new Map();

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      [preferred, downvoted] = await Promise.all([
        getPreferredCategories(supabase, user.id).catch(() => []),
        getDownvotedCategories(supabase, user.id).catch(
          () => new Map<AttractionCategory, number>(),
        ),
      ]);
    }
  } catch {
    // No session, no Supabase, or a failed read — the plain list.
  }

  return suggestClarificationCategories(preferred, downvoted.keys());
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = (await request.json()) as ExtractPlacesRequest;

    const prompt =
      typeof body.prompt === "string" ? body.prompt.trim() : "";

    if (!prompt) {
      return NextResponse.json(
        { error: "prompt is required." },
        { status: 400 },
      );
    }

    if (prompt.length > MAX_PROMPT_LENGTH) {
      return NextResponse.json(
        { error: `prompt must be ${MAX_PROMPT_LENGTH} characters or fewer.` },
        { status: 400 },
      );
    }

    let bias = toBias(body.nearLocation);
    const {
      places,
      contextLocation,
      durationMinutes,
      categoryNeeds,
      stopCount,
      notableOnly,
    } = await extractPlaceNames(prompt);

    // A chip the walker tapped answers the question the text left open, so it
    // stands in for what the model read (nothing) rather than joining it.
    const requestedNeeds = toRequestedNeeds(body.categoryNeeds);
    const effectiveNeeds = requestedNeeds ?? categoryNeeds;

    // Where the user says they want to walk beats where they happen to be
    // standing: geocode the area named in the prompt first, unbiased (it is the
    // anchor, not something to anchor), and search the rest around it. Without
    // a context area — or if it can't be located — the request's own
    // `nearLocation` stays the bias, as before.
    // Every Nominatim lookup in this handler — context area, stop, and the
    // canonical-name retry below — goes through here, so they stay one second
    // apart no matter how many of them a given prompt ends up making.
    let geocodeCalls = 0;
    const spacedGeocode = async (
      name: string,
      searchBias: Coordinates | undefined,
    ): Promise<GeocodeMatch | null> => {
      if (geocodeCalls > 0) {
        await delay(GEOCODE_DELAY_MS);
      }
      geocodeCalls += 1;
      return geocode(name, searchBias);
    };

    // Kept beyond the bias it is used for: it is also the best guess at where the
    // walk starts, so the companion form can fill its origin from it.
    let contextCoordinates: Coordinates | null = null;
    if (contextLocation) {
      const contextMatch = await spacedGeocode(contextLocation, undefined);
      if (contextMatch) {
        contextCoordinates = contextMatch.coordinates;
        bias = contextMatch.coordinates;
      }
    }

    const entries: GeocodedPlaceName[] = [];
    // What Nominatim called the one place, when there is exactly one — the only
    // thing that tells "a walk in Zichron Yaakov" apart from "a walk to Habima
    // Square", both of which arrive as one entry with no context location.
    let solePlaceKind: string | null = null;
    for (const name of places) {
      let match = await spacedGeocode(name, bias);

      // Nothing in the box under the user's wording. OpenStreetMap often tags
      // such a place only under its formal name ("מדרחוב" is mapped as the
      // street "המייסדים"), so ask the model for that name and try once more —
      // once, never in a loop. The stop keeps the user's own wording either way.
      if (!match) {
        const canonical = await canonicalNameFor(name, contextLocation);
        if (canonical) {
          match = await spacedGeocode(canonical, bias);
        }
      }

      if (places.length === 1) {
        solePlaceKind = match?.kind ?? null;
      }

      entries.push({ name, coordinates: match?.coordinates ?? null });
    }

    const { attractions, unresolvedNames } = buildExtractionResult(entries);

    // Searched around the same point the named stops were biased towards: the
    // area the walker asked about if we could locate it, otherwise where they
    // are standing.
    const needAttractions = await findNeedAttractions(
      effectiveNeeds,
      // One place and no context area means that place IS where the walk is —
      // "a walk in Zichron Yaakov" with a chip tapped has to look for food in
      // Zichron Yaakov, not around whatever GPS fix the browser handed us.
      // With several places, or an area named separately, the bias already
      // points at the right neighbourhood.
      (places.length === 1 && !contextLocation
        ? entries[0]?.coordinates
        : undefined) ?? bias,
      durationMinutes,
    );

    await learnPreferences(prompt, body.learnPreferences);

    const promptShape = {
      places,
      contextLocation: contextLocation ?? null,
      placeKind: solePlaceKind,
    };
    const clarificationCategories = await clarificationFor(
      isUnderSpecifiedPrompt({ ...promptShape, categoryNeeds: effectiveNeeds }),
    );

    return NextResponse.json({
      extractedNames: places,
      attractions: [...attractions, ...needAttractions],
      unresolvedNames,
      contextLocation: contextLocation ?? null,
      contextCoordinates,
      durationMinutes: durationMinutes ?? null,
      // Both ride through to the walk-plan request untouched: this endpoint
      // finds named places, and "three of them" / "famous ones" are answers
      // about a walk it does not build.
      stopCount: stopCount ?? null,
      notableOnly: notableOnly ?? null,
      // Reported so a need that found nothing is still visible when debugging —
      // no UI reads this yet.
      categoryNeeds: effectiveNeeds,
      // The walker named a place and nothing else. The walk is still built and
      // returned — this only offers to make it a walk about something.
      needsClarification: clarificationCategories !== null,
      clarificationCategories: clarificationCategories ?? [],
      // Still true once they have answered: a kind of walk is not a stop, so
      // there is no named list here and leftover time really is an invitation
      // to discover more. The panel reads this to pre-tick its fill toggle.
      areaOnlyPrompt: isAreaOnlyPrompt(promptShape),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to extract places.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
