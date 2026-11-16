"use client";

import Link from "next/link";

import { LogoutButton } from "@/components/auth/LogoutButton";
import { GROUPS } from "@/components/map/top-rated-groups";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

/**
 * What used to float over the map, now in Details: base map, day/night, the
 * top-rated layer (Google map only) with its legend and note, and the account
 * rows (until the Me screen exists).
 */
export function MapOptionsCard({
  mapType,
  onMapType,
  showMapType,
  topRated,
  onTopRated,
  topRatedNote,
  signedIn,
}: {
  mapType: "map" | "satellite";
  onMapType: (type: "map" | "satellite") => void;
  /** Only the Google map has a satellite view. */
  showMapType: boolean;
  /** Undefined when the provider has no top-rated layer. */
  topRated?: boolean;
  onTopRated?: (on: boolean) => void;
  topRatedNote: string;
  signedIn: boolean;
}) {
  const seg = (on: boolean) =>
    `min-h-11 flex-1 rounded-full px-4 text-[15px] font-medium transition-colors ${on ? "bg-forest/10 text-forest shadow-tk-soft" : "text-charcoal/70"}`;
  return (
    <section id="walk-details-display" aria-label="Map view" className="mx-auto mt-4 max-w-[440px] space-y-3 rounded-tk-card bg-paper p-4 shadow-tk-card">
      {showMapType ? (
        <div role="radiogroup" aria-label="Base map" className="flex gap-1 rounded-full bg-charcoal/5 p-1">
          <button type="button" role="radio" aria-checked={mapType === "map"} onClick={() => onMapType("map")} className={seg(mapType === "map")}>
            Map
          </button>
          <button type="button" role="radio" aria-checked={mapType === "satellite"} onClick={() => onMapType("satellite")} className={seg(mapType === "satellite")}>
            Satellite
          </button>
        </div>
      ) : null}
      <div className="flex items-center justify-between gap-3">
        <span className="text-[15px] text-charcoal">Day / night</span>
        <ThemeToggle />
      </div>
      {onTopRated ? (
        <div className="space-y-2">
          <button
            type="button"
            role="switch"
            aria-checked={Boolean(topRated)}
            onClick={() => onTopRated(!topRated)}
            className={`flex min-h-11 w-full items-center justify-between rounded-full px-4 text-[15px] font-medium ${topRated ? "bg-terra/10 text-terra shadow-tk-soft" : "bg-charcoal/5 text-charcoal"}`}
          >
            <span>Top rated</span>
            <span aria-hidden>{topRated ? "On" : "Off"}</span>
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
        </div>
      ) : null}
      {signedIn ? (
        <div className="flex items-center justify-between gap-3 border-t border-charcoal/10 pt-3 text-[15px]">
          <Link href="/forgot-password" className="font-semibold text-terra">
            Change password
          </Link>
          <LogoutButton className="min-h-11 font-semibold text-terra disabled:opacity-50" />
        </div>
      ) : null}
    </section>
  );
}
