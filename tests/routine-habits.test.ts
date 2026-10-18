import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { MEMORY_TABLES } from "@/app/api/forget-everything/route";
import { DAY_MS, findRow, type HabitState } from "@/lib/preferences/habit-model";
import {
  loadCompanionMemory,
  persistWalkEnd,
  planWalkEndWrites,
  type WalkEndInput,
} from "@/lib/preferences/companion-memory";
import { parseMemoryWire, toMemoryWire } from "@/lib/preferences/companion-memory-wire";
import {
  foldHabitWalk,
  loadRoutineHabits,
  persistRoutineHabits,
  rowFromDb,
  rowToDb,
  sanitizeHabitRows,
  type HabitWalkEnd,
} from "@/lib/preferences/routine-habits";
import type { Attraction } from "@/lib/types";
import {
  buildHabitWalkEnd,
  FOOD_DWELL_MIN,
  FoodDwellTracker,
  habitOfAttraction,
  resolveTimeZone,
} from "@/lib/walk/companion/habit-walk-end";
import type { AskRecord } from "@/lib/walk/companion/companion-types";
import { buildWalkEndInput } from "@/lib/walk/companion/walk-end";

// Wed 2026-10-14 15:50 Jerusalem (UTC+3).
const START = Date.UTC(2026, 9, 14, 12, 50);
const MIN = 60_000;
const TZ = "Asia/Jerusalem";

const rec = (over: Partial<AskRecord> = {}): AskRecord => ({
  kind: "habit-eat",
  askedAt: START + 20 * MIN, // 16:10 -> bin 32
  outcome: "answered",
  answerId: "take-me",
  urgency: 1,
  dismissed: false,
  ...over,
});

const facts = (over: Record<string, unknown> = {}) => ({
  startedAtMs: START,
  actualMin: 60,
  timeZone: TZ,
  records: [] as AskRecord[],
  foodEvents: [] as Array<{ habit: "eat" | "coffee"; atMs: number }>,
  ...over,
});

describe("buildHabitWalkEnd", () => {
  it("a walk with no food and no questions only adds opportunities", () => {
    const w = buildHabitWalkEnd(facts())!;
    const eat = w.observations.find((o) => o.habit === "eat")!;
    expect(eat.activeBins).toEqual([32, 33]);
    expect(eat.firstEventBin).toBeNull();
    expect(eat.dayType).toBe("weekday");
    expect(w.answers).toEqual([]);
  });

  it("returns null when the walk says nothing", () => {
    expect(buildHabitWalkEnd(facts({ actualMin: 5 }))).toBeNull();
    expect(buildHabitWalkEnd(facts({ startedAtMs: NaN }))).toBeNull();
    expect(buildHabitWalkEnd(facts({ timeZone: "Nope/Zone" }))).toBeNull();
  });

  it("a dwell at a place is the first event, in local time", () => {
    const w = buildHabitWalkEnd(
      facts({ foodEvents: [{ habit: "eat", atMs: START + 40 * MIN }, { habit: "eat", atMs: START + 10 * MIN }] }),
    )!;
    // Earliest is 16:00 -> bin 32.
    expect(w.observations.find((o) => o.habit === "eat")!.firstEventBin).toBe(32);
    expect(w.observations.find((o) => o.habit === "coffee")!.firstEventBin).toBeNull();
  });

  it("'take me' and 'already ate' are food events at the ask time (so they strengthen the habit)", () => {
    for (const answerId of ["take-me", "already"]) {
      const w = buildHabitWalkEnd(facts({ records: [rec({ answerId })] }))!;
      expect(w.observations.find((o) => o.habit === "eat")!.firstEventBin).toBe(32);
      expect(w.answers).toHaveLength(1);
      expect(w.answers[0]).toMatchObject({ habit: "eat", answer: answerId, bin: 32 });
    }
  });

  it("'not now' is not a food event; a dwell within 30 min makes it 'too early'", () => {
    const no = buildHabitWalkEnd(facts({ records: [rec({ answerId: "not-now" })] }))!;
    expect(no.observations.find((o) => o.habit === "eat")!.firstEventBin).toBeNull();
    expect(no.answers[0]).toMatchObject({ answer: "not-now", visitedFoodWithin30Min: false });

    const early = buildHabitWalkEnd(
      facts({
        records: [rec({ answerId: "not-now" })],
        foodEvents: [{ habit: "eat", atMs: START + 20 * MIN + 25 * MIN }],
      }),
    )!;
    expect(early.answers[0].visitedFoodWithin30Min).toBe(true);
    const late = buildHabitWalkEnd(
      facts({
        records: [rec({ answerId: "not-now" })],
        foodEvents: [{ habit: "eat", atMs: START + 20 * MIN + 31 * MIN }],
      }),
    )!;
    expect(late.answers[0].visitedFoodWithin30Min).toBe(false);
  });

  it("a timeout (ignored) carries no evidence; the question's habit is not mixed up", () => {
    const w = buildHabitWalkEnd(
      facts({ records: [rec({ outcome: "ignored", answerId: undefined }), rec({ kind: "sunset" })] }),
    )!;
    expect(w.answers).toHaveLength(1);
    expect(w.answers[0].answer).toBe("timeout");
    expect(w.observations.find((o) => o.habit === "eat")!.firstEventBin).toBeNull();
    expect(w.observations.find((o) => o.habit === "coffee")!.firstEventBin).toBeNull();
  });

  it("friday and saturday are their own day types, taken in the walk's zone", () => {
    const fri = buildHabitWalkEnd(facts({ startedAtMs: Date.UTC(2026, 9, 16, 9, 0) }))!;
    expect(fri.observations[0].dayType).toBe("friday");
    const sat = buildHabitWalkEnd(facts({ startedAtMs: Date.UTC(2026, 9, 17, 9, 0) }))!;
    expect(sat.observations[0].dayType).toBe("saturday");
  });

  it("holds only numbers and enums (no coordinates, names or text)", () => {
    const w = buildHabitWalkEnd(facts({ records: [rec()] }))!;
    expect(JSON.stringify(w)).not.toMatch(/lat|lng|name|place/i);
  });
});

describe("FoodDwellTracker", () => {
  const cafe: Attraction = {
    id: "c1",
    name: "Cafe",
    coordinates: { lat: 32.05, lng: 34.75 },
    category: "food",
    avgVisitMinutes: 20,
    tags: { amenity: "cafe" },
  };
  const here = cafe.coordinates;
  const far = { lat: 32.06, lng: 34.75 };

  it("maps places to habits", () => {
    expect(habitOfAttraction(cafe)).toBe("coffee");
    expect(habitOfAttraction({ ...cafe, tags: { amenity: "restaurant" } })).toBe("eat");
    expect(habitOfAttraction({ ...cafe, tags: { amenity: "fast_food" } })).toBe("eat");
    expect(habitOfAttraction({ ...cafe, tags: { amenity: "bar" } })).toBeNull();
    expect(habitOfAttraction({ ...cafe, tags: {} })).toBe("eat");
    expect(habitOfAttraction({ ...cafe, tags: {}, category: "museum" })).toBeNull();
  });

  it("walking past is not a visit; 8 minutes there is, stamped at arrival", () => {
    const t = new FoodDwellTracker();
    t.update(here, START, [cafe]);
    t.update(here, START + (FOOD_DWELL_MIN - 1) * MIN, [cafe]);
    expect(t.events).toEqual([]);
    t.update(here, START + FOOD_DWELL_MIN * MIN, [cafe]);
    expect(t.events).toEqual([{ habit: "coffee", atMs: START }]);
    t.update(here, START + 20 * MIN, [cafe]);
    expect(t.events).toHaveLength(1); // once per place
  });

  it("leaving resets the clock", () => {
    const t = new FoodDwellTracker();
    t.update(here, START, [cafe]);
    t.update(far, START + 5 * MIN, [cafe]);
    t.update(here, START + 6 * MIN, [cafe]);
    t.update(here, START + 12 * MIN, [cafe]);
    expect(t.events).toEqual([]);
    t.update(here, START + 14 * MIN, [cafe]);
    expect(t.events).toEqual([{ habit: "coffee", atMs: START + 6 * MIN }]);
  });

  it("reset clears everything; a non-finite time is ignored", () => {
    const t = new FoodDwellTracker();
    t.update(here, NaN, [cafe]);
    t.update(here, START, [cafe]);
    t.update(here, START + 9 * MIN, [cafe]);
    expect(t.events).toHaveLength(1);
    t.reset();
    expect(t.events).toEqual([]);
  });
});

describe("resolveTimeZone", () => {
  it("Israel uses Asia/Jerusalem even on a foreign phone; elsewhere the device zone", () => {
    expect(resolveTimeZone({ lat: 32.08, lng: 34.78 }, "America/New_York")).toBe("Asia/Jerusalem");
    expect(resolveTimeZone({ lat: 48.85, lng: 2.35 }, "Europe/Paris")).toBe("Europe/Paris");
    expect(resolveTimeZone(null, null)).toBe("Asia/Jerusalem");
  });
});

// --- storage ---------------------------------------------------------------

function learnedWalk(startedAtMs: number, day: number): HabitWalkEnd {
  return {
    startedAtMs,
    observations: [
      { habit: "eat", dayType: "weekday", activeBins: [31, 32, 33], firstEventBin: 32, epochDay: day },
    ],
    answers: [{ habit: "eat", dayType: "weekday", answer: "not-now", bin: 32, askedAtMs: startedAtMs }],
  };
}

interface Call {
  table: string;
  op: string;
  arg?: unknown;
}

/** A tiny fake of the Supabase builder chain that remembers upserts for later reads. */
function fakeClient(opts: { readError?: boolean; upsertError?: boolean } = {}) {
  const calls: Call[] = [];
  const store = new Map<string, Record<string, unknown>>();
  const builder = (table: string) => {
    let op = "select";
    const b: Record<string, unknown> = {};
    for (const o of ["select", "eq", "in", "order", "limit"]) b[o] = () => b;
    b.maybeSingle = async () => ({ data: null });
    for (const o of ["insert", "upsert", "update"]) {
      b[o] = (arg: unknown) => {
        op = o;
        calls.push({ table, op: o, arg });
        if (table === "routine_habits" && o === "upsert") {
          for (const r of arg as Array<Record<string, unknown>>) {
            store.set(`${r.habit}|${r.clock}|${r.day_type}`, r);
          }
        }
        return b;
      };
    }
    b.then = (res: (v: unknown) => void) => {
      if (table === "routine_habits" && op === "select") {
        res(
          opts.readError
            ? { data: null, error: { message: "boom" } }
            : { data: [...store.values()], error: null },
        );
      } else if (table === "routine_habits" && opts.upsertError) {
        res({ data: null, error: { message: "denied" } });
      } else {
        res({ data: [], error: null });
      }
    };
    return b;
  };
  return { client: { from: builder } as never, calls, store };
}

describe("routine_habits storage", () => {
  it("round-trips a row through the database shape, wall clock, no coordinates", () => {
    const state = foldHabitWalk([], learnedWalk(START, 20000));
    const row = findRow(state, "eat", "weekday")!;
    const db = rowToDb("u1", row);
    expect(db).toMatchObject({ user_id: "u1", habit: "eat", clock: "wall", day_type: "weekday" });
    expect(Object.keys(db).join()).not.toMatch(/lat|lng|coord|name/);
    expect(db.succ).toHaveLength(48);
    expect(rowFromDb(db)).toEqual({ ...row });
  });

  it("only wall-clock rows are read in v1 (walk-clock rows are v2)", () => {
    const db = rowToDb("u1", findRow(foldHabitWalk([], learnedWalk(START, 20000)), "eat", "any")!);
    expect(rowFromDb({ ...db, clock: "walk" })).toBeNull();
    expect(rowFromDb({ ...db, habit: "rest" })).toBeNull();
  });

  it("foldHabitWalk decays once and a replayed walk changes nothing, answers included", () => {
    const once = foldHabitWalk([], learnedWalk(START, 20000));
    const twice = foldHabitWalk(once, learnedWalk(START, 20000));
    expect(twice).toBe(once);
    expect(findRow(once, "eat", "any")!.declineStreak).toBe(1);
    const next = foldHabitWalk(once, learnedWalk(START + DAY_MS, 20001));
    expect(findRow(next, "eat", "any")!.declineStreak).toBe(2);
  });

  it("persist reads, folds and upserts only the changed rows; a retry writes nothing", async () => {
    const { client, calls } = fakeClient();
    expect(await persistRoutineHabits(client, "u1", learnedWalk(START, 20000))).toBe(true);
    const ups = calls.filter((c) => c.op === "upsert");
    expect(ups).toHaveLength(1);
    expect((ups[0].arg as unknown[]).length).toBe(2); // weekday + any
    expect(await persistRoutineHabits(client, "u1", learnedWalk(START, 20000))).toBe(true);
    expect(calls.filter((c) => c.op === "upsert")).toHaveLength(1);
  });

  it("never overwrites from a state it could not read", async () => {
    const { client, calls } = fakeClient({ readError: true });
    expect(await persistRoutineHabits(client, "u1", learnedWalk(START, 20000))).toBe(false);
    expect(calls.filter((c) => c.op === "upsert")).toEqual([]);
  });

  it("reports a failed upsert", async () => {
    const { client } = fakeClient({ upsertError: true });
    expect(await persistRoutineHabits(client, "u1", learnedWalk(START, 20000))).toBe(false);
  });

  it("load returns [] on a read error instead of throwing", async () => {
    expect(await loadRoutineHabits(fakeClient({ readError: true }).client, "u1")).toEqual([]);
    const throwing = { from: () => { throw new Error("no table"); } } as never;
    expect(await loadRoutineHabits(throwing, "u1")).toEqual([]);
  });

  it("sanitizeHabitRows drops garbage and non-arrays", () => {
    expect(sanitizeHabitRows("x")).toEqual([]);
    expect(sanitizeHabitRows([null, { habit: "eat" }])).toEqual([]);
  });
});

describe("consent gating of the walk-end write", () => {
  const base = (over: Partial<WalkEndInput> = {}): WalkEndInput => ({
    learnPreferences: true,
    startedAtMs: START,
    plannedMin: 60,
    actualMin: 60,
    distanceM: 4000,
    envMinutes: { urban: 60 },
    stopsPlanned: 2,
    stopsVisited: 2,
    questions: [],
    collapseCount: 0,
    paceSamples: [],
    interactions: [],
    habits: learnedWalk(START, 20000),
    ...over,
  });

  it("without learning consent nothing is planned and no client call is made", async () => {
    expect(planWalkEndWrites(base({ learnPreferences: false }))).toBeNull();
    const from = vi.fn();
    expect(await persistWalkEnd({ from } as never, "u1", base({ learnPreferences: false }), 1, {})).toBe(false);
    expect(from).not.toHaveBeenCalled();
  });

  it("with consent the habits are written after the summary", async () => {
    const { client, calls } = fakeClient();
    expect(await persistWalkEnd(client, "u1", base(), 1, {})).toBe(true);
    expect(calls.map((c) => `${c.table}:${c.op}`)).toEqual(["walk_summaries:insert", "routine_habits:upsert"]);
  });

  it("without habits (consent not 'granted') no routine_habits call happens", async () => {
    const { client, calls } = fakeClient();
    expect(await persistWalkEnd(client, "u1", base({ habits: null }), 1, {})).toBe(true);
    expect(calls.some((c) => c.table === "routine_habits")).toBe(false);
  });

  it("buildWalkEndInput passes habits through, and the summary plan never holds them in the summary row", () => {
    const input = buildWalkEndInput({
      learnPreferences: true,
      startedAtMs: START,
      plannedMin: 60,
      actualMin: 60,
      distanceM: 4000,
      environment: "urban",
      stopsPlanned: 1,
      stopsVisited: 1,
      records: [],
      collapseCount: 0,
      items: [],
      paceMinPerKm: null,
      habits: learnedWalk(START, 20000),
    });
    expect(input.habits).not.toBeNull();
    expect(JSON.stringify(planWalkEndWrites(input)!.summary)).not.toContain("succ");
    const none = buildWalkEndInput({ learnPreferences: false, records: [], items: [], environment: "urban" } as never);
    expect(none.habits).toBeNull();
  });

  it("memory load carries the stored habits and the wire re-validates them", async () => {
    const stored = rowToDb("u1", findRow(foldHabitWalk([], learnedWalk(START, 20000)), "eat", "any")!);
    const builder = () => {
      const b: Record<string, unknown> = {};
      for (const o of ["select", "eq", "order", "limit"]) b[o] = () => b;
      b.maybeSingle = async () => ({ data: { session_count: 3 } });
      b.then = (res: (v: unknown) => void) => res({ data: [stored], error: null });
      return b;
    };
    const mem = await loadCompanionMemory({ from: builder } as never, "u1", true);
    expect(mem!.habits).toHaveLength(1);
    expect(await loadCompanionMemory({ from: builder } as never, "u1", false)).toBeNull();
    const wire = toMemoryWire(mem!);
    expect(parseMemoryWire(JSON.parse(JSON.stringify(wire)))!.habits).toHaveLength(1);
    const tampered = JSON.parse(JSON.stringify(wire));
    tampered.habits[0].succ = [1, 2, 3];
    expect(parseMemoryWire(tampered)!.habits).toEqual([]);
    expect(parseMemoryWire({ sessionCount: 1 })!.habits).toEqual([]);
  });
});

describe("forget everything", () => {
  it("clears routine_habits too", () => {
    expect(MEMORY_TABLES).toContain("routine_habits");
  });
});

describe("a habit is learned across walks (integration of builder, fold and gate)", () => {
  it("five lunch walks at 16:00 on different days establish the habit; walks without eating do not", async () => {
    const { peakEstimate } = await import("@/lib/preferences/habit-model");
    let eats: HabitState = [];
    let walksOnly: HabitState = [];
    for (let i = 0; i < 5; i++) {
      const start = START + i * DAY_MS;
      const ate = buildHabitWalkEnd(facts({ startedAtMs: start, foodEvents: [{ habit: "eat", atMs: start + 10 * MIN }] }))!;
      const didNot = buildHabitWalkEnd(facts({ startedAtMs: start }))!;
      eats = foldHabitWalk(eats, ate);
      walksOnly = foldHabitWalk(walksOnly, didNot);
    }
    expect(peakEstimate(eats, "eat", "weekday")!.bin).toBe(32);
    expect(peakEstimate(walksOnly, "eat", "weekday")).toBeNull();
    expect(peakEstimate(eats, "coffee", "weekday")).toBeNull();
  });
});
