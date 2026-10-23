"use client";

import { AdvancedMarker, InfoWindow } from "@vis.gl/react-google-maps";
import { useState } from "react";

import { calloutHtml } from "@/components/map/PoiCallouts";
import { markerIconHtml } from "@/components/map/MapMarkers";
import type { Attraction, Coordinates, Waypoint } from "@/lib/types";
import type { Announcement } from "@/lib/walk/poi-announcer";

const OFFSET = { width: 0, height: -14 } as const;

/** Numbered stops: tap toggles the pin (when allowed) and opens the same info the Leaflet popup showed. */
export function GoogleStopMarkers({
  waypoints,
  pinnedIds = [],
  onTogglePin,
}: {
  waypoints: Waypoint[];
  pinnedIds?: string[];
  onTogglePin?: (waypointId: string) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = waypoints.find((w) => w.id === openId);
  const openIndex = open ? waypoints.indexOf(open) : -1;

  return (
    <>
      {waypoints.map((waypoint, index) => {
        const color = waypoint.isStart ? "#dc2626" : waypoint.isEnd ? "#16a34a" : "#2563eb";
        const label = String(index + 1);
        return (
          <AdvancedMarker
            key={waypoint.id}
            position={waypoint.coordinates}
            onClick={() => {
              onTogglePin?.(waypoint.id);
              setOpenId(waypoint.id);
            }}
          >
            <div className="flex items-center gap-1" data-testid="map-stop-marker">
              <span dangerouslySetInnerHTML={{ __html: markerIconHtml(label, color, pinnedIds.includes(waypoint.id)) }} />
              <span dir="auto" className="rounded bg-white/95 px-1 text-xs font-semibold shadow">
                {label} – {waypoint.name}
              </span>
            </div>
          </AdvancedMarker>
        );
      })}
      {open ? (
        <InfoWindow position={open.coordinates} pixelOffset={[OFFSET.width, OFFSET.height]} onCloseClick={() => setOpenId(null)}>
          <div className="space-y-1">
            <div className="text-sm font-semibold">{open.name}</div>
            {onTogglePin ? (
              <div className="text-xs text-amber-700">
                {pinnedIds.includes(open.id)
                  ? "📌 Pinned — kept when the walk is rebuilt. Tap again to unpin."
                  : "Tap to pin — keeps this stop when the walk is rebuilt."}
              </div>
            ) : null}
            <div className="text-xs text-slate-600">
              {open.coordinates.lat.toFixed(5)}, {open.coordinates.lng.toFixed(5)}
            </div>
            <span className="sr-only">{openIndex + 1}</span>
          </div>
        </InfoWindow>
      ) : null}
    </>
  );
}

/** Amber candidate stops, not yet in a walk. */
export function GooglePreviewMarkers({ places }: { places: Attraction[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = places.find((p) => p.id === openId);
  return (
    <>
      {places.map((place) => (
        <AdvancedMarker key={place.id} position={place.coordinates} onClick={() => setOpenId(place.id)}>
          <span style={{ display: "block", width: 18, height: 18, borderRadius: 9999, background: "#f59e0b", border: "2px solid white", boxShadow: "0 0 0 3px rgba(245,158,11,0.35)" }} />
        </AdvancedMarker>
      ))}
      {open ? (
        <InfoWindow position={open.coordinates} pixelOffset={[0, -12]} onCloseClick={() => setOpenId(null)}>
          <div className="space-y-1">
            <div className="text-sm font-semibold">{open.name}</div>
            <div className="text-xs text-amber-700">Candidate stop — not in your walk yet</div>
            <div className="text-xs text-slate-600">
              {open.coordinates.lat.toFixed(5)}, {open.coordinates.lng.toFixed(5)}
            </div>
          </div>
        </InfoWindow>
      ) : null}
    </>
  );
}

export function GoogleCurrentPosition({ position }: { position: Coordinates }) {
  return (
    <AdvancedMarker position={position} zIndex={500}>
      <span style={{ width: 16, height: 16, borderRadius: 9999, background: "#2563eb", border: "3px solid white", boxShadow: "0 0 0 4px rgba(37,99,235,0.3)", display: "block" }} />
    </AdvancedMarker>
  );
}

/** The (at most two) places the walker is being told about; tapping opens the visit sheet. */
export function GoogleCallouts({ announcements, onSelect }: { announcements: Announcement[]; onSelect: (a: Announcement) => void }) {
  return (
    <>
      {announcements.map((a) => (
        <AdvancedMarker key={a.place.id} position={a.place.coordinates} zIndex={800} onClick={() => onSelect(a)}>
          {/* calloutHtml escapes every place name; it is the same string the Leaflet divIcon used. */}
          <div style={{ transform: "translateY(-8px)" }} dangerouslySetInnerHTML={{ __html: calloutHtml(a) }} />
        </AdvancedMarker>
      ))}
    </>
  );
}
