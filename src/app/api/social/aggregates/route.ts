import { NextResponse } from "next/server";

import { rateLimitedResponse, socialRateLimiter } from "@/lib/api/rate-limit";
import { createClient } from "@/lib/supabase/server";
import {
  cleanPoiKeys,
  EMPTY_AGGREGATES,
  sanitizeSimilarRows,
  sanitizeSupportRows,
  type CommunityAggregates,
} from "@/lib/social/aggregates";
import { socialEnabled } from "@/lib/social/flag";

/**
 * Community aggregates for a list of OSM place keys the client already holds
 * (S1 support bucket, S2 "walkers like you"). Flag off => 404 before anything
 * else runs. Signed-out, not opted in, or any failure => the empty answer: a
 * badge never shows an error. The database applies the privacy rules; this
 * route only validates input and re-validates output.
 */
export async function POST(request: Request): Promise<NextResponse> {
  if (!socialEnabled()) return new NextResponse(null, { status: 404 });

  let body: { poiKeys?: unknown };
  try {
    body = (await request.json()) as { poiKeys?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const keys = cleanPoiKeys(body.poiKeys);
  if (keys.length === 0) return NextResponse.json(EMPTY_AGGREGATES);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json(EMPTY_AGGREGATES);
  const verdict = socialRateLimiter.check(`u:${user.id}`);
  if (!verdict.allowed) return rateLimitedResponse(verdict);

  try {
    const [support, similar] = await Promise.all([
      supabase.rpc("community_place_support", { p_poi_keys: keys }),
      supabase.rpc("similar_walkers_places", { p_poi_keys: keys }),
    ]);
    const result: CommunityAggregates = {
      support: support.error ? {} : sanitizeSupportRows(support.data, keys),
      similar: similar.error ? {} : sanitizeSimilarRows(similar.data, keys),
    };
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(EMPTY_AGGREGATES);
  }
}
