import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parseBbox, parseRecommendation } from "@/lib/social/recommendations";

const rpc = vi.fn();
const getUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser }, rpc }) }));

import { GET } from "@/app/api/places/recommended/route";

const url = (q: string) => new Request(`http://x/api/places/recommended?${q}`);
const BOX = "south=32.4&west=34.8&north=32.5&east=34.9";

beforeEach(() => {
  rpc.mockReset();
  getUser.mockReset();
  getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
});
afterEach(() => vi.unstubAllEnvs());

describe("parseBbox", () => {
  it("accepts a small box and rejects wide, inverted or non-numeric ones", () => {
    expect(parseBbox(new URLSearchParams(BOX))).toEqual({ south: 32.4, west: 34.8, north: 32.5, east: 34.9 });
    expect(parseBbox(new URLSearchParams("south=30&west=34&north=33&east=35"))).toBeNull();
    expect(parseBbox(new URLSearchParams("south=32.5&west=34.8&north=32.4&east=34.9"))).toBeNull();
    expect(parseBbox(new URLSearchParams("south=a&west=34.8&north=32.4&east=34.9"))).toBeNull();
    expect(parseBbox(new URLSearchParams("west=34.8&north=32.4&east=34.9"))).toBeNull();
  });
});

describe("parseRecommendation with a position", () => {
  it("keeps a valid position and name, drops an impossible one", () => {
    const ok = parseRecommendation({ poiKey: "osm-node-1", category: "food", tags: [], lat: 32.123456, lng: 34.8, name: " Cafe " });
    expect(ok).toMatchObject({ lat: 32.12346, lng: 34.8, name: "Cafe" });
    const bad = parseRecommendation({ poiKey: "osm-node-1", category: "food", tags: [], lat: 120, lng: 34.8 });
    expect(bad?.lat).toBeUndefined();
  });
});

describe("GET /api/places/recommended", () => {
  it("is 404 with the flag off", async () => {
    expect((await GET(url(BOX))).status).toBe(404);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("rejects a bad box, a signed-out walker, and maps rows when allowed", async () => {
    vi.stubEnv("NEXT_PUBLIC_SOCIAL", "1");
    expect((await GET(url("south=1"))).status).toBe(400);
    getUser.mockResolvedValueOnce({ data: { user: null } });
    expect((await GET(url(BOX))).status).toBe(401);
    rpc.mockResolvedValue({ data: [{ poi_key: "osm-node-1", name: "Cafe", category: "food", lat: 32.45, lng: 34.85, supporters_bucket: "5+", tags: ["view"] }], error: null });
    const res = await GET(url(BOX));
    expect(rpc).toHaveBeenCalledWith("recommended_places_in_bbox", { p_south: 32.4, p_west: 34.8, p_north: 32.5, p_east: 34.9 });
    expect((await res.json()).places).toEqual([{ poiKey: "osm-node-1", name: "Cafe", category: "food", lat: 32.45, lng: 34.85, supporters: "5+", tags: ["view"] }]);
  });
});
