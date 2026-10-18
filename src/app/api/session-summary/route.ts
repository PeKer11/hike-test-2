import { NextResponse } from "next/server";

import { callerKey, learningRateLimiter, rateLimitedResponse } from "@/lib/api/rate-limit";
import { runLlm } from "@/lib/llm/llm-client";
import { cleanOsmPoiKeys, whitelistWalkEnd } from "@/lib/llm/walk-end-whitelist";
import { PLANNER_PROMPT_ID } from "@/lib/llm/prompts/planner-v1";
import {
  buildSessionSummaryTask,
  EMPTY_SESSION_SUMMARY,
} from "@/lib/llm/tasks/session-summary";
import { createClient } from "@/lib/supabase/server";

interface SessionSummaryRequest {
  learnPreferences?: unknown;
  routine?: unknown;
  uiLang?: unknown;
  walkEnd?: unknown;
  poiKeys?: unknown;
}

/**
 * End-of-walk memory note. Consent-gated: without `learnPreferences === true`
 * nothing is sent to a model and nothing is stored. Any failure is a quiet
 * `{ saved: false }`: a finished walk never shows an error for a memory write.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const verdict = learningRateLimiter.check(callerKey(request));
  if (!verdict.allowed) {
    return rateLimitedResponse(verdict);
  }

  let body: SessionSummaryRequest;
  try {
    body = (await request.json()) as SessionSummaryRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (body.learnPreferences !== true) return NextResponse.json({ saved: false });

  const walkEnd = body.walkEnd;
  if (typeof walkEnd !== "object" || walkEnd === null || Array.isArray(walkEnd)) {
    return NextResponse.json({ error: "walkEnd is required." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ saved: false });

  // Only the app's own OSM place ids may reach the model: `name@lat,lng` keys carry a name and coordinates.
  const poiKeys = cleanOsmPoiKeys(body.poiKeys);

  try {
    const { data } = await runLlm(
      buildSessionSummaryTask({
        walkEnd: whitelistWalkEnd(walkEnd as Record<string, unknown>),
        uiLang: body.uiLang === "he" ? "he" : "en",
        consent: { learn: true, routine: body.routine === true },
        poiKeys,
      }),
      { userId: user.id, ip: callerKey(request), plan: "free" },
    );
    // Nothing learned, or an injection attempt: store nothing.
    if (JSON.stringify(data) === JSON.stringify(EMPTY_SESSION_SUMMARY) || data.injectionDetected) {
      return NextResponse.json({ saved: false });
    }
    const { error } = await supabase
      .from("session_summaries")
      .insert({ user_id: user.id, prompt_id: PLANNER_PROMPT_ID, summary: data });
    return NextResponse.json({ saved: !error });
  } catch {
    return NextResponse.json({ saved: false });
  }
}

/** Forget every stored summary. */
export async function DELETE(): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse(null, { status: 204 });
  const { error } = await supabase.from("session_summaries").delete().eq("user_id", user.id);
  if (error) {
    return NextResponse.json({ error: "Could not clear the summaries." }, { status: 500 });
  }
  return new NextResponse(null, { status: 204 });
}
