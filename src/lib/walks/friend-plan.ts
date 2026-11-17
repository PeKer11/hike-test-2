import type { SavedStop } from "./saved-walks";

type Doer = typeof fetch;

export interface ResolvedPlace {
  name: string;
  lat: number;
  lng: number;
  category?: string;
}

/**
 * Look Google places up again by id (signed in, Places-gated, ten per request). Nothing is stored: the names are for
 * display and planning only, per Google's terms. Unknown ids and failures are simply absent from the map.
 */
export async function resolvePlaces(placeIds: string[], doFetch: Doer = fetch): Promise<Map<string, ResolvedPlace>> {
  const found = new Map<string, ResolvedPlace>();
  const ids = [...new Set(placeIds)];
  try {
    for (let i = 0; i < ids.length; i += 10) {
      const res = await doFetch("/api/places/resolve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids: ids.slice(i, i + 10) }),
      });
      if (!res.ok) continue;
      const body = (await res.json()) as { places?: { placeId?: string; name?: string; coordinates?: { lat?: number; lng?: number }; category?: string }[] };
      for (const p of body.places ?? []) {
        const c = p.coordinates;
        if (p.placeId && p.name && typeof c?.lat === "number" && typeof c?.lng === "number") {
          found.set(p.placeId, { name: p.name, lat: c.lat, lng: c.lng, category: p.category });
        }
      }
    }
  } catch {
    // Offline or signed out: whatever resolved is kept.
  }
  return found;
}

/**
 * A friend's shared walk arrives with Google stops as `{category, placeId}` only (migration A strips the name and
 * position). To plan it, look those places up again. Stops that cannot be resolved are dropped. Stops that already
 * have a name and position pass through untouched.
 */
export async function resolveSharedStops(stops: SavedStop[], doFetch: Doer = fetch): Promise<SavedStop[]> {
  const unresolved = stops.filter((s) => s.placeId && !s.name);
  if (unresolved.length === 0) return stops.filter((s) => s.name);
  const found = await resolvePlaces(unresolved.map((s) => s.placeId as string), doFetch);
  const out: SavedStop[] = [];
  for (const s of stops) {
    if (s.name) out.push(s);
    else if (s.placeId && found.has(s.placeId)) {
      const f = found.get(s.placeId)!;
      out.push({ name: f.name, category: f.category ?? s.category, lat: f.lat, lng: f.lng, placeId: s.placeId });
    }
  }
  return out;
}
