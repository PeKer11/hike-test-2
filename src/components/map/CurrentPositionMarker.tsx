"use client";

import L from "leaflet";
import { useEffect, useMemo, useRef } from "react";
import { Circle, Marker } from "react-leaflet";

import { HALO_FILL_OPACITY, HALO_MIN_ACCURACY_M, HALO_STROKE_OPACITY, WALKER_BOX_PX, WALKER_COLOR, applyBeamHeading, walkerMarkerHtml } from "@/components/map/WalkerMarker";
import type { Coordinates } from "@/lib/types";
import type { HeadingStore } from "@/lib/walk/heading-store";

interface CurrentPositionMarkerProps {
  position: Coordinates;
  /** When set, a soft halo this many metres wide shows how sure the position is. */
  accuracyM?: number;
  /** Which way the walker faces, degrees clockwise from north (unwrapped is fine); no arrowhead without it. */
  headingDeg?: number | null;
  /** The live heading: when given, the icon is built once and its beam is turned in the DOM, with no React render. */
  headingStore?: HeadingStore;
}

// Leaflet rebuilds the icon element when the icon changes, so a whole degree is the finest turn worth redrawing.
const walkerIcon = (headingDeg: number | null | undefined, liveBeam = false) =>
  L.divIcon({
    className: "",
    html: walkerMarkerHtml(typeof headingDeg === "number" ? Math.round(headingDeg) : headingDeg, { liveBeam }),
    iconSize: [WALKER_BOX_PX, WALKER_BOX_PX],
    iconAnchor: [WALKER_BOX_PX / 2, WALKER_BOX_PX / 2],
  });

export function CurrentPositionMarker({
  position,
  accuracyM,
  headingDeg,
  headingStore,
}: CurrentPositionMarkerProps) {
  const rounded = typeof headingDeg === "number" && Number.isFinite(headingDeg) ? Math.round(headingDeg) : null;
  const live = !!headingStore;
  const icon = useMemo(() => (live ? walkerIcon(null, true) : walkerIcon(rounded)), [live, rounded]);
  const markerRef = useRef<L.Marker | null>(null);
  useEffect(() => {
    if (!headingStore) return;
    const marker = markerRef.current;
    const apply = () => applyBeamHeading(marker?.getElement()?.querySelector<HTMLElement>("[data-testid=walker-beam]"), headingStore.get());
    apply();
    marker?.on("add", apply);
    const off = headingStore.subscribe(apply);
    return () => {
      off();
      marker?.off("add", apply);
    };
  }, [headingStore, icon]);
  return (
    <>
      {accuracyM && accuracyM > HALO_MIN_ACCURACY_M ? (
        <Circle
          center={[position.lat, position.lng]}
          radius={accuracyM}
          interactive={false}
          pathOptions={{ color: WALKER_COLOR, weight: 1, opacity: HALO_STROKE_OPACITY, fillColor: WALKER_COLOR, fillOpacity: HALO_FILL_OPACITY }}
        />
      ) : null}
      <Marker ref={markerRef} position={[position.lat, position.lng]} icon={icon} />
    </>
  );
}
