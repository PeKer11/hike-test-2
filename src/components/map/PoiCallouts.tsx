"use client";

import L from "leaflet";
import { useMemo } from "react";
import { Marker } from "react-leaflet";

import type { Announcement } from "@/lib/walk/poi-announcer";
import { walkCopy } from "@/lib/walk/walk-copy";

const CATEGORY_ICON: Record<string, string> = {
  landmark: "🏛",
  museum: "🖼",
  park: "🌳",
  food: "☕",
  viewpoint: "🔭",
  religious: "⛪",
  shopping: "🛍",
  entertainment: "🎭",
  nature: "🌲",
  other: "📍",
};

// Place names come from OpenStreetMap and go into an HTML string for Leaflet's
// divIcon, so they are escaped here — an OSM name is user-edited data.
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function calloutHtml(a: Announcement): string {
  const categoryLabel = a.isPlanStop
    ? walkCopy.callout.nextStop
    : a.place.kind === "scenery"
      ? walkCopy.scenery.other.replace(" (mapped)", "")
      : walkCopy.categories[a.place.category];
  const line = walkCopy.callout.line(
    categoryLabel,
    walkCopy.callout.relation(a.relation),
    a.distanceM,
  );
  const d = walkCopy.discovery.en;
  const verification = a.place.verification;
  const badge =
    verification === "mapped-unnamed"
      ? d["badge.mapped"]
      : verification === "crowd-signal"
        ? d["badge.crowd"]
        : verification === "detected"
          ? d["badge.detected"]
          : walkCopy.callout.osmBadge;
  // A photo hotspot or an unverified find always says so — never "verified".
  const warning =
    verification === "crowd-signal"
      ? d["warn.crowd"]
      : verification === "detected"
        ? d["warn.detected"]
        : null;
  const icon = CATEGORY_ICON[a.place.category] ?? CATEGORY_ICON.other;
  return `<div class="flex w-56 items-start gap-2 rounded-xl border border-forest/20 bg-cream/95 p-2 text-forest shadow-[0_4px_20px_rgba(30,61,47,0.12)]">
    <span aria-hidden="true" class="text-lg leading-none">${icon}</span>
    <span class="min-w-0 flex-1">
      <span dir="auto" class="block truncate text-sm font-semibold">${escapeHtml(a.place.name)}</span>
      <span class="block text-[11px] text-charcoal/70">${escapeHtml(line)}</span>
      ${warning ? `<span class="mt-0.5 block text-[10px] leading-tight text-terra">${escapeHtml(warning)}</span>` : ""}
    </span>
    <span class="rounded bg-forest/10 px-1 text-[10px] font-semibold">${escapeHtml(badge)}</span>
  </div>`;
}

interface PoiCalloutsProps {
  announcements: Announcement[];
  onSelect: (announcement: Announcement) => void;
}

/**
 * The (at most two) places the walker is being told about, as small cards on the
 * map at the place itself. Inside `MapContainer`, so only reachable through
 * `DynamicMap`. Tapping one opens the "Would you like to visit?" sheet.
 */
export function PoiCallouts({ announcements, onSelect }: PoiCalloutsProps) {
  return (
    <>
      {announcements.map((a) => (
        <CalloutMarker key={a.place.id} announcement={a} onSelect={onSelect} />
      ))}
    </>
  );
}

function CalloutMarker({
  announcement,
  onSelect,
}: {
  announcement: Announcement;
  onSelect: (announcement: Announcement) => void;
}) {
  const html = calloutHtml(announcement);
  const tall =
    announcement.place.verification === "crowd-signal" ||
    announcement.place.verification === "detected";
  const icon = useMemo(
    () =>
      L.divIcon({
        className: "",
        html,
        iconSize: [224, tall ? 96 : 52],
        iconAnchor: [112, tall ? 104 : 60],
      }),
    [html, tall],
  );
  return (
    <Marker
      position={[announcement.place.coordinates.lat, announcement.place.coordinates.lng]}
      icon={icon}
      zIndexOffset={800}
      eventHandlers={{ click: () => onSelect(announcement) }}
    />
  );
}
