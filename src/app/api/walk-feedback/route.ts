import { NextResponse } from "next/server";

import { ATTRACTION_CATEGORIES } from "@/lib/preferences/preference-extractor";
import type { AttractionCategory } from "@/lib/types";
import {
  learnPreferencesFromText,
  saveWalkFeedback,
} from "@/lib/preferences/preference-store";
import { createClient } from "@/lib/supabase/server";

interface WalkFeedbackRequest {
  liked: boolean;
  /** Optional free text: "what did you like / not like?" */
  comment?: string;
  /** Categories the finished walk was actually made of. */
  categories?: string[];
  /** Client-side "Remember my preferences" setting. Absent means off. */
  learnPreferences?: boolean;
}

const MAX_COMMENT_LENGTH = 1000;

/**
 * Keep only real categories, deduplicated. `other` is dropped: every
 * unclassified POI lands in it, so a standing signal on it would tell the
 * planner to favour (or avoid) anything at all.
 */
function toCategories(value: unknown): AttractionCategory[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<AttractionCategory>();
  for (const item of value) {
    if (
      typeof item === "string" &&
      item !== "other" &&
      (ATTRACTION_CATEGORIES as string[]).includes(item)
    ) {
      seen.add(item as AttractionCategory);
    }
  }

  return [...seen];
}

/**
 * Post-walk feedback. Writes a category-level `attraction_feedback` row per
 * category the walk contained, and folds any free-text elaboration into
 * `profiles.preferred_categories` through the same pass the prompt box uses.
 *
 * Answers 200 with `saved: false` when there is nothing to write — no session,
 * or preference learning turned off. The UI treats that as "thanks anyway", so
 * a logged-out walker is never shown an error for a question they were never
 * required to answer.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = (await request.json()) as WalkFeedbackRequest;

    if (typeof body.liked !== "boolean") {
      return NextResponse.json(
        { error: "liked must be a boolean." },
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

    const categories = toCategories(body.categories);
    const recorded = await saveWalkFeedback(
      supabase,
      user.id,
      body.liked ? "upvote" : "downvote",
      categories,
    );

    const comment =
      typeof body.comment === "string"
        ? body.comment.trim().slice(0, MAX_COMMENT_LENGTH)
        : "";

    const learned = comment
      ? await learnPreferencesFromText(supabase, user.id, comment)
      : null;

    return NextResponse.json({
      saved: true,
      categoriesRecorded: recorded,
      preferredCategories: learned,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save feedback.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
