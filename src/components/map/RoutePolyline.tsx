"use client";

import { Pane, Polyline } from "react-leaflet";

import { useResolvedTheme } from "@/lib/theme/useResolvedTheme";
import { routeColors } from "@/lib/map/route-colors";
import { RouteArrows } from "@/components/map/RouteArrows";
import type { Coordinates } from "@/lib/types";

interface RoutePolylineProps {
  geometry: Coordinates[];
}

export function RoutePolyline({ geometry }: RoutePolylineProps) {
  const colors = routeColors(useResolvedTheme() === "dark" ? "dark" : "light");
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
        pathOptions={{ color: colors.casing, weight: 9, opacity: 0.9 }}
      />
      <Polyline
        pane="remaining-route"
        positions={geometry.map((point) => [point.lat, point.lng])}
        pathOptions={{ color: colors.route, weight: 5, opacity: 0.95 }}
      />
      <RouteArrows geometry={geometry} color={colors.route} />
    </Pane>
  );
}
