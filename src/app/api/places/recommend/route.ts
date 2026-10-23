import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { parseRecommendation, validPoiKey } from "@/lib/social/recommendations";
import { socialEnabled } from "@/lib/social/flag";

/** Recommend a place (own row; sending again changes the tags). */
export async function PUT(request: Request): Promise<NextResponse> {
  if (!socialEnabled()) return new NextResponse(null, { status: 404 });
  const rec = parseRecommendation(await request.json().catch(() => null));
  if (!rec) return NextResponse.json({ error: "Invalid recommendation." }, { status: 400 });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ saved: false }, { status: 401 });
  const { error } = await supabase
    .from("place_recommendations")
    .upsert({ user_id: user.id, poi_key: rec.poiKey, category: rec.category, tags: rec.tags, updated_at: new Date().toISOString() }, { onConflict: "user_id,poi_key" });
  return NextResponse.json({ saved: !error }, { status: error ? 500 : 200 });
}

/** Take the recommendation back. */
export async function DELETE(request: Request): Promise<NextResponse> {
  if (!socialEnabled()) return new NextResponse(null, { status: 404 });
  const body = (await request.json().catch(() => null)) as { poiKey?: unknown } | null;
  if (!validPoiKey(body?.poiKey)) return NextResponse.json({ error: "Invalid place." }, { status: 400 });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse(null, { status: 204 });
  const { error } = await supabase.from("place_recommendations").delete().eq("user_id", user.id).eq("poi_key", body!.poiKey as string);
  if (error) return NextResponse.json({ error: "Could not remove it." }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
