import { NextResponse } from "next/server";

/**
 * A city-level fallback for "where is the walker" when the device gives no fix.
 * Vercel already attaches these headers to every request, so this costs nothing
 * and calls no third party. Nothing is logged or stored.
 */
export function GET(request: Request) {
  const lat = Number(request.headers.get("x-vercel-ip-latitude"));
  const lng = Number(request.headers.get("x-vercel-ip-longitude"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || request.headers.get("x-vercel-ip-latitude") === null) {
    return NextResponse.json({ error: "unavailable" }, { status: 404 });
  }
  const rawCity = request.headers.get("x-vercel-ip-city");
  let city: string | undefined;
  try {
    city = rawCity ? decodeURIComponent(rawCity) : undefined;
  } catch {
    city = rawCity ?? undefined;
  }
  return NextResponse.json({ lat, lng, city }, { headers: { "Cache-Control": "no-store" } });
}
