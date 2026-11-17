import { describe, expect, it } from "vitest";

import { filterBySegment } from "@/components/walks/MyWalksPanel";
import type { SavedWalk } from "@/lib/walks/saved-walks";
import type { WalkWithRuns } from "@/lib/walks/walk-runs";

const walk = (id: string, status: SavedWalk["status"]): SavedWalk => ({
  id,
  title: id,
  status,
  areaLabel: null,
  start: { lat: 32, lng: 34 },
  totalMin: 30,
  distanceM: 2000,
  stops: [],
  params: {},
  visibility: "private",
  createdAt: "2026-11-01T10:00:00Z",
  completedAt: null,
});
const item = (id: string, status: SavedWalk["status"], runCount: number): WalkWithRuns => ({
  walk: walk(id, status),
  runs: [],
  runCount,
  lastRunAt: null,
  isDraft: runCount === 0,
});

const FIXTURE = [item("done", "completed", 1), item("walked-saved", "saved", 2), item("bookmark", "saved", 0), item("draft", "planned", 0)];

describe("Walks segments", () => {
  it("History is what was walked or completed", () => {
    expect(filterBySegment(FIXTURE, "history").map((i) => i.walk.id)).toEqual(["done", "walked-saved"]);
  });

  it("Saved is bookmarks and drafts that were not walked yet", () => {
    expect(filterBySegment(FIXTURE, "saved").map((i) => i.walk.id)).toEqual(["bookmark", "draft"]);
  });
});
