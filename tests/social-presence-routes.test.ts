import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const getUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser }, rpc }) }));

import { DELETE, PUT } from "@/app/api/social/presence/route";
import { GET } from "@/app/api/social/walking-now/route";

const put = (body: unknown, headers: Record<string, string> = {}) =>
  PUT(new Request("http://x/api/social/presence", { method: "PUT", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) }));

// Inside the allowed core area (Tel Aviv, away from deny zones) and one far outside it.
const TLV = { lat: 32.0668, lng: 34.7647 };
const PARIS = { lat: 48.8566, lng: 2.3522 };
const U = "123e4567-e89b-12d3-a456-426614174000";

beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue({ data: true, error: null });
  getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
  vi.stubEnv("NEXT_PUBLIC_SOCIAL_PRESENCE", "1");
});
afterEach(() => vi.unstubAllEnvs());

describe("/api/social/presence", () => {
  it("is a 404 with the flag off, and touches nothing", async () => {
    vi.stubEnv("NEXT_PUBLIC_SOCIAL_PRESENCE", "");
    expect((await put({ ...TLV })).status).toBe(404);
    expect((await DELETE()).status).toBe(404);
    expect(rpc).not.toHaveBeenCalled();
    expect(getUser).not.toHaveBeenCalled();
  });

  it("needs a signed-in walker and a valid body", async () => {
    getUser.mockResolvedValueOnce({ data: { user: null } });
    expect((await put(TLV)).status).toBe(401);
    expect((await put({ lat: "x" })).status).toBe(400);
    expect((await put({ lat: 99, lng: 0 })).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("outside the allowed zones: nothing is shared and any old row is cleared", async () => {
    const res = await put(PARIS);
    expect(await res.json()).toEqual({ shared: false });
    expect(rpc).toHaveBeenCalledWith("clear_my_presence");
    expect(rpc.mock.calls.some((c) => c[0] === "set_my_presence")).toBe(false);
  });

  it("inside: sends only the 1 km cell (never the position) and the city from the IP header", async () => {
    const res = await put({ ...TLV, newWalk: true }, { "x-vercel-ip-city": "Tel%20Aviv" });
    expect(await res.json()).toEqual({ shared: true, available: true });
    const call = rpc.mock.calls.find((c) => c[0] === "set_my_presence")!;
    expect(call[1]).toEqual({ p_cell_y: Math.floor(TLV.lat * 100), p_cell_x: Math.floor(TLV.lng * 100), p_area: "Tel Aviv", p_new_walk: true });
    expect(JSON.stringify(call)).not.toContain(String(TLV.lat));
  });

  it("never logs the position", async () => {
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => {}));
    await put(TLV);
    await put(PARIS);
    for (const s of spies) {
      expect(JSON.stringify(s.mock.calls)).not.toMatch(/32\.06|34\.76|48\.85/);
      s.mockRestore();
    }
  });

  it("a missing function (migration not applied) means not shared, no crash", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: "PGRST202" } });
    expect(await (await put(TLV)).json()).toEqual({ shared: false, available: false });
  });

  it("DELETE clears", async () => {
    expect((await DELETE()).status).toBe(204);
    expect(rpc).toHaveBeenCalledWith("clear_my_presence");
  });

  it("is rate limited to 6 writes a minute", async () => {
    for (let i = 0; i < 6; i++) expect((await put(TLV)).status).toBe(200);
    expect((await put(TLV)).status).toBe(429);
  });
});

describe("/api/social/walking-now", () => {
  it("is a 404 with the flag off", async () => {
    vi.stubEnv("NEXT_PUBLIC_SOCIAL_PRESENCE", "");
    expect((await GET()).status).toBe(404);
  });

  it("returns bucket keys only, cleaned", async () => {
    rpc.mockResolvedValueOnce({ data: [{ token: U, friend_id: U, display_name: "Dana", avatar: "boot", relation: "friend", area_label: "Jaffa", since_bucket: "about_30", distance_bucket: "near", profile_visible: true, lat: 1, lng: 2 }], error: null });
    const body = await (await GET()).json();
    expect(body.available).toBe(true);
    expect(body.rows).toEqual([{ token: U, friendId: U, displayName: "Dana", avatar: "boot", relation: "friend", areaLabel: "Jaffa", since: "about_30", distance: "near", profileVisible: true }]);
  });

  it("migration missing: available false, empty", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: "PGRST202" } });
    expect(await (await GET()).json()).toEqual({ available: false, rows: [] });
  });
});
