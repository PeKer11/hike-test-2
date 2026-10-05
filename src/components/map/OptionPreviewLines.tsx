"use client";

import { Polyline } from "react-leaflet";

import type { Coordinates } from "@/lib/types";

export interface PreviewRoute {
  id: string;
  geometry: Coordinates[];
  highlighted: boolean;
}

/**
 * Dashed previews of the directions on offer; the highlighted one is heavier and
 * terra. Inside `MapContainer`, so only reachable through `DynamicMap`.
 */
export function OptionPreviewLines({ routes }: { routes: PreviewRoute[] }) {
  return (
    <>
      {routes
        .filter((r) => r.geometry.length >= 2)
        .map((r) => (
          <Polyline
            key={r.id}
            positions={r.geometry.map((p) => [p.lat, p.lng])}
            pathOptions={{
              color: r.highlighted ? "#c15f3c" : "#1e3d2f",
              weight: r.highlighted ? 5 : 3,
              opacity: r.highlighted ? 0.95 : 0.55,
              dashArray: "8 8",
            }}
          />
        ))}
    </>
  );
}
