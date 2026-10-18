import { describe, expect, it } from "vitest";

import {
  applyWalk,
  peakEstimate,
  type HabitEstimate,
  type HabitState,
} from "@/lib/preferences/habit-model";
import { companionText, isCompanionCopyKey, questionKey } from "@/lib/walk/companion-copy";
import type { AmenityPick } from "@/lib/walk/companion/amenity-detour";
import { arbitrate } from "@/lib/walk/companion/companion-arbiter";
import type { ArbiterCtx, AskHistory } from "@/lib/walk/companion/companion-types";
import { resolveOperator } from "@/lib/walk/companion/operator-map";
import {
  habitCandidate,
  MAX_WEEKLY_HABIT_ASKS,
  type HabitProducerInput,
} from "@/lib/walk/companion/producers/habit";

const NOW = 1_000_000_000_000;

const est = (over: Partial<HabitEstimate> = {}): HabitEstimate => ({
  habit: "eat",
  bin: 32,
  mean: 0.7,
  wilsonLower: 0.5,
  opp: 5,
  source: "any",
  ...over,
});

const pick = (kind: "food" | "cafe", name: string | null = "Abu Hassan", distM = 140): AmenityPick => ({
  item: { id: "n1", kind, ...(name === null ? {} : { name }), coordinates: { lat: 32.05, lng: 34.75 } },
  distM,
  detourMin: 3,
});

function input(over: Partial<HabitProducerInput> = {}): HabitProducerInput {
  return {
    habit: "eat",
    estimate: est(),
    localMinute: 16 * 60,
    dayType: "weekday",
    alreadyDoneThisWalk: false,
    amenity: pick("food"),
    askedThisWalk: false,
    muted: false,
    weeklyAsks: 0,
    lang: "en",
    nowMs: NOW,
    ...over,
  };
}

describe("habitCandidate", () => {
  it("builds the eat question with a take-me / already / not-now answer set", () => {
    const c = habitCandidate(input())!;
    expect(c.kind).toBe("habit-eat");
    expect(c.urgency).toBe(1);
    expect(c.value).toBeCloseTo(0.7);
    expect(c.answers.map((a) => a.id)).toEqual(["take-me", "already", "not-now"]);
    expect(c.context).toMatchObject({ place: "Abu Hassan", d: 140 });
    expect(c.expiresAtMs).toBeGreaterThan(NOW);
  });

  it("coffee uses the cafe amenity and its own kind", () => {
    const c = habitCandidate(
      input({ habit: "coffee", estimate: est({ habit: "coffee" }), amenity: pick("cafe") }),
    )!;
    expect(c.kind).toBe("habit-coffee");
    expect(c.answers[0].operator).toEqual({ op: "find-amenity", kind: "cafe" });
  });

  it("answers map to find-amenity and two dismisses, via the exhaustive operator map", () => {
    const c = habitCandidate(input())!;
    expect(resolveOperator(c.answers[0].operator)).toEqual({ run: "amenity-detour", kind: "food" });
    expect(resolveOperator(c.answers[1].operator)).toEqual({ run: "none" });
    expect(resolveOperator(c.answers[2].operator)).toEqual({ run: "none" });
  });

  it("value is capped at 0.9", () => {
    expect(habitCandidate(input({ estimate: est({ mean: 0.99 }) }))!.value).toBe(0.9);
  });

  it("no actionable place ahead, no question", () => {
    expect(habitCandidate(input({ amenity: null }))).toBeNull();
  });

  it("a place of the wrong kind is not actionable (a cafe for eating, food for coffee)", () => {
    expect(habitCandidate(input({ amenity: pick("cafe") }))).toBeNull();
    expect(
      habitCandidate(input({ habit: "coffee", estimate: est({ habit: "coffee" }), amenity: pick("food") })),
    ).toBeNull();
  });

  it("each gate on its own silences it", () => {
    expect(habitCandidate(input({ estimate: null }))).toBeNull();
    expect(habitCandidate(input({ estimate: est({ habit: "coffee" }) }))).toBeNull();
    expect(habitCandidate(input({ muted: true }))).toBeNull();
    expect(habitCandidate(input({ askedThisWalk: true }))).toBeNull();
    expect(habitCandidate(input({ alreadyDoneThisWalk: true }))).toBeNull();
    expect(habitCandidate(input({ localMinute: NaN }))).toBeNull();
  });

  it("weekly cap is all habits together: 3 asks still allowed, 4 is the limit", () => {
    expect(MAX_WEEKLY_HABIT_ASKS).toBe(4);
    expect(habitCandidate(input({ weeklyAsks: 3 }))).not.toBeNull();
    expect(habitCandidate(input({ weeklyAsks: 4 }))).toBeNull();
  });

  it("only inside [peak - 30, peak + 15] minutes", () => {
    expect(habitCandidate(input({ localMinute: 15 * 60 + 29 }))).toBeNull();
    expect(habitCandidate(input({ localMinute: 15 * 60 + 30 }))).not.toBeNull();
    expect(habitCandidate(input({ localMinute: 16 * 60 + 15 }))).not.toBeNull();
    expect(habitCandidate(input({ localMinute: 16 * 60 + 16 }))).toBeNull();
  });

  it("an unnamed place gets a language-appropriate fallback, never an empty string", () => {
    const en = habitCandidate(input({ amenity: pick("food", null) }))!;
    expect(en.context.place).toBe("a place nearby");
    const he = habitCandidate(input({ amenity: pick("food", "  "), lang: "he" }))!;
    expect(he.context.place).toBe("מקום קרוב");
  });

  it("rounds the distance", () => {
    expect(habitCandidate(input({ amenity: pick("food", "X", 140.6) }))!.context.d).toBe(141);
  });
});

describe("copy", () => {
  it("every habit string exists in English and Hebrew and fills its placeholders", () => {
    for (const kind of ["habit-eat", "habit-coffee"] as const) {
      const key = questionKey(kind, {});
      expect(isCompanionCopyKey(key)).toBe(true);
      expect(companionText("en", key)).not.toBe(key);
      expect(companionText("he", key)).toMatch(/[֐-׿]/);
    }
    for (const lang of ["en", "he"] as const) {
      const t = companionText(lang, "answer.habitTakeMe", { place: "Abu Hassan", d: 140 });
      expect(t).toContain("Abu Hassan");
      expect(t).toContain("140");
      expect(t).not.toMatch(/[{}]/);
    }
    for (const key of [
      "answer.habitAlreadyEat",
      "answer.habitAlreadyCoffee",
      "habit.somePlace",
      "notice.habitMuted.eat",
      "notice.habitMuted.coffee",
    ]) {
      expect(isCompanionCopyKey(key)).toBe(true);
      expect(companionText("he", key)).toMatch(/[֐-׿]/);
      expect(companionText("en", key)).not.toBe(key);
    }
  });

  it("the candidate's labels all resolve to real copy", () => {
    const c = habitCandidate(input())!;
    for (const a of c.answers) expect(isCompanionCopyKey(a.label)).toBe(true);
  });
});

describe("with the real arbiter", () => {
  const ctx: ArbiterCtx = { level: "normal", questionOnScreen: false, nearTurn: false };
  const empty: AskHistory = { records: [] };

  it("a confident habit is asked at normal level", () => {
    expect(arbitrate([habitCandidate(input())!], ctx, empty, NOW)?.kind).toBe("habit-eat");
  });

  it("quiet level only lets very confident habits through (0.9 x 0.5 > 0.4, 0.7 x 0.5 < 0.4)", () => {
    const quiet: ArbiterCtx = { ...ctx, level: "quiet" };
    expect(arbitrate([habitCandidate(input())!], quiet, empty, NOW)).toBeNull();
    const strong = habitCandidate(input({ estimate: est({ mean: 0.95 }) }))!;
    expect(arbitrate([strong], quiet, empty, NOW)?.kind).toBe("habit-eat");
  });

  it("a learned estimate from the model feeds the producer end to end", () => {
    let s: HabitState = [];
    for (let i = 0; i < 5; i++) {
      s = applyWalk(
        s,
        { habit: "eat", dayType: "weekday", activeBins: [31, 32, 33], firstEventBin: 32, epochDay: 20000 + i },
        i + 1,
      );
    }
    const estimate = peakEstimate(s, "eat", "weekday");
    expect(estimate).not.toBeNull();
    expect(habitCandidate(input({ estimate }))?.kind).toBe("habit-eat");
  });
});
