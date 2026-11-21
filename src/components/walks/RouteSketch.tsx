"use client";

import { useMemo } from "react";

import type { Coordinates } from "@/lib/types";

/** A route drawn small: the walk, the walker, and a dashed line to where it joins. No map library, no tiles. */
export function RouteSketch({ route, here = null, label, className = "h-[120px] w-full", square = false }: { route: Coordinates[]; here?: Coordinates | null; label: string; className?: string; /** A square viewbox, for the 48px tile on a list row. */ square?: boolean }) {
  const view = useMemo(() => {
    const pts = here ? [...route, here] : route;
    const lats = pts.map((p) => p.lat);
    const lngs = pts.map((p) => p.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const span = Math.max(maxLat - minLat, maxLng - minLng, 1e-5);
    const w = square ? 120 : 300;
    const h = 120;
    const pad = 14;
    const scale = (Math.min(w, h) - pad * 2) / span;
    const x = (lng: number) => pad + (lng - minLng) * scale + (w - pad * 2 - (maxLng - minLng) * scale) / 2;
    const y = (lat: number) => h - pad - (lat - minLat) * scale - (h - pad * 2 - (maxLat - minLat) * scale) / 2;
    return { w, h, x, y };
  }, [route, here, square]);
  const d = route.map((p, i) => `${i ? "L" : "M"}${view.x(p.lng).toFixed(1)} ${view.y(p.lat).toFixed(1)}`).join(" ");
  // The dashed approach: from the walker to the closest vertex of the route.
  const near = here
    ? route.reduce((best, p) => (Math.hypot(p.lat - here.lat, p.lng - here.lng) < Math.hypot(best.lat - here.lat, best.lng - here.lng) ? p : best), route[0])
    : null;
  return (
    <svg role="img" aria-label={label} viewBox={`0 0 ${view.w} ${view.h}`} className={`${className} rounded-[14px] bg-forest/5`}>
      <path d={d} fill="none" style={{ stroke: "var(--tk-route)" }} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {here && near ? (
        <>
          <line x1={view.x(here.lng)} y1={view.y(here.lat)} x2={view.x(near.lng)} y2={view.y(near.lat)} style={{ stroke: "var(--tk-terra)" }} strokeWidth="2" strokeDasharray="4 4" strokeLinecap="round" />
          <circle cx={view.x(here.lng)} cy={view.y(here.lat)} r="5" fill="#2563eb" stroke="#fff" strokeWidth="2" />
        </>
      ) : null}
    </svg>
  );
}
