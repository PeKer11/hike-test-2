import { NextResponse } from "next/server";

import { assistantRateLimiter, callerKey, rateLimitedResponse } from "@/lib/api/rate-limit";
import { AiBuildRefusedError, runAiBuild, type AiBuildRequest } from "@/lib/ai-builder/run";
import { runMeteredTurn } from "@/lib/llm/llm-client";
import { LlmBudgetExceededError } from "@/lib/llm/types";
import { createClient } from "@/lib/supabase/server";
import type { Attraction } from "@/lib/types";

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const positive = (v: unknown) => (finite(v) && v > 0 && v < 100_000 ? v : undefined);
const strings = (v: unknown, max: number) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, max) : []);

/** The AI decides which stops a walk has and in what order; the planner then only measures it. */
export async function POST(request: Request): Promise<NextResponse> {
  const verdict = assistantRateLimiter.check(callerKey(request));
  if (!verdict.allowed) return rateLimitedResponse(verdict);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to build walks with the AI.", code: "signin" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const o = body.origin as { lat?: unknown; lng?: unknown } | undefined;
  if (!o || !finite(o.lat) || !finite(o.lng)) return NextResponse.json({ error: "origin required" }, { status: 400 });

  const keep = (Array.isArray(body.keep) ? (body.keep as Attraction[]) : [])
    .filter((a) => a && typeof a.id === "string" && typeof a.name === "string" && finite(a.coordinates?.lat) && finite(a.coordinates?.lng))
    .slice(0, 20);
  const rules = (body.routeRules ?? {}) as { noRepeat?: unknown; avoidStreets?: unknown; avoidDangerous?: unknown };
  const aiRequest: AiBuildRequest = {
    origin: { lat: o.lat, lng: o.lng },
    reason: typeof body.reason === "string" ? body.reason.slice(0, 400) : "a new walk",
    params: {
      timeMinutes: positive(body.availableMinutes),
      radiusKm: positive(body.radiusMeters) ? positive(body.radiusMeters)! / 1000 : undefined,
      endDistanceKm: finite(body.maxEndDistanceMeters) && body.maxEndDistanceMeters >= 0 ? body.maxEndDistanceMeters / 1000 : undefined,
      paceMinPerKm: positive(body.walkingPaceMinPerKm),
      noRepeat: rules.noRepeat === true ? true : undefined,
      avoidStreets: strings(rules.avoidStreets, 10).length ? strings(rules.avoidStreets, 10) : undefined,
      avoidDangerous: rules.avoidDangerous === true ? true : undefined,
    },
    keep,
    pinnedIds: strings(body.pinnedIds, 20),
    visitedIds: strings(body.visitedIds, 40),
    preferredCategories: strings(body.preferredCategories, 10),
    stopCount: positive(body.stopCount),
    notableOnly: body.notableOnly === true,
    heading: finite(body.heading) ? body.heading : undefined,
    fillRemainingTime: body.fillRemainingTime === true,
  };

  try {
    const result = await runMeteredTurn({ userId: user.id, ip: callerKey(request) }, 3, async (choice, effort) => {
      const built = await runAiBuild(aiRequest, choice, effort);
      return { value: built, billedMicros: built.billedMicros };
    });
    return NextResponse.json({ stops: result.stops, ordered: result.ordered, geometry: result.geometry ?? null, summary: result.summary });
  } catch (error) {
    if (error instanceof LlmBudgetExceededError) {
      return NextResponse.json({ code: "budget", error: "The AI builder is resting for today. Try again tomorrow." }, { status: 429 });
    }
    if (error instanceof AiBuildRefusedError) {
      return NextResponse.json({ code: "refused", error: "No walk fits those rules and limits. Loosen one of them, or move the start point." }, { status: 422 });
    }
    console.error("[ai-walk-plan] failed:", error);
    return NextResponse.json({ error: "The AI could not build a walk that fits. Try again." }, { status: 502 });
  }
}
