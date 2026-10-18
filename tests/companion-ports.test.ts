import { beforeEach, describe, expect, it, vi } from "vitest";

const prefs = vi.hoisted(() => ({
  getPreferredCategoryWeights: vi.fn(),
  getTrendingCategoryCounts: vi.fn(),
}));
const mem = vi.hoisted(() => ({ loadCompanionMemory: vi.fn(), persistWalkEnd: vi.fn() }));
const habits = vi.hoisted(() => ({ loadRoutineHabits: vi.fn(), persistRoutineHabits: vi.fn() }));
vi.mock("@/lib/preferences/preference-store", () => prefs);
vi.mock("@/lib/preferences/companion-memory", () => mem);
vi.mock("@/lib/preferences/routine-habits", async (orig) => ({
  ...(await orig<typeof import("@/lib/preferences/routine-habits")>()),
  loadRoutineHabits: habits.loadRoutineHabits,
  persistRoutineHabits: habits.persistRoutineHabits,
}));

import {
  arbiterPolicy,
  habitModel,
  personalRecommender,
  producerOf,
  supabaseMemoryRepository,
  trendingRecommender,
} from "@/lib/companion/adapters";
import type { AskPolicy } from "@/lib/companion/ports";
import { arbitrate } from "@/lib/walk/companion/companion-arbiter";
import { CompanionEngine } from "@/lib/walk/companion/companion-engine";
import type { Candidate } from "@/lib/walk/companion/companion-types";
import {
  applyWalk,
  binOfMinute,
  estimateForBin,
  type HabitState,
} from "@/lib/preferences/habit-model";
import { foldHabitWalk } from "@/lib/preferences/routine-habits";

const T0 = Date.UTC(2026, 6, 15, 15, 0, 0);
const cand = (over: Partial<Candidate> = {}): Candidate => ({
  kind: "rain",
  urgency: 3,
  value: 1,
  answers: [{ id: "ok", label: "ok", operator: { op: "dismiss" } }],
  expiresAtMs: T0 + 600_000,
  context: {},
  ...over,
});
const ctx = { level: "normal" as const, nearTurn: false };

describe("AskPolicy / CompanionEngine injection", () => {
  it("arbiterPolicy is the arbiter: same pick as calling arbitrate directly", () => {
    const history = { records: [] };
    const c = [cand()];
    const c2 = { ...ctx, questionOnScreen: false };
    expect(arbiterPolicy.choose(c, c2, history, T0)).toBe(arbitrate(c, c2, history, T0));
    expect(arbiterPolicy.choose(c, c2, history, T0)).toBe(c[0]);
  });

  it("the engine defaults to the arbiter", () => {
    const e = new CompanionEngine();
    expect(e.tick([cand()], ctx, T0)).toBe(true);
    expect(e.question?.cand.kind).toBe("rain");
  });

  it("an injected policy decides, and receives the engine's history and context", () => {
    const choose = vi.fn<AskPolicy["choose"]>(() => null);
    const e = new CompanionEngine({ rain: { asked: 3, answered: 1 } }, { policy: { choose } });
    expect(e.tick([cand()], { ...ctx, otherCardUp: true }, T0)).toBe(false);
    expect(choose).toHaveBeenCalledTimes(1);
    const [cands, c, history, now] = choose.mock.calls[0];
    expect(cands).toHaveLength(1);
    expect(c).toMatchObject({ level: "normal", questionOnScreen: true });
    expect(history.priors).toEqual({ rain: { asked: 3, answered: 1 } });
    expect(now).toBe(T0);
    expect(e.question).toBeNull();
  });

  it("an injected policy's pick goes on screen", () => {
    const only = cand({ kind: "sunset" });
    const e = new CompanionEngine(undefined, { policy: { choose: () => only } });
    e.tick([], ctx, T0);
    expect(e.question?.cand).toBe(only);
  });
});

describe("producerOf", () => {
  it("passes the mapped input to the wrapped function and returns its result untouched", () => {
    const out = cand();
    const fn = vi.fn((i: { n: number }) => (i.n > 0 ? out : null));
    const p = producerOf("x", fn, (f: { nowMs: number }) => ({ n: f.nowMs }));
    expect(p.id).toBe("x");
    expect(p.produce({ nowMs: 5 })).toBe(out);
    expect(p.produce({ nowMs: 0 })).toBeNull();
    expect(fn).toHaveBeenNthCalledWith(1, { n: 5 });
  });
});

describe("habitModel", () => {
  const state: HabitState = (() => {
    let s: HabitState = [];
    for (let d = 0; d < 5; d++) {
      s = applyWalk(
        s,
        { habit: "eat", dayType: "weekday", activeBins: [31, 32, 33], firstEventBin: 32, epochDay: 20000 + d },
        100 + d,
      );
    }
    return s;
  })();

  it("estimate is estimateForBin at the bin of the minute", () => {
    for (const m of [0, 8 * 60, 16 * 60, 16 * 60 + 29, 23 * 60 + 59]) {
      expect(habitModel.estimate(state, "eat", "weekday", m)).toEqual(
        estimateForBin(state, "eat", "weekday", binOfMinute(m)),
      );
    }
  });

  it("the fixture really is established at 16:00 (so the equality above is not null === null)", () => {
    expect(habitModel.estimate(state, "eat", "weekday", 16 * 60)).not.toBeNull();
    expect(habitModel.estimate(state, "eat", "weekday", 3 * 60)).toBeNull();
  });

  it("foldWalk is foldHabitWalk", () => {
    expect(habitModel.foldWalk).toBe(foldHabitWalk);
  });
});

describe("memory repository", () => {
  beforeEach(() => {
    mem.loadCompanionMemory.mockReset();
    mem.persistWalkEnd.mockReset();
    habits.loadRoutineHabits.mockReset();
    habits.persistRoutineHabits.mockReset();
  });
  const client = {} as never;

  it("forwards to the existing functions, with the consent flag", async () => {
    mem.loadCompanionMemory.mockResolvedValue("M");
    mem.persistWalkEnd.mockResolvedValue(true);
    habits.loadRoutineHabits.mockResolvedValue([]);
    habits.persistRoutineHabits.mockResolvedValue(true);
    const repo = supabaseMemoryRepository(client, { learnPreferences: false });
    expect(await repo.loadCompanion("u")).toBe("M");
    expect(mem.loadCompanionMemory).toHaveBeenCalledWith(client, "u", false);
    const input = { learnPreferences: false } as never;
    expect(await repo.saveWalkEnd("u", input, { currentSession: 4, prevPaceByEnv: {} })).toBe(true);
    expect(mem.persistWalkEnd).toHaveBeenCalledWith(client, "u", input, 4, {});
    expect(await repo.loadHabits("u")).toEqual([]);
    const walk = { startedAtMs: 1 } as never;
    expect(await repo.saveHabitWalk("u", walk)).toBe(true);
    expect(habits.persistRoutineHabits).toHaveBeenCalledWith(client, "u", walk);
  });
});

describe("personal and trending recommenders", () => {
  it("personal: category weights scaled by the max; nothing without a user", async () => {
    prefs.getPreferredCategoryWeights.mockResolvedValue(new Map([["park", 4], ["museum", 2]]));
    const r = personalRecommender({} as never);
    expect(r.source).toBe("personal");
    expect(await r.recommend({})).toEqual([]);
    expect(prefs.getPreferredCategoryWeights).not.toHaveBeenCalled();
    expect(await r.recommend({ userId: "u" })).toEqual([
      { category: "park", score: 1, reason: "personal" },
      { category: "museum", score: 0.5, reason: "personal" },
    ]);
  });

  it("trending: counts scaled by the max; empty map and zero max give nothing", async () => {
    const r = trendingRecommender({} as never);
    prefs.getTrendingCategoryCounts.mockResolvedValue(new Map([["viewpoint", 10], ["park", 5]]));
    expect(await r.recommend({})).toEqual([
      { category: "viewpoint", score: 1, reason: "trending" },
      { category: "park", score: 0.5, reason: "trending" },
    ]);
    prefs.getTrendingCategoryCounts.mockResolvedValue(new Map());
    expect(await r.recommend({})).toEqual([]);
    prefs.getTrendingCategoryCounts.mockResolvedValue(new Map([["park", 0]]));
    expect(await r.recommend({})).toEqual([]);
  });
});
