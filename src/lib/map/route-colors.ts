/**
 * The route and walked-trail colours (the --tk-route / --tk-walked tokens). Map libraries want literal
 * colours, not CSS variables, so the two themes are spelled out here and kept in step with globals.css.
 */
export type MapTheme = "light" | "dark";
/** The base map under the lines: our painted roadmap, or Google's satellite/hybrid imagery. */
export type BaseMap = "map" | "satellite";

const COLORS = {
  light: { route: "#25604b", walked: "#f6b81c", casing: "#ffffff" },
  dark: { route: "#7fc4a0", walked: "#f6b81c", casing: "#1f1d19" },
} as const;

export const routeColors = (theme: MapTheme) => COLORS[theme];

export interface TrailStroke {
  color: string;
  weight: number;
  opacity: number;
}

/** The walked trail as a core line and, where the base map needs one, a darker casing drawn under it. */
export interface WalkedTrail {
  core: TrailStroke;
  casing: TrailStroke | null;
}

/**
 * On satellite no single fill reads on both dark canopy and pale sand or roofs, so the trail is the brand
 * gold with a dark edge (same pair in both themes), the way the route solves it with its white casing.
 * Thinner than the route (4 against 5) so it reads as "behind you". See docs/FEEDBACK-ROUND-2026-11-22.md item 7.
 * The casing is at 0.7, not 0.5: drawn with its opacity over the imagery, 0.5 leaves the worst of the eight reference
 * backgrounds at 2.3:1, and 0.7 holds the 3:1 non-text bar (3.1:1; tests/route-colors.test.ts blends it in).
 */
export const SATELLITE_TRAIL: WalkedTrail = {
  core: { color: "#f6b81c", weight: 4, opacity: 0.95 },
  casing: { color: "#1b2620", weight: 7, opacity: 0.7 },
};

/**
 * The painted roadmap: the same brand gold, quieter than the route (4 px against 5, lower opacity). Gold alone is only
 * about 1.8:1 on a white road, so on the light map a thin dark-gold casing carries the contrast; on the dark map the gold
 * is bright enough alone and is drawn at 0.6 to stay behind the route. The values are a first pass tuned against assumed
 * Google roadmap colours (tests/route-colors.test.ts, 1.8:1 up to the route's own contrast); the owner signs off by looking.
 */
export const ROADMAP_TRAIL: Record<MapTheme, WalkedTrail> = {
  light: {
    core: { color: "#f6b81c", weight: 4, opacity: 0.85 },
    casing: { color: "#9a6b00", weight: 6, opacity: 0.65 },
  },
  dark: { core: { color: "#f6b81c", weight: 4, opacity: 0.6 }, casing: null },
};

/** The walked trail for this theme and base map: gold everywhere, tuned per base map. */
export function walkedTrail(theme: MapTheme, mapType: BaseMap = "map"): WalkedTrail {
  return mapType === "satellite" ? SATELLITE_TRAIL : ROADMAP_TRAIL[theme];
}
