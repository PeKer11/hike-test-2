"use client";

import { APIProvider, Map, useMap, useMapsLibrary } from "@vis.gl/react-google-maps";
import { useEffect } from "react";

import type { MapViewProps } from "@/components/map/MapView";
import type { Coordinates } from "@/lib/types";
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
}

/** `@vis.gl/react-google-maps` ships no Polyline, so this wraps `google.maps.Polyline`. */
function Line({ path, color, weight, opacity, zIndex, dashed = false }: LineProps) {
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
      icons: dashed
        ? [{ icon: { path: "M 0,-1 0,1", strokeColor: color, strokeOpacity: opacity, strokeWeight: weight, scale: 1 }, offset: "0", repeat: `${weight * 4}px` }]
        : undefined,
    });
    return () => line.setMap(null);
  }, [map, maps, path, color, weight, opacity, zIndex, dashed]);

  return null;
}

function Viewport({ center, zoom, focusTick = 0 }: { center: Coordinates; zoom: number; focusTick?: number }) {
  const map = useMap();
  useEffect(() => {
    map?.moveCamera({ center, zoom });
  }, [map, center, zoom, focusTick]);
  return null;
}

function PositionFollower({ currentPosition, followPosition = false }: { currentPosition?: Coordinates; followPosition?: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (map && followPosition && currentPosition) map.panTo(currentPosition);
  }, [map, currentPosition, followPosition]);
  return null;
}

/** Google Maps version of `MapView` — same props, so the planner doesn't change. */
export default function GoogleMapView({
  routeGeometry,
  walkedGeometry,
  center,
  focusTick,
  zoom,
  onMapClick,
  currentPosition,
  followPosition,
  hudInset = false,
  callouts,
  previewRoutes,
  extraAttribution,
}: MapViewProps) {
  const credits = [
    "Route: © OpenStreetMap contributors · openrouteservice",
    ...(callouts?.some((a) => a.place.verification === "detected") ? [WORLDCOVER_ATTRIBUTION] : []),
    ...(extraAttribution ?? []),
  ];

  return (
    <div className={hudInset ? "walk-hud absolute inset-0" : "absolute inset-0"}>
      <APIProvider apiKey={KEY}>
        <Map
          mapId={MAP_ID}
          defaultCenter={center}
          defaultZoom={zoom}
          gestureHandling="greedy"
          clickableIcons={false}
          disableDefaultUI={false}
          style={{ width: "100%", height: "100%" }}
          onClick={(e) => {
            const ll = e.detail.latLng;
            if (ll) onMapClick({ lat: ll.lat, lng: ll.lng });
          }}
        >
          <Viewport center={center} zoom={zoom} focusTick={focusTick} />
          <PositionFollower currentPosition={currentPosition} followPosition={followPosition} />
          {walkedGeometry && walkedGeometry.length > 1 ? <Line path={walkedGeometry} color="#94a3b8" weight={5} opacity={0.9} zIndex={1} /> : null}
          <Line path={routeGeometry} color="#1f8a4c" weight={5} opacity={0.9} zIndex={2} />
          {previewRoutes?.map((r) => (
            <Line key={r.id} path={r.geometry} color={r.highlighted ? "#c15f3c" : "#1e3d2f"} weight={r.highlighted ? 5 : 3} opacity={r.highlighted ? 0.95 : 0.55} zIndex={3} dashed />
          ))}
        </Map>
      </APIProvider>
      <div className="pointer-events-none absolute bottom-6 left-2 z-10 max-w-[70%] rounded bg-white/80 px-1.5 py-0.5 text-[10px] text-slate-700">
        {credits.join(" · ")}
      </div>
    </div>
  );
}
