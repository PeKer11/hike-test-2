import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/** Everything Traike has learned about a walker. Each table has an own-row delete policy. */
export const MEMORY_TABLES = [
  "session_summaries",
  "walk_summaries",
  "place_interactions",
  "standing_facts",
  "category_preferences",
  "prompt_exchanges",
  "routine_habits",
  // Social opt-in (S1/S2): deleting the row also stops the walker's votes counting.
  "community_optin",
  // The walker's own thumbs up/down rows (the aggregate views only count rows that exist).
  "attraction_feedback",
] as const;

/**
 * Learned columns on `profiles`, reset to their column defaults. `callout_level`
 * and `ui_language` are settings the walker chose, not things learned, so they stay.
 */
export const PROFILE_LEARNED_RESET = {
  walking_pace_min_per_km: null,
  preferred_categories: [],
  typical_visit_minutes: null,
  group_preference: null,
  pace_by_env: {},
  typical_walk_minutes: null,
  companion_prefs: {},
  session_count: 0,
} as const;

/** "Forget everything": deletes the signed-in walker's learned data. */
export async function DELETE(): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse(null, { status: 204 });

  const failed: string[] = [];
  for (const table of MEMORY_TABLES) {
    const { error } = await supabase.from(table).delete().eq("user_id", user.id);
    if (error) failed.push(table);
  }
  const { error: profileError } = await supabase
    .from("profiles")
    .update(PROFILE_LEARNED_RESET)
    .eq("id", user.id);
  if (profileError) failed.push("profiles");
  if (failed.length > 0) {
    return NextResponse.json({ error: "Could not clear everything.", failed }, { status: 500 });
  }
  return new NextResponse(null, { status: 204 });
}
