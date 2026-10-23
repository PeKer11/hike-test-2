import { describe, expect, it } from "vitest";
import type { Coordinates } from "@/lib/types";
import { matchesStreet, streetCore, type ForbiddenWay } from "@/lib/walk/forbidden-ways";
import type { RouteDetail } from "@/lib/walk/ors-route";
import { evaluateRoute, limitRules, unavailableVerdict, type VerdictInput } from "@/lib/walk/rule-verdict";

const p = (lat: number, lng: number): Coordinates => ({ lat, lng });
const origin = p(32, 34);
const north = p(32.01, 34);
const outAndBack = [origin, north, origin];
const square = [origin, north, p(32.01, 34.012), p(32, 34.012), origin];
const ok = { ways: [] as ForbiddenWay[], failed: false };

const base = (over: Partial<VerdictInput>): VerdictInput => ({
  geometry: square,
  origin,
  params: {},
  forbidden: ok,
  boundary: null,
  paceMinPerKm: 12.5,
  visitMin: 0,
  ...over,
});
const rule = (v: ReturnType<typeof evaluateRoute>, id: string) => v.rules.find((r) => r.rule === id);
const way = (name: string, path: Coordinates[], reason: "named" | "dangerous"): ForbiddenWay => ({ name, names: [name], reason, path });
const detailOf = (named: RouteDetail["named"], stateRoads: RouteDetail["stateRoads"] = null): RouteDetail => ({ named, stateRoads });

describe("street names", () => {
  it("matches Hebrew spellings with and without the word for street and the leading ה", () => {
    expect(streetCore("רחוב הנביאים")).toBe("נביאים");
    expect(matchesStreet("הנביאים", "רחוב הנביאים")).toBe(true);
    expect(matchesStreet("HaNeviim Street", "haneviim st")).toBe(true);
    expect(matchesStreet("הרצל", "הנביאים")).toBe(false);
  });
});

describe("evaluateRoute", () => {
  it("no_repeat: an out-and-back is not met, a square loop is met", () => {
    const params = { noRepeat: true, endDistanceKm: 0 };
    const back = evaluateRoute(base({ geometry: outAndBack, params }));
    expect(rule(back, "no_repeat")?.status).toBe("not_met");
    expect(rule(back, "no_repeat")?.value).toBeGreaterThan(0.8);
    expect(back.ok).toBe(false);
    expect(evaluateRoute(base({ params })).ok).toBe(true);
  });

  it("avoid_streets: a named way along the route is not met, found by its Hebrew name", () => {
    const v = evaluateRoute(base({ params: { avoidStreets: ["רחוב הנביאים"] }, forbidden: { ways: [way("הנביאים", [origin, north], "named")], failed: false } }));
    expect(rule(v, "avoid_streets")?.status).toBe("not_met");
  });

  it("avoid_streets: with the map service down, router step names decide; no names means not_checked, never met", () => {
    const down = { ways: [], failed: true };
    const params = { avoidStreets: ["הנביאים"] };
    const named = evaluateRoute(base({ params, forbidden: down, detail: detailOf([{ name: "הנביאים", path: [origin, north] }]) }));
    expect(rule(named, "avoid_streets")?.status).toBe("not_met");
    const clean = evaluateRoute(base({ params, forbidden: down, detail: detailOf([{ name: "הרצל", path: [origin, north] }]) }));
    expect(rule(clean, "avoid_streets")?.status).not.toBe("not_met");
    const noNames = evaluateRoute(base({ params, forbidden: down, detail: detailOf([]) }));
    expect(rule(noNames, "avoid_streets")?.status).toBe("not_checked");
    expect(noNames.ok).toBe(false);
  });

  it("avoid_streets: a street found nowhere is not_checked, not met", () => {
    const v = evaluateRoute(base({ params: { avoidStreets: ["Foo St"] } }));
    expect(rule(v, "avoid_streets")?.status).toBe("not_checked");
  });

  it("avoid_dangerous: map data decides; without it only state roads are read, and without those it is not_checked", () => {
    const params = { avoidDangerous: true };
    const hit = evaluateRoute(base({ params, forbidden: { ways: [way("Highway 4", [origin, north], "dangerous")], failed: false } }));
    expect(rule(hit, "avoid_dangerous")?.status).toBe("not_met");
    const state = evaluateRoute(base({ params, forbidden: { ways: [], failed: true }, detail: detailOf([], [[origin, north]]) }));
    expect(rule(state, "avoid_dangerous")?.status).toBe("not_met");
    const quiet = evaluateRoute(base({ params, forbidden: { ways: [], failed: true }, detail: detailOf([], []) }));
    expect(rule(quiet, "avoid_dangerous")?.status).toBe("partial");
    expect(rule(evaluateRoute(base({ params, forbidden: { ways: [], failed: true } })), "avoid_dangerous")?.status).toBe("not_checked");
  });

  it("stay_in_area: no outline is not_checked; a stretch outside is not_met; an outside start is not counted", () => {
    const params = { stayInArea: "Town" };
    expect(rule(evaluateRoute(base({ params })), "stay_in_area")?.status).toBe("not_checked");
    const small: [number, number][] = [[33.999, 31.999], [34.0125, 31.999], [34.0125, 32.0105], [33.999, 32.0105], [33.999, 31.999]];
    const ring = small.map(([lng, lat]) => [lng, lat]);
    const tight = [ring.map(([lng, lat]) => [lng, Math.min(lat, 32.0105)])];
    expect(rule(evaluateRoute(base({ params, boundary: tight })), "stay_in_area")?.status).toBe("met");
    const away = [[[34.5, 32.5], [34.6, 32.5], [34.6, 32.6], [34.5, 32.6], [34.5, 32.5]]];
    expect(rule(evaluateRoute(base({ params, boundary: away })), "stay_in_area")?.status).toBe("not_met");
  });

  it("via_streets: met only when the route runs along the street", () => {
    const params = { viaStreets: ["הרצל"] };
    const along = evaluateRoute(base({ params, detail: detailOf([{ name: "הרצל", path: [origin, north] }]) }));
    expect(rule(along, "via_streets")?.status).toBe("met");
    const known = { ways: [{ name: "הרצל", names: ["הרצל", "Herzl"], reason: "named" as const, path: [p(32.02, 34.01), p(32.03, 34.01)] }], failed: false };
    const crossed = evaluateRoute(base({ params, viaWays: known, detail: detailOf([{ name: "אחר", path: [origin, north] }]) }));
    expect(rule(crossed, "via_streets")?.status).toBe("not_met");
    // The street is not on the map and the router names differ: a different spelling cannot be ruled out.
    expect(rule(evaluateRoute(base({ params, detail: detailOf([{ name: "אחר", path: [origin, north] }]) })), "via_streets")?.status).toBe("not_checked");
    // The router spells it in English; the map knows both spellings and the route runs along it.
    const english = evaluateRoute(base({ params, viaWays: { ways: [{ name: "הרצל", names: ["הרצל", "Herzl"], reason: "named", path: [origin, north] }], failed: false }, detail: detailOf([{ name: "Herzl", path: [origin, north] }]) }));
    expect(rule(english, "via_streets")?.status).toBe("met");
    expect(rule(evaluateRoute(base({ params, detail: detailOf([]) })), "via_streets")?.status).toBe("not_checked");
  });

  it("time and distance come from the real route", () => {
    const v = evaluateRoute(base({ params: { timeMinutes: 10, maxWalkKm: 1 }, visitMin: 30 }));
    expect(rule(v, "time")?.status).toBe("not_met");
    expect(rule(v, "max_walk")?.status).toBe("not_met");
  });
});

describe("unavailableVerdict", () => {
  it("never reports a rule as met", () => {
    const v = unavailableVerdict({ noRepeat: true, avoidStreets: ["x"], endDistanceKm: 0 }, "routing limit reached");
    expect(v.ok).toBe(false);
    expect(v.rules.every((r) => r.status === "not_checked")).toBe(true);
    expect(v.broken).toBe(false); // unchecked is not the same as "no route exists"
    expect(v.unavailable).toBe(true);
  });
});

describe("limitRules", () => {
  it("is partial, not met, when the numbers are only estimates", () => {
    const [time, walk] = limitRules({ timeMinutes: 60, maxWalkKm: 4 }, 3, 40, 10, true);
    expect(time.status).toBe("partial");
    expect(walk.status).toBe("partial");
  });
  it("is met on measured numbers within the limit", () => {
    expect(limitRules({ maxWalkKm: 4 }, 3.9, 40, 0).map((r) => r.status)).toEqual(["met"]);
  });
  it("is partial inside the 10% tolerance and not_met beyond it", () => {
    expect(limitRules({ maxWalkKm: 4 }, 4.3, 40, 0)[0].status).toBe("partial");
    expect(limitRules({ maxWalkKm: 4 }, 4.5, 40, 0)[0].status).toBe("not_met");
  });
});
