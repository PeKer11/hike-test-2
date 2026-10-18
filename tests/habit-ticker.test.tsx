import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useWalkCompanion, type CompanionSnapshot } from "@/lib/hooks/useWalkCompanion";
import { applyWalk, type HabitState, type WalkObservation } from "@/lib/preferences/habit-model";
import { COMPANION_TICK_MS } from "@/lib/walk/companion/companion-glue";
import {
  countWeeklyAsks,
  HABIT_ASK_KEY,
  recentAsks,
  recordHabitAsk,
  withAsk,
  WEEK_MS,
} from "@/lib/walk/companion/habit-ask-log";
import {
  askedHabitQuestion,
  foodAmenityItems,
  habitsDoneThisWalk,
} from "@/lib/walk/companion/habit-ticker";
import { at, item } from "./helpers/discovery";

// Wednesday 16:00 in Asia/Jerusalem (UTC+3 in July): inside the 15:30-16:15 window of bin 32.
const T_IN = Date.UTC(2026, 6, 15, 13, 0, 0);
// 13:00 local: well outside it.
const T_OUT = Date.UTC(2026, 6, 15, 10, 0, 0);

const obs = (i: number): WalkObservation => ({
  habit: "eat",
  dayType: "weekday",
  activeBins: [31, 32, 33],
  firstEventBin: 32,
  epochDay: 20000 + i,
});
function established(): HabitState {
  let s: HabitState = [];
  for (let i = 0; i < 4; i++) s = applyWalk(s, obs(i), 100 + i);
  return s;
}

const restaurant = (over: Parameters<typeof item>[2] = {}) =>
  item("food-1", at(0, 120), { category: "food", name: "Abu Hassan", tags: { amenity: "restaurant" }, ...over });

function snapshot(
  nowMs: number,
  habit: CompanionSnapshot["tick"]["habit"],
  amenityItems = [restaurant()],
): CompanionSnapshot {
  return {
    tick: {
      nowMs,
      position: at(0, 0),
      environment: "urban",
      speedMpm: 80,
      remainingWalkMin: 60,
      remainingStops: [{ id: "a", name: "A" }],
      pace: null,
      addPlace: null,
      amenities: foodAmenityItems(amenityItems),
      walkerAlongM: null,
      green: null,
      habit,
    },
    ctx: { level: "normal", nearTurn: false },
  };
}

const facts = (items = [restaurant()], habits = established()) => ({
  habits,
  timeZone: "Asia/Jerusalem",
  foodEvents: [],
  items,
});

beforeEach(() => {
  vi.useFakeTimers();
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
  });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ apparentTempC: 20, precipProbabilityPct: 0 }) }));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function run(snap: CompanionSnapshot | null) {
  const onAnswered = vi.fn();
  const hook = renderHook(() =>
    useWalkCompanion({ active: true, lang: "en", voice: false, getSnapshot: () => snap, onAnswered }),
  );
  return { ...hook, onAnswered };
}
const tick = async () => act(async () => void vi.advanceTimersByTime(COMPANION_TICK_MS));

describe("routine-habit question in the companion ticker", () => {
  it("asks at the habit time when a food place is ahead, and 'take me' routes to food", async () => {
    const { result, onAnswered } = run(snapshot(T_IN, facts()));
    await tick();
    expect(result.current.card?.kind).toBe("habit-eat");
    expect(result.current.card?.title).toMatch(/usually eat/);
    expect(result.current.card?.title).not.toMatch(/Abu Hassan/); // the question itself is the fixed template
    expect(result.current.card?.answers.map((a) => a.id)).toEqual(["take-me", "already", "not-now"]);

    act(() => result.current.answer("take-me"));
    expect(onAnswered.mock.calls[0][0].action).toMatchObject({ run: "amenity-detour", kind: "food" });
    // The ask is counted in the on-device 7-day log (hour-truncated).
    expect(countWeeklyAsks(JSON.parse(localStorage.getItem(HABIT_ASK_KEY)!), T_IN)).toBe(1);
  });

  it("builds nothing without the learning consent (habit absent), even in the window", async () => {
    const { result } = run(snapshot(T_IN, null));
    await tick();
    expect(result.current.card).toBeNull();
    expect(localStorage.getItem(HABIT_ASK_KEY)).toBeNull();
  });

  it("builds nothing outside the window, with no food place ahead, or when food was already visited", async () => {
    const out = run(snapshot(T_OUT, facts()));
    await tick();
    expect(out.result.current.card).toBeNull();
    out.unmount();

    const none = run(snapshot(T_IN, facts([]), []));
    await tick();
    expect(none.result.current.card).toBeNull();
    none.unmount();

    const visited = restaurant({ state: "visited" });
    const done = run(snapshot(T_IN, facts([visited]), [visited]));
    await tick();
    expect(done.result.current.card).toBeNull();
  });

  it("stops at 4 asks in the rolling week and resumes when old asks age out", async () => {
    localStorage.setItem(HABIT_ASK_KEY, JSON.stringify([1, 2, 3, 4].map((d) => T_IN - d * 3_600_000)));
    const capped = run(snapshot(T_IN, facts()));
    await tick();
    expect(capped.result.current.card).toBeNull();
    capped.unmount();

    localStorage.setItem(HABIT_ASK_KEY, JSON.stringify([1, 2, 3, 4].map((d) => T_IN - WEEK_MS - d * 3_600_000)));
    const aged = run(snapshot(T_IN, facts()));
    await tick();
    expect(aged.result.current.card?.kind).toBe("habit-eat");
  });
});

describe("habit ticker helpers", () => {
  it("food amenities skip detected, visited and dismissed places and non-food", () => {
    const out = foodAmenityItems([
      restaurant(),
      item("cafe-1", at(10, 10), { category: "food", tags: { amenity: "cafe" } }),
      item("det", at(10, 10), { tier: "detected", category: "food" }),
      item("vis", at(10, 10), { state: "visited", category: "food" }),
      item("dis", at(10, 10), { state: "dismissed", category: "food" }),
      item("museum", at(10, 10), { category: "museum" }),
      item("bar", at(10, 10), { category: "food", tags: { amenity: "bar" } }),
    ]);
    expect(out.map((a) => [a.id, a.kind])).toEqual([
      ["food-1", "food"],
      ["cafe-1", "cafe"],
    ]);
  });

  it("'done' counts a dwell inside 2 h and visited/added places, not an old dwell", () => {
    expect([...habitsDoneThisWalk([], [{ habit: "eat", atMs: T_IN - 3_600_000 }], T_IN)]).toEqual(["eat"]);
    expect(habitsDoneThisWalk([], [{ habit: "eat", atMs: T_IN - 3 * 3_600_000 }], T_IN).size).toBe(0);
    expect([...habitsDoneThisWalk([restaurant({ state: "added" })], [], T_IN)]).toEqual(["eat"]);
  });

  it("asked-this-walk reads the engine's habit records only", () => {
    const rec = (kind: string) => ({ kind }) as never;
    expect(askedHabitQuestion([rec("sunset")])).toBe(false);
    expect(askedHabitQuestion([rec("sunset"), rec("habit-coffee")])).toBe(true);
  });
});

describe("habit ask log", () => {
  it("keeps only valid in-window entries and truncates new ones to the hour", () => {
    const now = T_IN + 25 * 60_000;
    expect(recentAsks([now - WEEK_MS - 1, "x", NaN, now - 5, now + 10 * 3_600_000], now)).toEqual([now - 5]);
    expect(withAsk([], now)).toEqual([T_IN]);
    expect(recentAsks("garbage", now)).toEqual([]);
  });

  it("survives a throwing storage", () => {
    const bad = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(() => recordHabitAsk(T_IN, bad)).not.toThrow();
  });
});
