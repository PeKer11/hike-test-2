"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { LogoutButton } from "@/components/auth/LogoutButton";
import { GROUPS } from "@/components/map/top-rated-groups";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { SEG_WRAP, chipCell, segCell } from "@/components/ui/panel-style";

type Lang = "en" | "he";

const COPY = {
  en: { mapView: "Map view", baseMap: "Base map", map: "Map", satellite: "Satellite", dayNight: "Day / night", placesAround: "Places around", topRated: "Top rated", on: "On", off: "Off", account: "Account", changePassword: "Change password", logout: { idle: "Log out", busy: "Logging out…" } },
  he: { mapView: "תצוגת מפה", baseMap: "מפת בסיס", map: "מפה", satellite: "לוויין", dayNight: "יום / לילה", placesAround: "מקומות בסביבה", topRated: "מדורגים גבוה", on: "פעיל", off: "כבוי", account: "חשבון", changePassword: "החלפת סיסמה", logout: { idle: "יציאה", busy: "יוצאים…" } },
} as const;

const CARD = "mx-auto w-full max-w-[440px] space-y-3 border-b border-tk-hair bg-cream px-4 py-3 font-app-sans";

/** Base map and day/night. `id` is where the layers glyph scrolls to. */
export function DisplaySection({
  mapType,
  onMapType,
  showMapType,
  children,
  lang = "en",
}: {
  lang?: Lang;
  mapType: "map" | "satellite";
  onMapType: (type: "map" | "satellite") => void;
  /** Only the Google map has a satellite view. */
  showMapType: boolean;
  /** More display switches (voice, walked path) that belong with these. */
  children?: ReactNode;
}) {
  const t = COPY[lang];
  return (
    <section id="walk-details-display" aria-label={t.mapView} className={CARD}>
      {showMapType ? (
        <div role="radiogroup" aria-label={t.baseMap} className={SEG_WRAP}>
          <button type="button" role="radio" aria-checked={mapType === "map"} onClick={() => onMapType("map")} className={segCell(mapType === "map")}>
            {t.map}
          </button>
          <button type="button" role="radio" aria-checked={mapType === "satellite"} onClick={() => onMapType("satellite")} className={segCell(mapType === "satellite")}>
            {t.satellite}
          </button>
        </div>
      ) : null}
      <div className="flex items-center justify-between gap-3">
        <span className="text-[15px] text-charcoal">{t.dayNight}</span>
        <ThemeToggle />
      </div>
      {children}
    </section>
  );
}

/** The top-rated layer (Google map only) with its legend and note. */
export function PlacesSection({ topRated, onTopRated, topRatedNote, lang = "en" }: { topRated?: boolean; onTopRated?: (on: boolean) => void; topRatedNote: string; lang?: Lang }) {
  if (!onTopRated) return null;
  const t = COPY[lang];
  return (
    <section aria-label={t.placesAround} className={CARD}>
      <button
        type="button"
        role="switch"
        aria-checked={Boolean(topRated)}
        onClick={() => onTopRated(!topRated)}
        className={`${chipCell(Boolean(topRated))} w-full justify-between`}
      >
        <span>{t.topRated}</span>
        <span aria-hidden>{topRated ? t.on : t.off}</span>
      </button>
      {topRated ? (
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-charcoal">
          {Object.values(GROUPS).map((g) => (
            <span key={g.label} className="flex items-center gap-1">
              <span className="inline-flex h-4 w-4 rounded-full p-0.5 text-white" style={{ background: g.color }}>{g.glyph}</span>
              {g.label}
            </span>
          ))}
        </div>
      ) : null}
      {topRatedNote ? <p className="text-[13px] text-charcoal/80">{topRatedNote}</p> : null}
    </section>
  );
}

/** Change password and log out (until the Me screen exists). */
export function AccountRows({ signedIn, lang = "en" }: { signedIn: boolean; lang?: Lang }) {
  if (!signedIn) return null;
  const t = COPY[lang];
  return (
    <section aria-label={t.account} className={`${CARD} flex items-center justify-between gap-3 text-[15px]`}>
      <Link href="/forgot-password" className="font-semibold text-terra">
        {t.changePassword}
      </Link>
      <LogoutButton className="min-h-11 font-semibold text-terra disabled:opacity-50" labels={t.logout} />
    </section>
  );
}

/** All of it, one after the other: how it sits outside a walk. */
export function MapOptionsCard({
  mapType,
  onMapType,
  showMapType,
  topRated,
  onTopRated,
  topRatedNote,
  signedIn,
  lang = "en",
}: {
  lang?: Lang;
  mapType: "map" | "satellite";
  onMapType: (type: "map" | "satellite") => void;
  showMapType: boolean;
  topRated?: boolean;
  onTopRated?: (on: boolean) => void;
  topRatedNote: string;
  signedIn: boolean;
}) {
  return (
    <div className="space-y-0">
      <DisplaySection mapType={mapType} onMapType={onMapType} showMapType={showMapType} lang={lang} />
      <PlacesSection topRated={topRated} onTopRated={onTopRated} topRatedNote={topRatedNote} lang={lang} />
      <AccountRows signedIn={signedIn} lang={lang} />
    </div>
  );
}
