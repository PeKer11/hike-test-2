"use client";

import { useMapEvents } from "react-leaflet";

import type { Coordinates } from "@/lib/types";

interface MapClickHandlerProps {
  onMapClick: (coordinates: Coordinates) => void;
}

export function MapClickHandler({ onMapClick }: MapClickHandlerProps) {
  useMapEvents({
    click(event) {
      onMapClick({
        lat: event.latlng.lat,
        lng: event.latlng.lng,
      });
    },
  });

  return null;
}
