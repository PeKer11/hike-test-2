import "server-only";

import type { Coordinates } from "@/lib/types";
import type { DiscoveryItem } from "@/lib/types/discovery";
import {
  ISRAEL_BBOX,
  WIKI_LIMIT,
  WIKI_MAX_CALLS,
  WIKI_MAX_POINTS,
  WIKI_RADIUS_M,
  WIKI_SAMPLE_EVERY_M,
  WIKI_TIMEOUT_MS,
  WIKI_USER_AGENT,
} from "@/lib/walk/discovery-cadence";
import { samplePath } from "@/lib/walk/route-overlap";

export interface WikiPlace {
  id: string;
  title: string;
  lang: string;
  coordinates: Coordinates;
  /** Wikidata QID, when the page has one. */
  qid?: string;
}

export function isInIsrael(p: Coordinates): boolean {
  return (
    p.lat >= ISRAEL_BBOX.minLat &&
    p.lat <= ISRAEL_BBOX.maxLat &&
    p.lng >= ISRAEL_BBOX.minLng &&
    p.lng <= ISRAEL_BBOX.maxLng
  );
}

/** Up to `maxPoints` points along the route, one every `everyM` metres. */
export function sampleScanPoints(
  path: Coordinates[],
  everyM = WIKI_SAMPLE_EVERY_M,
  maxPoints = WIKI_MAX_POINTS,
): Coordinates[] {
  return samplePath(path, everyM).slice(0, maxPoints);
}

interface GeosearchPage {
  pageid?: number;
  title?: string;
  coordinates?: Array<{ lat?: number; lon?: number }>;
  pageprops?: { wikibase_item?: string };
}

/** Pure parse of one `generator=geosearch` response. */
export function parseWikiResponse(json: unknown, lang: string): WikiPlace[] {
  const pages = (json as { query?: { pages?: Record<string, GeosearchPage> } })
    ?.query?.pages;
  if (!pages || typeof pages !== "object") return [];
  const out: WikiPlace[] = [];
  for (const page of Object.values(pages)) {
    const c = page.coordinates?.[0];
    if (
      page.pageid === undefined ||
      !page.title ||
      typeof c?.lat !== "number" ||
      typeof c?.lon !== "number"
    ) {
      continue;
    }
    out.push({
      id: `wikipedia:${lang}:${page.pageid}`,
      title: page.title,
      lang,
      coordinates: { lat: c.lat, lng: c.lon },
      qid: page.pageprops?.wikibase_item,
    });
  }
  return out;
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { "User-Agent": WIKI_USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(WIKI_TIMEOUT_MS),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Wikipedia ${response.status}`);
  return response.json();
}

/**
 * Wikipedia articles around sampled route points. Serial, capped at 8 calls
 * (4 points x he+en inside Israel, en elsewhere); a failed call is skipped, so
 * the result is whatever was reachable. De-duplicated by QID.
 */
export async function fetchWikiPlaces(
  points: Coordinates[],
): Promise<{ places: WikiPlace[]; calls: number }> {
  const places = new Map<string, WikiPlace>();
  let calls = 0;
  for (const p of points.slice(0, WIKI_MAX_POINTS)) {
    const langs = isInIsrael(p) ? ["he", "en"] : ["en"];
    for (const lang of langs) {
      if (calls >= WIKI_MAX_CALLS) return { places: [...places.values()], calls };
      calls += 1;
      const params = new URLSearchParams({
        action: "query",
        format: "json",
        generator: "geosearch",
        ggscoord: `${p.lat.toFixed(3)}|${p.lng.toFixed(3)}`,
        ggsradius: String(WIKI_RADIUS_M),
        ggslimit: String(WIKI_LIMIT),
        prop: "coordinates|pageprops",
        ppprop: "wikibase_item",
        colimit: String(WIKI_LIMIT),
      });
      try {
        const json = await fetchJson(
          `https://${lang}.wikipedia.org/w/api.php?${params}`,
        );
        for (const place of parseWikiResponse(json, lang)) {
          places.set(place.qid ?? place.id, place);
        }
      } catch {
        // One mirror down must not cost the walker the rest of the scan.
      }
    }
  }
  return { places: [...places.values()], calls };
}

/** A listed place by virtue of having an article; boost only, never auto-added. */
export function wikiPlaceToItem(place: WikiPlace): DiscoveryItem {
  return {
    id: place.qid ? `wikidata:${place.qid}` : place.id,
    attraction: {
      id: place.qid ? `wikidata:${place.qid}` : place.id,
      name: place.title,
      coordinates: place.coordinates,
      category: "landmark",
      avgVisitMinutes: 10,
      tags: {
        wikipedia: `${place.lang}:${place.title}`,
        ...(place.qid ? { wikidata: place.qid } : {}),
      },
    },
    kind: "poi",
    tier: "registered",
    sources: place.qid ? ["wikipedia", "wikidata"] : ["wikipedia"],
    notable: true,
    score: 0,
    frame: null,
    detourMin: 0,
    state: "new",
  };
}
