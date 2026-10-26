import { describe, expect, it } from "vitest";
import { parseGoogleRoute } from "@/lib/api/transit-client";

const step = (dep: string, arr: string, line: string) => ({ transitDetails: { stopDetails: { departureTime: dep, arrivalTime: arr }, transitLine: { nameShort: line } } });

describe("parseGoogleRoute", () => {
  it("takes first boarding to last alighting and counts transfers", () => {
    const leg = parseGoogleRoute({ routes: [{ legs: [{ steps: [{}, step("2026-10-27T07:10:00Z", "2026-10-27T07:30:00Z", "125"), {}, step("2026-10-27T07:35:00Z", "2026-10-27T07:50:00Z", "82")] }] }] });
    expect(leg).toMatchObject({ lines: ["125", "82"], transfers: 1 });
    expect(leg!.arriveMs - leg!.departMs).toBe(40 * 60000);
  });
  it("returns null with no transit step", () => {
    expect(parseGoogleRoute({ routes: [{ legs: [{ steps: [{}] }] }] })).toBeNull();
    expect(parseGoogleRoute({})).toBeNull();
  });
});

describe("planTransit daily cap", () => {
  it("stops calling Google once the cap is used", async () => {
    const { vi } = await import("vitest");
    const { planTransit } = await import("@/lib/api/transit-client");
    vi.stubEnv("TRANSIT_PROVIDER", "google");
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "k");
    vi.stubEnv("TRANSIT_DAILY_CAP", "2");
    const f = vi.fn().mockImplementation(async () => new Response(JSON.stringify({}), { status: 200 }));
    vi.stubGlobal("fetch", f);
    const p = { lat: 1, lng: 1 };
    await planTransit(p, p, 0);
    await planTransit(p, p, 0);
    await expect(planTransit(p, p, 0)).rejects.toThrow("cap");
    expect(f).toHaveBeenCalledTimes(2);
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
});
