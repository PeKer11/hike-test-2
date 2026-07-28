"use client";

import L from "leaflet";
import { Marker, Popup } from "react-leaflet";

import type { Attraction } from "@/lib/types";

interface PreviewMarkersProps {
  places: Attraction[];
}

// Amber ring, no number: these are candidates the user is still checking, not
// numbered stops on a committed route like MapMarkers draws.
const previewIcon = L.divIcon({
  className: "custom-map-preview-marker",
  html: '<span style="display:block;width:18px;height:18px;border-radius:9999px;background:#f59e0b;border:2px solid white;box-shadow:0 0 0 3px rgba(245,158,11,0.35);"></span>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

export function PreviewMarkers({ places }: PreviewMarkersProps) {
  return (
    <>
      {places.map((place) => (
        <Marker
          key={place.id}
          position={[place.coordinates.lat, place.coordinates.lng]}
          icon={previewIcon}
        >
          <Popup>
            <div className="space-y-1">
              <div className="text-sm font-semibold">{place.name}</div>
              <div className="text-xs text-amber-700">
                Candidate stop — not in your walk yet
              </div>
              <div className="text-xs text-slate-600">
                {place.coordinates.lat.toFixed(5)}, {place.coordinates.lng.toFixed(5)}
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
}
