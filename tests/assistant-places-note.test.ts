import { describe, expect, it } from "vitest";

import type { SavedPlace } from "@/lib/places/saved-places";
import { placesNote } from "@/lib/assistant/places-note";

const place = (label: string, visitedAt: string | null): SavedPlace => ({
  id: label,
  source: "google",
  placeRef: label,
  label,
  category: "food",
  coordinates: null,
  visitedAt,
  createdAt: "2026-10-01T00:00:00Z",
});

describe("placesNote", () => {
  it("is empty without places", () => {
    expect(placesNote([])).toBe("");
  });

  it("separates the wishlist from visited places", () => {
    const note = placesNote([place("Cafe A", null), place("Museum B", "2026-10-02T00:00:00Z")]);
    expect(note).toContain("want to visit: Cafe A.");
    expect(note).toContain("already visited (do not propose again unless asked): Museum B.");
  });

  it("caps the list and strips separators from names", () => {
    const many = Array.from({ length: 30 }, (_, i) => place(`P${i}`, null));
    expect(placesNote(many).split(";").length).toBe(12);
    expect(placesNote([place("A;\nB", null)])).toContain("A B");
  });
});
