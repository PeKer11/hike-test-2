"use client";

import "leaflet/dist/leaflet.css";
import "leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css";
import "leaflet-defaulticon-compatibility";

import { AttributionControl, MapContainer, Polyline, TileLayer, useMap } from "react-leaflet";
import { useCallback, useEffect, useRef } from "react";

import { MapClickHandler } from "@/components/map/MapClickHandler";
import { GpsDebugLine } from "@/components/map/GpsDebugLine";
import { MapGlyphs } from "@/components/map/MapGlyphs";
import { walkedTrail } from "@/lib/map/route-colors";
import { fitPadding, overviewBounds } from "@/lib/map/route-overview";
import { boundsOf } from "@/lib/utils/geo";
import { useResolvedTheme } from "@/lib/theme/useResolvedTheme";
import { useFollowPause } from "@/lib/hooks/useFollowPause";
import { WALK_FOLLOW_ZOOM } from "@/lib/walk/walk-cadence";
import { useIsPhone } from "@/lib/hooks/useIsPhone";
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
import type { HeadingStore } from "@/lib/walk/heading-store";
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
  /** How sure the position is, in metres: drawn as a soft halo around the dot. */
  currentAccuracyM?: number;
  /** Which way the walker faces, degrees clockwise from north; the dot shows an arrowhead only while there is one. */
  currentHeadingDeg?: number | null;
  /** The live heading store: the beam turns from it in the DOM, with no React render (see `useWalkerHeading`). */
  headingStore?: HeadingStore;
  followPosition?: boolean;
  /** Places found from free text but not accepted into a walk yet. */
  previewPlaces?: Attraction[];
  /** Stops the walker has pinned, drawn with a ring — see `MapMarkers`. */
  pinnedIds?: string[];
  /** Present only while the markers on screen are a walk's own stops. */
  onTogglePin?: (waypointId: string) => void;
  /** A walk HUD covers the map's bottom edge: keep the attribution above it. */
  hudInset?: boolean;
  /** Base map: our own Details control drives this (Google map only). */
  mapType?: "map" | "satellite";
  /** Walking only: the one stop whose name is shown on the map; null = none, undefined = label every stop. */
  nextStopId?: string | null;
  /** Top-rated layer on/off (Google map only), driven from Details. */
  topRated?: boolean;
  onTopRatedNote?: (note: string) => void;
  /** The layers glyph: open the Details sheet at its display section. */
  onOpenDetails?: () => void;
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
  /** The screen's language, for the labels on the map's own controls. */
  lang?: "he" | "en";
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

function FitPath({ path }: { path?: Coordinates[] }) {
  const map = useMap();
  useEffect(() => {
    const b = path ? boundsOf(path) : null;
    if (b) map.fitBounds([[b.south, b.west], [b.north, b.east]], { padding: [48, 48] });
  }, [map, path]);
  return null;
}

function PositionFollower({
  currentPosition,
  followPosition = false,
  onLayers,
  routeGeometry,
  walkedGeometry,
  hudInset = false,
  isPhone = false,
  lang = "en",
}: {
  currentPosition?: Coordinates;
  followPosition?: boolean;
  onLayers?: () => void;
  routeGeometry?: Coordinates[];
  walkedGeometry?: Coordinates[];
  hudInset?: boolean;
  isPhone?: boolean;
  lang?: "he" | "en";
}) {
  const map = useMap();
  // The walker dragged the map: stop pulling it back for a while (or until they tap "re-centre").
  // The "whole route" glyph holds it off for a minute instead (`held`), and a second tap hands it back.
  const { paused, held, pause, scheduleResume, hold, resume } = useFollowPause();

  useEffect(() => {
    map.on("dragstart", pause);
    map.on("dragend", scheduleResume);
    return () => {
      map.off("dragstart", pause);
      map.off("dragend", scheduleResume);
    };
  }, [map, pause, scheduleResume]);

  // Following starts (a walk begins): come in to street level once, so walking visibly moves the map.
  const zoomedForFollow = useRef(false);
  useEffect(() => {
    if (!followPosition) {
      zoomedForFollow.current = false;
      return;
    }
    if (!currentPosition || zoomedForFollow.current) return;
    zoomedForFollow.current = true;
    if (map.getZoom() < WALK_FOLLOW_ZOOM) map.setView([currentPosition.lat, currentPosition.lng], WALK_FOLLOW_ZOOM);
  }, [currentPosition, followPosition, map]);

  useEffect(() => {
    if (!followPosition || !currentPosition || paused) {
      return;
    }

    map.panTo([currentPosition.lat, currentPosition.lng]);
  }, [currentPosition, followPosition, map, paused]);

  const recentre = () => {
    resume();
    if (!currentPosition) return;
    if (map.getZoom() < WALK_FOLLOW_ZOOM) map.setView([currentPosition.lat, currentPosition.lng], WALK_FOLLOW_ZOOM);
    else map.panTo([currentPosition.lat, currentPosition.lng]);
  };
  const fitWholeRoute = () => {
    if (held) return recentre();
    const bounds = overviewBounds(routeGeometry, walkedGeometry, currentPosition);
    if (!bounds) return;
    hold();
    const pad = fitPadding(hudInset, isPhone);
    // Leaflet's map runs under the walk sheet (the sheet publishes its height as --hud-h), so the route must fit above it.
    const sheetPx = hudInset ? Number.parseFloat(getComputedStyle(map.getContainer()).getPropertyValue("--hud-h")) || 0 : 0;
    map.fitBounds([[bounds.south, bounds.west], [bounds.north, bounds.east]], {
      paddingTopLeft: [pad.left, pad.top],
      paddingBottomRight: [pad.right, pad.bottom + sheetPx],
    });
  };

  const getZoom = useCallback(() => map.getZoom(), [map]);
  return (
    <>
      <GpsDebugLine getZoom={getZoom} follow={followPosition && !paused} />
      <MapGlyphs
        showFollow={followPosition}
        following={!paused}
        onFollow={recentre}
        onFitRoute={followPosition && (routeGeometry?.length ?? 0) > 1 ? fitWholeRoute : undefined}
        fitting={held}
        onLayers={onLayers}
        lang={lang}
      />
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
  currentAccuracyM,
  currentHeadingDeg,
  headingStore,
  followPosition,
  previewPlaces,
  pinnedIds,
  onTogglePin,
  hudInset = false,
  onOpenDetails,
  callouts,
  onCalloutSelect,
  previewRoutes,
  extraAttribution,
  onAddToWalk,
  addedIds,
  fitPath,
  lang,
}: MapViewProps) {
  const isPhone = useIsPhone();
  const theme = useResolvedTheme();
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
        zoomControl={!isPhone}
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
      <FitPath path={fitPath} />
      <PositionFollower
        currentPosition={currentPosition}
        followPosition={followPosition}
        onLayers={onOpenDetails}
        routeGeometry={routeGeometry}
        walkedGeometry={walkedGeometry}
        hudInset={hudInset}
        isPhone={isPhone}
        lang={lang}
      />
      <MapMarkers
        waypoints={waypoints}
        pinnedIds={pinnedIds}
        onTogglePin={onTogglePin}
      />
      <PreviewMarkers places={previewPlaces ?? []} />
      <RecommendedLayer onAddToWalk={onAddToWalk} addedIds={addedIds} />
      {currentPosition ? <CurrentPositionMarker position={currentPosition} accuracyM={currentAccuracyM} headingDeg={currentHeadingDeg} headingStore={headingStore} /> : null}
      {walkedGeometry && walkedGeometry.length > 1 ? (
        <Polyline
          positions={walkedGeometry.map((p) => [p.lat, p.lng])}
          pathOptions={walkedTrail(theme === "dark" ? "dark" : "light").core}
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
