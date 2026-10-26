import { haversineDistance } from "@/lib/utils/geo";
import type { Coordinates } from "@/lib/types";
import { ACCEPTABLE_BAD_KM } from "./clean-route";
import { ACCESS_PROFILES, type Access } from "./access";
import type { RouteDetail } from "./ors-route";
import type { RuleResult } from "./rule-verdict";

const pathKm = (path: Coordinates[]): number => path.reduce((a, p, i) => a + (i ? haversineDistance(path[i - 1], p) : 0), 0) / 1000;
const round2 = (n: number): number => Math.round(n * 100) / 100;

/** ORS steepness class -> [lowest, highest] grade in percent covered by the class (up or down). */
const GRADE_CLASS: Record<number, [number, number]> = { 1: [1, 3], 2: [4, 6], 3: [7, 9], 4: [10, 15], 5: [16, Infinity] };

/** ORS surface codes that a wheel does badly on. */
const ROUGH_SURFACE = new Set([2, 5, 10, 11, 12, 13, 15, 16, 17, 18]);

/** Share of the route with no surface data above which the surface rule is only partial. */
const UNKNOWN_SURFACE_SHARE = 0.2;

/** Steps, steep grades and rough surface along one real route. `routeKm` is the route length. Pure. */
export function accessRules(detail: RouteDetail | undefined, access: Access, routeKm: number, maxGradePct?: number): RuleResult[] {
  const limit = maxGradePct ?? ACCESS_PROFILES[access].maxGradePct;
  const rules: RuleResult[] = [];

  if (!detail?.steps) rules.push({ rule: "no_steps", status: "not_checked", dataGap: true, detail: "the router gave no step data" });
  else {
    const km = round2(detail.steps.reduce((a, p) => a + pathKm(p), 0));
    rules.push(km > 0.01 ? { rule: "no_steps", status: "not_met", value: km, detail: "the route includes steps" } : { rule: "no_steps", status: "met", value: 0 });
  }

  if (!detail?.grades) rules.push({ rule: "max_grade", status: "not_checked", dataGap: true, detail: "the router gave no slope data" });
  else {
    let over = 0;
    let straddle = 0;
    for (const g of detail.grades) {
      const [lo, hi] = GRADE_CLASS[Math.abs(g.cls)] ?? [0, 0];
      if (lo > limit) over += pathKm(g.path);
      else if (hi > limit) straddle += pathKm(g.path);
    }
    over = round2(over);
    if (over > ACCEPTABLE_BAD_KM) rules.push({ rule: "max_grade", status: "not_met", value: over, limit, detail: `${over} km steeper than ${limit}%` });
    else if (straddle > ACCEPTABLE_BAD_KM) rules.push({ rule: "max_grade", status: "partial", value: round2(straddle), limit, detail: `${round2(straddle)} km are on slopes that may be close to ${limit}% (the router reports slope classes)` });
    else rules.push({ rule: "max_grade", status: "met", limit });
  }

  if (!detail?.surfaces) rules.push({ rule: "surface", status: "not_checked", dataGap: true, detail: "the router gave no surface data" });
  else {
    let rough = 0;
    let unknown = 0;
    for (const s of detail.surfaces) {
      const km = pathKm(s.path);
      if (ROUGH_SURFACE.has(s.code)) rough += km;
      else if (s.code === 0) unknown += km;
    }
    rough = round2(rough);
    if (rough > ACCEPTABLE_BAD_KM) rules.push({ rule: "surface", status: "not_met", value: rough, detail: `${rough} km on rough, unpaved or cobbled ground` });
    else if (routeKm > 0 && unknown / routeKm > UNKNOWN_SURFACE_SHARE) rules.push({ rule: "surface", status: "partial", dataGap: true, detail: `the surface of ${Math.round((unknown / routeKm) * 100)}% of the route is not on the map` });
    else rules.push({ rule: "surface", status: "met" });
  }
  return rules;
}

/** Wheelchair walkers: every place they will go into needs a step-free entrance. Places they only pass by are skipped. */
export function stopAccessRules(stops: Array<{ name: string; category: string; wheelchairEntrance?: boolean }>, access: Access): RuleResult[] {
  if (access !== "wheelchair") return [];
  const inside = stops.filter((s) => s.category !== "area" && s.category !== "nature" && s.category !== "park" && s.category !== "viewpoint");
  if (!inside.length) return [];
  const no = inside.filter((s) => s.wheelchairEntrance === false);
  const unknown = inside.filter((s) => s.wheelchairEntrance === undefined);
  if (no.length) return [{ rule: "accessible_stops", status: "not_met", value: no.length, detail: `no step-free entrance: ${no.map((s) => s.name).join(", ")}` }];
  if (unknown.length === inside.length) return [{ rule: "accessible_stops", status: "not_checked", dataGap: true, detail: "no accessibility data for these places" }];
  if (unknown.length) return [{ rule: "accessible_stops", status: "partial", dataGap: true, detail: `no accessibility data for: ${unknown.map((s) => s.name).join(", ")}` }];
  return [{ rule: "accessible_stops", status: "met" }];
}
