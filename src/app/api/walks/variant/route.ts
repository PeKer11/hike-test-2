import { NextResponse } from "next/server";

import { callerKey, rateLimitedResponse, walkPlanRateLimiter } from "@/lib/api/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { encodePolyline } from "@/lib/walks/polyline";
import { getWalkById, insertWalk } from "@/lib/walks/saved-walks";
import { orsRouteFn } from "@/lib/walks/variant-route";
import { makeVariant, type VariantRequest } from "@/lib/walks/variants";

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Parse the body into a deterministic variant request; null when it is not one (AI kinds go through the assistant). */
function parse(body: Record<string, unknown>): VariantRequest | null {
  switch (body.kind) {
    case "reverse":
      return { kind: "reverse" };
    case "start_here":
    case "start_at": {
      const at = body.at as { lat?: unknown; lng?: unknown } | undefined;
      const lat = num(at?.lat);
      const lng = num(at?.lng);
      return lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { kind: body.kind, at: { lat, lng } } : null;
    }
    case "skip_stop":
      return typeof body.stopName === "string" && body.stopName.trim() && body.stopName.length <= 120 ? { kind: "skip_stop", stopName: body.stopName } : null;
    case "shorter": {
      const minutes = num(body.minutes);
      return minutes !== null && minutes >= 10 && minutes <= 600 ? { kind: "shorter", minutes } : null;
    }
    default:
      return null;
  }
}

/**
 * A variant of a saved walk (reversed, from here, without a stop, shorter) saved as a NEW walk that points
 * at the original. Only signed-in walkers; the original must be readable by them (own, or a friend's shared
 * walk); the original row is never written.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const verdict = walkPlanRateLimiter.check(callerKey(request));
  if (!verdict.allowed) return rateLimitedResponse(verdict);

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return NextResponse.json({ error: "Sign in to make a variant." }, { status: 401 });
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to make a variant." }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const req = parse(body);
  if (!req || typeof body.walkId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.walkId)) {
    return NextResponse.json({ error: "Invalid variant request." }, { status: 400 });
  }

  const walk = await getWalkById(supabase, body.walkId);
  if (!walk) return NextResponse.json({ error: "Walk not found." }, { status: 404 });

  const outcome = await makeVariant(walk, req, orsRouteFn);
  if (!outcome.ok) return NextResponse.json({ error: outcome.error, needsAi: outcome.needsAi === true }, { status: 422 });

  const { ascentM, ...draft } = outcome.draft;
  const id = await insertWalk(supabase, user.id, draft);
  if (!id) return NextResponse.json({ error: "Could not save the variant." }, { status: 500 });
  const saved = {
    id,
    title: draft.title,
    status: "planned",
    areaLabel: draft.areaLabel ?? null,
    start: draft.start,
    totalMin: draft.totalMin ?? null,
    distanceM: draft.distanceM ?? null,
    stops: draft.stops,
    params: draft.params ?? {},
    visibility: "private",
    createdAt: new Date().toISOString(),
    completedAt: null,
    end: draft.end,
    isLoop: draft.isLoop,
    parentWalkId: draft.parentWalkId,
    variantKind: draft.variantKind,
    // Encoded, like the database stores it; the client decodes it.
    geometryEncoded: encodePolyline(draft.geometry),
  };
  return NextResponse.json({ id, title: draft.title, totalMin: draft.totalMin, distanceM: draft.distanceM, ascentM, kind: draft.variantKind, walk: saved });
}
