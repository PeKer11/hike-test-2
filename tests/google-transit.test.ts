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
