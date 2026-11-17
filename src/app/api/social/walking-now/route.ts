import { NextResponse } from "next/server";

import { rateLimitedResponse, walkingNowRateLimiter } from "@/lib/api/rate-limit";
import { presenceEnabled } from "@/lib/social/flag";
import { sanitizeWalkingNow } from "@/lib/social/presence";
import { createClient } from "@/lib/supabase/server";

/** Who is walking now (friends). Returns bucket keys only; the client writes the words. */
export async function GET(): Promise<NextResponse> {
  if (!presenceEnabled()) return new NextResponse(null, { status: 404 });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ available: false, rows: [] }, { status: 401 });
  const verdict = walkingNowRateLimiter.check(`u:${user.id}`);
  if (!verdict.allowed) return rateLimitedResponse(verdict);
  const { data, error } = await supabase.rpc("walking_now");
  // Missing function (migration B not applied) or any failure: the section stays hidden.
  if (error) return NextResponse.json({ available: false, rows: [] });
  return NextResponse.json({ available: true, rows: sanitizeWalkingNow(data) }, { headers: { "Cache-Control": "no-store" } });
}
