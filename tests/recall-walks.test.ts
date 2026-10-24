import { describe, expect, it } from "vitest";

import { formatRecalledWalks } from "@/lib/assistant/recall-walks";
import type { SavedWalk } from "@/lib/walks/saved-walks";

const walk = (title: string, createdAt: string, names: string[]): SavedWalk => ({
  id: title,
  title,
  status: "completed",
  areaLabel: "Tel Aviv",
  start: { lat: 32, lng: 34 },
  totalMin: 90,
  distanceM: 4000,
  stops: names.map((name) => ({ name, category: "food", lat: 32.1, lng: 34.1, placeId: "p1" })),
  params: {},
  visibility: "private",
  createdAt,
  completedAt: null,
});

const walks = [walk("Pizza day", "2026-10-23T10:00:00Z", ["Pizza Bar", "Beach"]), walk("Museums", "2026-10-20T10:00:00Z", ["Art Museum"])];

describe("formatRecalledWalks", () => {
  it("returns title, date, area, minutes and stops without coordinates or place ids", () => {
    const [first] = formatRecalledWalks(walks, 5);
    expect(first).toEqual({
      title: "Pizza day",
      date: "2026-10-23",
      areaLabel: "Tel Aviv",
      totalMin: 90,
      stops: [
        { name: "Pizza Bar", category: "food" },
        { name: "Beach", category: "food" },
      ],
    });
    expect(JSON.stringify(first)).not.toMatch(/lat|lng|placeId/);
  });

  it("filters by title or stop name, case-insensitively, then applies the limit", () => {
    expect(formatRecalledWalks(walks, 5, "ART").map((w) => w.title)).toEqual(["Museums"]);
    expect(formatRecalledWalks(walks, 5, "pizza").map((w) => w.title)).toEqual(["Pizza day"]);
    expect(formatRecalledWalks(walks, 1).map((w) => w.title)).toEqual(["Pizza day"]);
    expect(formatRecalledWalks(walks, 5, "zzz")).toEqual([]);
  });
});
