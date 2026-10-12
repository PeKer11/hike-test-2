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

const HAZARD_KEY = {
  private: "hazard.private",
  reserve: "hazard.reserve",
  flood: "hazard.flood",
  fire: "hazard.fire",
  cliff: "hazard.cliff",
  "mixed-area": "hazard.mixed",
} as const;

/**
 * The card for an imagery-detected find: EN and HE lines, always the lead
 * ("not a registered place"), at least one hazard (private is the floor),
 * "check signs", and the footer. Never says safe or verified.
 */
export function detectedCardHtml(a: Announcement): string {
  const en = walkCopy.discovery.en;
  const he = walkCopy.discovery.he;
  const water = a.place.tags["detected:class"] === "water";
  const codes = (a.place.tags["detected:hazards"] ?? "")
    .split(",")
    .filter((c): c is keyof typeof HAZARD_KEY => c in HAZARD_KEY);
  const hazards = codes.length > 0 ? codes : (["private"] as const);
  const pair = (k: keyof typeof en, cls: string) =>
    `<span class="block ${cls}">${escapeHtml(en[k])}</span><span dir="rtl" class="block ${cls}">${escapeHtml(he[k])}</span>`;
  const lead = water ? "detected.leadWater" : "detected.lead";
  return `<div class="w-64 rounded-xl border border-terra/40 bg-cream/95 p-2 text-forest shadow-[0_4px_20px_rgba(30,61,47,0.12)]">
    <span class="flex items-start justify-between gap-2">
      <span dir="auto" class="min-w-0 flex-1 truncate text-sm font-semibold">${escapeHtml(a.place.name)}</span>
      <span class="rounded bg-forest/10 px-1 text-[10px] font-semibold">${escapeHtml(en["badge.detected"])} · ${escapeHtml(he["badge.detected"])}</span>
    </span>
    ${pair(lead, "mt-0.5 text-[10px] leading-tight text-charcoal/80")}
    ${hazards.map((h) => pair(HAZARD_KEY[h], "mt-0.5 text-[10px] leading-tight text-terra")).join("")}
    ${pair("detected.checkSigns", "mt-0.5 text-[10px] font-semibold leading-tight")}
    ${pair("detected.footer", "mt-0.5 text-[9px] leading-tight text-charcoal/60")}
  </div>`;
}

export function calloutHtml(a: Announcement): string {
  if (a.place.verification === "detected") return detectedCardHtml(a);
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
        : walkCopy.callout.osmBadge;
  // A photo hotspot always says so — never "verified". (Detected finds take
  // the early return above, with their own multi-line card.)
  const warning = verification === "crowd-signal" ? d["warn.crowd"] : null;
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
  const detected = announcement.place.verification === "detected";
  const icon = useMemo(
    () =>
      L.divIcon({
        className: "",
        html,
        iconSize: detected ? [256, 300] : [224, tall ? 96 : 52],
        iconAnchor: detected ? [128, 308] : [112, tall ? 104 : 60],
      }),
    [html, tall, detected],
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
