import { describe, expect, it, vi } from "vitest";

import {
  blendedPace,
  foldInteraction,
  interactionSuppression,
  loadCompanionMemory,
  persistWalkEnd,
  sanitizePaceByEnv,
  planWalkEndWrites,
  priorsFromSummaries,
  truncateToHour,
  updatePaceByEnv,
  type InteractionRow,
  type WalkEndInput,
} from "@/lib/preferences/companion-memory";

const row = (
  poi_key: string,
  kind: InteractionRow["kind"],
  last_session: number,
  count = 1,
): InteractionRow => ({ poi_key, kind, count, last_session });

describe("pace per environment", () => {
  it("first sample sets, later samples EWMA with alpha 0.3", () => {
    const a = updatePaceByEnv({}, [{ env: "urban", activeMinutes: 30, minPerKm: 12 }]);
    expect(a.urban).toEqual({ minPerKm: 12, n: 1 });
    const b = updatePaceByEnv(a, [{ env: "urban", activeMinutes: 30, minPerKm: 15 }]);
    expect(b.urban!.minPerKm).toBeCloseTo(0.3 * 15 + 0.7 * 12);
    expect(b.urban!.n).toBe(2);
  });

  it("ignores walks under 10 active minutes and implausible paces", () => {
    const prev = { park: { minPerKm: 14, n: 3 } };
    expect(updatePaceByEnv(prev, [{ env: "park", activeMinutes: 9.9, minPerKm: 20 }])).toEqual(prev);
    expect(updatePaceByEnv(prev, [{ env: "park", activeMinutes: 30, minPerKm: 1 }])).toEqual(prev);
    expect(updatePaceByEnv(prev, [{ env: "park", activeMinutes: 30, minPerKm: NaN }])).toEqual(prev);
    expect(updatePaceByEnv(prev, [{ env: "park", activeMinutes: 10, minPerKm: 14 }]).park!.n).toBe(4);
  });

  it("does not mutate the previous map; blends by n", () => {
    const prev = { urban: { minPerKm: 12, n: 3 } };
    updatePaceByEnv(prev, [{ env: "urban", activeMinutes: 20, minPerKm: 20 }]);
    expect(prev.urban).toEqual({ minPerKm: 12, n: 3 });
    expect(blendedPace({ urban: { minPerKm: 12, n: 3 }, rural: { minPerKm: 20, n: 1 } })).toBeCloseTo(14);
    expect(blendedPace({})).toBeNull();
  });
});

describe("interaction suppression on the session clock", () => {
  it("dismissed is suppressed for 30 sessions", () => {
    const rows = [row("a", "dismissed", 100)];
    expect(interactionSuppression(rows, 129).suppressedKeys.has("a")).toBe(true);
    expect(interactionSuppression(rows, 130).suppressedKeys.has("a")).toBe(false);
  });

  it("visited is suppressed for 180 sessions unless notable", () => {
    const rows = [row("v", "visited", 10)];
    expect(interactionSuppression(rows, 189).suppressedKeys.has("v")).toBe(true);
    expect(interactionSuppression(rows, 190).suppressedKeys.has("v")).toBe(false);
    expect(interactionSuppression(rows, 50, new Set(["v"])).suppressedKeys.has("v")).toBe(false);
  });

  it("two declined detours block offers for 20 sessions", () => {
    const rows = [row("a", "declined_detour", 50), row("b", "declined_detour", 52)];
    expect(interactionSuppression(rows, 60).detourOffersBlocked).toBe(true);
    expect(interactionSuppression(rows, 72).detourOffersBlocked).toBe(false); // 'a' aged out
    expect(interactionSuppression([row("a", "declined_detour", 50)], 60).detourOffersBlocked).toBe(false);
    expect(interactionSuppression([row("a", "declined_detour", 50, 2)], 60).detourOffersBlocked).toBe(true);
  });

  it("added / offered never suppress", () => {
    const s = interactionSuppression([row("x", "added", 1), row("y", "offered", 1)], 2);
    expect(s.suppressedKeys.size).toBe(0);
  });

  it("foldInteraction bumps the count and stamps the session", () => {
    expect(foldInteraction(undefined, "k", "visited", 7)).toEqual(row("k", "visited", 7, 1));
    expect(foldInteraction(row("k", "visited", 3, 2), "k", "visited", 9)).toEqual(row("k", "visited", 9, 3));
  });
});

describe("question stats", () => {
  it("counts answered vs ignored per kind", () => {
    const p = priorsFromSummaries([
      { questions: [{ kind: "sunset", answer: "shorten" }, { kind: "sunset", answer: "ignored" }] },
      { questions: [{ kind: "rain", answer: "dismiss" }] },
    ]);
    expect(p.sunset).toEqual({ asked: 2, answered: 1 });
    expect(p.rain).toEqual({ asked: 1, answered: 1 });
  });
});

const input = (over: Partial<WalkEndInput> = {}): WalkEndInput => ({
  learnPreferences: true,
  startedAtMs: Date.UTC(2026, 9, 11, 10, 42, 17),
  areaLabel: "Tel Aviv",
  plannedMin: 90,
  actualMin: 84.4,
  distanceM: 5234.6,
  envMinutes: { urban: 80 },
  stopsPlanned: 4,
  stopsVisited: 3,
  questions: Array.from({ length: 25 }, () => ({ kind: "sunset" as const, answer: "ignored" })),
  collapseCount: 0,
  paceSamples: [{ env: "urban", activeMinutes: 80, minPerKm: 13 }],
  interactions: [{ poiKey: "osm-node-1", kind: "visited", category: "museum" }],
  ...over,
});

describe("consent gating", () => {
  it("no consent -> no plan", () => {
    expect(planWalkEndWrites(input({ learnPreferences: false }))).toBeNull();
  });

  it("no consent -> persistWalkEnd makes zero client calls", async () => {
    const from = vi.fn();
    const ok = await persistWalkEnd({ from } as never, "u1", input({ learnPreferences: false }), 5, {});
    expect(ok).toBe(false);
    expect(from).not.toHaveBeenCalled();
  });

  it("plan holds numbers only: hour-truncated time, rounded values, capped questions, bounded label", () => {
    const plan = planWalkEndWrites(input({ areaLabel: "x".repeat(100) }))!;
    expect(plan.summary.started_hour).toBe("2026-10-11T10:00:00.000Z");
    expect(truncateToHour(Date.UTC(2026, 0, 1, 0, 59, 59))).toBe("2026-01-01T00:00:00.000Z");
    expect(plan.summary.actual_min).toBe(84);
    expect(plan.summary.distance_m).toBe(5235);
    expect(plan.summary.questions).toHaveLength(20);
    expect(plan.summary.area_label).toHaveLength(60);
    expect(JSON.stringify(plan)).not.toMatch(/lat|lng/);
  });

  it("with consent the store writes summary, interactions and pace", async () => {
    const calls: Array<{ table: string; op: string; arg?: unknown }> = [];
    const builder = (table: string) => {
      const b: Record<string, unknown> = {};
      for (const op of ["select", "eq", "in"]) b[op] = () => b;
      for (const op of ["insert", "upsert", "update"]) {
        b[op] = (arg: unknown) => {
          calls.push({ table, op, arg });
          return b;
        };
      }
      b.maybeSingle = async () => ({ data: { session_count: 5, pace_by_env: {} }, error: null });
      b.then = (res: (v: unknown) => void) => res({ data: [], error: null });
      return b;
    };
    const ok = await persistWalkEnd({ from: builder } as never, "u1", input(), 5, {});
    expect(ok).toBe(true);
    expect(calls.map((c) => `${c.table}:${c.op}`)).toEqual([
      "walk_summaries:insert",
      "place_interactions:upsert",
      "profiles:update",
    ]);
    const upsert = calls[1].arg as Array<Record<string, unknown>>;
    expect(upsert[0]).toMatchObject({ user_id: "u1", poi_key: "osm-node-1", count: 1, last_session: 5, category: "museum" });
  });
});

describe("persistWalkEnd is idempotent for a walk already stored (R1)", () => {
  it("a unique violation on the summary means 'already stored': true, and no interaction or pace write", async () => {
    const calls: string[] = [];
    const builder = (table: string) => {
      const b: Record<string, unknown> = {};
      for (const op of ["select", "eq", "in", "update"]) b[op] = () => b;
      for (const op of ["insert", "upsert"]) {
        b[op] = () => {
          calls.push(`${table}:${op}`);
          return table === "walk_summaries"
            ? Promise.resolve({ data: null, error: { code: "23505" } })
            : b;
        };
      }
      b.then = (res: (v: unknown) => void) => res({ data: [], error: null });
      return b;
    };
    expect(await persistWalkEnd({ from: builder } as never, "u1", input(), 5, {})).toBe(true);
    expect(calls).toEqual(["walk_summaries:insert"]);
  });
  it("any other insert error is still a failure", async () => {
    const builder = () => ({ insert: () => Promise.resolve({ data: null, error: { code: "42501" } }) });
    expect(await persistWalkEnd({ from: builder } as never, "u1", input(), 5, {})).toBe(false);
  });
});

describe("persistWalkEnd never writes client-held pace back (privacy)", () => {
  it("after the DB rows are empty, stale client pace history is not resurrected", async () => {
    const updates: Array<Record<string, unknown>> = [];
    const builder = () => {
      const b: Record<string, unknown> = {};
      for (const op of ["select", "eq", "in", "upsert"]) b[op] = () => b;
      b.insert = () => b;
      b.update = (arg: Record<string, unknown>) => {
        updates.push(arg);
        return b;
      };
      b.maybeSingle = async () => ({ data: { session_count: 0, pace_by_env: {} }, error: null });
      b.then = (res: (v: unknown) => void) => res({ data: [], error: null });
      return b;
    };
    const stale = { urban: { minPerKm: 20, n: 50 } };
    expect(await persistWalkEnd({ from: builder } as never, "u1", input(), 99, stale)).toBe(true);
    expect(updates).toHaveLength(1);
    expect(updates[0].pace_by_env).toEqual({ urban: { minPerKm: 13, n: 1 } });
  });
});

describe("store error handling", () => {
  function clientFailing(failTable: string, failOp: string) {
    const calls: string[] = [];
    const builder = (table: string) => {
      const b: Record<string, unknown> = {};
      let op = "select";
      for (const o of ["select", "eq", "in"]) b[o] = () => b;
      for (const o of ["insert", "upsert", "update"]) {
        b[o] = () => {
          op = o;
          calls.push(`${table}:${o}`);
          return b;
        };
      }
      b.maybeSingle = async () => ({ data: { session_count: 5, pace_by_env: {} }, error: null });
      b.then = (res: (v: unknown) => void) =>
        res(
          table === failTable && op === failOp
            ? { data: null, error: { message: "denied" } }
            : { data: [], error: null },
        );
      return b;
    };
    return { client: { from: builder } as never, calls };
  }

  it("returns false when the summary insert fails, and writes nothing else", async () => {
    const { client, calls } = clientFailing("walk_summaries", "insert");
    expect(await persistWalkEnd(client, "u1", input(), 5, {})).toBe(false);
    expect(calls).toEqual(["walk_summaries:insert"]);
  });

  it("returns false when the interactions upsert or the pace update fails", async () => {
    const a = clientFailing("place_interactions", "upsert");
    expect(await persistWalkEnd(a.client, "u1", input(), 5, {})).toBe(false);
    const b = clientFailing("profiles", "update");
    expect(await persistWalkEnd(b.client, "u1", input(), 5, {})).toBe(false);
  });
});

describe("sanitizePaceByEnv", () => {
  it("keeps valid entries and drops non-finite, out-of-range and malformed ones", () => {
    expect(
      sanitizePaceByEnv({
        urban: { minPerKm: 12, n: 3 },
        forest: { minPerKm: 2.9, n: 3 },
        park: { minPerKm: 61, n: 3 },
        trail: { minPerKm: "12", n: 3 },
        coast: { minPerKm: null, n: 3 },
        rural: { minPerKm: 12, n: 0 },
        other: 5,
      }),
    ).toEqual({ urban: { minPerKm: 12, n: 3 } });
    expect(sanitizePaceByEnv([1, 2])).toEqual({});
    expect(sanitizePaceByEnv("x")).toEqual({});
    expect(sanitizePaceByEnv(null)).toEqual({});
  });

  it("loadCompanionMemory applies it to what the database returned", async () => {
    const builder = (table: string) => {
      const b: Record<string, unknown> = {};
      for (const o of ["select", "eq", "order", "limit"]) b[o] = () => b;
      b.maybeSingle = async () => ({
        data: { session_count: 4, pace_by_env: { urban: { minPerKm: 1e9, n: 2 }, park: { minPerKm: 11, n: 2 } } },
      });
      b.then = (res: (v: unknown) => void) => res({ data: [], error: null });
      void table;
      return b;
    };
    const mem = await loadCompanionMemory({ from: builder } as never, "u1", true);
    expect(mem!.paceByEnv).toEqual({ park: { minPerKm: 11, n: 2 } });
  });
});
