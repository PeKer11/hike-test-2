import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MEMORY_TABLES } from "@/app/api/forget-everything/route";

const rpc = vi.fn();
const getUser = vi.fn();
const upsert = vi.fn();
const del = vi.fn();
const createClient = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: (...a: unknown[]) => createClient(...a),
}));

import { POST } from "@/app/api/social/aggregates/route";
import { DELETE, GET, PUT } from "@/app/api/social/optin/route";

function req(body: unknown): Request {
  return new Request("http://x/api/social/aggregates", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  rpc.mockReset();
  getUser.mockReset();
  upsert.mockReset();
  del.mockReset();
  createClient.mockReset();
  getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
  upsert.mockResolvedValue({ error: null });
  del.mockReturnValue({ eq: () => Promise.resolve({ error: null }) });
  createClient.mockResolvedValue({
    auth: { getUser },
    rpc,
    from: () => ({ upsert, delete: del }),
  });
});
afterEach(() => vi.unstubAllEnvs());

describe("flag off (default)", () => {
  it("all social routes 404 and never touch supabase", async () => {
    vi.stubEnv("NEXT_PUBLIC_SOCIAL", "");
    expect((await POST(req({ poiKeys: ["osm-node-1"] }))).status).toBe(404);
    expect((await GET()).status).toBe(404);
    expect((await PUT()).status).toBe(404);
    expect((await DELETE()).status).toBe(404);
    expect(createClient).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });
  it("'0' is off too", async () => {
    vi.stubEnv("NEXT_PUBLIC_SOCIAL", "0");
    expect((await POST(req({ poiKeys: ["osm-node-1"] }))).status).toBe(404);
  });
});

describe("opt-in GET (flag on)", () => {
  beforeEach(() => vi.stubEnv("NEXT_PUBLIC_SOCIAL", "1"));
  const withRow = (data: unknown, error: unknown = null) =>
    createClient.mockResolvedValue({
      auth: { getUser },
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data, error }) }) }) }),
    });
  it("reports the server row, not anything the client says", async () => {
    withRow({ user_id: "u1" });
    expect(await (await GET()).json()).toEqual({ optedIn: true });
    withRow(null);
    expect(await (await GET()).json()).toEqual({ optedIn: false });
  });
  it("is unknown when signed out or on error", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect(await (await GET()).json()).toEqual({ optedIn: null });
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    withRow(null, { message: "x" });
    expect(await (await GET()).json()).toEqual({ optedIn: null });
  });
});

describe("aggregates route (flag on)", () => {
  beforeEach(() => vi.stubEnv("NEXT_PUBLIC_SOCIAL", "1"));

  it("400 on bad JSON", async () => {
    expect((await POST(req("{not json"))).status).toBe(400);
  });

  it("no valid keys => empty answer without any rpc", async () => {
    const res = await POST(req({ poiKeys: ["cafe@32.1,34.1", 5] }));
    expect(await res.json()).toEqual({ support: {}, similar: {} });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("signed out => empty, no rpc", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(req({ poiKeys: ["osm-node-1"] }));
    expect(await res.json()).toEqual({ support: {}, similar: {} });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("calls both functions with the cleaned keys and returns sanitised buckets only", async () => {
    rpc.mockImplementation((fn: string) =>
      Promise.resolve(
        fn === "community_place_support"
          ? { data: [{ poi_key: "osm-node-1", supporters_bucket: "10+", user_id: "leak" }, { poi_key: "osm-node-77", supporters_bucket: "5+" }], error: null }
          : { data: [{ poi_key: "osm-node-2", reason_categories: ["park", "viewpoint"] }], error: null },
      ),
    );
    const res = await POST(req({ poiKeys: ["osm-node-1", "osm-node-1", "osm-node-2", "bad"] }));
    expect(rpc).toHaveBeenCalledWith("community_place_support", { p_poi_keys: ["osm-node-1", "osm-node-2"] });
    expect(rpc).toHaveBeenCalledWith("similar_walkers_places", { p_poi_keys: ["osm-node-1", "osm-node-2"] });
    const body = await res.json();
    expect(body).toEqual({
      support: { "osm-node-1": "10+" },
      similar: { "osm-node-2": ["park", "viewpoint"] },
    });
    expect(JSON.stringify(body)).not.toContain("leak");
  });

  it("rate limits a signed-in walker's lookups (429 after 30 in a minute)", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    let last = 200;
    for (let i = 0; i < 31; i++) last = (await POST(req({ poiKeys: ["osm-node-1"] }))).status;
    expect(last).toBe(429);
    expect(rpc.mock.calls.length).toBe(60);
  });

  it("an rpc error or a throw gives the empty answer, never an error", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    expect(await (await POST(req({ poiKeys: ["osm-node-1"] }))).json()).toEqual({ support: {}, similar: {} });
    rpc.mockRejectedValue(new Error("down"));
    const res = await POST(req({ poiKeys: ["osm-node-1"] }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ support: {}, similar: {} });
  });

  it("one failing function does not hide the other", async () => {
    rpc.mockImplementation((fn: string) =>
      Promise.resolve(
        fn === "community_place_support"
          ? { data: null, error: { message: "x" } }
          : { data: [{ poi_key: "osm-node-1", reason_categories: ["nature"] }], error: null },
      ),
    );
    expect(await (await POST(req({ poiKeys: ["osm-node-1"] }))).json()).toEqual({
      support: {},
      similar: { "osm-node-1": ["nature"] },
    });
  });
});

describe("opt-in route (flag on)", () => {
  beforeEach(() => vi.stubEnv("NEXT_PUBLIC_SOCIAL", "1"));

  it("PUT inserts the caller's own row, keeping an existing opt-in time", async () => {
    const res = await PUT();
    expect(await res.json()).toEqual({ saved: true });
    expect(upsert).toHaveBeenCalledWith(
      { user_id: "u1" },
      { onConflict: "user_id", ignoreDuplicates: true },
    );
  });

  it("PUT signed out saves nothing", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect(await (await PUT()).json()).toEqual({ saved: false });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("DELETE removes only the caller's row", async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    del.mockReturnValue({ eq });
    expect((await DELETE()).status).toBe(204);
    expect(eq).toHaveBeenCalledWith("user_id", "u1");
  });

  it("DELETE failure is a 500", async () => {
    del.mockReturnValue({ eq: () => Promise.resolve({ error: { message: "x" } }) });
    expect((await DELETE()).status).toBe(500);
  });
});

describe("forget everything", () => {
  it("also clears the social opt-in", () => {
    expect(MEMORY_TABLES).toContain("community_optin");
  });
});

describe("social migration timestamps", () => {
  it("forces now() on insert for the opt-in time and the vote's updated_at", async () => {
    const { readFileSync } = await import("node:fs");
    const sql = readFileSync("supabase/migrations/20261012110000_social_aggregates.sql", "utf8");
    expect(sql).toMatch(/new\.opted_in_at = now\(\)/);
    expect(sql).toMatch(/new\.updated_at = now\(\)/);
    expect(sql).toMatch(/before insert on public\.community_optin/);
    expect(sql).toMatch(/before insert on public\.attraction_feedback/);
  });
});
