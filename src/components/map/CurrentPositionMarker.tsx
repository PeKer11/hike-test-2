"use client";

import L from "leaflet";
import { Marker } from "react-leaflet";

import type { Coordinates } from "@/lib/types";

interface CurrentPositionMarkerProps {
  position: Coordinates;
}

const currentPositionIcon = L.divIcon({
  className: "",
  html: '<span style="width:16px;height:16px;border-radius:9999px;background:#2563eb;border:3px solid white;box-shadow:0 0 0 4px rgba(37,99,235,0.3);display:block;"></span>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

export function CurrentPositionMarker({
  position,
}: CurrentPositionMarkerProps) {
  return <Marker position={[position.lat, position.lng]} icon={currentPositionIcon} />;
}
