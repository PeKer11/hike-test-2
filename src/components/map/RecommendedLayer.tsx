"use client";

import L from "leaflet";
import { useState } from "react";
import { Marker, Popup, useMap } from "react-leaflet";

import { socialEnabled } from "@/lib/social/flag";

interface RecommendedPlace {
  poiKey: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  supporters: string;
  tags: string[];
}

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
  const [status, setStatus] = useState<"idle" | "loading" | "empty" | "signin" | "error">("idle");

  if (!socialEnabled()) return null;

  const toggle = async () => {
    if (places) {
      setPlaces(null);
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
    try {
      const res = await fetch(`/api/places/recommended?south=${south}&west=${west}&north=${north}&east=${east}`);
      if (res.status === 401) return setStatus("signin");
      if (!res.ok) return setStatus("error");
      const data = (await res.json()) as { places: RecommendedPlace[] };
      setPlaces(data.places);
      setStatus(data.places.length ? "idle" : "empty");
    } catch {
      setStatus("error");
    }
  };

  const note = { loading: "Loading…", empty: "No place in this area has enough recommendations yet", signin: "Sign in to see recommendations", error: "Could not load recommendations", idle: "" }[status];

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
      {places?.map((p) => (
        <Marker key={p.poiKey} position={[p.lat, p.lng]} icon={starIcon}>
          <Popup>
            <div className="space-y-1">
              <div className="text-sm font-semibold">{p.name}</div>
              <div className="text-xs text-slate-600">Recommended by {p.supporters} walkers</div>
              {p.tags.length ? <div className="text-xs text-slate-600">{p.tags.join(" · ")}</div> : null}
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
}
