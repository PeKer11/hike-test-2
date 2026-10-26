import { describe, expect, it } from "vitest";

import { parseItinerary } from "@/lib/api/transit-client";
import { withTransitBack } from "@/lib/assistant/transit";
import type { Verdict } from "@/lib/walk/rule-verdict";

const verdict = (): Verdict => ({ ok: true, broken: false, rules: [], walkKm: 3, walkMin: 40, visitMin: 20, totalMin: 60 });
const a = { lat: 32.08, lng: 34.78 };
const b = { lat: 32.06, lng: 34.76 };
const startAt = Date.now() + 3600000;

describe("parseItinerary", () => {
  it("reads times, lines and transfers, skipping walking legs", () => {
    const leg = parseItinerary({ itineraries: [{ startTime: "2026-10-27T08:01:00Z", endTime: "2026-10-27T08:23:00Z", transfers: 1, legs: [{ mode: "WALK" }, { mode: "BUS", routeShortName: "125" }, { mode: "BUS", routeShortName: "82" }] }] });
    expect(leg).toEqual({ departMs: Date.parse("2026-10-27T08:01:00Z"), arriveMs: Date.parse("2026-10-27T08:23:00Z"), lines: ["125", "82"], transfers: 1 });
  });
  it("returns null with no itinerary or bad times", () => {
    expect(parseItinerary({ itineraries: [] })).toBeNull();
    expect(parseItinerary(null)).toBeNull();
    expect(parseItinerary({ itineraries: [{ startTime: "x", endTime: "y" }] })).toBeNull();
  });
});

describe("withTransitBack", () => {
  it("does nothing unless a ride back was asked for", async () => {
    const v = verdict();
    expect(await withTransitBack(v, a, b, {})).toBe(v);
  });
  it("is not_checked without a start time", async () => {
    const v = await withTransitBack(verdict(), a, b, { transit: { back: true } }, async () => null);
    expect(v.rules[0]).toMatchObject({ rule: "transit", status: "not_checked", dataGap: true });
    expect(v.ok).toBe(false);
  });
  it("keeps ok when the ride is found, breaks the verdict when there is none", async () => {
    const ride = async (_f: unknown, _t: unknown, d: number) => ({ departMs: d, arriveMs: d + 600000, lines: ["1"], transfers: 0 });
    expect((await withTransitBack(verdict(), a, b, { startAt, transit: { back: true } }, ride)).ok).toBe(true);
    expect((await withTransitBack(verdict(), a, b, { startAt, transit: { back: true } }, async () => null)).broken).toBe(true);
  });
  it("met with the extra minutes when there is a ride", async () => {
    const v = await withTransitBack(verdict(), a, b, { startAt, transit: { back: true } }, async (_f, _t, depart) => ({ departMs: depart + 5 * 60000, arriveMs: depart + 25 * 60000, lines: ["125"], transfers: 0 }));
    expect(v.rules[0]).toMatchObject({ rule: "transit", status: "met", value: 25 });
    expect(v.transitMin).toBe(25);
    expect(v.rules[0].detail).toMatch(/Transitous/);
  });
  it("not_met with no service, not_checked when the service fails", async () => {
    expect((await withTransitBack(verdict(), a, b, { startAt, transit: { back: true } }, async () => null)).rules[0].status).toBe("not_met");
    expect((await withTransitBack(verdict(), a, b, { startAt, transit: { back: true } }, async () => { throw new Error("down"); })).rules[0].status).toBe("not_checked");
  });
});
