import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createBudgetGuard, type UsageStore } from "@/lib/llm/budget";
import { runMeteredTurn } from "@/lib/llm/llm-client";
import { createMemoryTurnLock, TurnBusyError } from "@/lib/llm/turn-lock";
import { BilledFailureError } from "@/lib/llm/types";
import { AiBuildRefusedError } from "@/lib/ai-builder/run";
import { TurnCancelledError } from "@/lib/assistant/turn";

/** Same semantics as the llm_usage_bump RPC after the reservations migration: negative bumps allowed, totals clamped at 0. */
function fakeStore() {
  const rows = new Map<string, { calls: number; cost: number }>();
  const bumps: Array<{ calls: number; cost: number }> = [];
  const store: UsageStore = {
    async bump(key, day, calls, cost) {
      bumps.push({ calls, cost });
      for (const k of [`${key}|${day}`, `*global*|${day}`]) {
        const r = rows.get(k) ?? { calls: 0, cost: 0 };
        r.calls += calls;
        r.cost = Math.max(0, r.cost + cost);
        rows.set(k, r);
      }
      const u = [...rows.entries()].find(([k]) => k.startsWith(`${key}|`))![1];
      const g = [...rows.entries()].find(([k]) => k.startsWith("*global*|"))![1];
      return { callerCalls: u.calls, callerCostMicros: u.cost, globalCostMicros: g.cost };
    },
  };
  return { store, bumps, total: () => [...rows.entries()].find(([k]) => k.startsWith("user:"))?.[1].cost ?? 0 };
}

const ctx = { userId: "u1", ip: "1.1.1.1" };
const choice = { provider: "openai", model: "gpt-6.1-sol" } as never;
const env = { OPENAI_API_KEY: "x" };

describe("runMeteredTurn settles failed turns", () => {
  it("settles what a cancelled turn already spent", async () => {
    const { store, total } = fakeStore();
    const budget = createBudgetGuard(store);
    await expect(
      runMeteredTurn(ctx, 3, async () => { throw new TurnCancelledError(1234); }, { budget, choice, env }),
    ).rejects.toBeInstanceOf(TurnCancelledError);
    expect(total()).toBe(1234);
  });

  it("settles what a refused AI build already spent", async () => {
    const { store, total } = fakeStore();
    await expect(
      runMeteredTurn(ctx, 3, async () => { throw new AiBuildRefusedError("x", 999); }, { budget: createBudgetGuard(store), choice, env }),
    ).rejects.toBeInstanceOf(AiBuildRefusedError);
    expect(total()).toBe(999);
  });

  it("settles a BilledFailureError and settles 0 for a plain error", async () => {
    const a = fakeStore();
    await expect(
      runMeteredTurn(ctx, 3, async () => { throw new BilledFailureError(500, new Error("x")); }, { budget: createBudgetGuard(a.store), choice, env }),
    ).rejects.toBeInstanceOf(BilledFailureError);
    expect(a.total()).toBe(500);
    const b = fakeStore();
    await expect(
      runMeteredTurn(ctx, 3, async () => { throw new Error("plain"); }, { budget: createBudgetGuard(b.store), choice, env }),
    ).rejects.toThrow("plain");
    expect(b.total()).toBe(0);
  });
});

describe("worst-case reservation", () => {
  const anon = { userId: "u2", ip: "2.2.2.2" };

  it("holds the worst case, refuses a second concurrent turn, and refunds the refusal", async () => {
    const { store, total } = fakeStore();
    const g = createBudgetGuard(store);
    await g.reserve(anon, 250_000); // the free cap is 250_000
    await expect(g.reserve(anon, 250_000)).rejects.toMatchObject({ reason: "user" });
    expect(total()).toBe(250_000);
  });

  it("replaces the hold with the real cost when the turn settles", async () => {
    const { store, total } = fakeStore();
    const g = createBudgetGuard(store);
    await g.reserve(anon, 250_000);
    await g.settle(anon, 40_000, 250_000);
    expect(total()).toBe(40_000);
  });

  it("keeps the old behaviour with no reservation (runLlm)", async () => {
    const { store, total } = fakeStore();
    const g = createBudgetGuard(store);
    await g.reserve(anon);
    await g.settle(anon, 7_000);
    expect(total()).toBe(7_000);
  });

  it("lets the owner through the per-user cap but not the global one", async () => {
    process.env.LLM_OWNER_USER_IDS = "owner";
    try {
      const { store } = fakeStore();
      const g = createBudgetGuard(store, { dailyBudgetUsd: 1 });
      const owner = { userId: "owner", ip: "3.3.3.3" };
      await g.reserve(owner, 600_000);
      await g.settle(owner, 600_000, 600_000);
      await expect(g.reserve(owner, 500_000)).resolves.toBeUndefined();
      await g.settle(owner, 500_000, 500_000);
      await expect(g.reserve(owner, 1)).rejects.toMatchObject({ reason: "global" });
    } finally {
      delete process.env.LLM_OWNER_USER_IDS;
    }
  });

  it("a turn in a runMeteredTurn holds the reservation while it runs", async () => {
    const { store, total } = fakeStore();
    const budget = createBudgetGuard(store);
    let during = -1;
    await runMeteredTurn(ctx, 3, async () => { during = total(); return { value: 1, billedMicros: 3_000 }; }, { budget, choice, env }, { reserveMicros: 100_000 });
    expect(during).toBe(100_000);
    expect(total()).toBe(3_000);
  });
});

describe("one turn at a time", () => {
  const run = (lock: ReturnType<typeof createMemoryTurnLock>, fn: () => Promise<{ value: number; billedMicros: number }>) =>
    runMeteredTurn(ctx, 3, fn, { budget: createBudgetGuard(fakeStore().store), choice, env, lock }, { lockKey: "assistant:u1" });

  it("refuses a second turn for the same key while the first runs, and never calls its fn", async () => {
    const lock = createMemoryTurnLock();
    let release!: () => void;
    const first = run(lock, () => new Promise((resolve) => { release = () => resolve({ value: 1, billedMicros: 0 }); }));
    await new Promise((r) => setTimeout(r, 5));
    const second = vi.fn(async () => ({ value: 2, billedMicros: 0 }));
    await expect(run(lock, second)).rejects.toBeInstanceOf(TurnBusyError);
    expect(second).not.toHaveBeenCalled();
    release();
    await first;
    await expect(run(lock, async () => ({ value: 3, billedMicros: 0 }))).resolves.toBe(3);
  });

  it("releases the lock when the turn throws", async () => {
    const lock = createMemoryTurnLock();
    await expect(run(lock, async () => { throw new Error("x"); })).rejects.toThrow("x");
    await expect(run(lock, async () => ({ value: 4, billedMicros: 0 }))).resolves.toBe(4);
  });

  it("lets an expired lock be taken again, and ignores a release with the wrong token", async () => {
    let t = 1_000;
    const lock = createMemoryTurnLock(() => t);
    const token = await lock.acquire("k", 1_000);
    expect(token).toBeTruthy();
    expect(await lock.acquire("k", 1_000)).toBeNull();
    await lock.release("k", "not-the-token");
    expect(await lock.acquire("k", 1_000)).toBeNull();
    t += 1_500;
    expect(await lock.acquire("k", 1_000)).toBeTruthy();
  });
});
