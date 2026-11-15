"use client";

import "leaflet/dist/leaflet.css";
import "leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css";
import "leaflet-defaulticon-compatibility";

import { AttributionControl, MapContainer, Polyline, TileLayer, useMap } from "react-leaflet";
import { useEffect, useState } from "react";

import { MapClickHandler } from "@/components/map/MapClickHandler";
import { CurrentPositionMarker } from "@/components/map/CurrentPositionMarker";
import { MapMarkers } from "@/components/map/MapMarkers";
import { OptionPreviewLines, type PreviewRoute } from "@/components/map/OptionPreviewLines";
import { ExtraAttribution } from "@/components/map/ExtraAttribution";
import { PoiCallouts } from "@/components/map/PoiCallouts";
import { RecommendedLayer } from "@/components/map/RecommendedLayer";
import { PreviewMarkers } from "@/components/map/PreviewMarkers";
import { RoutePolyline } from "@/components/map/RoutePolyline";
import { WORLDCOVER_ATTRIBUTION } from "@/lib/types/landcover";
import { getTileAttribution, getTileUrl } from "@/lib/map/tile-config";
import type { Attraction, Coordinates, Waypoint } from "@/lib/types";
import type { Announcement } from "@/lib/walk/poi-announcer";

export interface MapViewProps {
  waypoints: Waypoint[];
  routeGeometry: Coordinates[];
  /** The path already walked, drawn in a muted colour under the remaining route. */
  walkedGeometry?: Coordinates[];
  center: Coordinates;
  focusTick?: number;
  zoom: number;
  onMapClick: (coordinates: Coordinates) => void;
  currentPosition?: Coordinates;
  followPosition?: boolean;
  /** Places found from free text but not accepted into a walk yet. */
  previewPlaces?: Attraction[];
  /** Stops the walker has pinned, drawn with a ring — see `MapMarkers`. */
  pinnedIds?: string[];
  /** Present only while the markers on screen are a walk's own stops. */
  onTogglePin?: (waypointId: string) => void;
  /** A walk HUD covers the map's bottom edge: keep the attribution above it. */
  hudInset?: boolean;
  /** Embedded (not full-screen) frame: map overlays keep clear of the Map/Satellite switch. */
  compactControls?: boolean;
  /** Places the walker is being told about right now (walking only). */
  callouts?: Announcement[];
  onCalloutSelect?: (announcement: Announcement) => void;
  /** Dashed previews of the directions on offer after a collapse. */
  previewRoutes?: PreviewRoute[];
  /** Extra data-source credits (e.g. Open-Meteo while the companion uses weather). */
  extraAttribution?: string[];
  /** "Add to walk" on a Recommended-layer place; the layer shows no button without it. */
  onAddToWalk?: (place: Attraction) => void;
  addedIds?: string[];
  /** Fit the view around this path once (a saved walk shown from the list). */
  fitPath?: Coordinates[];
}

function MapViewport({ center, zoom, focusTick = 0 }: { center: Coordinates; zoom: number; focusTick?: number }) {
  const map = useMap();

  useEffect(() => {
    map.setView([center.lat, center.lng], zoom);
  }, [map, center.lat, center.lng, zoom, focusTick]);

  return null;
}

function MapSizeInvalidator() {
  const map = useMap();

  useEffect(() => {
    const invalidate = () => {
      map.invalidateSize();
    };

    const frameId = window.requestAnimationFrame(() => {
      invalidate();
      window.setTimeout(invalidate, 150);
    });

    window.addEventListener("resize", invalidate);
    window.addEventListener("orientationchange", invalidate);

    // The map now lives in a box that resizes without the window resizing —
    // expanding/collapsing the planner frame on /app. Without this, Leaflet
    // keeps the old pixel size and the tiles come out cropped or grey.
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(invalidate);
    observer?.observe(map.getContainer());

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", invalidate);
      window.removeEventListener("orientationchange", invalidate);
      observer?.disconnect();
    };
  }, [map]);

  return null;
}

function PositionFollower({
  currentPosition,
  followPosition = false,
}: {
  currentPosition?: Coordinates;
  followPosition?: boolean;
}) {
  const map = useMap();
  // The walker dragged the map: stop pulling it back until they tap "re-centre".
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const pause = () => setPaused(true);
    map.on("dragstart", pause);
    return () => {
      map.off("dragstart", pause);
    };
  }, [map]);

  useEffect(() => {
    if (!followPosition || !currentPosition || paused) {
      return;
    }

    map.panTo([currentPosition.lat, currentPosition.lng]);
  }, [currentPosition, followPosition, map, paused]);

  return (
    <>
      {paused ? (
        <button
          type="button"
          onClick={() => setPaused(false)}
          aria-label="Re-centre on me"
          className="absolute left-[10px] top-[96px] z-[1000] flex h-11 w-11 items-center justify-center rounded-full border border-forest/20 bg-paper text-forest shadow-tk-card"
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
            <circle cx="12" cy="12" r="3.5" />
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
          </svg>
        </button>
      ) : null}
    </>
  );
}

export default function MapView({
  waypoints,
  routeGeometry,
  walkedGeometry,
  center,
  focusTick,
  zoom,
  onMapClick,
  currentPosition,
  followPosition,
  previewPlaces,
  pinnedIds,
  onTogglePin,
  hudInset = false,
  callouts,
  onCalloutSelect,
  previewRoutes,
  extraAttribution,
  onAddToWalk,
  addedIds,
}: MapViewProps) {
  // ESA WorldCover (CC BY 4.0) is credited whenever a satellite find is on the map.
  const credits = [
    ...(callouts?.some((a) => a.place.verification === "detected")
      ? [WORLDCOVER_ATTRIBUTION]
      : []),
    ...(extraAttribution ?? []),
  ];
  return (
    <div className={hudInset ? "walk-hud absolute inset-0" : "absolute inset-0"}>
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={zoom}
        className="h-full w-full"
        style={{ height: "100%", width: "100%" }}
        attributionControl={false}
      >
      {/* No "Leaflet" prefix (optional); the OpenStreetMap credit itself is a licence requirement and stays. */}
      <AttributionControl prefix={false} />
      <TileLayer
        attribution={getTileAttribution()}
        url={getTileUrl()}
      />
      <ExtraAttribution texts={credits} />
      <MapViewport center={center} zoom={zoom} focusTick={focusTick} />
      <MapSizeInvalidator />
      <PositionFollower
        currentPosition={currentPosition}
        followPosition={followPosition}
      />
      <MapMarkers
        waypoints={waypoints}
        pinnedIds={pinnedIds}
        onTogglePin={onTogglePin}
      />
      <PreviewMarkers places={previewPlaces ?? []} />
      <RecommendedLayer onAddToWalk={onAddToWalk} addedIds={addedIds} />
      {currentPosition ? <CurrentPositionMarker position={currentPosition} /> : null}
      {walkedGeometry && walkedGeometry.length > 1 ? (
        <Polyline
          positions={walkedGeometry.map((p) => [p.lat, p.lng])}
          pathOptions={{ color: "#94a3b8", weight: 5, opacity: 0.9 }}
        />
      ) : null}
      <RoutePolyline geometry={routeGeometry} />
      {previewRoutes && previewRoutes.length > 0 ? (
        <OptionPreviewLines routes={previewRoutes} />
      ) : null}
      {callouts && onCalloutSelect ? (
        <PoiCallouts announcements={callouts} onSelect={onCalloutSelect} />
      ) : null}
      <MapClickHandler onMapClick={onMapClick} />
      </MapContainer>
    </div>
  );
}
