import { NextResponse } from "next/server";

import { categoryOfGooglePlace, getPlaceById } from "@/lib/api/google-places-client";
import { createPlacesGate, placesDailyCap } from "@/lib/api/places-quota";
import { placesResolveRateLimiter, rateLimitedResponse } from "@/lib/api/rate-limit";
import { createClient } from "@/lib/supabase/server";

const MAX_IDS = 10;

/** Saved Google places keep only their id; this looks them up again for a walk (signed-in only, nothing is stored). */
export async function POST(request: Request): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const verdict = placesResolveRateLimiter.check(`user:${user.id}`);
  if (!verdict.allowed) return rateLimitedResponse(verdict);
  const body = (await request.json().catch(() => null)) as { ids?: unknown } | null;
  const ids = Array.isArray(body?.ids)
    ? [...new Set(body.ids.filter((i): i is string => typeof i === "string" && i.length > 0 && i.length <= 300))].slice(0, MAX_IDS)
    : [];
  if (ids.length === 0) return NextResponse.json({ error: "No places." }, { status: 400 });
  const owners = (process.env.LLM_OWNER_USER_IDS ?? "").split(",").map((s) => s.trim());
  const gate = createPlacesGate({ key: `places:user:${user.id}`, dailyCap: placesDailyCap("free", owners.includes(user.id)), perTurnCap: MAX_IDS });
  if (!(await gate.take(ids.length))) return NextResponse.json({ error: "Place lookup limit reached for today." }, { status: 429 });
  try {
    const found = await Promise.all(ids.map((id) => getPlaceById(id)));
    const places = found
      .filter((p) => p !== null)
      .map((p) => ({ placeId: p.placeId, name: p.name, coordinates: p.coordinates, category: categoryOfGooglePlace(p) }));
    return NextResponse.json({ places });
  } catch {
    return NextResponse.json({ error: "Couldn't look those places up." }, { status: 502 });
  }
}
