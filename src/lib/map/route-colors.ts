/**
 * The route and walked-trail colours (the --tk-route / --tk-walked tokens). Map libraries want literal
 * colours, not CSS variables, so the two themes are spelled out here and kept in step with globals.css.
 */
export type MapTheme = "light" | "dark";
/** The base map under the lines: our painted roadmap, or Google's satellite/hybrid imagery. */
export type BaseMap = "map" | "satellite";

const COLORS = {
  light: { route: "#25604b", walked: "#b9ad9c", casing: "#ffffff" },
  dark: { route: "#7fc4a0", walked: "#6e655a", casing: "#1f1d19" },
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
 */
export const SATELLITE_TRAIL: WalkedTrail = {
  core: { color: "#f6b81c", weight: 4, opacity: 0.95 },
  casing: { color: "#1b2620", weight: 7, opacity: 0.5 },
};

/** The painted roadmap keeps the muted warm-stone "route-past" trail (the approved paper-map look). */
export function walkedTrail(theme: MapTheme, mapType: BaseMap = "map"): WalkedTrail {
  if (mapType === "satellite") return SATELLITE_TRAIL;
  return { core: { color: COLORS[theme].walked, weight: 5, opacity: 0.9 }, casing: null };
}
