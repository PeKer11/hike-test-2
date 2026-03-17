"use client";

import { useState } from "react";

import type { Coordinates } from "@/lib/types";

export type MapClickMode = "add-waypoint" | "set-start" | "set-end";

const DEFAULT_CENTER: Coordinates = {
  lat: 31.7683,
  lng: 35.2137,
};

export function useMapInteraction() {
  const [center, setCenter] = useState<Coordinates>(DEFAULT_CENTER);
  const [zoom, setZoom] = useState(12);
  const [clickMode, setClickMode] = useState<MapClickMode>("add-waypoint");

  const focusOn = (coordinates: Coordinates, nextZoom = zoom) => {
    setCenter(coordinates);
    setZoom(nextZoom);
  };

  return {
    center,
    zoom,
    clickMode,
    setCenter,
    setZoom,
    setClickMode,
    focusOn,
  };
}
