import { describe, expect, it } from "vitest";

import { planWalkEndWrites } from "@/lib/preferences/companion-memory";
import {
  arbitrate,
  recordFromCandidate,
} from "@/lib/walk/companion/companion-arbiter";
import type {
  ArbiterCtx,
  AskHistory,
  Candidate,
} from "@/lib/walk/companion/companion-types";
import { resolveOperator } from "@/lib/walk/companion/operator-map";
import { heatCandidate } from "@/lib/walk/companion/producers/conditions";
import { stopClosingInfoCandidate } from "@/lib/walk/companion/producers/places";
import { sunsetCandidate } from "@/lib/walk/companion/producers/sunset";
import { sunsetMs } from "@/lib/walk/companion/sun";
import { companionText, questionKey } from "@/lib/walk/companion-copy";
import {
  buildDropStopsRebuildRequest,
  type PaceRebuildState,
  type RebuildInput,
} from "@/lib/walk/planner-actions";
import { DEFAULT_WALK_SETTINGS } from "@/lib/types/walk-settings";
import type { Attraction } from "@/lib/types";

const MIN = 60_000;
const T0 = Date.UTC(2026, 6, 15, 8, 0, 0);
const TLV = { lat: 32.0853, lng: 34.7818 };
const water = { name: "Fountain", distM: 100 };
const quiet: ArbiterCtx = { level: "quiet", questionOnScreen: false, nearTurn: false };

/** Run a 15 s-check walk; the walker dismisses every question. */
function simulate(
  mk: (t: number) => Candidate | null,
  minutes: number,
  answerId: string,
  ctx: ArbiterCtx = quiet,
): Candidate[] {
  let history: AskHistory = { records: [] };
  const shown: Candidate[] = [];
  for (let t = T0; t < T0 + minutes * MIN; t += 15_000) {
    const c = mk(t);
    const pick = c ? arbitrate([c], ctx, history, t) : null;
    if (pick) {
      shown.push(pick);
      history = {
        ...history,
        records: [...history.records, recordFromCandidate(pick, t, "answered", answerId)],
      };
    }
  }
  return shown;
}

describe("M1 safety questions respect a dismissal", () => {
  it("quiet user, 37 C, always 'I'm fine': at most 2 heat questions in 90 min", () => {
    const shown = simulate((t) => heatCandidate({ apparentTempC: 37, precipProbabilityPct: null }, water, t), 90, "fine");
    expect(shown.length).toBeGreaterThanOrEqual(1);
    expect(shown.length).toBeLessThanOrEqual(2);
  });

  it("escalation by +2 C comes back after the 12 min gap, but not before", () => {
    const first = heatCandidate({ apparentTempC: 37, precipProbabilityPct: null }, water, T0)!;
    const history: AskHistory = { records: [recordFromCandidate(first, T0, "answered", "fine")] };
    const hotter = (t: number) => heatCandidate({ apparentTempC: 39, precipProbabilityPct: null }, water, t)!;
    expect(arbitrate([hotter(T0 + 5 * MIN)], quiet, history, T0 + 5 * MIN)).toBeNull();
    expect(arbitrate([hotter(T0 + 13 * MIN)], quiet, history, T0 + 13 * MIN)).not.toBeNull();
    const same = heatCandidate({ apparentTempC: 38, precipProbabilityPct: null }, water, T0 + 13 * MIN)!;
    expect(arbitrate([same], quiet, history, T0 + 13 * MIN)).toBeNull();
  });

  it("urgency 2 -> 3 skips the same-kind gap but never the 3 min floor or a turn", () => {
    const warm = heatCandidate({ apparentTempC: 34, precipProbabilityPct: null }, water, T0)!;
    expect(warm.urgency).toBe(2);
    const history: AskHistory = { records: [recordFromCandidate(warm, T0, "answered", "fine")] };
    const hot = (t: number) => heatCandidate({ apparentTempC: 36, precipProbabilityPct: null }, water, t)!;
    expect(arbitrate([hot(T0 + 2 * MIN)], quiet, history, T0 + 2 * MIN)).toBeNull(); // floor
    expect(arbitrate([hot(T0 + 4 * MIN)], quiet, history, T0 + 4 * MIN)).not.toBeNull();
    expect(arbitrate([hot(T0 + 4 * MIN)], { ...quiet, nearTurn: true }, history, T0 + 4 * MIN)).toBeNull();
  });

  it("a safety question answered with take-me also waits 45 min (not every 12), then returns as safety", () => {
    const hot = heatCandidate({ apparentTempC: 37, precipProbabilityPct: null }, water, T0)!;
    const history: AskHistory = { records: [recordFromCandidate(hot, T0, "answered", "take-me")] };
    expect(history.records[0].dismissed).toBe(false);
    const later = heatCandidate({ apparentTempC: 37, precipProbabilityPct: null }, water, T0 + 13 * MIN)!;
    expect(arbitrate([later], quiet, history, T0 + 13 * MIN)).toBeNull();
    const much = heatCandidate({ apparentTempC: 37, precipProbabilityPct: null }, water, T0 + 46 * MIN)!;
    expect(arbitrate([much], quiet, history, T0 + 46 * MIN)).not.toBeNull();
  });

  it("an ignored safety question returns after 45 min even at quiet", () => {
    const hot = heatCandidate({ apparentTempC: 37, precipProbabilityPct: null }, water, T0)!;
    const history: AskHistory = { records: [recordFromCandidate(hot, T0, "ignored")] };
    const later = heatCandidate({ apparentTempC: 37, precipProbabilityPct: null }, water, T0 + 46 * MIN)!;
    expect(arbitrate([later], quiet, history, T0 + 46 * MIN)).not.toBeNull();
  });

  it("sunset: dismissed, margin unchanged -> not repeated like safety; worse by 10 min -> repeated", () => {
    const sunset = sunsetMs(T0, TLV.lat, TLV.lng)!;
    const start = sunset - 40 * MIN;
    const at = (t: number, r: number) =>
      sunsetCandidate({ nowMs: t, position: TLV, remainingWalkMin: r })!;
    const first = at(start, 60);
    const history: AskHistory = { records: [recordFromCandidate(first, start, "answered", "continue")] };
    // 15 min later the walker kept walking: margin identical (r shrank with m).
    const t1 = start + 15 * MIN;
    expect(arbitrate([at(t1, 45)], quiet, history, t1)).toBeNull();
    // 15 min later but no progress made: margin worsened by 15.
    expect(arbitrate([at(t1, 60)], quiet, history, t1)).not.toBeNull();
  });

  it("sunset simulation with a steady margin: at most 2 in 60 min", () => {
    const sunset = sunsetMs(T0, TLV.lat, TLV.lng)!;
    const start = sunset - 60 * MIN;
    let history: AskHistory = { records: [] };
    let n = 0;
    for (let t = start; t < start + 60 * MIN; t += 15_000) {
      const minsToSunset = (sunset - t) / MIN;
      const c = sunsetCandidate({ nowMs: t, position: TLV, remainingWalkMin: minsToSunset + 20 });
      const pick = c ? arbitrate([c], quiet, history, t) : null;
      if (pick) {
        n++;
        history = { records: [...history.records, recordFromCandidate(pick, t, "answered", "continue")] };
      }
    }
    expect(n).toBeGreaterThanOrEqual(1);
    expect(n).toBeLessThanOrEqual(2);
  });

  it("an ignored safety question also counts as dismissed", () => {
    const hot = heatCandidate({ apparentTempC: 37, precipProbabilityPct: null }, water, T0)!;
    const history: AskHistory = { records: [recordFromCandidate(hot, T0, "ignored")] };
    expect(history.records[0].dismissed).toBe(true);
    const later = heatCandidate({ apparentTempC: 37, precipProbabilityPct: null }, water, T0 + 20 * MIN)!;
    expect(arbitrate([later], quiet, history, T0 + 20 * MIN)).toBeNull();
  });
});

describe("W2 sunset cap is never lost", () => {
  const sunset = sunsetMs(T0, TLV.lat, TLV.lng)!;
  const now = sunset - 10 * MIN;

  it("always carries capMin, also with a drop stop, and through the operator map", () => {
    const c = sunsetCandidate({ nowMs: now, position: TLV, remainingWalkMin: 40, dropStopId: "s1", remainingStopCount: 3 })!;
    const op = c.answers[0].operator!;
    expect(op).toMatchObject({ op: "shorten", dropStopIds: ["s1"], capMin: 10 });
    expect(resolveOperator(op)).toEqual({ run: "drop-stops", dropStopIds: ["s1"], capMin: 10 });
  });

  it("a lone remaining stop is not dropped", () => {
    const c = sunsetCandidate({ nowMs: now, position: TLV, remainingWalkMin: 40, dropStopId: "s1", remainingStopCount: 1 })!;
    expect(c.answers[0].operator).toMatchObject({ op: "shorten", capMin: 10 });
    expect((c.answers[0].operator as { dropStopIds?: string[] }).dropStopIds).toBeUndefined();
  });

  it("the rebuild honours a cap below MIN_REBUILD_MINUTES", () => {
    const stop = (id: string) => ({ id, name: id, coordinates: { lat: 32, lng: 34.8 }, avgVisitMinutes: 10 }) as Attraction;
    const state: PaceRebuildState<RebuildInput> = {
      originalInput: { origin: { lat: 32, lng: 34.8 }, availableMinutes: 90, walkingPaceMinPerKm: 12 },
      walkStartTime: 0,
      now: 30 * MIN,
      currentPosition: { lat: 32.001, lng: 34.8 },
      settings: DEFAULT_WALK_SETTINGS,
      currentAttractions: [stop("a"), stop("b")],
      pinnedIds: [],
    };
    expect(buildDropStopsRebuildRequest(state, ["a"]).input.availableMinutes).toBe(60);
    expect(buildDropStopsRebuildRequest(state, ["a"], 8).input.availableMinutes).toBe(8);
    expect(buildDropStopsRebuildRequest(state, ["a"], 500).input.availableMinutes).toBe(60);
  });
});

describe("W3 walk-end values are clamped to the migration ranges", () => {
  it("one bad number does not leave an out-of-range column", () => {
    const plan = planWalkEndWrites({
      learnPreferences: true,
      startedAtMs: T0,
      areaLabel: null,
      plannedMin: -5,
      actualMin: 99_999,
      distanceM: Number.NaN,
      envMinutes: {},
      stopsPlanned: 500,
      stopsVisited: -1,
      questions: [],
      collapseCount: 1e9,
      paceSamples: [],
      interactions: [],
    })!;
    expect(plan.summary).toMatchObject({
      planned_min: 0,
      actual_min: 1440,
      distance_m: 0,
      stops_planned: 100,
      stops_visited: 0,
      collapse_count: 1000,
    });
  });
});

describe("W4 last closing stop is info only", () => {
  const args = {
    stopId: "s1",
    stopName: "Museum",
    closesAtMs: T0 + 30 * MIN,
    closesAtHhmm: "17:00",
    etaMin: 25,
    nowMs: T0,
  };

  it("single OK answer, no operator change, only when exactly one stop is left", () => {
    const c = stopClosingInfoCandidate({ ...args, remainingStopCount: 1 })!;
    expect(c.answers).toHaveLength(1);
    expect(resolveOperator(c.answers[0].operator)).toEqual({ run: "none" });
    expect(stopClosingInfoCandidate({ ...args, remainingStopCount: 2 })).toBeNull();
    expect(stopClosingInfoCandidate({ ...args, remainingStopCount: 1, closesAtMs: T0 + 120 * MIN })).toBeNull();
  });

  it("copy exists in EN and HE and never asks to skip", () => {
    const c = stopClosingInfoCandidate({ ...args, remainingStopCount: 1 })!;
    const key = questionKey(c.kind, c.context);
    expect(key).toBe("q.stop-closing.info");
    expect(companionText("en", key, c.context)).toBe("Museum closes at 17:00.");
    expect(companionText("he", key, c.context)).toBe("שעת הסגירה של Museum: 17:00.");
    expect(companionText("en", c.answers[0].label)).toBe("OK");
    expect(companionText("he", c.answers[0].label)).not.toBe("answer.ok");
  });
});
