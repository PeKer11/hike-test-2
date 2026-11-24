"use client";

import { APIProvider, ColorScheme, ControlPosition, Map, useMap, useMapsLibrary } from "@vis.gl/react-google-maps";
import { useResolvedTheme } from "@/lib/theme/useResolvedTheme";
import { useEffect, useRef } from "react";

import { MapGlyphs } from "@/components/map/MapGlyphs";
import { routeColors, walkedTrail } from "@/lib/map/route-colors";
import { fitPadding, overviewBounds } from "@/lib/map/route-overview";
import { useFollowPause } from "@/lib/hooks/useFollowPause";
import { useIsPhone } from "@/lib/hooks/useIsPhone";

import { GoogleCallouts, GoogleCurrentPosition, GooglePreviewMarkers, GoogleStopMarkers } from "@/components/map/GoogleMarkers";
import { GoogleRecommendedLayer } from "@/components/map/GoogleRecommendedLayer";
import type { MapViewProps } from "@/components/map/MapView";
import type { Coordinates } from "@/lib/types";
import { boundsOf } from "@/lib/utils/geo";

const KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY ?? "";
// AdvancedMarker needs a Map ID; Google's demo ID works for development only.
const MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID ?? "DEMO_MAP_ID";

interface LineProps {
  path: Coordinates[];
  color: string;
  weight: number;
  opacity: number;
  zIndex: number;
  dashed?: boolean;
  /** Small arrows along the line so a loop reads as going one way. */
  arrows?: boolean;
}

/** `@vis.gl/react-google-maps` ships no Polyline, so this wraps `google.maps.Polyline`. */
function Line({ path, color, weight, opacity, zIndex, dashed = false, arrows = false }: LineProps) {
  const map = useMap();
  const maps = useMapsLibrary("maps");

  useEffect(() => {
    if (!map || !maps || path.length < 2) return;
    const line = new maps.Polyline({
      map,
      path,
      zIndex,
      geodesic: false,
      // A dashed Google line is a transparent stroke with a repeated dash symbol.
      strokeColor: color,
      strokeOpacity: dashed ? 0 : opacity,
      strokeWeight: dashed ? 0 : weight,
      icons: [
        ...(dashed
          ? [{ icon: { path: "M 0,-1 0,1", strokeColor: color, strokeOpacity: opacity, strokeWeight: weight, scale: 1 }, offset: "0", repeat: `${weight * 4}px` }]
          : []),
        // Direction: a white arrow with the route's colour as its outline, repeated along the line.
        ...(arrows
          ? [{ icon: { path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW, scale: 2.6, strokeColor: color, strokeOpacity: 1, strokeWeight: 1.5, fillColor: "#ffffff", fillOpacity: 1 }, offset: "40px", repeat: "160px" }]
          : []),
      ],
    });
    return () => line.setMap(null);
  }, [map, maps, path, color, weight, opacity, zIndex, dashed, arrows]);

  return null;
}

function Viewport({ center, zoom, focusTick = 0 }: { center: Coordinates; zoom: number; focusTick?: number }) {
  const map = useMap();
  const lastTick = useRef<number | null>(null);
  // Move the camera only on an explicit focus request, so unrelated re-renders never snap the map back.
  useEffect(() => {
    if (!map || lastTick.current === focusTick) return;
    lastTick.current = focusTick;
    map.moveCamera({ center, zoom });
  }, [map, center, zoom, focusTick]);
  return null;
}

function FitPath({ path }: { path?: Coordinates[] }) {
  const map = useMap();
  useEffect(() => {
    const b = path ? boundsOf(path) : null;
    if (!map || !b) return;
    // The Plan map is hidden until there is a route and shown in the same render that brings it: wait a frame so Google
    // has measured the box before it picks the zoom.
    const frame = requestAnimationFrame(() => {
      google.maps.event.trigger(map, "resize");
      map.fitBounds(b, 48);
    });
    return () => cancelAnimationFrame(frame);
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
    if (!map) return;
    const start = map.addListener("dragstart", pause);
    const end = map.addListener("dragend", scheduleResume);
    // Pinch, wheel and double-tap zoom fire no dragstart; without these the next GPS fix pulled the map back mid-gesture.
    const div = map.getDiv();
    const onWheel = () => { pause(); scheduleResume(); };
    const onTouchStart = (e: TouchEvent) => { if (e.touches.length > 1) pause(); };
    const onTouchEnd = (e: TouchEvent) => { if (e.touches.length === 0) scheduleResume(); };
    div.addEventListener("wheel", onWheel, { passive: true });
    div.addEventListener("dblclick", onWheel);
    div.addEventListener("touchstart", onTouchStart, { passive: true });
    div.addEventListener("touchend", onTouchEnd, { passive: true });
    div.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      start.remove();
      end.remove();
      div.removeEventListener("wheel", onWheel);
      div.removeEventListener("dblclick", onWheel);
      div.removeEventListener("touchstart", onTouchStart);
      div.removeEventListener("touchend", onTouchEnd);
      div.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [map, pause, scheduleResume]);
  useEffect(() => {
    if (map && followPosition && currentPosition && !paused) map.panTo(currentPosition);
  }, [map, currentPosition, followPosition, paused]);
  const recentre = () => {
    resume();
    if (map && currentPosition) map.panTo(currentPosition);
  };
  const fitWholeRoute = () => {
    if (held) return recentre();
    const bounds = overviewBounds(routeGeometry, walkedGeometry, currentPosition);
    if (!map || !bounds) return;
    hold();
    map.fitBounds(bounds, fitPadding(hudInset, isPhone));
  };
  return (
    <MapGlyphs
      showFollow={followPosition}
      following={!paused}
      onFollow={recentre}
      onFitRoute={followPosition && (routeGeometry?.length ?? 0) > 1 ? fitWholeRoute : undefined}
      fitting={held}
      onLayers={onLayers}
      lang={lang}
    />
  );
}

/** Google Maps version of `MapView` — same props, so the planner doesn't change. */
export default function GoogleMapView({
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
  followPosition,
  previewPlaces,
  pinnedIds,
  onTogglePin,
  hudInset = false,
  mapType = "map",
  nextStopId,
  topRated = false,
  onTopRatedNote,
  onOpenDetails,
  callouts,
  onCalloutSelect,
  previewRoutes,
  onAddToWalk,
  addedIds,
  fitPath,
  lang,
}: MapViewProps) {
  const theme = useResolvedTheme();
  const isPhone = useIsPhone();
  const colors = routeColors(theme === "dark" ? "dark" : "light");
  const trail = walkedTrail(theme === "dark" ? "dark" : "light", mapType);

  return (
    // Google's logo and terms link must stay visible, so while the walk HUD is up the map ends above it.
    <div className="absolute inset-x-0 top-0" style={{ bottom: hudInset ? "var(--hud-h, 9rem)" : 0 }}>
      <APIProvider apiKey={KEY}>
        <Map
          mapId={MAP_ID}
          colorScheme={theme === "dark" ? ColorScheme.DARK : ColorScheme.LIGHT}
          defaultCenter={center}
          defaultZoom={zoom}
          gestureHandling="greedy"
          clickableIcons={false}
          streetViewControl={false}
          mapTypeControl={false}
          cameraControl={false}
          mapTypeId={mapType === "satellite" ? "hybrid" : "roadmap"}
          zoomControl={!isPhone}
          zoomControlOptions={{ position: ControlPosition.RIGHT_CENTER }}
          fullscreenControl={false}
          keyboardShortcuts={false}
          style={{ width: "100%", height: "100%" }}
          onClick={(e) => {
            const ll = e.detail.latLng;
            if (ll) onMapClick({ lat: ll.lat, lng: ll.lng });
          }}
        >
          <Viewport center={center} zoom={zoom} focusTick={focusTick} />
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
          {walkedGeometry && walkedGeometry.length > 1 ? (
            <>
              {trail.casing ? <Line path={walkedGeometry} color={trail.casing.color} weight={trail.casing.weight} opacity={trail.casing.opacity} zIndex={0} /> : null}
              <Line path={walkedGeometry} color={trail.core.color} weight={trail.core.weight} opacity={trail.core.opacity} zIndex={1} />
            </>
          ) : null}
          <Line path={routeGeometry} color={colors.casing} weight={9} opacity={0.9} zIndex={2} />
          <Line path={routeGeometry} color={colors.route} weight={5} opacity={0.95} zIndex={3} arrows />
          {previewRoutes?.map((r) => (
            <Line key={r.id} path={r.geometry} color={r.highlighted ? "#c15f3c" : "#1e3d2f"} weight={r.highlighted ? 5 : 3} opacity={r.highlighted ? 0.95 : 0.55} zIndex={3} dashed arrows />
          ))}
          <GoogleStopMarkers waypoints={waypoints} pinnedIds={pinnedIds} onTogglePin={onTogglePin} nextStopId={nextStopId} />
          <GooglePreviewMarkers places={previewPlaces ?? []} />
          <GoogleRecommendedLayer enabled={topRated} onNote={onTopRatedNote} onAddToWalk={onAddToWalk} addedIds={addedIds} />
          {currentPosition ? <GoogleCurrentPosition position={currentPosition} accuracyM={currentAccuracyM} headingDeg={currentHeadingDeg} /> : null}
          {callouts && onCalloutSelect ? <GoogleCallouts announcements={callouts} onSelect={onCalloutSelect} /> : null}
        </Map>
      </APIProvider>
      {/* Our data credits (openrouteservice, OpenStreetMap, WorldCover, Open-Meteo) are one line below the map, drawn by the planner: see MapCredits. */}
    </div>
  );
}
