"use client";

import { FitRouteIcon, LayersIcon, NavArrowIcon } from "@/components/ui/icons";

/**
 * The controls drawn on the live-walk map: follow me, the whole route, and layers
 * (opens the Details sheet at its display section). Everything else lives in Details.
 */
const BASE =
  "pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full shadow-tk-card transition-colors";

const LABELS = {
  en: { follow: "Re-centre on me", route: "Show whole route", layers: "Map layers" },
  he: { follow: "מרכזו אותי במפה", route: "הצגת כל המסלול", layers: "שכבות מפה" },
} as const;

export function MapGlyphs({
  showFollow,
  following,
  onFollow,
  onFitRoute,
  fitting = false,
  onLayers,
  lang = "en",
}: {
  showFollow: boolean;
  /** True while the map is following the walker; false after they dragged it away. */
  following: boolean;
  onFollow: () => void;
  /** Frame the whole route (what is left, what is walked, and where the walker is); absent = no such control. */
  onFitRoute?: () => void;
  /** The whole-route view is up (it holds the map off the walker until it is tapped again). */
  fitting?: boolean;
  onLayers?: () => void;
  lang?: "he" | "en";
}) {
  const t = LABELS[lang];
  return (
    <div className="pointer-events-none absolute end-3 top-3 z-[1000] flex flex-col gap-2">
      {showFollow ? (
        <button
          type="button"
          onClick={onFollow}
          aria-label={t.follow}
          aria-pressed={following}
          className={`${BASE} ${following ? "bg-forest text-on-accent" : "bg-paper text-forest"}`}
        >
          {/* The navigation arrow: "me". Filled while the map follows the walker. */}
          <NavArrowIcon filled={following} />
        </button>
      ) : null}
      {onFitRoute ? (
        <button
          type="button"
          onClick={onFitRoute}
          aria-label={t.route}
          aria-pressed={fitting}
          className={`${BASE} ${fitting ? "bg-forest text-on-accent" : "bg-paper text-forest"}`}
        >
          {/* A frame with a route curve inside: "see all of it". */}
          <FitRouteIcon />
        </button>
      ) : null}
      {onLayers ? (
        <button type="button" onClick={onLayers} aria-label={t.layers} className={`${BASE} bg-paper text-forest`}>
          <LayersIcon />
        </button>
      ) : null}
    </div>
  );
}
