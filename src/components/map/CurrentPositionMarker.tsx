"use client";

import L from "leaflet";
import { Circle, Marker } from "react-leaflet";

import type { Coordinates } from "@/lib/types";

interface CurrentPositionMarkerProps {
  position: Coordinates;
  /** When set, a soft halo this many metres wide shows how sure the position is. */
  accuracyM?: number;
}

const currentPositionIcon = L.divIcon({
  className: "",
  html: '<span style="width:16px;height:16px;border-radius:9999px;background:#2563eb;border:3px solid white;box-shadow:0 0 0 4px rgba(37,99,235,0.3);display:block;"></span>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

export function CurrentPositionMarker({
  position,
  accuracyM,
}: CurrentPositionMarkerProps) {
  return (
    <>
      {accuracyM ? (
        <Circle
          center={[position.lat, position.lng]}
          radius={accuracyM}
          interactive={false}
          pathOptions={{ color: "#2563eb", weight: 1, opacity: 0.4, fillColor: "#2563eb", fillOpacity: 0.12 }}
        />
      ) : null}
      <Marker position={[position.lat, position.lng]} icon={currentPositionIcon} />
    </>
  );
}
