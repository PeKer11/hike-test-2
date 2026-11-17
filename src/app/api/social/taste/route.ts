import { NextResponse } from "next/server";

import { callerKey, learningRateLimiter, rateLimitedResponse } from "@/lib/api/rate-limit";
import { runLlm } from "@/lib/llm/llm-client";
import { TASTE_PROMPT_ID } from "@/lib/llm/prompts/taste-v1";
import { buildTasteSummaryTask, tasteCooldown, TASTE_MIN_WALKS, type TasteWalk } from "@/lib/llm/tasks/taste-summary";
import { LlmBudgetExceededError } from "@/lib/llm/types";
import { hasLearningConsent } from "@/lib/preferences/consent";
import { tasteEnabled } from "@/lib/social/flag";
import { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

interface StoredSummary {
  summary: { bullets?: unknown; tags?: unknown; areas?: unknown };
  tags: string[];
  based_on_walks: number;
  created_at: string;
}

const view = (row: StoredSummary, nextAvailableAtMs: number | null) => ({
  summary: {
    bullets: Array.isArray(row.summary.bullets) ? row.summary.bullets.filter((b): b is string => typeof b === "string").slice(0, 3) : [],
    tags: row.tags,
    areas: Array.isArray(row.summary.areas) ? row.summary.areas.filter((a): a is string => typeof a === "string").slice(0, 3) : [],
  },
  createdAt: row.created_at,
  basedOnWalks: row.based_on_walks,
  nextAvailableAt: nextAvailableAtMs === null ? null : new Date(nextAvailableAtMs).toISOString(),
});

async function latest(supabase: Supabase, userId: string): Promise<{ row: StoredSummary | null; available: boolean }> {
  const { data, error } = await supabase.from("taste_summaries").select("summary, tags, based_on_walks, created_at").eq("user_id", userId).maybeSingle();
  if (error) // Table missing (migration E not applied) or any failure: unavailable, no model call.
  return { row: null, available: false };
  return { row: (data as StoredSummary | null) ?? null, available: true };
}

async function completedWalks(supabase: Supabase, userId: string): Promise<TasteWalk[]> {
  const columns = "area_label, distance_m, total_min, stops";
  const q = (hidden: boolean) => {
    let b = supabase.from("saved_walks").select(columns).eq("user_id", userId).eq("status", "completed");
    if (hidden) b = b.eq("hidden_from_profile", false);
    return b.order("completed_at", { ascending: false }).limit(30);
  };
  let { data, error } = await q(true);
  // Before migration A there is no hidden column: the summary is private anyway.
  if (error) ({ data, error } = await q(false));
  if (error || !Array.isArray(data)) return [];
  return data.map((w) => ({
    areaLabel: typeof w.area_label === "string" ? w.area_label : null,
    distanceM: typeof w.distance_m === "number" ? w.distance_m : null,
    totalMin: typeof w.total_min === "number" ? w.total_min : null,
    stops: Array.isArray(w.stops)
      ? w.stops.flatMap((s: Record<string, unknown>) =>
          s && typeof s === "object" && typeof s.category === "string"
            ? [{ category: s.category, name: typeof s.name === "string" ? s.name : null, source: typeof s.source === "string" ? s.source : null, placeId: typeof s.placeId === "string" ? s.placeId : null }]
            : [],
        )
      : [],
  }));
}

async function newWalksSince(supabase: Supabase, userId: string, sinceIso: string): Promise<number> {
  const { count } = await supabase.from("saved_walks").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "completed").gt("completed_at", sinceIso);
  return count ?? 0;
}

/** The cached summary (no model call). */
export async function GET(): Promise<NextResponse> {
  if (!tasteEnabled()) return new NextResponse(null, { status: 404 });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ available: false, summary: null }, { status: 401 });
  const { row, available } = await latest(supabase, user.id);
  if (!available) return NextResponse.json({ available: false, summary: null });
  if (!row) return NextResponse.json({ available: true, summary: null });
  const cool = tasteCooldown({ lastCreatedAtMs: Date.parse(row.created_at), newWalksSince: await newWalksSince(supabase, user.id, row.created_at), nowMs: Date.now() });
  return NextResponse.json({ available: true, ...view(row, cool.nextAvailableAtMs) });
}

/**
 * Make (or refresh) the summary. Opt-in and consent-gated: without server-side learning consent nothing is read and no
 * model is called. At most one model call per walker per 7 days (or after 3 new finished walks); inside the window the
 * cached summary comes back. Every call is metered by the shared budget guard.
 */
export async function POST(request: Request): Promise<NextResponse> {
  if (!tasteEnabled()) return new NextResponse(null, { status: 404 });
  const verdict = learningRateLimiter.check(callerKey(request));
  if (!verdict.allowed) return rateLimitedResponse(verdict);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!(await hasLearningConsent(supabase, user.id))) return NextResponse.json({ error: "consent" }, { status: 403 });

  const body = (await request.json().catch(() => null)) as { lang?: unknown } | null;
  const { row, available } = await latest(supabase, user.id);
  // Migration E is not applied: say so before spending anything.
  if (!available) return NextResponse.json({ available: false, summary: null });

  const now = Date.now();
  if (row) {
    const cool = tasteCooldown({ lastCreatedAtMs: Date.parse(row.created_at), newWalksSince: await newWalksSince(supabase, user.id, row.created_at), nowMs: now });
    if (!cool.allowed) return NextResponse.json({ available: true, cooldown: true, ...view(row, cool.nextAvailableAtMs) });
  }

  const walks = await completedWalks(supabase, user.id);
  if (walks.length < TASTE_MIN_WALKS) return NextResponse.json({ error: "not_enough_walks", needed: TASTE_MIN_WALKS }, { status: 409 });

  try {
    const { data, model } = await runLlm(buildTasteSummaryTask({ walks, uiLang: body?.lang === "he" ? "he" : "en" }), {
      userId: user.id,
      ip: callerKey(request),
      plan: "free",
    });
    // An injection attempt or nothing worth saying: store nothing new.
    if (data.injectionDetected || (data.bullets.length === 0 && data.tags.length === 0)) {
      return NextResponse.json({ available: true, summary: row ? view(row, null).summary : null, empty: true });
    }
    const createdAt = new Date(now).toISOString();
    const { error } = await supabase.from("taste_summaries").upsert(
      {
        user_id: user.id,
        summary: { schemaVersion: 1, bullets: data.bullets, areas: data.areas },
        tags: data.tags,
        based_on_walks: walks.length,
        model: model.slice(0, 80),
        prompt_id: TASTE_PROMPT_ID,
        created_at: createdAt,
      },
      { onConflict: "user_id" },
    );
    if (error) return NextResponse.json({ error: "save" }, { status: 502 });
    return NextResponse.json({
      available: true,
      ...view({ summary: { bullets: data.bullets, areas: data.areas }, tags: data.tags, based_on_walks: walks.length, created_at: createdAt }, now + 7 * 24 * 3600_000),
    });
  } catch (e) {
    if (e instanceof LlmBudgetExceededError) return NextResponse.json({ error: "resting" }, { status: 429 });
    return NextResponse.json({ error: "unavailable" }, { status: 502 });
  }
}

/** Delete my summary. */
export async function DELETE(): Promise<NextResponse> {
  if (!tasteEnabled()) return new NextResponse(null, { status: 404 });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse(null, { status: 204 });
  await supabase.from("taste_summaries").delete().eq("user_id", user.id);
  return new NextResponse(null, { status: 204 });
}
