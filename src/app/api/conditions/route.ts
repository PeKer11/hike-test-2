import { NextResponse } from "next/server";

import { appUserAgent } from "@/lib/api/http-identity";
import {
  callerKey,
  createRateLimiter,
  rateLimitedResponse,
} from "@/lib/api/rate-limit";
import {
  CONDITIONS_CACHE_MS,
  conditionsCell,
  OPEN_METEO_ATTRIBUTION,
  openMeteoUrl,
  parseOpenMeteo,
} from "@/lib/walk/companion/conditions";
import type { ConditionsSnapshot } from "@/lib/walk/companion/producers/conditions";

const FETCH_TIMEOUT_MS = 6_000;
const CACHE_MAX_ENTRIES = 200;

// Open-Meteo is free for non-commercial use only: switch to a paid plan before
// payments go live. In-process cache, like the other routes.
const cache = new Map<string, { at: number; body: ConditionsSnapshot }>();

// One lookup at walk start plus roughly hourly while walking.
const conditionsRateLimiter = createRateLimiter([
  { limit: 10, windowMs: 60_000 },
  { limit: 200, windowMs: 24 * 3_600_000 },
]);

function parseCoord(value: string | null, min: number, max: number): number | null {
  if (value === null || value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

/** GET /api/conditions?lat=..&lng=.. -> { apparentTempC, precipProbabilityPct, attribution } */
export async function GET(request: Request): Promise<NextResponse> {
  const verdict = conditionsRateLimiter.check(callerKey(request));
  if (!verdict.allowed) return rateLimitedResponse(verdict);

  const params = new URL(request.url).searchParams;
  const lat = parseCoord(params.get("lat"), -90, 90);
  const lng = parseCoord(params.get("lng"), -180, 180);
  if (lat === null || lng === null) {
    return NextResponse.json({ error: "lat and lng must be finite coordinates." }, { status: 400 });
  }

  const cell = conditionsCell(lat, lng);
  const hit = cache.get(cell.key);
  if (hit && Date.now() - hit.at < CONDITIONS_CACHE_MS) {
    return NextResponse.json({ ...hit.body, attribution: OPEN_METEO_ATTRIBUTION });
  }

  try {
    // The cell centre goes upstream, never the walker's exact position.
    const res = await fetch(openMeteoUrl(cell.lat, cell.lng), {
      headers: { "User-Agent": appUserAgent() },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      return NextResponse.json({ error: "Weather service unavailable." }, { status: 502 });
    }
    const body = parseOpenMeteo(await res.json());
    if (cache.size >= CACHE_MAX_ENTRIES) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    cache.set(cell.key, { at: Date.now(), body });
    return NextResponse.json({ ...body, attribution: OPEN_METEO_ATTRIBUTION });
  } catch {
    return NextResponse.json({ error: "Weather service unavailable." }, { status: 502 });
  }
}
