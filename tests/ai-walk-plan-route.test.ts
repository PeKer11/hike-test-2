import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { getUser, runMeteredTurn, runAiBuild } = vi.hoisted(() => ({
  getUser: vi.fn(),
  runMeteredTurn: vi.fn(async (_ctx: unknown, _tier: unknown, fn: (c: unknown, e: unknown) => Promise<{ value: unknown }>) => (await fn({ model: "m" }, undefined)).value),
  runAiBuild: vi.fn(async (..._args: unknown[]) => ({ stops: [], ordered: true, summary: "", billedMicros: 1, params: {} })),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser } }) }));
vi.mock("@/lib/llm/llm-client", () => ({ runMeteredTurn }));
vi.mock("@/lib/ai-builder/run", () => ({ runAiBuild, AiBuildRefusedError: class extends Error {} }));
vi.mock("@/lib/api/places-quota", () => ({ createPlacesGate: () => ({ take: async () => true }), placesDailyCap: () => 80 }));

import { POST } from "@/app/api/ai-walk-plan/route";
import { aiBuildUserRateLimiter } from "@/lib/api/rate-limit";

const post = (body: unknown, headers: Record<string, string> = {}) =>
  POST(new Request("http://x/api/ai-walk-plan", { method: "POST", body: JSON.stringify(body), headers }));
const at = (id: string, name = id) => ({ id, name, coordinates: { lat: 1, lng: 1 }, category: "park", avgVisitMinutes: 20, tags: {} });

beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
});

describe("POST /api/ai-walk-plan", () => {
  it("keeps the step-free rules the walker set", async () => {
    await post({ origin: { lat: 32, lng: 34 }, routeRules: { access: "wheelchair", maxGradePct: 6 } });
    const req = (runAiBuild.mock.calls[0] as unknown as [{ params: Record<string, unknown> }])[0];
    expect(req.params.access).toBe("wheelchair");
    expect(req.params.maxGradePct).toBe(6);
  });

  it("drops an access value that is not a real one, and a silly grade", async () => {
    await post({ origin: { lat: 32, lng: 34 }, routeRules: { access: "jetpack", maxGradePct: 400 } });
    const req = (runAiBuild.mock.calls[0] as unknown as [{ params: Record<string, unknown> }])[0];
    expect(req.params.access).toBeUndefined();
    expect(req.params.maxGradePct).toBeUndefined();
  });

  it("refuses an oversized body with 413", async () => {
    const res = await post({ origin: { lat: 32, lng: 34 } }, { "content-length": "300000" });
    expect(res.status).toBe(413);
    expect(runAiBuild).not.toHaveBeenCalled();
  });

  it("filters out an overlong name, an out-of-range origin and unknown categories", async () => {
    await post({ origin: { lat: 32, lng: 34 }, keep: [at("a", "x".repeat(5_000)), at("b")], preferredCategories: ["food", "<script>"] });
    const req = (runAiBuild.mock.calls[0] as unknown as [{ keep: Array<{ id: string }>; preferredCategories: string[] }])[0];
    expect(req.keep.map((k) => k.id)).toEqual(["b"]);
    expect(req.preferredCategories).toEqual(["food"]);
    expect((await post({ origin: { lat: 999, lng: 34 } })).status).toBe(400);
  });

  it("reserves the build ceiling and takes the per-walker lock", async () => {
    await post({ origin: { lat: 32, lng: 34 } });
    const guard = (runMeteredTurn.mock.calls[0] as unknown[])[4] as { reserveMicros: number; lockKey: string };
    expect(guard.lockKey).toBe("ai-walk-plan:u1");
    expect(guard.reserveMicros).toBeGreaterThan(0);
  });

  it("limits one walker's builds per minute whatever the address", async () => {
    aiBuildUserRateLimiter.reset();
    let last = 200;
    for (let i = 0; i < 5; i += 1) last = (await post({ origin: { lat: 32, lng: 34 } }, { "x-forwarded-for": `9.9.9.${i}` })).status;
    expect(last).toBe(429);
  });
});
