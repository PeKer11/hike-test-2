import { describe, expect, it } from "vitest";

import { SATELLITE_TRAIL, walkedTrail, type BaseMap, type MapTheme } from "@/lib/map/route-colors";

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two opaque hex colours. */
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** An opaque hex colour drawn at `alpha` over an opaque background, as the map draws a semi-transparent line. */
function over(fg: string, bg: string, alpha: number): string {
  const mix = (i: number) => Math.round(alpha * parseInt(fg.slice(i, i + 2), 16) + (1 - alpha) * parseInt(bg.slice(i, i + 2), 16));
  return `#${[1, 3, 5].map((i) => mix(i).toString(16).padStart(2, "0")).join("")}`;
}

/** Best contrast the trail gives against `bg`: its core or its casing, each drawn at its own opacity over the imagery. */
function trailContrast(trail: ReturnType<typeof walkedTrail>, bg: string): number {
  const core = contrast(over(trail.core.color, bg, trail.core.opacity), bg);
  const casing = trail.casing ? contrast(over(trail.casing.color, bg, trail.casing.opacity), bg) : 0;
  return Math.max(core, casing);
}

/** Typical Google hybrid-imagery colours (the eight of docs/FEEDBACK-ROUND-2026-11-22.md item 7). */
const IMAGERY: Record<string, string> = {
  canopy: "#2f4b2d",
  shadow: "#1f2b23",
  vegetation: "#566b3a",
  sea: "#256078",
  asphalt: "#5d6064",
  dryGrass: "#a89960",
  sand: "#cdb98f",
  roofConcrete: "#d0cbc3",
};

describe("walked trail colours", () => {
  it("is brand gold, quieter than the route, on the roadmap in both themes (it was warm grey)", () => {
    expect(walkedTrail("light", "map")).toEqual({
      core: { color: "#f6b81c", weight: 4, opacity: 0.85 },
      casing: { color: "#9a6b00", weight: 6, opacity: 0.65 },
    });
    expect(walkedTrail("dark", "map")).toEqual({ core: { color: "#f6b81c", weight: 4, opacity: 0.6 }, casing: null });
    // The roadmap is the default, so a caller that does not know the base map gets the same trail.
    expect(walkedTrail("light")).toEqual(walkedTrail("light", "map"));
  });

  it("the walked trail is gold on every base map and theme", () => {
    for (const theme of ["light", "dark"] as MapTheme[]) {
      for (const mapType of ["map", "satellite"] as BaseMap[]) expect(walkedTrail(theme, mapType).core.color).toBe("#f6b81c");
    }
  });

  it("is thinner than the 5 px route on every base map, so it reads as behind you", () => {
    for (const theme of ["light", "dark"] as MapTheme[]) {
      for (const mapType of ["map", "satellite"] as BaseMap[]) expect(walkedTrail(theme, mapType).core.weight).toBeLessThan(5);
    }
  });

  // ASSUMED roadmap colours: Google's standard (light) and night (dark) styles as commonly published, not measured from
  // phone screenshots. The owner must sign off by looking at the real roadmap, light and dark, and satellite.
  const ROADMAP_LIGHT: Record<string, string> = { land: "#f5f5f5", road: "#ffffff", highway: "#f8c967", park: "#c8e6c9", water: "#aadaff", building: "#ebe8e3" };
  const ROADMAP_DARK: Record<string, string> = { land: "#242f3e", road: "#38414e", highway: "#746855", park: "#263c3f", water: "#17263c" };

  it.each([
    ["light", ROADMAP_LIGHT, "#25604b", 0.95],
    ["dark", ROADMAP_DARK, "#7fc4a0", 0.95],
  ] as const)("on the %s roadmap it is weak but visible: at least 1.8:1 and below the route's own contrast", (theme, backgrounds, route, routeOpacity) => {
    const trail = walkedTrail(theme, "map");
    for (const [name, bg] of Object.entries(backgrounds)) {
      const visible = trailContrast(trail, bg);
      const routeContrast = contrast(over(route, bg, routeOpacity), bg);
      expect(visible, `${theme} ${name}`).toBeGreaterThanOrEqual(1.8);
      expect(visible, `${theme} ${name}`).toBeLessThan(routeContrast);
    }
  });

  it("is brand gold with a dark casing on satellite, the same in both themes", () => {
    for (const theme of ["light", "dark"] as MapTheme[]) {
      const trail = walkedTrail(theme, "satellite");
      expect(trail.core).toMatchObject({ color: "#f6b81c", weight: 4, opacity: 0.95 });
      expect(trail.casing).toMatchObject({ color: "#1b2620", weight: 7, opacity: 0.7 });
    }
  });

  it("draws the casing wider than the core, and the core thinner than the 5 px route", () => {
    expect(SATELLITE_TRAIL.casing!.weight).toBeGreaterThan(SATELLITE_TRAIL.core.weight);
    expect(SATELLITE_TRAIL.core.weight).toBeLessThan(5);
  });

  it.each(Object.entries(IMAGERY))("stays visible on satellite %s: best of core and casing is at least 3:1", (_name, bg) => {
    expect(trailContrast(walkedTrail("light", "satellite"), bg)).toBeGreaterThanOrEqual(3);
  });

  it("holds the 3:1 bar for every theme and base map that uses a casing", () => {
    for (const theme of ["light", "dark"] as MapTheme[]) {
      for (const mapType of ["satellite"] as BaseMap[]) {
        const trail = walkedTrail(theme, mapType);
        for (const bg of Object.values(IMAGERY)) expect(trailContrast(trail, bg)).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("needs the casing at 0.7: drawn at 0.5 the worst background falls under 3:1", () => {
    const faint = { ...SATELLITE_TRAIL, casing: { ...SATELLITE_TRAIL.casing!, opacity: 0.5 } };
    const worst = (trail: ReturnType<typeof walkedTrail>) => Math.min(...Object.values(IMAGERY).map((bg) => trailContrast(trail, bg)));
    expect(worst(faint)).toBeLessThan(3);
    expect(worst(SATELLITE_TRAIL)).toBeGreaterThanOrEqual(3);
  });

  it("documents why the old grey failed: below 1.5:1 on dry grass, sand and roofs", () => {
    for (const bg of [IMAGERY.dryGrass, IMAGERY.sand, IMAGERY.roofConcrete]) {
      expect(contrast("#b9ad9c", bg)).toBeLessThan(1.5);
    }
  });
});
