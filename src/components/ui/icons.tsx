import type { ReactNode } from "react";

/**
 * The one Traike icon set (docs/FEEDBACK-ROUND-2026-11-22.md item 5; grammar from docs/design-brief/BRIEF.md,
 * "Trail mark on limestone"). No icon package, no emoji, no text glyphs.
 *
 * - 24 viewBox, 1.75 stroke, round caps and joins, `currentColor`: the icon takes its colour from the
 *   control around it (forest ink, terracotta for an accent, cream on a pine fill).
 * - Two primitives: a Ring is a place or a stop; a Trail is a route line. Leather (`--tk-leather`) is only
 *   ever the core of a "you / now" Ring or the fill of something that is live.
 * - One icon, one function, the same everywhere ("same action = same icon").
 * - Icons that point somewhere along the reading direction mirror in Hebrew (`rtl:-scale-x-100`).
 *
 * The Rings are filled with the bar colour (`--tk-nav-fill`, cream outside the tab bar) so a Trail passing
 * behind one looks cut by it.
 */
export interface IconProps {
  className?: string;
}

const RING_FILL = "var(--tk-nav-fill, var(--tk-cream))";

function Svg({ className, mirror = false, children }: IconProps & { mirror?: boolean; children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={`${className ?? ""}${mirror ? " rtl:-scale-x-100" : ""}`.trim() || undefined}
    >
      {children}
    </svg>
  );
}

const NAV = "h-[22px] w-[22px]";
const MID = "h-6 w-6";
const SMALL = "h-5 w-5";

/* ------------------------------------------------------------------ destinations (tab bar and rail) */

/** Home: a house. */
export const HomeIcon = ({ className = NAV }: IconProps) => (
  <Svg className={className}>
    <path d="M3.5 10.5L12 3.5l8.5 7V20a1 1 0 0 1-1 1h-5v-6h-5v6h-5a1 1 0 0 1-1-1v-9.5z" />
  </Svg>
);

/** Plan: a route being composed, a dotted trail from a start Ring to a stop Ring (nothing walked yet). */
export const PlanIcon = ({ className = NAV }: IconProps) => (
  <Svg className={className} mirror>
    <path d="M8.6 17.3C13.7 17 15.6 14.7 13 12.3 10.6 10.1 12.6 8.6 15.9 7.9" strokeDasharray="0.01 3.65" />
    <circle cx="6" cy="17.6" r="2.6" fill={RING_FILL} />
    <circle cx="18" cy="6.4" r="2.6" fill={RING_FILL} />
  </Svg>
);

/** Walk: the walker (the live walk, only when a walk is running; with none, the tab opens Plan). */
export const WalkIcon = ({ className = NAV }: IconProps) => (
  <Svg className={className} mirror>
    <circle cx="12.5" cy="4.8" r="2.2" />
    <path d="M8.5 9.5c-1.8.4-2.5 2-2.2 4.2" />
    <path d="M12 8.2l-1.6 5.6L7.5 20M10.8 13.8l3.7 2.2 1.2 4M10.8 9.8l4.7 2.2M17.5 8.5L16 20.2" />
  </Svg>
);

/** Walks: saved walks, a route card (a solid trail from a start dot to a finish Ring inside a card). */
export const WalksIcon = ({ className = NAV }: IconProps) => (
  <Svg className={className} mirror>
    <rect x="3" y="3" width="18" height="18" rx="2.8" />
    <path d="M7.6 16.6c4.4.2 5.4-2.4 3.9-4.1-1.3-1.5-.2-3.2 2.1-3.7" />
    <circle cx="7.6" cy="16.6" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="16.1" cy="8" r="1.9" fill={RING_FILL} />
  </Svg>
);

/** Places: a map pin with a Ring in it (somewhere to stop). */
export const PlacesIcon = ({ className = NAV }: IconProps) => (
  <Svg className={className}>
    <path d="M12 21s6.5-5.7 6.5-11A6.5 6.5 0 0 0 5.5 10c0 5.3 6.5 11 6.5 11z" />
    <circle cx="12" cy="10" r="2.4" fill={RING_FILL} />
  </Svg>
);

/** Me: head and shoulders. */
export const PersonIcon = ({ className = NAV }: IconProps) => (
  <Svg className={className}>
    <circle cx="12" cy="8" r="3.8" />
    <path d="M4.5 20c1.6-3.8 4.4-5.6 7.5-5.6s5.9 1.8 7.5 5.6" />
  </Svg>
);

/** Friends: two people. */
export const PeopleIcon = ({ className = MID }: IconProps) => (
  <Svg className={className}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3 19c.5-3.2 3-5 6-5s5.5 1.8 6 5" />
    <path d="M16 5.2a3.2 3.2 0 0 1 0 5.6M18 14.3c1.8.7 2.8 2.3 3 4.7" />
  </Svg>
);

/* ------------------------------------------------------------------ the assistant chat */

/** Preferences: three sliders whose knobs are Rings (the standing defaults the assistant uses). */
export const SlidersIcon = ({ className = SMALL }: IconProps) => (
  <Svg className={className}>
    <path d="M4 7h2.5M11.5 7H20" />
    <circle cx="9" cy="7" r="2.5" fill={RING_FILL} />
    <path d="M4 12h8.5M17.5 12H20" />
    <circle cx="15" cy="12" r="2.5" fill={RING_FILL} />
    <path d="M4 17h2M11 17h9" />
    <circle cx="8.5" cy="17" r="2.5" fill={RING_FILL} />
  </Svg>
);

/** Dictate: a microphone. */
export const MicIcon = ({ className = MID }: IconProps) => (
  <Svg className={className}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5.5 11.2a6.5 6.5 0 0 0 13 0M12 17.7V21M9 21h6" />
  </Svg>
);

/** Read aloud: a speaker with sound travelling to the reading end. */
export const SpeakerIcon = ({ className = SMALL }: IconProps) => (
  <Svg className={className} mirror>
    <path d="M4 9.6v4.8h3.4l4.3 3.7V5.9L7.4 9.6H4z" />
    <path d="M15.2 9.2a4 4 0 0 1 0 5.6M18 6.6a7.8 7.8 0 0 1 0 10.8" />
  </Svg>
);

/** Stop: a square (stop reading, stop dictating, end the walk). */
export const StopIcon = ({ className = SMALL }: IconProps) => (
  <Svg className={className}>
    <rect x="6" y="6" width="12" height="12" rx="2.4" />
  </Svg>
);

/** Add image: a photo frame with a hill and a sun. */
export const ImageIcon = ({ className = SMALL }: IconProps) => (
  <Svg className={className}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2.6" />
    <circle cx="8.6" cy="9.5" r="1.5" />
    <path d="M4 17l4.6-4.4 3.4 3 3-2.6 5.4 4.6" />
  </Svg>
);

/** Ask: a speech bubble whose tail is at the start side. */
export const ChatIcon = ({ className = SMALL }: IconProps) => (
  <Svg className={className} mirror>
    <path d="M5.5 4.5h13a2 2 0 0 1 2 2v8.2a2 2 0 0 1-2 2h-7.6L6.6 20v-3.3h-1.1a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2z" />
  </Svg>
);

/* ------------------------------------------------------------------ the live-walk map */

/** Re-centre on me: the navigation arrow, filled while the map is following the walker. */
export const NavArrowIcon = ({ className = NAV, filled = false }: IconProps & { filled?: boolean }) => (
  <Svg className={className}>
    <path d="M20.2 3.8L3.8 10.4l6.9 2.9 2.9 6.9 6.6-16.4z" fill={filled ? "currentColor" : "none"} />
  </Svg>
);

/** Show the whole route: a frame with the route curve inside it (kept from the round-2026-11-22 batch A). */
export const FitRouteIcon = ({ className = NAV }: IconProps) => (
  <Svg className={className}>
    <path d="M4 9V6a2 2 0 0 1 2-2h3M20 9V6a2 2 0 0 0-2-2h-3M4 15v3a2 2 0 0 0 2 2h3M20 15v3a2 2 0 0 1-2 2h-3" />
    <path d="M8 15c1.5-4.5 4.5 0 6-3.5.6-1.4 1.2-2 2-2.5" />
  </Svg>
);

/** Map layers: a stack of sheets. */
export const LayersIcon = ({ className = NAV }: IconProps) => (
  <Svg className={className}>
    <path d="M12 3L3 8l9 5 9-5-9-5z" />
    <path d="M3 12.5l9 5 9-5" />
    <path d="M3 17l9 5 9-5" />
  </Svg>
);

/** Full-screen map. */
export const ExpandIcon = ({ className = SMALL }: IconProps) => (
  <Svg className={className}>
    <path d="M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7" />
  </Svg>
);

/** Back to the smaller map. */
export const CollapseIcon = ({ className = SMALL }: IconProps) => (
  <Svg className={className}>
    <path d="M20 4l-7 7m0 0h6m-6 0V5M4 20l7-7m0 0H5m6 0v6" />
  </Svg>
);

/* ------------------------------------------------------------------ small utility glyphs */

export const PlusIcon = ({ className = MID }: IconProps) => (
  <Svg className={className}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

/** Points to the start side: it mirrors in RTL. */
export const BackIcon = ({ className = MID }: IconProps) => (
  <Svg className={className} mirror>
    <path d="M15 5l-7 7 7 7" />
  </Svg>
);

/** Points to the end side (the way forward on a button): it mirrors in RTL. */
export const ArrowIcon = ({ className = NAV }: IconProps) => (
  <Svg className={className} mirror>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Svg>
);

export const ChevronDownIcon = ({ className = MID }: IconProps) => (
  <Svg className={className}>
    <path d="M6 9l6 6 6-6" />
  </Svg>
);

export const RefreshIcon = ({ className = SMALL }: IconProps) => (
  <Svg className={className}>
    <path d="M20 12a8 8 0 1 1-2.6-5.9" />
    <path d="M20 4v5h-5" />
  </Svg>
);

export const CloseIcon = ({ className = SMALL }: IconProps) => (
  <Svg className={className}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
);

export const CheckIcon = ({ className = SMALL }: IconProps) => (
  <Svg className={className}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Svg>
);

export const WarnIcon = ({ className = SMALL }: IconProps) => (
  <Svg className={className}>
    <path d="M12 3.8L2.8 19.4a1 1 0 0 0 .9 1.5h16.6a1 1 0 0 0 .9-1.5L12 3.8z" />
    <path d="M12 10v4.4M12 17.4h.01" />
  </Svg>
);

export const InfoIcon = ({ className = SMALL }: IconProps) => (
  <Svg className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5.4M12 7.7h.01" />
  </Svg>
);

/** A rating star (a recommendation, a Google rating). */
export const StarIcon = ({ className = SMALL, filled = false }: IconProps & { filled?: boolean }) => (
  <Svg className={className}>
    <path d="M12 3.4l2.5 5.3 5.8.7-4.3 4 1.1 5.7L12 16.3l-5.1 2.8L8 13.4l-4.3-4 5.8-.7L12 3.4z" fill={filled ? "currentColor" : "none"} />
  </Svg>
);

/** Time: a clock. */
export const ClockIcon = ({ className = SMALL }: IconProps) => (
  <Svg className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5.2l3.4 2" />
  </Svg>
);

/** Distance: a trail between two Rings. */
export const TrailIcon = ({ className = SMALL }: IconProps) => (
  <Svg className={className} mirror>
    <path d="M8.4 17.2c5.6-.4 7.4-2.4 4.6-4.9-2.4-2.2-.4-3.7 2.8-4.5" />
    <circle cx="6" cy="17.4" r="2.4" fill={RING_FILL} />
    <circle cx="18" cy="6.6" r="2.4" fill={RING_FILL} />
  </Svg>
);

/* ------------------------------------------------------------------ live-walk alert cards (the sheet's one question) */

/** Rain coming: a cloud and drops. */
export const RainIcon = ({ className = SMALL }: IconProps) => (
  <Svg className={className}>
    <path d="M7 15.5a4.2 4.2 0 0 1-.4-8.4A5.6 5.6 0 0 1 17.4 8a3.8 3.8 0 0 1 .1 7.5H7z" />
    <path d="M8.6 18.4l-.9 2.2M12.6 18.4l-.9 2.2M16.6 18.4l-.9 2.2" />
  </Svg>
);

/** Heat and water: a drop. */
export const DropIcon = ({ className = SMALL }: IconProps) => (
  <Svg className={className}>
    <path d="M12 3.4s-6 6.5-6 10.8a6 6 0 0 0 12 0c0-4.3-6-10.8-6-10.8z" />
  </Svg>
);

/** Sunset: a half sun on the horizon. */
export const SunsetIcon = ({ className = SMALL }: IconProps) => (
  <Svg className={className}>
    <path d="M3.5 18h17M7.2 18a4.8 4.8 0 0 1 9.6 0" />
    <path d="M12 6.2v2.6M5.4 9.4l1.8 1.8M18.6 9.4l-1.8 1.8M2.8 14.2h1.8M19.4 14.2h1.8" />
  </Svg>
);

/** A shortcut offer: an arrow that skips ahead. Points to the end side. */
export const ShortcutIcon = ({ className = SMALL }: IconProps) => (
  <Svg className={className} mirror>
    <path d="M5 19v-3.5A4.5 4.5 0 0 1 9.5 11H19M15 7l4 4-4 4" />
  </Svg>
);

/** Pace: a dial with a needle. */
export const GaugeIcon = ({ className = SMALL }: IconProps) => (
  <Svg className={className}>
    <path d="M4.2 17.5a8.6 8.6 0 1 1 15.6 0" />
    <path d="M12 15.2l3.2-4.8" />
    <circle cx="12" cy="15.4" r="1" fill="currentColor" stroke="none" />
  </Svg>
);

/** Finish: a flag on a pole. Points to the end side. */
export const FlagIcon = ({ className = SMALL }: IconProps) => (
  <Svg className={className} mirror>
    <path d="M6 21V4.2M6 5h11.5l-2.8 4 2.8 4H6" />
  </Svg>
);

/* ------------------------------------------------------------------ choices on the walk sheet and after a walk */

/** A green way (the nature direction). */
export const TreeIcon = ({ className = SMALL }: IconProps) => (
  <Svg className={className}>
    <path d="M12 3.2l5 7h-3l4 5.3H6l4-5.3H7l5-7z" />
    <path d="M12 15.5v5" />
  </Svg>
);

/** Food: a fork and a knife. */
export const FoodIcon = ({ className = SMALL }: IconProps) => (
  <Svg className={className}>
    <path d="M5.5 3.5v5a2.5 2.5 0 0 0 5 0v-5M8 11v9.5" />
    <path d="M16.5 20.5V3.5c-2.2 1.3-3.4 3.8-3.4 6.5h3.4" />
  </Svg>
);

/** I liked it. */
export const ThumbUpIcon = ({ className = SMALL }: IconProps) => (
  <Svg className={className}>
    <path d="M7.5 11v9h-3v-9h3z" />
    <path d="M7.5 11l3.3-6.2a1.7 1.7 0 0 1 3.2 1V9h4.6a2 2 0 0 1 2 2.4l-1.2 6.6a2 2 0 0 1-2 1.6H7.5" />
  </Svg>
);

/** I did not like it. */
export const ThumbDownIcon = ({ className = SMALL }: IconProps) => (
  <Svg className={className}>
    <g transform="rotate(180 12 12)">
      <path d="M7.5 11v9h-3v-9h3z" />
      <path d="M7.5 11l3.3-6.2a1.7 1.7 0 0 1 3.2 1V9h4.6a2 2 0 0 1 2 2.4l-1.2 6.6a2 2 0 0 1-2 1.6H7.5" />
    </g>
  </Svg>
);

/** Pin this stop to the walk: a push pin. */
export const PushPinIcon = ({ className = SMALL }: IconProps) => (
  <Svg className={className}>
    <path d="M9 3.8h6M10 3.8l-.6 5.2L6.5 12.2h11L14.6 9l-.6-5.2M12 12.2v8" />
  </Svg>
);
