import { NextRequest, NextResponse } from "next/server";

import { appUserAgent } from "@/lib/api/http-identity";
import { searchPlaces } from "@/lib/api/nominatim-client";
import type { NominatimPlace } from "@/lib/types";
import {
  callerKey,
  nominatimRateLimiter,
  rateLimitedResponse,
} from "@/lib/api/rate-limit";

/** Photon understands partial words and spelling variants ("דיזי", "דיזינגוף"), which Nominatim returns nothing for. */
async function photonFallback(query: string, limit: number): Promise<NominatimPlace[]> {
  try {
    const res = await fetch(`https://photon.komoot.io/api/?${new URLSearchParams({ q: query, limit: String(limit) })}`, {
      headers: { "User-Agent": appUserAgent(), Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      features?: Array<{ geometry?: { coordinates?: number[] }; properties?: Record<string, string | number | undefined> }>;
    };
    const seen = new Set<string>();
    return (data.features ?? []).flatMap((f, i) => {
      const [lng, lat] = f.geometry?.coordinates ?? [];
      const p = f.properties ?? {};
      if (typeof lat !== "number" || typeof lng !== "number" || !p.name) return [];
      const label = [p.name, p.street, p.city ?? p.county, p.country].filter(Boolean).join(", ");
      const key = `${label}|${lat}|${lng}`;
      if (seen.has(key)) return [];
      seen.add(key);
      return [{ place_id: Number(p.osm_id ?? i) * 10 + i, display_name: label, lat: String(lat), lon: String(lng) } as unknown as NominatimPlace];
    });
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const verdict = nominatimRateLimiter.check(callerKey(request));
  if (!verdict.allowed) {
    return rateLimitedResponse(verdict);
  }

  try {
    const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    const limit = Number(request.nextUrl.searchParams.get("limit") ?? "5");

    if (!query) {
      return NextResponse.json([]);
    }

    // Nominatim is a rate-limited shared service — never forward an arbitrary limit.
    const safeLimit = Number.isFinite(limit)
      ? Math.min(Math.max(Math.floor(limit), 1), 10)
      : 5;
    const results = await searchPlaces(query, safeLimit).catch(() => [] as NominatimPlace[]);
    return NextResponse.json(results.length > 0 ? results : await photonFallback(query, safeLimit));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to search places.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
