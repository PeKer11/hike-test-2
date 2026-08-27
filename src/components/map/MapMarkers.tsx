"use client";

import L from "leaflet";
import { Marker, Popup } from "react-leaflet";

import type { Waypoint } from "@/lib/types";

interface MapMarkersProps {
  waypoints: Waypoint[];
  /**
   * Stops the walker has pinned. Same array the list view's pin toggle reads,
   * so a stop pinned in one surface is drawn pinned in the other.
   */
  pinnedIds?: string[];
  /**
   * Absent whenever the markers on screen are not a walk's stops — a manually
   * drawn waypoint has an id no pin means anything against. Present, and a tap
   * on a marker toggles that stop's pin.
   */
  onTogglePin?: (waypointId: string) => void;
}

/**
 * The pin is drawn as a ring around the marker, not as a colour.
 *
 * Colour is already spoken for and says something a pin must not overwrite:
 * `#dc2626` is the start of the walk, `#16a34a` the end, `#2563eb` an ordinary
 * numbered stop. The "red dot" this was first sketched as would therefore have
 * collided head-on with the start marker, and painting stop 4 red to mean
 * "pinned" would have made it unreadable as stop 4. A ring stacks on all three
 * instead, so a pinned stop still says which stop it is.
 *
 * Amber rather than any other free colour because the list view's pin button is
 * already amber (`bg-amber-100`, 📌) — the two surfaces are one mechanism and
 * should not need two colours to say so. The ring device itself is the map's
 * own: `PreviewMarkers` and `CurrentPositionMarker` both already use a coloured
 * halo to mean "this marker is special", so this reads as the same language
 * rather than a new one.
 */
export const PIN_RING_COLOR = "rgba(245,158,11,0.9)";

/** The plain marker's hairline outline, kept for every unpinned marker. */
const PLAIN_RING = "0 0 0 1px rgba(0,0,0,0.15)";

/**
 * The marker's inner HTML, as a string, so what a pin actually changes about a
 * marker can be read without a map.
 */
export function markerIconHtml(
  label: string,
  color: string,
  pinned: boolean,
): string {
  const ring = pinned ? `0 0 0 3px ${PIN_RING_COLOR}` : PLAIN_RING;

  return `<span style="display:flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:9999px;background:${color};color:white;font-size:12px;font-weight:700;border:2px solid white;box-shadow:${ring};">${label}</span>`;
}

function createMarkerIcon(label: string, color: string, pinned: boolean) {
  return L.divIcon({
    className: "custom-map-marker",
    html: markerIconHtml(label, color, pinned),
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

export function MapMarkers({
  waypoints,
  pinnedIds = [],
  onTogglePin,
}: MapMarkersProps) {
  return (
    <>
      {waypoints.map((waypoint, index) => {
        const color = waypoint.isStart
          ? "#dc2626"
          : waypoint.isEnd
            ? "#16a34a"
            : "#2563eb";
        const label = waypoint.isStart ? "S" : waypoint.isEnd ? "E" : String(index + 1);
        const isPinned = pinnedIds.includes(waypoint.id);

        return (
          <Marker
            key={waypoint.id}
            position={[waypoint.coordinates.lat, waypoint.coordinates.lng]}
            icon={createMarkerIcon(label, color, isPinned)}
            // The popup still opens on the same tap, and that is deliberate:
            // a divIcon has nowhere to put a label, so the popup is the only
            // place the map can say out loud which way the pin just went.
            eventHandlers={
              onTogglePin
                ? { click: () => onTogglePin(waypoint.id) }
                : undefined
            }
          >
            <Popup>
              <div className="space-y-1">
                <div className="text-sm font-semibold">{waypoint.name}</div>
                {onTogglePin && (
                  <div className="text-xs text-amber-700">
                    {isPinned
                      ? "📌 Pinned — kept when the walk is rebuilt. Tap again to unpin."
                      : "Tap to pin — keeps this stop when the walk is rebuilt."}
                  </div>
                )}
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
