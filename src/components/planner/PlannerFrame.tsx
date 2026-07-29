"use client";

import { useEffect, useState } from "react";

import { WalkPlannerApp } from "./WalkPlannerApp";

/* Iconoir-style glyphs (1.5px stroke, round caps) — DESIGN.md forbids icon
   packages. Deliberately the "fullscreen" corner arrows people already know
   from a video player, not the diagonal arrows the Advanced toggle uses. */
function IconFullscreen({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth={1.5}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M9 3H3v6M21 9V3h-6M15 21h6v-6M3 15v6h6" />
    </svg>
  );
}

function IconFullscreenExit({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth={1.5}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M3 9h6V3M21 9h-6V3M3 15h6v6M21 15h-6v6" />
    </svg>
  );
}

/**
 * The planner's frame — one mounted `WalkPlannerApp`, two sizes.
 *
 * Like a video embed: the small box and the "fullscreen" box are the same
 * element resized, not two pages. Everything is CSS + one boolean, so no state,
 * GPS watch, timer or in-flight request is lost when the size changes — which is
 * exactly what a route change to a separate /app/plan page used to cost.
 *
 * Deliberately not the browser Fullscreen API: that would hide the site's own
 * chrome (the account indicator / logout), which has to stay reachable.
 */
export function PlannerFrame() {
  const [isExpanded, setIsExpanded] = useState(false);

  // Esc collapses, the same reflex a real fullscreen player trains.
  useEffect(() => {
    if (!isExpanded) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsExpanded(false);
    };
    window.addEventListener("keydown", onKeyDown);
    // Stop the hub page scrolling behind the expanded planner.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isExpanded]);

  return (
    <div
      className={
        isExpanded
          ? // z-[900] keeps it under the account indicator (z-[1000]) so logout
            // stays clickable while expanded.
            "fixed inset-0 z-[900] overflow-hidden bg-cream"
          : "relative h-[min(72vh,620px)] w-full overflow-hidden rounded-xl border border-charcoal/10 bg-cream shadow-[0_4px_20px_rgba(30,61,47,0.12)]"
      }
    >
      <WalkPlannerApp isExpanded={isExpanded} />

      <button
        type="button"
        onClick={() => setIsExpanded((value) => !value)}
        aria-pressed={isExpanded}
        aria-label={isExpanded ? "Collapse the planner" : "Expand the planner"}
        title={isExpanded ? "Collapse the planner (Esc)" : "Expand the planner"}
        /* Top-right of the map: Leaflet's zoom sits top-left and its attribution
           bottom-right, so this corner is free. While expanded it drops below
           the account indicator, which is pinned to the viewport's top-right.
           z-[600] clears the Leaflet panes. */
        className={`absolute right-3 z-[600] inline-flex h-9 w-9 items-center justify-center rounded-[10px] border border-forest/20 bg-white/95 text-forest shadow-[0_4px_20px_rgba(30,61,47,0.12)] transition-colors hover:bg-forest/10 ${
          isExpanded ? "top-14" : "top-3"
        }`}
      >
        {isExpanded ? (
          <IconFullscreenExit className="h-4 w-4" />
        ) : (
          <IconFullscreen className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}
