import { NextResponse } from "next/server";

import { learnFactsFromText } from "@/lib/preferences/fact-store";
import { ATTRACTION_CATEGORIES } from "@/lib/preferences/preference-extractor";
import type { AttractionCategory } from "@/lib/types";
import {
  deriveCategorySignals,
  learnPreferencesFromText,
  saveAttractionFeedback,
  saveWalkFeedback,
  type AttractionRating,
} from "@/lib/preferences/preference-store";
import { createClient } from "@/lib/supabase/server";

interface WalkFeedbackRatingInput {
  /** `Attraction.id` — an Overpass id only for stops that came from Overpass. */
  id?: unknown;
  name?: unknown;
  lat?: unknown;
  lng?: unknown;
  category?: unknown;
  liked?: unknown;
}

interface WalkFeedbackRequest {
  /** One entry per stop the walker actually rated. Unrated stops are absent. */
  ratings?: WalkFeedbackRatingInput[];
  /** Optional free text: "anything else about this walk?" */
  comment?: string;
  /** Client-side "Remember my preferences" setting. Absent means off. */
  learnPreferences?: boolean;
}

const MAX_COMMENT_LENGTH = 1000;
const MAX_POI_NAME_LENGTH = 200;

/**
 * The id shape `overpass-client` builds for a real Overpass element. Anything
 * else — a stop the walker named in the prompt box, geocoded rather than
 * discovered — has no OSM identity, so `osm_id` stays null and the row is
 * recognised later by name and coordinates alone.
 */
const OSM_ID_PATTERN = /^osm-(node|way|relation)-\d+$/;

function toOsmId(id: unknown): string | null {
  return typeof id === "string" && OSM_ID_PATTERN.test(id) ? id : null;
}

/**
 * Keep only ratings that can become a POI-level row: the table's check
 * constraint wants a name and both coordinates, and the category column is an
 * enum. `other` survives here (unlike in the category-level pass) because a
 * POI-level row about one unclassified stop is a fact about that stop, not a
 * standing instruction to the planner.
 */
function toRatings(value: unknown): AttractionRating[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const ratings: AttractionRating[] = [];
  for (const item of value as WalkFeedbackRatingInput[]) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const name = typeof item.name === "string" ? item.name.trim() : "";
    const { lat, lng, category, liked } = item;

    if (
      !name ||
      typeof lat !== "number" ||
      !Number.isFinite(lat) ||
      typeof lng !== "number" ||
      !Number.isFinite(lng) ||
      typeof category !== "string" ||
      !(ATTRACTION_CATEGORIES as string[]).includes(category) ||
      typeof liked !== "boolean"
    ) {
      continue;
    }

    ratings.push({
      osmId: toOsmId(item.id),
      name: name.slice(0, MAX_POI_NAME_LENGTH),
      lat,
      lng,
      category: category as AttractionCategory,
      signal: liked ? "upvote" : "downvote",
    });
  }

  return ratings;
}

/**
 * Post-walk feedback. Each rated stop writes a POI-level `attraction_feedback`
 * row (the audit trail of what the walker thought of that exact place) and
 * moves its category's standing signal, which is the half the ranker reads.
 * Free-text elaboration still folds into `profiles.preferred_categories`
 * through the same pass the prompt box uses.
 *
 * Answers 200 with `saved: false` when there is nothing to write — no session,
 * or preference learning turned off. The UI treats that as "thanks anyway", so
 * a logged-out walker is never shown an error for a question they were never
 * required to answer.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = (await request.json()) as WalkFeedbackRequest;

    const ratings = toRatings(body.ratings);
    const comment =
      typeof body.comment === "string"
        ? body.comment.trim().slice(0, MAX_COMMENT_LENGTH)
        : "";

    if (ratings.length === 0 && !comment) {
      return NextResponse.json(
        { error: "ratings must contain at least one rated stop." },
        { status: 400 },
      );
    }

    if (body.learnPreferences !== true) {
      return NextResponse.json({ saved: false });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ saved: false });
    }

    const poisRecorded = await saveAttractionFeedback(
      supabase,
      user.id,
      ratings,
    );

    // Liking one stop has to raise its whole category, or the ranker — which
    // only reads category-level rows — learns nothing from the walk.
    const { upvoted, downvoted } = deriveCategorySignals(ratings);
    const categoriesRecorded = [
      ...(await saveWalkFeedback(supabase, user.id, "upvote", upvoted)),
      ...(await saveWalkFeedback(supabase, user.id, "downvote", downvoted)),
    ];

    // Both passes over the same comment box, exactly as the prompt route runs
    // them: what the walker likes, and what is true about them.
    const [learned, learnedFacts] = comment
      ? await Promise.all([
          learnPreferencesFromText(supabase, user.id, comment).catch(() => null),
          learnFactsFromText(supabase, user.id, comment).catch(() => null),
        ])
      : [null, null];

    return NextResponse.json({
      saved: true,
      poisRecorded,
      categoriesRecorded,
      preferredCategories: learned,
      factContradictions: learnedFacts?.contradictions ?? [],
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save feedback.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
