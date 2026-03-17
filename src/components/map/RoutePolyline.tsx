"use client";

import { Polyline } from "react-leaflet";

import type { Coordinates } from "@/lib/types";

interface RoutePolylineProps {
  geometry: Coordinates[];
}

export function RoutePolyline({ geometry }: RoutePolylineProps) {
  if (geometry.length < 2) {
    return null;
  }

  return (
    <Polyline
      positions={geometry.map((point) => [point.lat, point.lng])}
      pathOptions={{ color: "#0f766e", weight: 5, opacity: 0.8 }}
    />
  );
}
