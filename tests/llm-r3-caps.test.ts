import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { callerKey, normalizeIp, learningRateLimiter } from "@/lib/api/rate-limit";
import {
  DAILY_COST_CAPS_MICROS,
  costCapMicrosFor,
  createBudgetGuard,
  type UsageStore,
} from "@/lib/llm/budget";
import { runLlm } from "@/lib/llm/llm-client";
import { UNMETERED, type LlmTask } from "@/lib/llm/types";

const mockResolveCanonicalName = vi.fn();
const mockExtractPlaceNames = vi.fn();
const mockExtractPrefs = vi.fn();
const mockExtractFacts = vi.fn();

vi.mock("@/lib/api/gemini-client", () => ({
  extractPlaceNames: (...a: unknown[]) => mockExtractPlaceNames(...a),
  resolveCanonicalName: (...a: unknown[]) => mockResolveCanonicalName(...a),
  extractCategoryPreferences: (...a: unknown[]) => mockExtractPrefs(...a),
  extractStandingFacts: (...a: unknown[]) => mockExtractFacts(...a),
}));
vi.mock("@/lib/attractions/overpass-client", () => ({ fetchAttractions: async () => [] }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) } }),
}));
vi.mock("@/lib/api/nominatim-client", () => ({ searchPlaces: async () => [] }));

import { POST as extractPlaces, MAX_CANONICAL_LOOKUPS_PER_REQUEST } from "@/app/api/extract-places/route";
import { POST as sessionSummary } from "@/app/api/session-summary/route";
import { learnPreferencesFromText } from "@/lib/preferences/preference-store";

function fakeStore() {
  const rows = new Map<string, { calls: number; cost: number }>();
  const store: UsageStore = {
    async bump(key, day, calls, cost) {
      for (const k of [`${key}|${day}`, `*global*|${day}`]) {
        const r = rows.get(k) ?? { calls: 0, cost: 0 };
        r.calls += calls;
        r.cost += cost;
        rows.set(k, r);
      }
      const u = rows.get(`${key}|${day}`)!;
      return { callerCalls: u.calls, callerCostMicros: u.cost, globalCostMicros: rows.get(`*global*|${day}`)!.cost };
    },
  };
  return store;
}

const anon = { userId: null, ip: "9.9.9.9" };
const free = { userId: "u1", ip: "9.9.9.9" };

describe("R3 per-caller dollar cap", () => {
  it("refuses an anonymous caller once settled cost reaches the cap, well before the call cap", async () => {
    const g = createBudgetGuard(fakeStore(), { dailyBudgetUsd: 1000 });
    await g.reserve(anon);
    await g.settle(anon, DAILY_COST_CAPS_MICROS.anonymous - 1);
    await expect(g.reserve(anon)).resolves.toBeUndefined();
    await g.settle(anon, 1);
    await expect(g.reserve(anon)).rejects.toMatchObject({ reason: "user" });
  });

  it("is per class and per caller", async () => {
    const g = createBudgetGuard(fakeStore(), { dailyBudgetUsd: 1000 });
    await g.reserve(free);
    await g.settle(free, DAILY_COST_CAPS_MICROS.anonymous + 1);
    await expect(g.reserve(free)).resolves.toBeUndefined(); // free cap is higher
    await expect(g.reserve({ userId: null, ip: "8.8.8.8" })).resolves.toBeUndefined(); // other caller untouched
    await g.settle(free, DAILY_COST_CAPS_MICROS.free);
    await expect(g.reserve(free)).rejects.toMatchObject({ reason: "user" });
    const paid = { userId: "p1", ip: "1.1.1.1", plan: "paid" as const };
    await g.reserve(paid);
    await g.settle(paid, DAILY_COST_CAPS_MICROS.free + 1);
    await expect(g.reserve(paid)).resolves.toBeUndefined();
  });

  it("is overridable per class through env", () => {
    expect(costCapMicrosFor(anon, { LLM_CAP_USD_ANONYMOUS: "0.2" })).toBe(200_000);
    expect(costCapMicrosFor(anon, { LLM_CAP_USD_ANONYMOUS: "junk" })).toBe(DAILY_COST_CAPS_MICROS.anonymous);
    expect(costCapMicrosFor(free, {})).toBe(DAILY_COST_CAPS_MICROS.free);
  });

  it("fails closed with no store or a failing store in production mode", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(createBudgetGuard(null, { failClosed: true }).reserve(anon)).rejects.toMatchObject({ reason: "global" });
    const down: UsageStore = { bump: async () => { throw new Error("down"); } };
    await expect(createBudgetGuard(down, { failClosed: true }).reserve(anon)).rejects.toMatchObject({ reason: "global" });
  });

  it("defaults to fail-closed when NODE_ENV is production (missing SUPABASE_SERVICE_ROLE_KEY)", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("LLM_BUDGET_FAIL_OPEN", "");
    try {
      await expect(createBudgetGuard(null).reserve(anon)).rejects.toBeInstanceOf(Error);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe("R3 runLlm requires a caller context", () => {
  const task: LlmTask<string> = {
    name: "eval",
    system: "s",
    user: "u",
    schema: { } as never,
    parse: (t) => t,
    maxOutputTokens: 10,
    tier: 1,
  };
  it("throws when ctx is missing, before any provider is contacted", async () => {
    const provider = vi.fn();
    await expect(
      runLlm(task, undefined as never, { providers: { gemini: provider } }),
    ).rejects.toThrow(/caller context/);
    expect(provider).not.toHaveBeenCalled();
  });
  it("UNMETERED is the explicit opt-out", () => {
    expect(typeof UNMETERED).toBe("symbol");
  });
  it("no production signature leaves ctx optional", () => {
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const f of readdirSync(dir)) {
        const full = path.join(dir, f);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.tsx?$/.test(f) && /ctx\?: LlmCallContext/.test(readFileSync(full, "utf8"))) hits.push(full);
      }
    };
    walk(path.join(process.cwd(), "src"));
    expect(hits).toEqual([]);
  });
});

describe("R3 every spending call site carries the caller context", () => {
  beforeEach(() => {
    mockExtractPrefs.mockReset().mockResolvedValue([]);
    mockExtractFacts.mockReset().mockResolvedValue([]);
  });

  it("learnPreferencesFromText forwards ctx to the model call", async () => {
    const ctx = { userId: "u1", ip: "2.2.2.2" };
    await learnPreferencesFromText({} as never, "u1", "I love museums", ctx).catch(() => null);
    expect(mockExtractPrefs).toHaveBeenCalledWith("I love museums", ctx);
  });
});

describe("R3 extract-places fan-out", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockExtractPlaceNames.mockReset().mockResolvedValue({
      places: ["a", "b", "c", "d", "e", "f"],
      contextLocation: null,
      durationMinutes: null,
      categoryNeeds: [],
    });
    mockResolveCanonicalName.mockReset().mockResolvedValue(null);
  });
  afterEach(() => vi.useRealTimers());

  it("spends at most MAX_CANONICAL_LOOKUPS_PER_REQUEST canonical-name calls, each with the caller ctx", async () => {
    const pending = extractPlaces(
      new Request("http://localhost/api/extract-places", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": "5.5.5.5" },
        body: JSON.stringify({ prompt: "a b c d e f" }),
      }),
    );
    await vi.runAllTimersAsync();
    await pending;
    expect(MAX_CANONICAL_LOOKUPS_PER_REQUEST).toBe(3);
    expect(mockResolveCanonicalName).toHaveBeenCalledTimes(3);
    for (const call of mockResolveCanonicalName.mock.calls) {
      expect(call[2]).toEqual({ userId: null, ip: "5.5.5.5" });
    }
  });
});

describe("R3 rate limits on every LLM route", () => {
  it("session-summary is rate limited (429 after the per-minute allowance)", async () => {
    const make = () =>
      new Request("http://localhost/api/session-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": "4.4.4.4" },
        body: JSON.stringify({ learnPreferences: false }),
      });
    for (let i = 0; i < 10; i++) expect((await sessionSummary(make())).status).toBe(200);
    expect((await sessionSummary(make())).status).toBe(429);
  });
  it("walk-feedback and session-summary share one bucket", () => {
    for (let i = 0; i < 10; i++) learningRateLimiter.check("k");
    expect(learningRateLimiter.check("k").allowed).toBe(false);
  });
});

describe("R3 callerKey cannot be rotated", () => {
  const req = (h: Record<string, string>) => new Request("http://x/", { headers: h });
  afterEach(() => vi.unstubAllEnvs());

  it("trusts forwarded headers outside production", () => {
    expect(callerKey(req({ "x-forwarded-for": "1.2.3.4" }))).toBe("1.2.3.4");
  });
  it("ignores them in production unless on Vercel or explicitly trusted", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("TRUST_PROXY_HEADERS", "");
    expect(callerKey(req({ "x-forwarded-for": "1.2.3.4" }))).toBe("unidentified");
    vi.stubEnv("VERCEL", "1");
    expect(callerKey(req({ "x-forwarded-for": "1.2.3.4" }))).toBe("1.2.3.4");
  });
  it("collapses an IPv6 /64 into one caller", () => {
    expect(normalizeIp("2001:db8:1:2:aaaa:bbbb:cccc:dddd")).toBe(normalizeIp("2001:DB8:1:2::1"));
    expect(normalizeIp("2001:db8:1:3::1")).not.toBe(normalizeIp("2001:db8:1:2::1"));
    expect(normalizeIp("1.2.3.4")).toBe("1.2.3.4");
  });
});
