import { afterEach, describe, expect, it, vi } from "vitest";

import { appUserAgent } from "@/lib/api/http-identity";
import { GET } from "@/app/api/conditions/route";

let ipCounter = 0;
const req = (qs: string) =>
  new Request(`http://localhost/api/conditions?${qs}`, {
    headers: { "x-forwarded-for": `203.0.113.${(ipCounter += 1)}` },
  });

const upstream = {
  current: { apparent_temperature: 35.4 },
  hourly: { precipitation_probability: [5, 20] },
};

afterEach(() => vi.unstubAllGlobals());

describe("GET /api/conditions", () => {
  it("400 on missing, non-numeric or out-of-range coordinates", async () => {
    for (const qs of ["", "lat=32", "lat=abc&lng=34", "lat=91&lng=34", "lat=32&lng=181", "lat=&lng="]) {
      expect((await GET(req(qs))).status).toBe(400);
    }
  });

  it("returns parsed conditions with attribution; sends the cell centre, not the exact position", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(upstream)));
    vi.stubGlobal("fetch", fetchMock);
    const res = await GET(req("lat=33.0449&lng=35.1234"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ apparentTempC: 35.4, precipProbabilityPct: 20 });
    expect(body.attribution).toContain("Open-Meteo");
    const url = String((fetchMock.mock.calls[0] as unknown[])[0]);
    expect(url).toContain("latitude=33");
    expect(url).toContain("longitude=35.1");
    expect(url).not.toContain("33.0449");
  });

  it("identifies itself with appUserAgent(), not a hardcoded contact", async () => {
    const fetchMock = vi.fn(async (..._a: unknown[]) => new Response(JSON.stringify(upstream)));
    vi.stubGlobal("fetch", fetchMock);
    await GET(req("lat=28.1&lng=34.7"));
    const init = fetchMock.mock.calls[0][1] as { headers: Record<string, string> };
    expect(init.headers["User-Agent"]).toBe(appUserAgent());
    expect(init.headers["User-Agent"]).not.toContain("@");
  });

  it("serves the same 0.1 degree cell from cache", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(upstream)));
    vi.stubGlobal("fetch", fetchMock);
    await GET(req("lat=31.5101&lng=34.9"));
    const second = await GET(req("lat=31.5499&lng=34.9"));
    expect(second.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("502 when the upstream fails or throws", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 500 })));
    expect((await GET(req("lat=30.1&lng=34.1"))).status).toBe(502);
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("down"); }));
    expect((await GET(req("lat=30.2&lng=34.2"))).status).toBe(502);
  });

  it("rate limits a hammering caller", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(upstream))));
    const headers = { "x-forwarded-for": "198.51.100.77" };
    let limited = 0;
    for (let i = 0; i < 12; i += 1) {
      const r = await GET(new Request("http://localhost/api/conditions?lat=29.6&lng=34.9", { headers }));
      if (r.status === 429) limited += 1;
    }
    expect(limited).toBeGreaterThan(0);
  });
});
