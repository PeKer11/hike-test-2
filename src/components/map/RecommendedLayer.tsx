"use client";

import L from "leaflet";
import { useState } from "react";
import { Marker, Popup, useMap } from "react-leaflet";

import { GooglePlaceCard } from "@/components/map/GooglePlaceCard";
import { notableEnabled, socialEnabled } from "@/lib/social/flag";

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

const notableIcon = L.divIcon({
  className: "custom-map-notable-marker",
  html: '<span style="display:flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:9999px;background:#2f5d46;border:2px solid #fff;color:#fff;font-size:12px;line-height:1;box-shadow:0 1px 4px rgba(0,0,0,0.35);">✦</span>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

const starIcon = L.divIcon({
  className: "custom-map-recommended-marker",
  html: '<span style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:9999px;background:#fff;border:2px solid #c2652f;font-size:15px;line-height:1;box-shadow:0 1px 4px rgba(0,0,0,0.35);">⭐</span>',
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
export function RecommendedLayer() {
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
            className={`rounded-full border border-terra/60 px-3 py-1.5 text-sm font-medium shadow ${places ? "bg-terra text-white" : "bg-white text-charcoal"}`}
          >
            ⭐ Recommended
          </button>
          {note ? <p className="mt-1 max-w-52 rounded bg-white/90 px-2 py-1 text-xs text-charcoal shadow">{note}</p> : null}
        </div>
      </div>
      {notable.map((p) => (
        <Marker key={p.id} position={[p.lat, p.lng]} icon={notableIcon}>
          <Popup>
            <div className="space-y-1">
              <div className="text-sm font-semibold">{p.name}</div>
              <div className="text-xs text-slate-600">Notable place · {p.kind}</div>
              <a className="text-xs underline" href={`https://www.wikidata.org/wiki/${p.id}`} target="_blank" rel="noreferrer">
                Source: Wikidata
              </a>
              <GooglePlaceCard name={p.name} lat={p.lat} lng={p.lng} />
            </div>
          </Popup>
        </Marker>
      ))}
      {places?.map((p) => (
        <Marker key={p.poiKey} position={[p.lat, p.lng]} icon={starIcon}>
          <Popup>
            <div className="space-y-1">
              <div className="text-sm font-semibold">{p.name}</div>
              <div className="text-xs text-slate-600">{p.supporters === 1 ? "Recommended by a Traike user" : `Recommended by ${p.supporters} Traike users`}</div>
              {p.tags.length ? <div className="text-xs text-slate-600">{p.tags.join(" · ")}</div> : null}
              {p.reviews.map((r, i) => (
                <blockquote key={i} className="border-l-2 border-terra/50 pl-2 text-xs text-slate-700">
                  {r} <span className="text-slate-500">— a Traike user</span>
                </blockquote>
              ))}
              <GooglePlaceCard name={p.name} lat={p.lat} lng={p.lng} />
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
}
