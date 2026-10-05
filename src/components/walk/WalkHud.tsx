"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { WalkAlertCard, type WalkAlert } from "@/components/walk/WalkAlertCard";
import { WalkStatsBar, type WalkStatsData } from "@/components/walk/WalkStatsBar";
import { walkCopy } from "@/lib/walk/walk-copy";

interface WalkHudProps {
  alert: WalkAlert | null;
  /** The direction options after a collapse; takes the alert's slot (one card, never two). */
  sheet?: ReactNode;
  stats: WalkStatsData | null;
  onDetails: () => void;
  onEndWalk: () => void;
}

/**
 * Everything the walker sees over the map while walking, as one bottom stack:
 * the single alert card, the Details / End walk pills, the stats bar.
 *
 * Nothing sits at the top on a narrow screen — that band belongs to the account
 * pill and the frame's expand button. The stack publishes its own height as
 * `--hud-h` on the map section so the map can lift Leaflet's attribution (a
 * licence requirement) clear of it.
 */
export function WalkHud({ alert, sheet, stats, onDetails, onEndWalk }: WalkHudProps) {
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
        className="pointer-events-none absolute inset-x-3 bottom-0 flex flex-col gap-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] @4xl:mx-auto @4xl:max-w-xl"
      >
        {sheet ?? (alert ? <WalkAlertCard key={alert.id} alert={alert} /> : null)}
        <div className="pointer-events-none flex justify-between gap-2">
          <button
            type="button"
            onClick={onDetails}
            className="pointer-events-auto rounded-full border border-forest/20 bg-cream/95 px-4 py-2 text-xs font-semibold text-forest shadow-[0_4px_20px_rgba(30,61,47,0.12)] backdrop-blur transition hover:bg-forest/10 @4xl:hidden"
          >
            {walkCopy.hud.details}
          </button>
          <button
            type="button"
            onClick={onEndWalk}
            className="pointer-events-auto ms-auto rounded-full bg-terra px-4 py-2 text-xs font-semibold text-white shadow-[0_4px_20px_rgba(30,61,47,0.12)] transition hover:bg-terra/90"
          >
            {walkCopy.hud.endWalk}
          </button>
        </div>
        {stats ? <WalkStatsBar stats={stats} /> : null}
      </div>
    </div>
  );
}
