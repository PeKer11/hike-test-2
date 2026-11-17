import { NextResponse } from "next/server";
import { z } from "zod";

import { presenceRateLimiter, rateLimitedResponse } from "@/lib/api/rate-limit";
import { classifyPoint } from "@/lib/places/safety-zones";
import { presenceEnabled } from "@/lib/social/flag";
import { isMissingRpc } from "@/lib/social/profiles";
import { createClient } from "@/lib/supabase/server";

const Body = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  areaLabel: z.string().max(60).optional(),
  newWalk: z.boolean().optional(),
});

/** The city from Vercel's IP headers (no third party), else what the client sent. */
function cityOf(request: Request, fallback: string | undefined): string | undefined {
  const raw = request.headers.get("x-vercel-ip-city");
  if (raw) {
    try {
      return decodeURIComponent(raw).slice(0, 60);
    } catch {
      return raw.slice(0, 60);
    }
  }
  return fallback;
}

/**
 * Publish where I am walking, as a ~1 km cell. The exact position is reduced here and NEVER stored or logged
 * (this file has no logging on purpose). Outside the allowed zones nothing is shared and any old row is cleared.
 */
export async function PUT(request: Request): Promise<NextResponse> {
  if (!presenceEnabled()) return new NextResponse(null, { status: 404 });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ shared: false }, { status: 401 });
  const verdict = presenceRateLimiter.check(`u:${user.id}`);
  if (!verdict.allowed) return rateLimitedResponse(verdict);
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ shared: false }, { status: 400 });
  const { lat, lng, areaLabel, newWalk } = parsed.data;

  if (classifyPoint({ lat, lng }).status !== "allowed") {
    await supabase.rpc("clear_my_presence");
    return NextResponse.json({ shared: false });
  }
  const { data, error } = await supabase.rpc("set_my_presence", {
    p_cell_y: Math.floor(lat * 100),
    p_cell_x: Math.floor(lng * 100),
    p_area: cityOf(request, areaLabel) ?? null,
    p_new_walk: newWalk === true,
  });
  if (error) return NextResponse.json({ shared: false, available: !isMissingRpc(error) });
  return NextResponse.json({ shared: data === true, available: true });
}

/** Stop sharing: End walk, going ghost, turning the audience off. */
export async function DELETE(): Promise<NextResponse> {
  if (!presenceEnabled()) return new NextResponse(null, { status: 404 });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse(null, { status: 204 });
  await supabase.rpc("clear_my_presence");
  return new NextResponse(null, { status: 204 });
}
