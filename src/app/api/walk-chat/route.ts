import { NextResponse } from "next/server";

import { callerKey, chatRateLimiter, rateLimitedResponse } from "@/lib/api/rate-limit";
import { runLlm } from "@/lib/llm/llm-client";
import {
  buildWalkIntentTask,
  MAX_CHAT_STOP_NAME_CHARS,
  MAX_CHAT_STOPS,
  MAX_CHAT_TEXT_CHARS,
} from "@/lib/llm/tasks/walk-intent";
import { LlmBudgetExceededError } from "@/lib/llm/types";
import { createClient } from "@/lib/supabase/server";

const UNKNOWN = { intent: "unknown", amenity: null, stopIndex: null } as const;

interface WalkChatRequest {
  text?: unknown;
  stops?: unknown;
  lang?: unknown;
}

/**
 * Free-form fallback for the in-walk text box: sorts one typed sentence into an
 * intent. The body carries no coordinates and the route reads no stored facts,
 * habits or names. Only a signed-in walker reaches the model; the app writes
 * every reply itself from the intent.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const verdict = chatRateLimiter.check(callerKey(request));
  if (!verdict.allowed) return rateLimitedResponse(verdict);

  let body: WalkChatRequest;
  try {
    body = (await request.json()) as WalkChatRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (text.length < 1 || text.length > MAX_CHAT_TEXT_CHARS) {
    return NextResponse.json({ error: "text must be 1-200 characters." }, { status: 400 });
  }
  const stops = body.stops ?? [];
  if (
    !Array.isArray(stops) ||
    stops.length > MAX_CHAT_STOPS ||
    stops.some((s) => typeof s !== "string" || s.length > MAX_CHAT_STOP_NAME_CHARS)
  ) {
    return NextResponse.json({ error: "stops must be up to 12 names." }, { status: 400 });
  }
  if (body.lang !== "en" && body.lang !== "he") {
    return NextResponse.json({ error: "lang must be en or he." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to ask free-form questions.", code: "signin" }, { status: 401 });
  }

  try {
    const { data } = await runLlm(
      buildWalkIntentTask({ text, stopNames: stops as string[], uiLang: body.lang }),
      { userId: user.id, ip: callerKey(request) },
    );
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof LlmBudgetExceededError) {
      return NextResponse.json(
        { code: "budget", error: "The AI helper is resting for today. Quick commands still work." },
        { status: 429 },
      );
    }
    return NextResponse.json(UNKNOWN);
  }
}
