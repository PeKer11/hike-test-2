import type { ReactNode } from "react";

/** The four top-rated groups: label, glyph, colour and search. Kept free of map libraries so Details can show the legend. */
const icon = (d: string) => (
  <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);

export type Group = "food" | "nature" | "culture" | "sights";

/** One search per group, so a food-heavy area can't crowd out nature, museums and sights. */
export const GROUPS: Record<Group, { label: string; glyph: ReactNode; color: string; types: string[]; radius: number }> = {
  food: { label: "Food", glyph: icon("M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 3c-2 2-3 4-3 7h3v11"), color: "#e8742c", types: ["restaurant", "cafe", "bakery"], radius: 1500 },
  nature: { label: "Nature", glyph: icon("M12 22v-5M12 3l6 8h-3l4 6H5l4-6H6z"), color: "#2f8f4e", types: ["park", "national_park", "hiking_area", "beach", "garden"], radius: 3000 },
  culture: { label: "Museum & art", glyph: icon("M3 21h18M5 21V10M9 21V10M15 21V10M19 21V10M3 10l9-6 9 6"), color: "#7c4dbd", types: ["museum", "art_gallery"], radius: 3000 },
  sights: { label: "Sights", glyph: icon("M4 8h3l2-3h6l2 3h3v11H4zM12 11.5a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4z"), color: "#2563eb", types: ["tourist_attraction", "historical_landmark", "synagogue", "church", "mosque"], radius: 3000 },
};
