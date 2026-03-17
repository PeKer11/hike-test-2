# Known Issues & Gotchas

## Leaflet Marker Icons in Next.js
Leaflet marker icons don't load by default in bundled environments (webpack/turbopack). The `leaflet-defaulticon-compatibility` package fixes this — import it and its CSS in the MapView component.

## Coordinate Order Confusion
- Leaflet uses `[lat, lng]`
- OpenRouteService API uses `[lng, lat]` (reversed!)
- Internal model uses `{ lat, lng }` (named fields) to avoid ambiguity
- Always use `toOrsCoord()` / `fromOrsCoord()` helpers — never manually swap coordinates

## Nominatim Rate Limit
Nominatim allows max 1 request/second. The place search input must be debounced by at least 500ms. Exceeding the rate limit will result in 429 errors or IP bans.

## ORS Optimization Lacks Route Geometry
The `/v2/optimization` endpoint returns the optimal stop order and summary statistics, but does NOT return the actual walking path geometry. After optimization, follow-up `/v2/directions` calls are needed for each consecutive waypoint pair to get the trail paths for map display.

## ORS Free Tier Limits
- 2000 direction requests/day
- 40 requests/minute
- Multi-stop routes with N waypoints need N-1 direction calls after optimization
- Consider caching direction results for repeated coordinate pairs

## Leaflet SSR Crashes
Leaflet accesses `window` and `document` on import, which crashes during Next.js server-side rendering. All Leaflet components must use `"use client"` and the map must be loaded via `next/dynamic` with `{ ssr: false }`.

## Time Window Semantics
VROOM expects time windows as seconds (from midnight or epoch). Users think in clock times (e.g., "9:00 AM - 11:00 AM"). The constraint builder must convert HH:MM to seconds-from-midnight. All time windows are relative to the start of the day.
