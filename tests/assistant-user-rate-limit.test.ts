import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/api/ors-client", () => ({ getMatrix: vi.fn(), getDirections: vi.fn() }));
vi.mock("@/lib/api/google-places-client", () => ({
  googlePlacesAvailable: () => false,
  searchTextPlaces: vi.fn(async () => []),
  searchNearbyPlaces: vi.fn(async () => []),
}));

let current: { id: string } | null = { id: "u1" };
const from = vi.fn(() => {
  throw new Error("chat store reached");
});
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: current } }) }, from }),
}));

import { POST } from "@/app/api/assistant/route";
import { assistantRateLimiter, assistantUserRateLimiter } from "@/lib/api/rate-limit";

const IP = "198.51.100.9";
const post = () =>
  new Request("http://localhost/api/assistant", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": IP },
    body: JSON.stringify({ message: "hi" }),
  });

describe("POST /api/assistant per-user rate limit", () => {
  beforeEach(() => {
    from.mockClear();
    current = { id: "u1" };
  });

  it("refuses a user past the per-minute limit before touching the chat store", async () => {
    for (let i = 0; i < 8; i++) expect(assistantUserRateLimiter.check("user:u1").allowed).toBe(true);
    const res = await POST(post());
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
    expect(from).not.toHaveBeenCalled();
    // The per-ip limiter only saw this one request: it was the user limiter that refused.
    expect(assistantRateLimiter.check(IP).allowed).toBe(true);
  });

  it("does not affect another walker", async () => {
    for (let i = 0; i < 8; i++) assistantUserRateLimiter.check("user:u1");
    current = { id: "u2" };
    const res = await POST(post()).catch(() => null);
    expect(res?.status).not.toBe(429);
    expect(from).toHaveBeenCalled();
  });
});
