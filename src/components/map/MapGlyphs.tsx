"use client";

/**
 * The only two controls drawn on the live-walk map: follow me, and layers
 * (opens the Details sheet at its display section). Everything else lives in Details.
 */
const BASE =
  "pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full shadow-tk-card transition-colors";

export function MapGlyphs({
  showFollow,
  following,
  onFollow,
  onLayers,
}: {
  showFollow: boolean;
  /** True while the map is following the walker; false after they dragged it away. */
  following: boolean;
  onFollow: () => void;
  onLayers?: () => void;
}) {
  return (
    <div className="pointer-events-none absolute end-3 top-3 z-[1000] flex flex-col gap-2">
      {showFollow ? (
        <button
          type="button"
          onClick={onFollow}
          aria-label="Re-centre on me"
          aria-pressed={following}
          className={`${BASE} ${following ? "bg-forest text-on-accent" : "bg-paper text-forest"}`}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
            <circle cx="12" cy="12" r="3.5" fill={following ? "currentColor" : "none"} />
            <path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4" />
          </svg>
        </button>
      ) : null}
      {onLayers ? (
        <button type="button" onClick={onLayers} aria-label="Map layers" className={`${BASE} bg-paper text-forest`}>
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
