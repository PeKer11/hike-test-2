"use client";

import { useEffect, useRef, useState } from "react";

const KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY;

/* eslint-disable @typescript-eslint/no-explicit-any */
let loading: Promise<any> | null = null;

/** Loads the Maps JavaScript API once, only when a card is first opened. */
function loadGoogle(): Promise<any> {
  const w = window as any;
  if (w.google?.maps?.importLibrary) return Promise.resolve(w.google);
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(KEY ?? "")}&loading=async&v=weekly`;
    script.async = true;
    script.onload = () => resolve(w.google);
    script.onerror = () => reject(new Error("Google Maps failed to load"));
    document.head.appendChild(script);
  });
  return loading;
}

/**
 * Google's own Place Details card (rating + reviews) for a place found by name near a point.
 * Google draws and attributes the content; nothing from it is stored or re-drawn on our map.
 */
export function GooglePlaceCard({ name, lat, lng }: { name: string; lat: number; lng: number }) {
  const host = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"idle" | "loading" | "none" | "error">("idle");

  useEffect(() => {
    if (!KEY || state !== "loading" || !host.current) return;
    let alive = true;
    (async () => {
      try {
        const google = await loadGoogle();
        const { Place } = await google.maps.importLibrary("places");
        const { places } = await Place.searchByText({ textQuery: name, fields: ["id"], locationBias: { center: { lat, lng }, radius: 300 }, maxResultCount: 1 });
        if (!alive || !host.current) return;
        const id = places?.[0]?.id;
        if (!id) return setState("none");
        host.current.innerHTML = `<gmp-place-details style="width:100%"><gmp-place-details-place-request place="${id}"></gmp-place-details-place-request><gmp-place-content-config><gmp-place-rating></gmp-place-rating><gmp-place-reviews></gmp-place-reviews></gmp-place-content-config></gmp-place-details>`;
      } catch {
        if (alive) setState("error");
      }
    })();
    return () => {
      alive = false;
    };
  }, [state, name, lat, lng]);

  if (!KEY) return null;
  return (
    <div className="pt-1">
      {state === "idle" ? (
        <button type="button" className="text-xs underline" onClick={() => setState("loading")}>
          Google rating &amp; reviews
        </button>
      ) : null}
      {state === "none" ? <p className="text-xs text-slate-600">No Google match for this place.</p> : null}
      {state === "error" ? <p className="text-xs text-slate-600">Could not load Google reviews.</p> : null}
      <div ref={host} style={{ minWidth: 260 }} />
    </div>
  );
}
