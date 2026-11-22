"use client";

import L from "leaflet";
import { useState } from "react";
import { Marker, Popup, useMap } from "react-leaflet";

import { GooglePlaceCard } from "@/components/map/GooglePlaceCard";
import { CheckIcon, PlusIcon } from "@/components/ui/icons";
import { notableEnabled, socialEnabled } from "@/lib/social/flag";
import type { Attraction, AttractionCategory } from "@/lib/types";

interface RecommendedPlace {
  poiKey: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  supporters: number;
  tags: string[];
  reviews: string[];
}

interface NotablePlace {
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

const notableAttraction = (p: NotablePlace): Attraction => ({
  id: `wikidata-${p.id}`,
  name: p.name,
  coordinates: { lat: p.lat, lng: p.lng },
  category: KIND_CATEGORY.find(([re]) => re.test(p.kind))?.[1] ?? "landmark",
  avgVisitMinutes: 15,
  tags: { source: "wikidata" },
});

const recommendedAttraction = (p: RecommendedPlace): Attraction => ({
  id: p.poiKey,
  name: p.name,
  coordinates: { lat: p.lat, lng: p.lng },
  category: p.category as AttractionCategory,
  avgVisitMinutes: 15,
  tags: {},
});

function AddToWalkButton({ attraction, onAdd, added }: { attraction: Attraction; onAdd?: (a: Attraction) => void; added: boolean }) {
  if (!onAdd) return null;
  return (
    <button
      type="button"
      disabled={added}
      onClick={() => onAdd(attraction)}
      className="mt-1 inline-flex items-center gap-1 rounded-full bg-terra px-3 py-1 text-[13px] font-medium text-on-accent disabled:bg-forest/70"
    >
      {added ? <CheckIcon className="h-4 w-4" /> : <PlusIcon className="h-4 w-4" />}
      {added ? "Added to walk" : "Add to walk"}
    </button>
  );
}

const notableIcon = L.divIcon({
  className: "custom-map-notable-marker",
  html: '<span style="display:flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:9999px;background:#2f5d46;border:2px solid #fff;color:#fff;box-shadow:0 1px 4px rgba(0,0,0,0.35);"><svg viewBox="0 0 24 24" width="12" height="12" fill="#fff" stroke="#fff" stroke-width="1.75" stroke-linejoin="round"><path d="M12 3.4l2.5 5.3 5.8.7-4.3 4 1.1 5.7L12 16.3l-5.1 2.8L8 13.4l-4.3-4 5.8-.7L12 3.4z"/></svg></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

const starIcon = L.divIcon({
  className: "custom-map-recommended-marker",
  html: '<span style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:9999px;background:#fff;border:2px solid #c2652f;box-shadow:0 1px 4px rgba(0,0,0,0.35);"><svg viewBox="0 0 24 24" width="15" height="15" fill="#c2652f" stroke="#c2652f" stroke-width="1.75" stroke-linejoin="round"><path d="M12 3.4l2.5 5.3 5.8.7-4.3 4 1.1 5.7L12 16.3l-5.1 2.8L8 13.4l-4.3-4 5.8-.7L12 3.4z"/></svg></span>',
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

/** Leaflet treats any click inside its container as a map click unless the element opts out. */
const keepClicksOffMap = (el: HTMLDivElement | null) => {
  if (el) L.DomEvent.disableClickPropagation(el);
};

/**
 * "Recommended" button over the map: shows the places other walkers recommended in the area on screen.
 * Renders nothing unless the social flag is on. Needs a signed-in, opted-in walker (the server decides).
 */
export function RecommendedLayer({ onAddToWalk, addedIds = [] }: { onAddToWalk?: (place: Attraction) => void; addedIds?: string[] }) {
  const map = useMap();
  const [places, setPlaces] = useState<RecommendedPlace[] | null>(null);
  const [notable, setNotable] = useState<NotablePlace[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "empty" | "signin" | "error">("idle");

  if (!socialEnabled() && !notableEnabled()) return null;

  const toggle = async () => {
    if (places) {
      setPlaces(null);
      setNotable([]);
      setStatus("idle");
      return;
    }
    const b = map.getBounds();
    // The server refuses boxes wider than half a degree; zoomed far out, ask for the middle of the view.
    const c = b.getCenter();
    const half = 0.24;
    const south = Math.max(b.getSouth(), c.lat - half);
    const north = Math.min(b.getNorth(), c.lat + half);
    const west = Math.max(b.getWest(), c.lng - half);
    const east = Math.min(b.getEast(), c.lng + half);
    setStatus("loading");
    const area = (halfSpan: number) => `south=${Math.max(b.getSouth(), c.lat - halfSpan)}&west=${Math.max(b.getWest(), c.lng - halfSpan)}&north=${Math.min(b.getNorth(), c.lat + halfSpan)}&east=${Math.min(b.getEast(), c.lng + halfSpan)}`;
    try {
      const [community, wiki] = await Promise.all([
        socialEnabled() ? fetch(`/api/places/recommended?south=${south}&west=${west}&north=${north}&east=${east}`) : null,
        notableEnabled() ? fetch(`/api/places/notable?${area(0.05)}`) : null,
      ]);
      if (community?.status === 401 && !wiki) return setStatus("signin");
      if (community && !community.ok && community.status !== 401 && !wiki?.ok) return setStatus("error");
      const found = community?.ok ? ((await community.json()) as { places: RecommendedPlace[] }).places : [];
      const around = wiki?.ok ? ((await wiki.json()) as { places: NotablePlace[] }).places : [];
      setPlaces(found);
      setNotable(around);
      setStatus(found.length || around.length ? "idle" : "empty");
    } catch {
      setStatus("error");
    }
  };

  const note = { loading: "Loading…", empty: "No recommended or notable place found in this area yet", signin: "Sign in to see recommendations", error: "Could not load recommendations", idle: "" }[status];

  return (
    <>
      <div className="leaflet-top leaflet-right" style={{ pointerEvents: "none" }}>
        <div ref={keepClicksOffMap} className="leaflet-control" style={{ pointerEvents: "auto", marginTop: 10, marginRight: 10 }}>
          <button
            type="button"
            onClick={() => void toggle()}
            aria-pressed={places !== null}
            className={`min-h-11 rounded-full px-4 text-[15px] font-medium shadow-tk-soft ${places ? "bg-terra/10 text-terra" : "bg-paper text-charcoal"}`}
          >
            Recommended
          </button>
          {note ? <p className="mt-1 max-w-52 rounded bg-paper/90 px-2 py-1 text-[13px] text-charcoal shadow">{note}</p> : null}
        </div>
      </div>
      {notable.map((p) => (
        <Marker key={p.id} position={[p.lat, p.lng]} icon={notableIcon}>
          <Popup>
            <div className="space-y-1">
              <div className="text-sm font-semibold">{p.name}</div>
              <div className="text-[13px] text-charcoal/80">Notable place · {p.kind}</div>
              <a className="text-[13px] underline" href={`https://www.wikidata.org/wiki/${p.id}`} target="_blank" rel="noreferrer">
                Source: Wikidata
              </a>
              <GooglePlaceCard name={p.name} lat={p.lat} lng={p.lng} />
              <AddToWalkButton attraction={notableAttraction(p)} onAdd={onAddToWalk} added={addedIds.includes(`wikidata-${p.id}`)} />
            </div>
          </Popup>
        </Marker>
      ))}
      {places?.map((p) => (
        <Marker key={p.poiKey} position={[p.lat, p.lng]} icon={starIcon}>
          <Popup>
            <div className="space-y-1">
              <div className="text-sm font-semibold">{p.name}</div>
              <div className="text-[13px] text-charcoal/80">{p.supporters === 1 ? "Recommended by a Traike user" : `Recommended by ${p.supporters} Traike users`}</div>
              {p.tags.length ? <div className="text-[13px] text-charcoal/80">{p.tags.join(" · ")}</div> : null}
              {p.reviews.map((r, i) => (
                <blockquote key={i} className="border-l-2 border-terra/50 pl-2 text-[13px] text-charcoal/80">
                  {r} <span className="text-charcoal/80">— a Traike user</span>
                </blockquote>
              ))}
              <GooglePlaceCard name={p.name} lat={p.lat} lng={p.lng} />
              <AddToWalkButton attraction={recommendedAttraction(p)} onAdd={onAddToWalk} added={addedIds.includes(p.poiKey)} />
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
}
