import { afterEach, describe, expect, it, vi } from "vitest";

import { createCircuitBreaker, parseRetryAfterMs } from "@/lib/api/circuit-breaker";
import { searchPlaces } from "@/lib/api/nominatim-client";
import { runOverpassQuery } from "@/lib/attractions/overpass-client";
import { fetchWikiPlaces } from "@/lib/places/wiki-geosearch";
import { DEFAULT_TILE_URL, resolveTileUrl, tileImgSrc } from "@/lib/map/tile-config";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const res = (status: number, body: unknown = [], headers: Record<string, string> = {}) => ({
  ok: status < 400,
  status,
  statusText: "",
  headers: new Headers(headers),
  json: async () => body,
  text: async () => "",
});

describe("circuit breaker", () => {
  it("opens after 3 failures, closes after the cooldown, and success resets", () => {
    let now = 0;
    const b = createCircuitBreaker({ now: () => now });
    b.recordFailure("k");
    b.recordFailure("k");
    expect(b.isOpen("k")).toBe(false);
    b.recordFailure("k");
    expect(b.isOpen("k")).toBe(true);
    now = 10 * 60_000 + 1;
    expect(b.isOpen("k")).toBe(false);
    b.recordFailure("k");
    expect(b.isOpen("k")).toBe(false); // fresh probe counts from one
    b.recordSuccess("k");
    b.recordFailure("k");
    b.recordFailure("k");
    expect(b.isOpen("k")).toBe(false);
  });
  it("opens at once on Retry-After and parses both header forms", () => {
    const b = createCircuitBreaker({ now: () => 0 });
    b.recordFailure("k", 30_000);
    expect(b.isOpen("k")).toBe(true);
    expect(parseRetryAfterMs("12")).toBe(12_000);
    expect(parseRetryAfterMs("Thu, 01 Jan 1970 00:00:10 GMT", 0)).toBe(10_000);
    expect(parseRetryAfterMs(null)).toBeUndefined();
  });
});

describe("upstream identity and breakers", () => {
  it("nominatim sends a contact User-Agent, then skips after 3 server failures", async () => {
    vi.stubEnv("APP_CONTACT", "ops@example.test");
    const f = vi.fn(async () => res(503));
    vi.stubGlobal("fetch", f);
    for (let i = 0; i < 3; i++) await expect(searchPlaces("x")).rejects.toThrow(/503/);
    const ua = (f.mock.calls[0] as unknown as [string, RequestInit])[1].headers as Record<string, string>;
    expect(ua["User-Agent"]).toContain("ops@example.test");
    await expect(searchPlaces("x")).rejects.toThrow(/skipped/);
    expect(f).toHaveBeenCalledTimes(3);
  });

  it("nominatim honours Retry-After immediately", async () => {
    const f = vi.fn(async () => res(429, [], { "Retry-After": "60" }));
    vi.stubGlobal("fetch", f);
    await expect(searchPlaces("x")).rejects.toThrow();
    await expect(searchPlaces("x")).rejects.toThrow(/skipped/);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("overpass sends the contact UA and skips a mirror whose breaker is open", async () => {
    vi.stubEnv("APP_CONTACT", "ops@example.test");
    const f = vi.fn(async (url: string) =>
      url.startsWith("https://overpass-api.de") ? res(429, {}, { "Retry-After": "60" }) : res(200, { elements: [] }),
    );
    vi.stubGlobal("fetch", f as unknown as typeof fetch);
    await runOverpassQuery("q");
    const hostsFirst = f.mock.calls.map((c) => c[0]);
    expect(hostsFirst.filter((u) => String(u).includes("overpass-api.de"))).toHaveLength(1);
    f.mockClear();
    await runOverpassQuery("q");
    expect(f.mock.calls.some((c) => String(c[0]).includes("overpass-api.de"))).toBe(false);
    expect(String(f.mock.calls[0][0])).toContain("private.coffee");
    const headers = (f.mock.calls[0] as unknown as [string, RequestInit])[1].headers as Record<string, string>;
    expect(headers["User-Agent"]).toContain("ops@example.test");
  });

  it("wikipedia skips a host after 3 failures but still asks the other language", async () => {
    const f = vi.fn(async (url: string) => (url.includes("//he.") ? res(500) : res(200, {})));
    vi.stubGlobal("fetch", f as unknown as typeof fetch);
    const pts = Array.from({ length: 4 }, (_, i) => ({ lat: 32.08 + i * 0.01, lng: 34.78 }));
    await fetchWikiPlaces(pts);
    const he = f.mock.calls.filter((c) => String(c[0]).includes("//he.")).length;
    expect(he).toBe(3);
  });
});

describe("tile config", () => {
  it("defaults, validates and derives the CSP img-src host", () => {
    expect(resolveTileUrl(undefined)).toBe(DEFAULT_TILE_URL);
    expect(resolveTileUrl("http://insecure/{z}/{x}/{y}.png")).toBe(DEFAULT_TILE_URL);
    expect(resolveTileUrl("https://t/{z}/{x}")).toBe(DEFAULT_TILE_URL);
    expect(tileImgSrc(DEFAULT_TILE_URL)).toBe("https://tile.openstreetmap.org");
    expect(tileImgSrc("https://{s}.tiles.example.test/{z}/{x}/{y}.png")).toBe("https://*.tiles.example.test");
  });
});
