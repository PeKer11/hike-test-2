import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { parseBbox } from "@/lib/social/recommendations";
import { socialEnabled } from "@/lib/social/flag";

/** Places that enough other walkers recommended inside a map box (k-anonymous, see the SQL function). */
export async function GET(request: Request): Promise<NextResponse> {
  if (!socialEnabled()) return new NextResponse(null, { status: 404 });
  const box = parseBbox(new URL(request.url).searchParams);
  if (!box) return NextResponse.json({ error: "Invalid map area." }, { status: 400 });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ places: [] }, { status: 401 });
  const { data, error } = await supabase.rpc("recommended_places_in_bbox", { p_south: box.south, p_west: box.west, p_north: box.north, p_east: box.east });
  if (error) return NextResponse.json({ places: [] }, { status: 500 });
  const places = (data ?? []).map((p: { poi_key: string; name: string; category: string; lat: number; lng: number; supporters_bucket: string; tags: string[] }) => ({
    poiKey: p.poi_key,
    name: p.name,
    category: p.category,
    lat: p.lat,
    lng: p.lng,
    supporters: p.supporters_bucket,
    tags: p.tags ?? [],
  }));
  return NextResponse.json({ places });
}
