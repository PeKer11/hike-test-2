import { NextResponse } from "next/server";

import { fetchNotable } from "@/lib/places/notable";
import { notableEnabled } from "@/lib/social/flag";
import { parseBbox } from "@/lib/social/recommendations";

/** Notable places (Wikidata, CC0) in a map box. No sign-in: nothing here is about a person. */
export async function GET(request: Request): Promise<NextResponse> {
  if (!notableEnabled()) return new NextResponse(null, { status: 404 });
  const box = parseBbox(new URL(request.url).searchParams, 0.12);
  if (!box) return NextResponse.json({ error: "Invalid map area." }, { status: 400 });
  try {
    const places = await fetchNotable(box);
    return NextResponse.json({ places }, { headers: { "cache-control": "public, s-maxage=3600" } });
  } catch {
    return NextResponse.json({ places: [], partial: true });
  }
}
