"use client";

import L from "leaflet";
import { useEffect, useRef, useState } from "react";

import { distanceM, namesOverlap } from "@/lib/places/match";

const KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY;

/* eslint-disable @typescript-eslint/no-explicit-any */
let loading: Promise<any> | null = null;

/** Loads the Maps JavaScript API once, only when a card is first opened. */
function loadGoogle(): Promise<any> {
  const w = window as any;
  if (w.google?.maps?.importLibrary) return Promise.resolve(w.google);
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    // importLibrary only exists once Google's own callback has fired, not on script.onload.
    w.__traikeGoogleReady = () => resolve(w.google);
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(KEY ?? "")}&loading=async&v=weekly&callback=__traikeGoogleReady`;
    script.async = true;
    script.onerror = () => reject(new Error("Google Maps failed to load"));
    document.head.appendChild(script);
  });
  return loading;
}

const MATCH_RADIUS_M = 100;

/**
 * Google's own Place Details card for a place found by name near a point: stars and review count first,
 * the reviews behind "See reviews" with a way back. Google draws and attributes the content; nothing
 * from it is stored or re-drawn on our map.
 */
export function GooglePlaceCard({ name, lat, lng, placeId: knownId, startWithReviews = false }: { name: string; lat: number; lng: number; placeId?: string; startWithReviews?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const [placeId, setPlaceId] = useState<string | null>(knownId ?? null);
  const [state, setState] = useState<"loading" | "ready" | "none" | "error">(knownId ? "ready" : "loading");
  const [showReviews, setShowReviews] = useState(startWithReviews);
  const [matchedName, setMatchedName] = useState<string | null>(null);

  useEffect(() => {
    if (!KEY || knownId) return;
    let alive = true;
    (async () => {
      try {
        const google = await loadGoogle();
        const { Place } = await google.maps.importLibrary("places");
        const { places } = await Place.searchByText({ textQuery: name, fields: ["id", "displayName", "location"], locationBias: { center: { lat, lng }, radius: 300 }, maxResultCount: 5 });
        if (!alive) return;
        const match = (places ?? []).find((p: any) => p.location && distanceM(lat, lng, p.location.lat(), p.location.lng()) <= MATCH_RADIUS_M && namesOverlap(name, p.displayName ?? ""));
        if (!match) return setState("none");
        setPlaceId(match.id);
        setMatchedName(match.displayName ?? null);
        setState("ready");
      } catch (error) {
        console.error("GooglePlaceCard", error);
        if (alive) setState("error");
      }
    })();
    return () => {
      alive = false;
    };
  }, [name, lat, lng, knownId]);

  useEffect(() => {
    if (!placeId || !host.current) return;
    const request = `<gmp-place-details-place-request place="${placeId}"></gmp-place-details-place-request>`;
    host.current.innerHTML = showReviews
      ? `<gmp-place-details style="width:100%">${request}<gmp-place-rating></gmp-place-rating><gmp-place-reviews></gmp-place-reviews></gmp-place-details>`
      : `<gmp-place-details-compact style="width:100%">${request}<gmp-place-rating></gmp-place-rating><gmp-place-type></gmp-place-type><gmp-place-attribution></gmp-place-attribution></gmp-place-details-compact>`;
  }, [placeId, showReviews]);

  if (!KEY) return null;
  return (
    // Clicks inside the card must not reach the map, or Leaflet closes the popup.
    <div
      ref={(el) => {
        if (el) L.DomEvent.disableClickPropagation(el);
      }}
      className="pt-1"
    >
      {state === "loading" ? <p className="text-xs text-slate-600">Loading Google rating…</p> : null}
      {state === "none" ? <p className="text-xs text-slate-600">No Google match for this place.</p> : null}
      {state === "error" ? <p className="text-xs text-slate-600">Could not load Google reviews.</p> : null}
      {state === "ready" && matchedName ? <p className="text-xs text-slate-600">Google: {matchedName}</p> : null}
      {state === "ready" ? (
        <button type="button" className="mb-1 text-xs underline" onClick={() => setShowReviews((v) => !v)}>
          {showReviews ? "← Back" : "See reviews"}
        </button>
      ) : null}
      <div ref={host} style={{ minWidth: 260, maxHeight: 190, overflowY: "auto" }} />
    </div>
  );
}
