import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LlmBudgetExceededError } from "@/lib/llm/types";

import { fakeSupabase } from "./helpers/fake-supabase";

const runLlm = vi.fn();
vi.mock("@/lib/llm/llm-client", () => ({ runLlm: (...a: unknown[]) => runLlm(...a) }));
const consent = vi.fn();
vi.mock("@/lib/preferences/consent", () => ({ hasLearningConsent: (...a: unknown[]) => consent(...a) }));
const getUser = vi.fn();
let sb = fakeSupabase();
const upserts: unknown[] = [];
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
    from: (table: string) => {
      const real = (sb.client as unknown as { from: (t: string) => Record<string, unknown> }).from(table);
      return new Proxy(real, { get: (t, p) => (p === "upsert" ? (row: unknown) => { upserts.push(row); return Promise.resolve({ error: null }); } : (t as Record<string | symbol, unknown>)[p]) });
    },
  }),
}));

import { DELETE, GET, POST } from "@/app/api/social/taste/route";

const post = (body: unknown = { lang: "en" }) => POST(new Request("http://x/api/social/taste", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));
const W = (n: number) => Array.from({ length: n }, () => ({ area_label: "Jaffa", distance_m: 4000, total_min: 90, stops: [{ category: "park", name: "Gordon Park", source: "osm" }] }));
const good = { data: { schemaVersion: 1, bullets: ["Likes parks"], tags: ["parks"], areas: ["Jaffa"], injectionDetected: false }, model: "m" };
const recent = (days: number) => ({ summary: { bullets: ["old"], areas: [] }, tags: ["views"], based_on_walks: 5, created_at: new Date(Date.now() - days * 86400_000).toISOString() });

beforeEach(() => {
  runLlm.mockReset();
  runLlm.mockResolvedValue(good);
  consent.mockReset();
  consent.mockResolvedValue(true);
  getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
  upserts.length = 0;
  sb = fakeSupabase({ tables: { taste_summaries: { data: null }, saved_walks: { data: W(5), count: 0 } } });
  vi.stubEnv("NEXT_PUBLIC_TASTE_SUMMARY", "1");
});
afterEach(() => vi.unstubAllEnvs());

describe("/api/social/taste", () => {
  it("is a 404 with the flag off, and calls nothing", async () => {
    vi.stubEnv("NEXT_PUBLIC_TASTE_SUMMARY", "");
    expect((await post()).status).toBe(404);
    expect((await GET()).status).toBe(404);
    expect((await DELETE()).status).toBe(404);
    expect(runLlm).not.toHaveBeenCalled();
    expect(getUser).not.toHaveBeenCalled();
  });

  it("without learning consent: 403 and zero model calls", async () => {
    consent.mockResolvedValue(false);
    const res = await post();
    expect(res.status).toBe(403);
    expect(runLlm).not.toHaveBeenCalled();
  });

  it("signed out: 401, no model call", async () => {
    getUser.mockResolvedValueOnce({ data: { user: null } });
    expect((await post()).status).toBe(401);
    expect(runLlm).not.toHaveBeenCalled();
  });

  it("migration E missing: unavailable, and no model call is spent", async () => {
    sb = fakeSupabase({ tables: { taste_summaries: { error: { code: "PGRST205" } } } });
    expect(await (await post()).json()).toEqual({ available: false, summary: null });
    expect(runLlm).not.toHaveBeenCalled();
  });

  it("inside the 7-day window with fewer than 3 new walks: the cached summary, zero model calls", async () => {
    sb = fakeSupabase({ tables: { taste_summaries: { data: recent(2) }, saved_walks: { data: W(5), count: 2 } } });
    const body = await (await post()).json();
    expect(body.cooldown).toBe(true);
    expect(body.summary.bullets).toEqual(["old"]);
    expect(body.nextAvailableAt).toBeTruthy();
    expect(runLlm).not.toHaveBeenCalled();
  });

  it("after the window, or after 3 new walks, one call is made and the result is stored", async () => {
    sb = fakeSupabase({ tables: { taste_summaries: { data: recent(8) }, saved_walks: { data: W(5), count: 0 } } });
    let body = await (await post()).json();
    expect(runLlm).toHaveBeenCalledTimes(1);
    expect(body.summary).toMatchObject({ bullets: ["Likes parks"], tags: ["parks"] });
    expect(upserts).toHaveLength(1);
    expect(upserts[0]).toMatchObject({ user_id: "u1", tags: ["parks"], based_on_walks: 5, prompt_id: "taste@v1" });
    sb = fakeSupabase({ tables: { taste_summaries: { data: recent(1) }, saved_walks: { data: W(5), count: 3 } } });
    body = await (await post()).json();
    expect(runLlm).toHaveBeenCalledTimes(2);
  });

  it("goes through the budget guard with the caller's identity, never UNMETERED", async () => {
    await post();
    const ctx = runLlm.mock.calls[0][1] as { userId: string; plan: string };
    expect(ctx).toMatchObject({ userId: "u1", plan: "free" });
  });

  it("a spent budget: 429 'resting', nothing stored", async () => {
    runLlm.mockRejectedValue(new LlmBudgetExceededError("global"));
    const res = await post();
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe("resting");
    expect(upserts).toHaveLength(0);
  });

  it("too few finished walks: 409 and no model call", async () => {
    sb = fakeSupabase({ tables: { taste_summaries: { data: null }, saved_walks: { data: W(2) } } });
    expect((await post()).status).toBe(409);
    expect(runLlm).not.toHaveBeenCalled();
  });

  it("an injection flagged by the model stores nothing", async () => {
    runLlm.mockResolvedValue({ data: { schemaVersion: 1, bullets: [], tags: [], areas: [], injectionDetected: true }, model: "m" });
    const body = await (await post()).json();
    expect(body.empty).toBe(true);
    expect(upserts).toHaveLength(0);
  });

  it("the prompt sent never holds a Google place name", async () => {
    sb = fakeSupabase({ tables: { taste_summaries: { data: null }, saved_walks: { data: [{ area_label: "Jaffa", distance_m: 1, total_min: 1, stops: [{ category: "food", name: "Leaky Google Cafe", source: "google", placeId: "ChIJabcdefghij12345" }] }, ...W(2)] } } });
    await post();
    const task = runLlm.mock.calls[0][0] as { system: string; user: string; untrusted: { text: string }[] };
    expect(JSON.stringify(task)).not.toContain("Leaky Google Cafe");
    expect(JSON.stringify(task)).not.toContain("ChIJ");
  });

  it("GET returns the cache and never calls a model", async () => {
    sb = fakeSupabase({ tables: { taste_summaries: { data: recent(1) }, saved_walks: { count: 0 } } });
    const body = await (await GET()).json();
    expect(body.available).toBe(true);
    expect(body.summary.tags).toEqual(["views"]);
    expect(runLlm).not.toHaveBeenCalled();
  });
});
