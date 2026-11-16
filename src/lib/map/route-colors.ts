/**
 * The route and walked-trail colours (the --tk-route / --tk-walked tokens). Map libraries want literal
 * colours, not CSS variables, so the two themes are spelled out here and kept in step with globals.css.
 */
export type MapTheme = "light" | "dark";

const COLORS = {
  light: { route: "#25604b", walked: "#b9ad9c", casing: "#ffffff" },
  dark: { route: "#7fc4a0", walked: "#6e655a", casing: "#1f1d19" },
} as const;

export const routeColors = (theme: MapTheme) => COLORS[theme];
