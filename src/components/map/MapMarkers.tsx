"use client";

import L from "leaflet";
import { Marker, Popup } from "react-leaflet";

import type { Waypoint } from "@/lib/types";

interface MapMarkersProps {
  waypoints: Waypoint[];
}

function createMarkerIcon(label: string, color: string) {
  return L.divIcon({
    className: "custom-map-marker",
    html: `<span style="display:flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:9999px;background:${color};color:white;font-size:12px;font-weight:700;border:2px solid white;box-shadow:0 0 0 1px rgba(0,0,0,0.15);">${label}</span>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

export function MapMarkers({ waypoints }: MapMarkersProps) {
  return (
    <>
      {waypoints.map((waypoint, index) => {
        const color = waypoint.isStart
          ? "#dc2626"
          : waypoint.isEnd
            ? "#16a34a"
            : "#2563eb";
        const label = waypoint.isStart ? "S" : waypoint.isEnd ? "E" : String(index + 1);

        return (
          <Marker
            key={waypoint.id}
            position={[waypoint.coordinates.lat, waypoint.coordinates.lng]}
            icon={createMarkerIcon(label, color)}
          >
            <Popup>
              <div className="space-y-1">
                <div className="text-sm font-semibold">{waypoint.name}</div>
                <div className="text-xs text-slate-600">
                  {waypoint.coordinates.lat.toFixed(5)}, {waypoint.coordinates.lng.toFixed(5)}
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}
