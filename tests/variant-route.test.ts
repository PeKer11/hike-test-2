import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const user = { id: "u1" };
let signedIn = true;
const supabase = { auth: { getUser: async () => ({ data: { user: signedIn ? user : null } }) } };
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => supabase }));
vi.mock("@/lib/api/rate-limit", () => ({
  callerKey: () => "k",
  walkPlanRateLimiter: { check: () => ({ allowed: true }) },
  rateLimitedResponse: () => new Response("slow down", { status: 429 }),
}));

const ID = "11111111-1111-1111-1111-111111111111";
const parent = {
  id: ID, title: "Market", status: "completed", areaLabel: null, start: { lat: 32, lng: 34.8 }, totalMin: 90, distanceM: 3000,
  stops: [{ name: "A", category: "food", lat: 32.01, lng: 34.8 }, { name: "B", category: "food", lat: 32.02, lng: 34.8 }],
  params: {}, visibility: "private", createdAt: "", completedAt: null, end: { lat: 32.03, lng: 34.8 }, isLoop: false,
};
let found: typeof parent | null = parent;
const insertWalk = vi.fn(async () => "new-id");
vi.mock("@/lib/walks/saved-walks", () => ({ getWalkById: async () => found, insertWalk: (...a: unknown[]) => insertWalk(...(a as [])) }));
vi.mock("@/lib/walks/variant-route", () => ({
  orsRouteFn: async (wps: { lat: number; lng: number }[]) => ({ geometry: [...wps, { lat: wps[0].lat + 0.001, lng: wps[0].lng }], distanceM: 3100, ascentM: 12 }),
}));

import { POST } from "@/app/api/walks/variant/route";

const call = (body: unknown) => POST(new Request("http://x/api/walks/variant", { method: "POST", body: JSON.stringify(body) }));

beforeEach(() => {
  signedIn = true;
  found = parent;
  insertWalk.mockClear();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://supabase.test";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "k";
});

describe("POST /api/walks/variant", () => {
  it("needs a signed-in walker", async () => {
    signedIn = false;
    expect((await call({ walkId: ID, kind: "reverse" })).status).toBe(401);
    expect(insertWalk).not.toHaveBeenCalled();
  });

  it("refuses AI kinds, bad ids and bad details", async () => {
    expect((await call({ walkId: ID, kind: "longer" })).status).toBe(400);
    expect((await call({ walkId: "../x", kind: "reverse" })).status).toBe(400);
    expect((await call({ walkId: ID, kind: "shorter", minutes: 2 })).status).toBe(400);
    expect((await call({ walkId: ID, kind: "start_here", at: { lat: 999, lng: 0 } })).status).toBe(400);
  });

  it("404s a walk the caller cannot read (row-level security returns nothing)", async () => {
    found = null;
    expect((await call({ walkId: ID, kind: "reverse" })).status).toBe(404);
  });

  it("saves a reversed walk as a NEW row that points at the parent, and returns it", async () => {
    const res = await call({ walkId: ID, kind: "reverse" });
    expect(res.status).toBe(200);
    expect(insertWalk).toHaveBeenCalledTimes(1);
    const saved = (insertWalk.mock.calls[0] as unknown as [unknown, string, Record<string, unknown>])[2];
    expect(saved).toMatchObject({ parentWalkId: ID, variantKind: "reverse", title: "Market · reversed", status: "planned" });
    expect(saved).not.toHaveProperty("ascentM");
    const body = await res.json();
    expect(body).toMatchObject({ id: "new-id", ascentM: 12, kind: "reverse" });
    expect(body.walk.parentWalkId).toBe(ID);
    expect(typeof body.walk.geometryEncoded).toBe("string");
    expect(parent.title).toBe("Market"); // the original object is untouched
  });

  it("a refused shorter (cannot be reached by dropping stops) says so", async () => {
    const res = await call({ walkId: ID, kind: "shorter", minutes: 10 });
    expect(res.status).toBe(422);
    expect((await res.json()).needsAi).toBe(true);
  });
});
