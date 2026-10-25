"use client";

import { AdvancedMarker, ControlPosition, InfoWindow, MapControl, useMap, useMapsLibrary } from "@vis.gl/react-google-maps";
import { useState, type ReactNode } from "react";

import { GooglePlaceCard } from "@/components/map/GooglePlaceCard";
import { distanceM, namesOverlap } from "@/lib/places/match";
import { notableEnabled, socialEnabled } from "@/lib/social/flag";
import type { Attraction, AttractionCategory } from "@/lib/types";

/** One thing on the layer, whichever source it came from. */
interface Item {
  key: string;
  source: "google" | "notable" | "community";
  group?: Group;
  name: string;
  lat: number;
  lng: number;
  attraction: Attraction;
  // google
  rating?: number;
  ratingCount?: number;
  placeId?: string;
  // notable
  kind?: string;
  wikidataId?: string;
  // community
  supporters?: number;
  tags?: string[];
  reviews?: string[];
}

interface RecommendedApi {
  poiKey: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  supporters: number;
  tags: string[];
  reviews: string[];
}

interface NotableApi {
  id: string;
  name: string;
  kind: string;
  lat: number;
  lng: number;
}

const KIND_CATEGORY: [RegExp, AttractionCategory][] = [
  [/museum|gallery/i, "museum"],
  [/viewpoint|lookout/i, "viewpoint"],
  [/church|synagogue|mosque|monastery|shrine|temple/i, "religious"],
  [/park|reserve|waterfall|spring|cave|beach|forest|nature|lake/i, "nature"],
];

const GOOGLE_CATEGORY: [RegExp, AttractionCategory][] = [
  [/restaurant|cafe|bakery|food|bar|coffee/i, "food"],
  [/museum|art_gallery/i, "museum"],
  [/park|hiking|beach|garden|natural/i, "nature"],
  [/worship|church|synagogue|mosque/i, "religious"],
];

const icon = (d: string) => (
  <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);

type Group = "food" | "nature" | "culture" | "sights";

/** One search per group, so a food-heavy area can't crowd out nature, museums and sights. */
const GROUPS: Record<Group, { label: string; glyph: ReactNode; color: string; types: string[]; radius: number }> = {
  food: { label: "Food", glyph: icon("M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 3c-2 2-3 4-3 7h3v11"), color: "#e8742c", types: ["restaurant", "cafe", "bakery"], radius: 1500 },
  nature: { label: "Nature", glyph: icon("M12 22v-5M12 3l6 8h-3l4 6H5l4-6H6z"), color: "#2f8f4e", types: ["park", "national_park", "hiking_area", "beach", "garden"], radius: 3000 },
  culture: { label: "Museum & art", glyph: icon("M3 21h18M5 21V10M9 21V10M15 21V10M19 21V10M3 10l9-6 9 6"), color: "#7c4dbd", types: ["museum", "art_gallery"], radius: 3000 },
  sights: { label: "Sights", glyph: icon("M4 8h3l2-3h6l2 3h3v11H4zM12 11.5a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4z"), color: "#2563eb", types: ["tourist_attraction", "historical_landmark", "synagogue", "church", "mosque"], radius: 3000 },
};
const GROUP_CATEGORY: Record<Group, AttractionCategory> = { food: "food", nature: "nature", culture: "museum", sights: "landmark" };
const MIN_RATING = 4.0;
const MIN_RATINGS = 25;
const PER_GROUP = 5;
/** Rating x log(reviews), halved at radius/5 of distance: near places beat slightly better far ones. */
const placeScore = (rating: number, count: number, distM: number, radius: number) => (rating * Math.log10(count + 1)) / (1 + distM / (radius / 5));
// TODO(pricing): effectively unlimited while Ariel tests; set from the plan once packages exist.
const SEARCHES_PER_SESSION = 100000;
const SEARCH_COUNT_KEY = "traike-top-rated-searches";

function searchesLeft(): boolean {
  try {
    return Number(sessionStorage.getItem(SEARCH_COUNT_KEY) ?? 0) < SEARCHES_PER_SESSION;
  } catch {
    return true;
  }
}

function countSearch() {
  try {
    sessionStorage.setItem(SEARCH_COUNT_KEY, String(Number(sessionStorage.getItem(SEARCH_COUNT_KEY) ?? 0) + 1));
  } catch {
    // Storage blocked: the Cloud Console quota is the real cap.
  }
}

function AddToWalkButton({ attraction, onAdd, added }: { attraction: Attraction; onAdd?: (a: Attraction) => void; added: boolean }) {
  if (!onAdd) return null;
  return (
    <button type="button" disabled={added} onClick={() => onAdd(attraction)} className="mt-1 rounded-full bg-terra px-3 py-1 text-xs font-medium text-white disabled:bg-forest/70">
      {added ? "✓ Added to walk" : "＋ Add to walk"}
    </button>
  );
}

const pin = (bg: string, border: string, glyph: ReactNode, size: number) => (
  <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: size, height: size, borderRadius: 9999, background: bg, border: `2px solid ${border}`, color: "#fff", fontSize: 13, lineHeight: 1, boxShadow: "0 1px 4px rgba(0,0,0,0.35)" }}><span style={{ width: "62%", height: "62%", display: "flex" }}>{glyph}</span></span>
);

/** Notable (Wikidata) places: a gold star with a white rim and a soft shadow. */
const goldStar = (
  <svg width="30" height="30" viewBox="0 0 24 24" style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.45))" }} aria-hidden="true">
    <defs>
      <linearGradient id="traike-gold" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ffe066" />
        <stop offset="1" stopColor="#f5a800" />
      </linearGradient>
    </defs>
    <path d="M12 2.2l2.9 6.1 6.7.8-4.9 4.6 1.3 6.6L12 16.9l-6 3.4 1.3-6.6-4.9-4.6 6.7-.8z" fill="url(#traike-gold)" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
  </svg>
);

/**
 * Google-map version of the recommended layer. "Top rated" is the main control: Google's own ranking of
 * places around the map centre (rating + number of reviews), with Wikidata notable places and Traike-user
 * recommendations as the secondary "Recommended" layer. Google data is shown only on this Google map.
 */
export function GoogleRecommendedLayer({ onAddToWalk, addedIds = [], compact = false }: { compact?: boolean; onAddToWalk?: (place: Attraction) => void; addedIds?: string[] }) {
  const map = useMap();
  const placesLib = useMapsLibrary("places");
  const [top, setTop] = useState<Item[]>([]);
  const [extra, setExtra] = useState<Item[] | null>(null);
  const [note, setNote] = useState("");
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [reviewsFor, setReviewsFor] = useState<string | null>(null);

  const showTop = async () => {
    if (top.length) {
      setTop([]);
      setNote("");
      return;
    }
    if (!map || !placesLib) return;
    if (!searchesLeft()) return setNote("Top-rated search limit reached for this session");
    const c = map.getCenter();
    if (!c) return;
    setNote("Loading…");
    countSearch();
    try {
      const perGroup = await Promise.all(
        (Object.keys(GROUPS) as Group[]).map(async (group) => {
          const g = GROUPS[group];
          const { places } = await placesLib.Place.searchNearby({
            locationRestriction: { center: c, radius: g.radius },
            includedPrimaryTypes: g.types,
            fields: ["id", "displayName", "location", "rating", "userRatingCount", "primaryType"],
            rankPreference: placesLib.SearchNearbyRankPreference.POPULARITY,
            maxResultCount: 12,
          });
          return places
            .filter((p) => p.location && p.id && (p.rating ?? 0) >= MIN_RATING && (p.userRatingCount ?? 0) >= MIN_RATINGS)
            .map((p) => ({ p, score: placeScore(p.rating ?? 0, p.userRatingCount ?? 0, distanceM(c.lat(), c.lng(), p.location!.lat(), p.location!.lng()), g.radius) }))
            .sort((a, z) => z.score - a.score)
            .map(({ p }) => p)
            .slice(0, PER_GROUP)
            .map((p): Item => {
              const name = p.displayName ?? "Place";
              const lat = p.location!.lat();
              const lng = p.location!.lng();
              return {
                key: `g-${p.id}`,
                source: "google",
                group,
                name,
                lat,
                lng,
                rating: p.rating ?? undefined,
                ratingCount: p.userRatingCount ?? undefined,
                placeId: p.id,
                // Only the place id is kept as the stop's identity; the Google card re-fetches name/rating when shown.
                attraction: {
                  id: `google-${p.id}`,
                  name,
                  coordinates: { lat, lng },
                  category: GOOGLE_CATEGORY.find(([re]) => re.test(p.primaryType ?? ""))?.[1] ?? GROUP_CATEGORY[group],
                  avgVisitMinutes: 20,
                  tags: { source: "google" },
                },
              };
            });
        }),
      );
      const seen = new Set<string>();
      const items = perGroup.flat().filter((i) => !seen.has(i.key) && seen.add(i.key));
      setNote(items.length ? "" : "No highly rated place found around here");
      setTop(items);
    } catch (error) {
      console.error("GoogleRecommendedLayer", error);
      setNote("Could not load top-rated places");
    }
  };

  const showExtra = async () => {
    if (extra) {
      setExtra(null);
      setNote("");
      return;
    }
    if (!map) return;
    const b = map.getBounds();
    const c = map.getCenter();
    if (!b || !c) return;
    const ne = b.getNorthEast();
    const sw = b.getSouthWest();
    const half = 0.24;
    const clamp = (lo: number, hi: number, mid: number, h: number) => [Math.max(lo, mid - h), Math.min(hi, mid + h)] as const;
    const [south, north] = clamp(sw.lat(), ne.lat(), c.lat(), half);
    const [west, east] = clamp(sw.lng(), ne.lng(), c.lng(), half);
    const [nSouth, nNorth] = clamp(sw.lat(), ne.lat(), c.lat(), 0.05);
    const [nWest, nEast] = clamp(sw.lng(), ne.lng(), c.lng(), 0.05);
    setNote("Loading…");
    try {
      const [community, wiki] = await Promise.all([
        socialEnabled() ? fetch(`/api/places/recommended?south=${south}&west=${west}&north=${north}&east=${east}`) : null,
        notableEnabled() ? fetch(`/api/places/notable?south=${nSouth}&west=${nWest}&north=${nNorth}&east=${nEast}`) : null,
      ]);
      if (community?.status === 401 && !wiki) return setNote("Sign in to see recommendations");
      const found = community?.ok ? ((await community.json()) as { places: RecommendedApi[] }).places : [];
      const around = wiki?.ok ? ((await wiki.json()) as { places: NotableApi[] }).places : [];
      const items: Item[] = [
        ...found.map((p) => ({
          key: p.poiKey,
          source: "community" as const,
          name: p.name,
          lat: p.lat,
          lng: p.lng,
          supporters: p.supporters,
          tags: p.tags,
          reviews: p.reviews,
          attraction: { id: p.poiKey, name: p.name, coordinates: { lat: p.lat, lng: p.lng }, category: p.category as AttractionCategory, avgVisitMinutes: 15, tags: {} },
        })),
        ...around.map((p) => ({
          key: `wd-${p.id}`,
          source: "notable" as const,
          name: p.name,
          lat: p.lat,
          lng: p.lng,
          kind: p.kind,
          wikidataId: p.id,
          attraction: { id: `wikidata-${p.id}`, name: p.name, coordinates: { lat: p.lat, lng: p.lng }, category: KIND_CATEGORY.find(([re]) => re.test(p.kind))?.[1] ?? "landmark", avgVisitMinutes: 15, tags: { source: "wikidata" } },
        })),
      ];
      setExtra(items);
      setNote(items.length ? "" : "No recommended or notable place found in this area yet");
    } catch {
      setNote("Could not load recommendations");
    }
  };

  // A secondary place that is the same as a Google top-rated one is shown once, as the Google one.
  const secondary = (extra ?? []).filter((e) => !top.some((g) => distanceM(g.lat, g.lng, e.lat, e.lng) <= 60 && namesOverlap(g.name, e.name)));
  const all = [...top, ...secondary];
  const open = all.find((i) => i.key === openKey);
  const enabled = socialEnabled() || notableEnabled();
  // One button: Google's top rated plus the community/notable places, shown together and cleared together.
  const toggleAll = () => {
    if (top.length || extra !== null) {
      setTop([]);
      setExtra(null);
      setNote("");
      return;
    }
    // Say so here: showExtra finishing would otherwise wipe the limit note and the button would look pressed but empty.
    if (!searchesLeft()) return setNote("Top-rated search limit reached for this session");
    void showTop();
    if (enabled) void showExtra();
  };
  const btn = (on: boolean) => `rounded-full border border-terra/60 px-3 py-1.5 text-sm font-medium shadow ${on ? "bg-terra text-white" : "bg-white text-charcoal"}`;

  return (
    <>
      <MapControl position={ControlPosition.TOP_RIGHT}>
        {/* Right-aligned and capped so it never reaches the Map/Satellite switch on the left; sm:mr clears the fixed account pill so both share one row. */}
        <div className={`flex max-w-[min(640px,60vw)] gap-2 p-2.5 ${compact ? "flex-wrap items-center justify-end" : "flex-wrap items-center justify-end sm:mr-[270px]"}`}>
          {top.length ? (
            <div className="pointer-events-none flex flex-wrap justify-end gap-x-2 rounded bg-white/85 px-2 py-1 text-xs text-charcoal shadow">
              {Object.values(GROUPS).map((g) => (
                <span key={g.label} className="flex items-center gap-1">
                  <span className="inline-flex h-4 w-4 rounded-full p-0.5 text-white" style={{ background: g.color }}>{g.glyph}</span>
                  {g.label}
                </span>
              ))}
            </div>
          ) : null}
          <button type="button" onClick={toggleAll} aria-pressed={top.length > 0 || extra !== null} className={btn(top.length > 0 || extra !== null)}>
            🏆 Top rated
          </button>
          {note ? <p className="max-w-52 rounded bg-white/90 px-2 py-1 text-xs text-charcoal shadow">{note}</p> : null}
        </div>
      </MapControl>
      {all.map((i) => (
        <AdvancedMarker key={i.key} position={{ lat: i.lat, lng: i.lng }} onClick={() => setOpenKey(i.key)} zIndex={i.source === "google" ? 300 : 200}>
          {i.source === "google" ? (
            <div className="flex items-center gap-1" data-testid="top-rated-marker">
              {pin(GROUPS[i.group ?? "sights"].color, "#fff", GROUPS[i.group ?? "sights"].glyph, 32)}
              <span className="rounded bg-white/95 px-1 text-xs font-semibold shadow">★ {i.rating?.toFixed(1)} ({i.ratingCount})</span>
            </div>
          ) : i.source === "notable" ? (
            goldStar
          ) : (
            pin("#fff", "#c2652f", "⭐", 26)
          )}
        </AdvancedMarker>
      ))}
      {open ? (
        <InfoWindow position={{ lat: open.lat, lng: open.lng }} pixelOffset={[0, -16]} onCloseClick={() => { setOpenKey(null); setReviewsFor(null); }}>
          <div className="space-y-1" style={{ minWidth: 240 }}>
            <div className="text-sm font-semibold">{open.name}</div>
            {open.source === "google" ? (
              <>
                <div className="text-xs text-slate-700">
                  {GROUPS[open.group ?? "sights"].label} · ★ {open.rating?.toFixed(1)} · {open.ratingCount} Google reviews
                </div>
                {reviewsFor === open.key ? (
                  <GooglePlaceCard name={open.name} lat={open.lat} lng={open.lng} placeId={open.placeId} startWithReviews />
                ) : (
                  <div>
                    <button type="button" className="text-xs underline" onClick={() => setReviewsFor(open.key)}>
                      See reviews
                    </button>
                  </div>
                )}
              </>
            ) : null}
            {open.source === "notable" ? (
              <>
                <div className="text-xs text-slate-600">Notable place · {open.kind}</div>
                <a className="text-xs underline" href={`https://www.wikidata.org/wiki/${open.wikidataId}`} target="_blank" rel="noreferrer">
                  Source: Wikidata
                </a>
                <GooglePlaceCard name={open.name} lat={open.lat} lng={open.lng} />
              </>
            ) : null}
            {open.source === "community" ? (
              <>
                <div className="text-xs text-slate-600">{open.supporters === 1 ? "Recommended by a Traike user" : `Recommended by ${open.supporters} Traike users`}</div>
                {open.tags?.length ? <div className="text-xs text-slate-600">{open.tags.join(" · ")}</div> : null}
                {open.reviews?.map((r, n) => (
                  <blockquote key={n} className="border-l-2 border-terra/50 pl-2 text-xs text-slate-700">
                    {r} <span className="text-slate-500">— a Traike user</span>
                  </blockquote>
                ))}
                <GooglePlaceCard name={open.name} lat={open.lat} lng={open.lng} />
              </>
            ) : null}
            <div>
              <AddToWalkButton attraction={open.attraction} onAdd={onAddToWalk} added={addedIds.includes(open.attraction.id)} />
            </div>
          </div>
        </InfoWindow>
      ) : null}
    </>
  );
}
