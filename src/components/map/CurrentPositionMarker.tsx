"use client";

import L from "leaflet";
import { useMemo } from "react";
import { Circle, Marker } from "react-leaflet";

import { WALKER_BOX_PX, WALKER_COLOR, walkerMarkerHtml } from "@/components/map/WalkerMarker";
import type { Coordinates } from "@/lib/types";

interface CurrentPositionMarkerProps {
  position: Coordinates;
  /** When set, a soft halo this many metres wide shows how sure the position is. */
  accuracyM?: number;
  /** Which way the walker faces, degrees clockwise from north (unwrapped is fine); no arrowhead without it. */
  headingDeg?: number | null;
}

// Leaflet rebuilds the icon element when the icon changes, so a whole degree is the finest turn worth redrawing.
const walkerIcon = (headingDeg: number | null | undefined) =>
  L.divIcon({
    className: "",
    html: walkerMarkerHtml(typeof headingDeg === "number" ? Math.round(headingDeg) : headingDeg),
    iconSize: [WALKER_BOX_PX, WALKER_BOX_PX],
    iconAnchor: [WALKER_BOX_PX / 2, WALKER_BOX_PX / 2],
  });

export function CurrentPositionMarker({
  position,
  accuracyM,
  headingDeg,
}: CurrentPositionMarkerProps) {
  const rounded = typeof headingDeg === "number" && Number.isFinite(headingDeg) ? Math.round(headingDeg) : null;
  const icon = useMemo(() => walkerIcon(rounded), [rounded]);
  return (
    <>
      {accuracyM ? (
        <Circle
          center={[position.lat, position.lng]}
          radius={accuracyM}
          interactive={false}
          pathOptions={{ color: WALKER_COLOR, weight: 1, opacity: 0.4, fillColor: WALKER_COLOR, fillOpacity: 0.12 }}
        />
      ) : null}
      <Marker position={[position.lat, position.lng]} icon={icon} />
    </>
  );
}
