"use client";

import L from "leaflet";
import { useMemo } from "react";
import { Marker } from "react-leaflet";

import type { Coordinates } from "@/lib/types";

const M_PER_DEG = 111_320;

function arrowIcon(bearingDeg: number, color: string) {
  return L.divIcon({
    className: "",
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    html: `<svg width="14" height="14" viewBox="0 0 14 14" style="transform:rotate(${bearingDeg}deg);display:block"><path d="M7 1 L12 12 L7 9.5 L2 12 Z" fill="#fff" stroke="${color}" stroke-width="1.4" stroke-linejoin="round"/></svg>`,
  });
}

/** Small white arrows along a route so a loop reads as going one way. */
export function RouteArrows({ geometry, color }: { geometry: Coordinates[]; color: string }) {
  const arrows = useMemo(() => {
    if (geometry.length < 2) return [];
    const cosLat = Math.cos((geometry[0].lat * Math.PI) / 180);
    const dist = (a: Coordinates, b: Coordinates) =>
      Math.hypot((b.lat - a.lat) * M_PER_DEG, (b.lng - a.lng) * M_PER_DEG * cosLat);
    let total = 0;
    for (let i = 1; i < geometry.length; i++) total += dist(geometry[i - 1], geometry[i]);
    const spacing = Math.max(120, total / 40);
    const out: { pos: [number, number]; bearing: number }[] = [];
    let next = spacing / 2;
    let walked = 0;
    for (let i = 1; i < geometry.length; i++) {
      const a = geometry[i - 1];
      const b = geometry[i];
      const seg = dist(a, b);
      while (seg > 0 && walked + seg >= next) {
        const t = (next - walked) / seg;
        const dx = (b.lng - a.lng) * cosLat;
        const dy = b.lat - a.lat;
        out.push({
          pos: [a.lat + (b.lat - a.lat) * t, a.lng + (b.lng - a.lng) * t],
          bearing: (Math.atan2(dx, dy) * 180) / Math.PI,
        });
        next += spacing;
      }
      walked += seg;
    }
    return out;
  }, [geometry]);

  return (
    <>
      {arrows.map((a, i) => (
        <Marker key={i} position={a.pos} icon={arrowIcon(a.bearing, color)} interactive={false} keyboard={false} />
      ))}
    </>
  );
}
