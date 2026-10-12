import { describe, expect, it } from "vitest";

import type { Attraction } from "@/lib/types";
import { pickAmenity, amenityRerouteBodies } from "@/lib/walk/companion/amenity-detour";
import type { PlanOperator } from "@/lib/walk/companion/companion-types";
import { resolveOperator } from "@/lib/walk/companion/operator-map";
import { paceCandidate } from "@/lib/walk/companion/producers/pace";
import { sunsetCandidate } from "@/lib/walk/companion/producers/sunset";
import {
  companionCopy,
  companionText,
  questionKey,
} from "@/lib/walk/companion-copy";
import {
  buildDropStopsRebuildRequest,
  type PaceRebuildState,
  type RebuildInput,
} from "@/lib/walk/planner-actions";
import { DEFAULT_WALK_SETTINGS } from "@/lib/types/walk-settings";

const stop = (id: string): Attraction =>
  ({ id, name: id, coordinates: { lat: 32, lng: 34.8 }, avgVisitMinutes: 10 }) as Attraction;

const state = (ids: string[], pinned: string[] = []): PaceRebuildState<RebuildInput> => ({
  originalInput: {
    origin: { lat: 32, lng: 34.8 },
    availableMinutes: 90,
    walkingPaceMinPerKm: 12,
  },
  walkStartTime: 0,
  now: 30 * 60_000,
  currentPosition: { lat: 32.001, lng: 34.8 },
  settings: DEFAULT_WALK_SETTINGS,
  currentAttractions: ids.map(stop),
  pinnedIds: pinned,
});

describe("resolveOperator", () => {
  it("maps every operator to an existing rebuild or a new builder", () => {
    const cases: Array<[PlanOperator | null, unknown]> = [
      [{ op: "shorten" }, { run: "pace-rebuild", reason: "sustained-slow-pace" }],
      [{ op: "shorten", dropStopIds: ["a"] }, { run: "drop-stops", dropStopIds: ["a"] }],
      [{ op: "keep-all-extend" }, { run: "extended-time-rebuild" }],
      [{ op: "extend", addFrom: "collection" }, { run: "pace-rebuild", reason: "sustained-fast-pace" }],
      [{ op: "loop-from-here", theme: "nature" }, { run: "walk-options-roundtrip", theme: "nature" }],
      [{ op: "find-amenity", kind: "bench" }, { run: "amenity-detour", kind: "bench" }],
      [{ op: "head-back" }, { run: "head-back" }],
      [{ op: "dismiss" }, { run: "none" }],
      [null, { run: "none" }],
    ];
    for (const [op, expected] of cases) expect(resolveOperator(op)).toEqual(expected);
  });

  it("an empty drop list falls back to the pace rebuild", () => {
    expect(resolveOperator({ op: "shorten", dropStopIds: [] })).toEqual({
      run: "pace-rebuild",
      reason: "sustained-slow-pace",
    });
  });
});

describe("planner-actions operators", () => {
  it("drop keeps the order of the rest and unpins the dropped stop", () => {
    const { options } = buildDropStopsRebuildRequest(state(["a", "b", "c", "d"], ["b", "c"]), ["b"]);
    expect(options.keepAttractions?.map((s) => s.id)).toEqual(["a", "c", "d"]);
    expect(options.pinnedIds).toEqual(["c"]);
    expect(options.fillRemainingTime).toBe(false);
  });

  it("dropping the only remaining stop keeps it (an empty list would trigger discovery)", () => {
    const { options } = buildDropStopsRebuildRequest(state(["a"]), ["a"]);
    expect(options.keepAttractions?.map((s) => s.id)).toEqual(["a"]);
    expect(options.fillRemainingTime).toBe(false);
    const all = buildDropStopsRebuildRequest(state(["a", "b"]), ["a", "b"]);
    expect(all.options.keepAttractions?.map((s) => s.id)).toEqual(["a", "b"]);
  });

  it("a shorten cap travels with the pace-rebuild action", () => {
    expect(resolveOperator({ op: "shorten", capMin: 40 })).toEqual({
      run: "pace-rebuild",
      reason: "sustained-slow-pace",
      capMin: 40,
    });
  });

  it("both rebuild from the walker's position with the remaining time", () => {
    const { input } = buildDropStopsRebuildRequest(state(["a", "b"]), ["a"]);
    expect(input.origin).toEqual({ lat: 32.001, lng: 34.8 });
    expect(input.availableMinutes).toBe(60);
  });
});

describe("answers all resolve", () => {
  it("every answer of the pace and sunset producers has a known operator action and copy key", () => {
    const pace = paceCandidate({
      advice: "slow",
      currentPaceMinPerKm: 16,
      plannedPaceMinPerKm: 12,
      remainingPlannedMin: 60,
      remainingStops: [{ id: "a", name: "A" }],
      nowMs: 0,
    })!;
    const sun = sunsetCandidate({
      nowMs: Date.UTC(2026, 5, 21, 15, 30),
      position: { lat: 32.08, lng: 34.78 },
      remainingWalkMin: 100,
    })!;
    for (const c of [pace, sun]) {
      expect(c.answers.length).toBeGreaterThanOrEqual(2);
      expect(c.answers.length).toBeLessThanOrEqual(3);
      for (const a of c.answers) {
        expect(resolveOperator(a.operator)).toBeDefined();
        expect(a.label in companionCopy.en).toBe(true);
      }
    }
  });
});

describe("amenity detour", () => {
  const position = { lat: 32.08, lng: 34.78 };
  const at = (m: number) => ({ lat: position.lat + m / 111_320, lng: position.lng });
  const near = { id: "w1", kind: "drinking_water" as const, coordinates: at(80), lateralM: 3 };
  const far = { id: "w2", kind: "drinking_water" as const, coordinates: at(140), lateralM: 3 };
  const base = { position, environment: "urban" as const, speedMpm: 80, remainingWalkMin: 60 };

  it("picks the nearest of the right kind that passes the detour rule", () => {
    const pick = pickAmenity({
      ...base,
      kind: "drinking_water",
      items: [far, near, { ...near, id: "t", kind: "toilets", coordinates: at(10) }],
    });
    expect(pick?.item.id).toBe("w1");
    expect(pick!.detourMin).toBeCloseTo((2 * 80 * 1.25) / 80);
  });

  it("uses straight-line distance from the walker and ignores amenities behind", () => {
    const behind = {
      id: "back",
      kind: "drinking_water" as const,
      // ~2.2 km south of the walker, but only 10 m off the route
      coordinates: { lat: position.lat - 0.02, lng: position.lng },
      lateralM: 10,
      alongM: 100,
    };
    const ahead = {
      id: "ahead",
      kind: "drinking_water" as const,
      coordinates: { lat: position.lat + 0.001, lng: position.lng }, // ~111 m
      lateralM: 5,
      alongM: 2_100,
    };
    // no along info: the straight line (2.2 km) rules it out
    expect(pickAmenity({ ...base, kind: "drinking_water", items: [behind] })).toBeNull();
    // with route info: behind is dropped even if it were close
    expect(
      pickAmenity({
        ...base,
        kind: "drinking_water",
        walkerAlongM: 2_000,
        items: [{ ...behind, coordinates: position }, ahead],
      })?.item.id,
    ).toBe("ahead");
    const pick = pickAmenity({ ...base, kind: "drinking_water", walkerAlongM: 2_000, items: [ahead] })!;
    expect(pick.distM).toBeGreaterThan(100); // from the walker, not the 5 m lateral
    expect(pick.distM).toBeLessThan(120);
    // too far ahead along the route
    expect(
      pickAmenity({
        ...base,
        kind: "drinking_water",
        walkerAlongM: 0,
        items: [{ ...ahead, coordinates: position, alongM: 1_600 }],
      }),
    ).toBeNull();
  });

  it("rejects beyond the environment limit and beyond the time rule", () => {
    expect(
      pickAmenity({ ...base, kind: "drinking_water", items: [{ ...near, coordinates: at(151) }] }),
    ).toBeNull(); // urban detourOfferM = 150
    // 140 m at 80 m/min = 4.4 min > max(3, 0.12 x 20) = 3
    expect(
      pickAmenity({ ...base, remainingWalkMin: 20, kind: "drinking_water", items: [far] }),
    ).toBeNull();
  });

  it("uses at most two reroute calls", () => {
    const bodies = amenityRerouteBodies(position, { lat: 32.081, lng: 34.78 }, { lat: 32.082, lng: 34.78 });
    expect(bodies).toHaveLength(2);
    expect(bodies[0].from).toEqual(position);
    expect(bodies[1].from).toEqual({ lat: 32.081, lng: 34.78 });
  });
});

describe("companion copy", () => {
  it("English and Hebrew have the same keys and no empty strings", () => {
    expect(Object.keys(companionCopy.he).sort()).toEqual(Object.keys(companionCopy.en).sort());
    for (const lang of ["en", "he"] as const)
      for (const v of Object.values(companionCopy[lang])) expect(v.length).toBeGreaterThan(0);
  });

  it("keeps the same placeholders in both languages", () => {
    const names = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
    for (const k of Object.keys(companionCopy.en) as Array<keyof typeof companionCopy.en>) {
      expect(names(companionCopy.he[k])).toBe(names(companionCopy.en[k]));
    }
  });

  it("fills placeholders and leaves unknowns visible", () => {
    expect(companionText("en", "q.heat-water", { t: 35, place: "Fountain", d: 120 })).toBe(
      "It's 35°C now. Water at Fountain, 120 m away?",
    );
    expect(companionText("he", "q.stop-closing", { stop: "מוזיאון", hhmm: "17:00" })).toContain("17:00");
    expect(companionText("en", "q.rain")).toContain("{p}");
    expect(companionText("en", "nope")).toBe("nope");
    // inherited property names are not copy keys or variables
    expect(companionText("en", "toString")).toBe("toString");
    expect(companionText("en", "constructor")).toBe("constructor");
    expect(companionText("en", "q.rain", {})).toContain("{p}");
    expect(companionText("en", "answer.keepAll", {}).includes("{constructor}")).toBe(false);
  });

  it("Hebrew answer buttons are infinitives and there is no reorder answer", () => {
    expect("answer.reorder" in companionCopy.en).toBe(false);
    for (const k of ["answer.shorten", "answer.add", "answer.skip", "answer.headBack", "answer.continue"] as const) {
      expect(companionCopy.he[k].startsWith("ל")).toBe(true);
    }
    expect(companionCopy.he["q.stop-closing"]).toContain("שעת הסגירה של");
    expect(companionCopy.en["answer.finishEarly"]).toMatch(/head back/i);
  });

  it("never claims safety in hebrew or english questions", () => {
    for (const lang of ["en", "he"] as const)
      for (const v of Object.values(companionCopy[lang])) expect(v).not.toMatch(/safe|verified|בטוח|מאומת/i);
  });

  it("questionKey picks the no-stop variant", () => {
    expect(questionKey("pace-slow", { stop: "" })).toBe("q.pace-slow.nostop");
    expect(questionKey("pace-slow", { stop: "A" })).toBe("q.pace-slow");
    expect(questionKey("sunset", {})).toBe("q.sunset");
  });
});
