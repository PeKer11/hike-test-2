"use client";

import { APIProvider, ColorScheme, ControlPosition, Map, useMap, useMapsLibrary } from "@vis.gl/react-google-maps";
import { useResolvedTheme } from "@/lib/theme/useResolvedTheme";
import { useEffect, useRef, useState } from "react";

import { GoogleCallouts, GoogleCurrentPosition, GooglePreviewMarkers, GoogleStopMarkers } from "@/components/map/GoogleMarkers";
import { GoogleRecommendedLayer } from "@/components/map/GoogleRecommendedLayer";
import type { MapViewProps } from "@/components/map/MapView";
import type { Coordinates } from "@/lib/types";
import { boundsOf } from "@/lib/utils/geo";
import { WORLDCOVER_ATTRIBUTION } from "@/lib/types/landcover";

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
          ? [{ icon: { path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW, scale: 2.6, strokeColor: color, strokeOpacity: 1, strokeWeight: 1.5, fillColor: "#ffffff", fillOpacity: 1 }, offset: "40px", repeat: "110px" }]
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
    if (map && b) map.fitBounds(b, 48);
  }, [map, path]);
  return null;
}

function PositionFollower({ currentPosition, followPosition = false }: { currentPosition?: Coordinates; followPosition?: boolean }) {
  const map = useMap();
  // The walker dragged the map: stop pulling it back until they tap "re-centre".
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (!map) return;
    const l = map.addListener("dragstart", () => setPaused(true));
    return () => l.remove();
  }, [map]);
  useEffect(() => {
    if (map && followPosition && currentPosition && !paused) map.panTo(currentPosition);
  }, [map, currentPosition, followPosition, paused]);
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
  followPosition,
  previewPlaces,
  pinnedIds,
  onTogglePin,
  hudInset = false,
  compactControls = false,
  callouts,
  onCalloutSelect,
  previewRoutes,
  extraAttribution,
  onAddToWalk,
  addedIds,
  fitPath,
}: MapViewProps) {
  const theme = useResolvedTheme();
  const credits = [
    "Route: © openrouteservice by HeiGIT | Data from OpenStreetMap, © OpenStreetMap contributors",
    ...(callouts?.some((a) => a.place.verification === "detected") ? [WORLDCOVER_ATTRIBUTION] : []),
    ...(extraAttribution ?? []),
  ];

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
          zoomControl
          zoomControlOptions={{ position: ControlPosition.RIGHT_BOTTOM }}
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
          <PositionFollower currentPosition={currentPosition} followPosition={followPosition} />
          {walkedGeometry && walkedGeometry.length > 1 ? <Line path={walkedGeometry} color="#94a3b8" weight={5} opacity={0.9} zIndex={1} /> : null}
          <Line path={routeGeometry} color="#1f8a4c" weight={5} opacity={0.9} zIndex={2} arrows />
          {previewRoutes?.map((r) => (
            <Line key={r.id} path={r.geometry} color={r.highlighted ? "#c15f3c" : "#1e3d2f"} weight={r.highlighted ? 5 : 3} opacity={r.highlighted ? 0.95 : 0.55} zIndex={3} dashed arrows />
          ))}
          <GoogleStopMarkers waypoints={waypoints} pinnedIds={pinnedIds} onTogglePin={onTogglePin} />
          <GooglePreviewMarkers places={previewPlaces ?? []} />
          <GoogleRecommendedLayer compact={compactControls} onAddToWalk={onAddToWalk} addedIds={addedIds} />
          {currentPosition ? <GoogleCurrentPosition position={currentPosition} accuracyM={currentAccuracyM} /> : null}
          {callouts && onCalloutSelect ? <GoogleCallouts announcements={callouts} onSelect={onCalloutSelect} /> : null}
        </Map>
      </APIProvider>
      {/* Our own credits sit small at the map's bottom edge, beside Google's logo. Google's logo and terms stay on the map: its terms require them. */}
      <div className="pointer-events-none absolute bottom-0 left-24 z-[900] max-w-[40%] bg-paper/80 px-1.5 py-0.5 text-[9px] leading-tight text-slate-700">
        {credits.join(" · ")}
      </div>
    </div>
  );
}
