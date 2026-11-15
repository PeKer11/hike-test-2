"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { WalkAlertCard, type WalkAlert } from "@/components/walk/WalkAlertCard";
import { WalkStatsBar, type WalkStatsData } from "@/components/walk/WalkStatsBar";
import type { LocateState } from "@/lib/geo/locate";
import { walkCopy } from "@/lib/walk/walk-copy";

interface WalkHudProps {
  alert: WalkAlert | null;
  /** The direction options after a collapse; takes the alert's slot (one card, never two). */
  sheet?: ReactNode;
  /** The in-walk chat (the "Ask" pill); sits between the alert and the pill row. */
  chat?: ReactNode;
  stats: WalkStatsData | null;
  /** Lock-on state of the real GPS; the chip shows while it is searching or weak, and is hidden once good. */
  gpsState?: LocateState;
  lang?: "he" | "en";
  onDetails: () => void;
  onEndWalk: () => void;
}

/**
 * Everything the walker sees over the map while walking, as one opaque bottom
 * sheet that paints to the screen edge (safe-area included), so no page
 * background shows around it: the single alert card, the Details / End walk
 * pills, the stats bar.
 *
 * Nothing sits at the top on a narrow screen — that band belongs to the account
 * pill and the frame's expand button. The stack publishes its own height as
 * `--hud-h` on the map section so the map can lift Leaflet's attribution (a
 * licence requirement) clear of it.
 */
export function WalkHud({ alert, sheet, chat, stats, gpsState = "idle", lang = "en", onDetails, onEndWalk }: WalkHudProps) {
  const gpsCopy = walkCopy.hud.gps[lang];
  const gpsLabel =
    gpsState === "searching" ? gpsCopy.searching : gpsState === "coarse" || gpsState === "timeout" || gpsState === "unavailable" ? gpsCopy.weak : null;
  const outerRef = useRef<HTMLDivElement>(null);
  const stackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stack = stackRef.current;
    // The wrapper's parent: a descendant of the map section (MapView's div) that
    // carries `.walk-hud`, so only a property set there is inherited by Leaflet's
    // controls.
    const host = outerRef.current?.parentElement;
    if (!stack || !host) return;

    const publish = () => host.style.setProperty("--hud-h", `${stack.offsetHeight}px`);
    publish();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(publish);
    observer.observe(stack);
    return () => {
      observer.disconnect();
      host.style.removeProperty("--hud-h");
    };
  }, []);

  return (
    <div ref={outerRef} className="pointer-events-none absolute inset-0 z-[600]">
      <div
        ref={stackRef}
        data-testid="walk-hud"
        className="pointer-events-auto absolute inset-x-0 bottom-0 flex flex-col gap-2 rounded-t-[22px] bg-paper px-4 pt-2 pb-[max(12px,env(safe-area-inset-bottom))] shadow-[0_-8px_30px_rgba(30,61,47,0.18)] dark:shadow-[0_-8px_30px_rgba(0,0,0,0.5)] dark:ring-1 dark:ring-inset dark:ring-[rgba(242,235,225,0.06)]"
      >
        {sheet ?? (alert ? <WalkAlertCard key={alert.id} alert={alert} /> : null)}
        {chat}
        {gpsLabel ? (
          <div
            role="status"
            data-testid="gps-chip"
            className="flex items-center gap-2 self-start rounded-full bg-forest/10 px-3 py-1 text-[13px] font-medium text-forest"
          >
            <span
              aria-hidden
              className={`h-2 w-2 rounded-full ${gpsState === "searching" ? "animate-pulse bg-forest" : "bg-amber-500"}`}
            />
            {gpsLabel}
          </div>
        ) : null}
        <div className="pointer-events-none flex justify-between gap-2">
          <button
            type="button"
            onClick={onDetails}
            className="pointer-events-auto min-h-11 rounded-full border border-forest/20 bg-paper px-4 py-2 text-[15px] font-semibold text-forest transition hover:bg-forest/10 @4xl:hidden"
          >
            {walkCopy.hud.details}
          </button>
          <button
            type="button"
            onClick={onEndWalk}
            className="pointer-events-auto ms-auto min-h-11 rounded-full bg-terra px-4 py-2 text-[15px] font-semibold text-on-accent transition hover:bg-terra/90"
          >
            {walkCopy.hud.endWalk}
          </button>
        </div>
        {stats ? <WalkStatsBar stats={stats} /> : null}
      </div>
    </div>
  );
}
