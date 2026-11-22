"use client";

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
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
            <circle cx="12" cy="12" r="3.5" fill={following ? "currentColor" : "none"} />
            <path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4" />
          </svg>
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
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M4 9V6a2 2 0 0 1 2-2h3M20 9V6a2 2 0 0 0-2-2h-3M4 15v3a2 2 0 0 0 2 2h3M20 15v3a2 2 0 0 1-2 2h-3" />
            <path d="M8 15c1.5-4.5 4.5 0 6-3.5 .6-1.4 1.2-2 2-2.5" />
          </svg>
        </button>
      ) : null}
      {onLayers ? (
        <button type="button" onClick={onLayers} aria-label={t.layers} className={`${BASE} bg-paper text-forest`}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 3 3 8l9 5 9-5-9-5Z" />
            <path d="m3 12.5 9 5 9-5" />
            <path d="m3 17 9 5 9-5" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}
