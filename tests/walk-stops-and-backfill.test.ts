import { describe, expect, it } from "vitest";

import { upcomingStops } from "@/lib/walk/upcoming-stops";
import { mayBackfillGeometry } from "@/lib/walks/walk-again";

describe("upcomingStops", () => {
  it("points at stop 1 while heading to stop 1", () => {
    const wps = [{ id: "a", isStart: true }, { id: "b", isStart: false }];
    expect(upcomingStops(wps, []).map((w) => w.id)).toEqual(["a", "b"]);
  });
  it("shows a next stop on a one-stop walk", () => {
    expect(upcomingStops([{ id: "a", isStart: true }], [])[0]?.id).toBe("a");
  });
  it("moves on once a stop is visited", () => {
    expect(upcomingStops([{ id: "a" }, { id: "b" }], ["a"]).map((w) => w.id)).toEqual(["b"]);
  });
});

describe("mayBackfillGeometry", () => {
  it("only lets builds that follow the original route write it back", () => {
    expect(mayBackfillGeometry("start_now")).toBe(true);
    expect(mayBackfillGeometry("original_start_no_location")).toBe(true);
    for (const m of ["join_nearest", "walk_to_start", "reroute_from_here", "same_style_here", "reverse"] as const) {
      expect(mayBackfillGeometry(m)).toBe(false);
    }
  });
});
