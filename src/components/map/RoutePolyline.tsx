"use client";

import { Pane, Polyline } from "react-leaflet";

import type { Coordinates } from "@/lib/types";

interface RoutePolylineProps {
  geometry: Coordinates[];
}

export function RoutePolyline({ geometry }: RoutePolylineProps) {
  if (geometry.length < 2) {
    return null;
  }

  return (
    // Own pane above the default overlay pane (400), so the green route always
    // draws over the grey walked trail, whichever of them was added to the map last.
    <Pane name="remaining-route" style={{ zIndex: 410 }}>
      <Polyline
        pane="remaining-route"
        positions={geometry.map((point) => [point.lat, point.lng])}
        pathOptions={{ color: "#1f8a4c", weight: 5, opacity: 0.9 }}
      />
    </Pane>
  );
}
