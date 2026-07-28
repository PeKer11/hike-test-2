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
  pickNeedAttractions,
  type GeocodedPlaceName,
} from "@/lib/places/place-extractor";
import { learnPreferencesFromText } from "@/lib/preferences/preference-store";
import { createClient } from "@/lib/supabase/server";
import type { Attraction, AttractionCategory, Coordinates } from "@/lib/types";

interface ExtractPlacesRequest {
  prompt: string;
  nearLocation?: Coordinates;
  /** Client-side "Remember my preferences" setting. Absent means off. */
  learnPreferences?: boolean;
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

/**
 * Best-effort geocode of a single name. Returns null instead of throwing — one
 * failed lookup shouldn't sink the whole prompt, the name falls through to
 * `unresolvedNames` instead.
 */
async function geocode(
  name: string,
  bias: Coordinates | undefined,
): Promise<Coordinates | null> {
  try {
    const [match] = await searchPlaces(name, 1, bias);
    const lat = Number(match?.lat);
    const lng = Number(match?.lon);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lng };
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
    const { places, contextLocation, durationMinutes, categoryNeeds } =
      await extractPlaceNames(prompt);

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
    ): Promise<Coordinates | null> => {
      if (geocodeCalls > 0) {
        await delay(GEOCODE_DELAY_MS);
      }
      geocodeCalls += 1;
      return geocode(name, searchBias);
    };

    if (contextLocation) {
      const contextCoordinates = await spacedGeocode(contextLocation, undefined);
      if (contextCoordinates) {
        bias = contextCoordinates;
      }
    }

    const entries: GeocodedPlaceName[] = [];
    for (const name of places) {
      let coordinates = await spacedGeocode(name, bias);

      // Nothing in the box under the user's wording. OpenStreetMap often tags
      // such a place only under its formal name ("מדרחוב" is mapped as the
      // street "המייסדים"), so ask the model for that name and try once more —
      // once, never in a loop. The stop keeps the user's own wording either way.
      if (!coordinates) {
        const canonical = await canonicalNameFor(name, contextLocation);
        if (canonical) {
          coordinates = await spacedGeocode(canonical, bias);
        }
      }

      entries.push({ name, coordinates });
    }

    const { attractions, unresolvedNames } = buildExtractionResult(entries);

    // Searched around the same point the named stops were biased towards: the
    // area the walker asked about if we could locate it, otherwise where they
    // are standing.
    const needAttractions = await findNeedAttractions(
      categoryNeeds,
      bias,
      durationMinutes,
    );

    await learnPreferences(prompt, body.learnPreferences);

    return NextResponse.json({
      extractedNames: places,
      attractions: [...attractions, ...needAttractions],
      unresolvedNames,
      contextLocation: contextLocation ?? null,
      durationMinutes: durationMinutes ?? null,
      // Reported so a need that found nothing is still visible when debugging —
      // no UI reads this yet.
      categoryNeeds,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to extract places.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
