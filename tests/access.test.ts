import { beforeEach, describe, expect, it, vi } from "vitest";

import { accessRules, stopAccessRules } from "@/lib/walk/access-rules";
import type { RouteDetail } from "@/lib/walk/ors-route";

const line = (km: number) => [
  { lat: 32, lng: 34 },
  { lat: 32 + km / 111.2, lng: 34 },
];
const detail = (over: Partial<RouteDetail>): RouteDetail => ({ named: [], stateRoads: null, steps: [], grades: [], surfaces: [], ...over });

describe("accessRules", () => {
  it("is met on a clean route", () => {
    const r = accessRules(detail({}), "wheelchair", 2);
    expect(r.map((x) => x.status)).toEqual(["met", "met", "met"]);
  });
  it("steps are not_met with their length", () => {
    const r = accessRules(detail({ steps: [line(0.05)] }), "stroller", 2);
    expect(r[0]).toMatchObject({ rule: "no_steps", status: "not_met" });
  });
  it("slope: a class wholly above the limit is not_met, a straddling class is partial", () => {
    // wheelchair limit 6%: class 3 (7-9%) is above; stroller limit 8%: class 3 straddles
    expect(accessRules(detail({ grades: [{ path: line(0.3), cls: 3 }] }), "wheelchair", 2)[1].status).toBe("not_met");
    expect(accessRules(detail({ grades: [{ path: line(0.3), cls: -3 }] }), "stroller", 2)[1].status).toBe("partial");
    // ORS class 2 is 4% up to (not including) 7%: a 6% limit cannot be sure of it, class 1 (1-4%) is safe
    expect(accessRules(detail({ grades: [{ path: line(0.3), cls: 2 }] }), "wheelchair", 2)[1].status).toBe("partial");
    expect(accessRules(detail({ grades: [{ path: line(0.3), cls: 1 }] }), "wheelchair", 2)[1].status).toBe("met");
  });
  it("the walker's own grade limit wins", () => {
    expect(accessRules(detail({ grades: [{ path: line(0.3), cls: 3 }] }), "wheelchair", 2, 11)[1].status).toBe("met");
  });
  it("rough surface is not_met; mostly unknown surface is partial with a data gap", () => {
    expect(accessRules(detail({ surfaces: [{ path: line(0.4), code: 11 }] }), "wheelchair", 2)[2].status).toBe("not_met");
    const unknown = accessRules(detail({ surfaces: [{ path: line(1), code: 0 }] }), "wheelchair", 2)[2];
    expect(unknown).toMatchObject({ status: "partial", dataGap: true });
  });
  it("never says met when the router sent nothing", () => {
    const r = accessRules(detail({ steps: null, grades: null, surfaces: null }), "stroller", 2);
    expect(r.every((x) => x.status === "not_checked" && x.dataGap)).toBe(true);
    expect(accessRules(undefined, "stroller", 2).every((x) => x.status === "not_checked")).toBe(true);
  });
});

describe("stopAccessRules", () => {
  it("only applies to wheelchairs and to places they go into", () => {
    expect(stopAccessRules([{ name: "A", category: "museum", wheelchairEntrance: false }], "stroller")).toEqual([]);
    expect(stopAccessRules([{ name: "P", category: "park" }], "wheelchair")).toEqual([]);
  });
  it("not_met on a known step, partial on unknown, met when all known", () => {
    expect(stopAccessRules([{ name: "A", category: "museum", wheelchairEntrance: false }], "wheelchair")[0].status).toBe("not_met");
    expect(stopAccessRules([{ name: "A", category: "museum", wheelchairEntrance: true }, { name: "B", category: "food" }], "wheelchair")[0].status).toBe("partial");
    expect(stopAccessRules([{ name: "B", category: "food" }], "wheelchair")[0].status).toBe("not_checked");
    expect(stopAccessRules([{ name: "A", category: "museum", wheelchairEntrance: true }], "wheelchair")[0].status).toBe("met");
  });
});

const getDirections = vi.fn();
vi.mock("@/lib/api/ors-client", () => ({ getDirections: (...a: unknown[]) => getDirections(...a) }));

describe("orsRoute with a route mode", () => {
  beforeEach(() => getDirections.mockReset());

  it("asks for the mode's profile and options, and keeps steps, slope and surface", async () => {
    const { orsRoute, routeDetail } = await import("@/lib/walk/ors-route");
    const { ACCESS_PROFILES } = await import("@/lib/walk/access");
    // two 2D points encoded: (32.0,34.0) -> (32.001,34.0)
    getDirections.mockResolvedValue({
      routes: [
        {
          geometry: "_c`|@_qo]ObA",
          summary: { distance: 100, duration: 70 },
          way_points: [0, 1],
          segments: [{ distance: 100, duration: 70, steps: [{ distance: 100, duration: 70, instruction: "go", name: "Main", way_points: [0, 1] }] }],
          extras: { waytype: { values: [[0, 1, 8]] }, steepness: { values: [[0, 1, 3]] }, surface: { values: [[0, 1, 1]] } },
        },
      ],
    });
    const wps = [{ lat: 32.0, lng: 34.0 }, { lat: 32.001, lng: 34.0 }];
    const g = await orsRoute(wps, null, ACCESS_PROFILES.wheelchair.mode);
    const req = getDirections.mock.calls[0][0];
    expect(req.profile).toBe("wheelchair");
    expect(req.extra_info).toEqual(["waytype", "steepness", "surface"]);
    expect(req.options.profile_params.restrictions.maximum_incline).toBe(6);
    const d = routeDetail(g)!;
    expect(d.steps).toHaveLength(1);
    expect(d.grades?.[0].cls).toBe(3);
    expect(d.surfaces?.[0].code).toBe(1);
  });

  it("does not share the cache between modes", async () => {
    const { isRouteCached } = await import("@/lib/walk/ors-route");
    const { ACCESS_PROFILES } = await import("@/lib/walk/access");
    const wps = [{ lat: 32.0, lng: 34.0 }, { lat: 32.001, lng: 34.0 }];
    expect(isRouteCached(wps, null, ACCESS_PROFILES.stroller.mode)).toBe(false);
  });
});
