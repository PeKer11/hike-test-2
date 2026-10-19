import { NextResponse } from "next/server";

import { callerKey, chatRateLimiter, rateLimitedResponse } from "@/lib/api/rate-limit";
import { runWalkTurn } from "@/lib/assistant/walk-turn";
import { runMeteredTurn } from "@/lib/llm/llm-client";
import { LlmBudgetExceededError } from "@/lib/llm/types";
import { createClient } from "@/lib/supabase/server";

/**
 * Free-form in-walk chat answered by the model with tools (find_places, tap
 * proposals). For now only the accounts in LLM_OWNER_USER_IDS; everyone else
 * gets `code: "notowner"` and the client uses the keyword chat instead.
 * TODO: a paid tier that opens this to more walkers.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const verdict = chatRateLimiter.check(callerKey(request));
  if (!verdict.allowed) return rateLimitedResponse(verdict);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const pos = body.position as { lat?: unknown; lng?: unknown } | undefined;
  if (typeof pos?.lat !== "number" || typeof pos?.lng !== "number" || !Array.isArray(body.history) || body.history.length === 0) {
    return NextResponse.json({ error: "position and history required." }, { status: 400 });
  }
  const history = (body.history as Array<{ role?: unknown; content?: unknown }>)
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-8)
    .map((m) => ({ role: m.role as "user" | "assistant", content: (m.content as string).slice(0, 400) }));
  const stops = Array.isArray(body.stops)
    ? body.stops.filter((s): s is string => typeof s === "string").map((s) => s.slice(0, 80)).slice(0, 12)
    : [];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in.", code: "signin" }, { status: 401 });
  const owners = (process.env.LLM_OWNER_USER_IDS ?? "").split(",").map((s) => s.trim());
  if (!owners.includes(user.id)) return NextResponse.json({ code: "notowner" }, { status: 403 });

  try {
    const result = await runMeteredTurn({ userId: user.id, ip: callerKey(request) }, 3, async (choice, effort) => {
      const turn = await runWalkTurn({ history, position: { lat: pos.lat as number, lng: pos.lng as number }, stops, choice, effort });
      return { value: turn, billedMicros: turn.billedMicros };
    });
    return NextResponse.json({ reply: result.reply, actions: result.actions });
  } catch (error) {
    if (error instanceof LlmBudgetExceededError) {
      return NextResponse.json({ code: "budget", error: "resting" }, { status: 429 });
    }
    return NextResponse.json({ error: "failed" }, { status: 502 });
  }
}
