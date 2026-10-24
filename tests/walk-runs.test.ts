import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { addRun, groupRuns, isDraft, listRuns, type WalkRun } from "@/lib/walks/walk-runs";
import type { SavedWalk } from "@/lib/walks/saved-walks";

/** Chainable stand-in for the query builder: records the calls, resolves to `result`. */
function mockClient(result: { data?: unknown; error?: unknown }) {
  const calls: Array<[string, unknown[]]> = [];
  const q: Record<string, unknown> = {};
  for (const m of ["from", "insert", "select", "eq", "in", "order", "single"]) {
    q[m] = (...args: unknown[]) => {
      calls.push([m, args]);
      return q;
    };
  }
  q.then = (res: (v: unknown) => unknown) => Promise.resolve({ data: result.data ?? null, error: result.error ?? null }).then(res);
  return { client: q as unknown as SupabaseClient, calls };
}

const walk = (id: string): SavedWalk =>
  ({ id, title: id, status: "planned", areaLabel: null, start: { lat: 1, lng: 2 }, totalMin: 60, distanceM: 1000, stops: [], params: {}, visibility: "private", createdAt: "2026-10-01", completedAt: null }) as SavedWalk;
const run = (id: string, walkId: string, startedAt: string): WalkRun => ({ id, walkId, startedAt, finishedAt: null, minutes: 30, distanceM: 1000 });

describe("walk-runs", () => {
  it("groups runs under their walk, newest first, drafts have none", () => {
    const g = groupRuns([walk("a"), walk("b")], [run("1", "a", "2026-10-02"), run("2", "a", "2026-10-05"), run("3", "zzz", "2026-10-06")]);
    expect(g[0].runs.map((r) => r.id)).toEqual(["2", "1"]);
    expect(g[0]).toMatchObject({ runCount: 2, lastRunAt: "2026-10-05", isDraft: false });
    expect(g[1]).toMatchObject({ runCount: 0, lastRunAt: null, isDraft: true });
    expect(isDraft(0)).toBe(true);
    expect(isDraft(1)).toBe(false);
  });
  it("addRun clamps numbers and returns the id", async () => {
    const { client, calls } = mockClient({ data: { id: "r1" } });
    expect(await addRun(client, "u1", "w1", { minutes: 99999, distanceM: -5, finishedAt: "2026-10-24T10:00:00Z" })).toBe("r1");
    const insert = calls.find(([m]) => m === "insert")![1][0] as Record<string, unknown>;
    expect(insert).toMatchObject({ walk_id: "w1", user_id: "u1", minutes: 1440, distance_m: null, finished_at: "2026-10-24T10:00:00Z" });
  });
  it("addRun returns null on error; listRuns is empty on error", async () => {
    const { client } = mockClient({ error: { message: "x" } });
    expect(await addRun(client, "u1", "w1")).toBeNull();
    expect(await listRuns(client, "w1")).toEqual([]);
  });
  it("listRuns maps rows", async () => {
    const { client } = mockClient({ data: [{ id: "r", walk_id: "w", started_at: "s", finished_at: null, minutes: 5, distance_m: 6 }] });
    expect(await listRuns(client, "w")).toEqual([{ id: "r", walkId: "w", startedAt: "s", finishedAt: null, minutes: 5, distanceM: 6 }]);
  });
});
