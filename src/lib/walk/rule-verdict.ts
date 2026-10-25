import type { Coordinates } from "@/lib/types";
import { haversineDistance } from "@/lib/utils/geo";
import { ACCEPTABLE_BAD_KM } from "./clean-route";
import { matchesStreet, type ForbiddenWay } from "./forbidden-ways";
import { insideBoundary, outsideKm, type Boundary } from "./loop-search";
import { analyzeRoute } from "./route-quality";
import type { RouteDetail } from "./ors-route";

export type RuleId = "no_repeat" | "stay_in_area" | "avoid_streets" | "avoid_dangerous" | "via_streets" | "loop" | "end_distance" | "time" | "max_walk";
/** met = checked and fine; not_met = checked and broken; partial = checked only in part; not_checked = no data to check with. */
export type RuleStatus = "met" | "not_met" | "partial" | "not_checked";

export interface RuleResult {
  rule: RuleId;
  status: RuleStatus;
  /** What was measured (km, minutes) when the rule is about an amount. */
  value?: number;
  limit?: number;
  detail?: string;
}

export interface Verdict {
  /** True only when every rule that applies is `met`. */
  ok: boolean;
  /** True when at least one rule was checked and is `not_met` (an unchecked rule alone never makes a route "broken"). */
  broken: boolean;
  /** True when no route could be built, so nothing was measured. */
  unavailable?: boolean;
  rules: RuleResult[];
  walkKm: number;
  walkMin: number;
  visitMin: number;
  totalMin: number;
}

/** The walker's rules, as far as the verdict needs them (a subset of WalkParams). */
export interface VerdictParams {
  timeMinutes?: number;
  maxWalkKm?: number;
  endDistanceKm?: number;
  noRepeat?: boolean;
  avoidStreets?: string[];
  avoidDangerous?: boolean;
  stayInArea?: string;
  viaStreets?: string[];
}

/** A via street counts as walked along when at least this much of the route runs on it. */
const VIA_MIN_KM = 0.06;

const km = (path: Coordinates[]): number => path.reduce((a, p, i) => a + (i ? haversineDistance(path[i - 1], p) : 0), 0) / 1000;
const round1 = (n: number): number => Math.round(n * 10) / 10;
const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Time and distance rules, from numbers measured on the real route (or estimated, when no route rule needs routing). `approx`: the numbers are straight-line estimates, so the rule is at best partial. */
export function limitRules(params: VerdictParams, walkKm: number, walkMin: number, visitMin: number, approx = false): RuleResult[] {
  const totalMin = walkMin + visitMin;
  const rules: RuleResult[] = [];
  const estimated = "distances are straight-line estimates, not a real route";
  if (params.timeMinutes) {
    const fits = totalMin <= params.timeMinutes;
    rules.push({ rule: "time", status: !fits ? "not_met" : approx ? "partial" : "met", value: Math.round(totalMin), limit: params.timeMinutes, ...(fits && approx ? { detail: estimated } : {}) });
  }
  if (params.maxWalkKm) {
    const fits = walkKm <= params.maxWalkKm;
    const near = walkKm <= params.maxWalkKm * 1.1;
    rules.push({
      rule: "max_walk",
      status: !near ? "not_met" : !fits || approx ? "partial" : "met",
      value: round1(walkKm),
      limit: params.maxWalkKm,
      ...(near && !fits ? { detail: "over the limit, within the 10% tolerance" } : near && approx ? { detail: estimated } : {}),
    });
  }
  return rules;
}

export function makeVerdict(rules: RuleResult[], walkKm: number, walkMin: number, visitMin: number): Verdict {
  return {
    ok: rules.every((r) => r.status === "met"),
    broken: rules.some((r) => r.status === "not_met"),
    rules,
    walkKm: round1(walkKm),
    walkMin: Math.round(walkMin),
    visitMin: Math.round(visitMin),
    totalMin: Math.round(walkMin + visitMin),
  };
}

export interface VerdictInput {
  geometry: Coordinates[];
  /** Street names and road types the router reported for `geometry`. */
  detail?: RouteDetail;
  origin: Coordinates;
  params: VerdictParams;
  /** Ways from the map-data service; `failed` when it did not answer. */
  forbidden: { ways: ForbiddenWay[]; failed: boolean };
  /** OSM ways for the streets the walk must go along (every spelling); absent when none were asked for. */
  viaWays?: { ways: ForbiddenWay[]; failed: boolean };
  /** Town outline; null when it could not be fetched. */
  boundary: Boundary | null;
  paceMinPerKm: number;
  visitMin: number;
  /** Walking minutes when legs have their own pace; otherwise km x paceMinPerKm. */
  walkMin?: number;
}

/** Every rule against one real route. Pure: no network. "not_checked" is decided here and nowhere else. */
export function evaluateRoute(input: VerdictInput): Verdict {
  const { geometry, detail, origin, params, forbidden, boundary } = input;
  const loop = params.endDistanceKm === 0;
  const walkKm = km(geometry);
  const walkMin = input.walkMin ?? walkKm * input.paceMinPerKm;
  const quality = analyzeRoute(geometry, []);
  const rules: RuleResult[] = [];
  const hasNames = (detail?.named.length ?? 0) > 0;

  if (loop) {
    rules.push({ rule: "loop", status: quality.closesLoop ? "met" : "not_met", value: round2(quality.endGapM / 1000), detail: "km between the end and the start" });
  } else if (params.endDistanceKm && params.endDistanceKm > 0) {
    const end = geometry[geometry.length - 1];
    const away = end ? haversineDistance(origin, end) / 1000 : 0;
    rules.push({ rule: "end_distance", status: away <= params.endDistanceKm ? "met" : away <= params.endDistanceKm * 1.1 ? "partial" : "not_met", value: round1(away), limit: params.endDistanceKm, ...(away > params.endDistanceKm && away <= params.endDistanceKm * 1.1 ? { detail: "over the limit, within the 10% tolerance" } : {}) });
  }

  if (params.noRepeat) {
    rules.push({ rule: "no_repeat", status: quality.repeatedKm <= ACCEPTABLE_BAD_KM ? "met" : "not_met", value: quality.repeatedKm });
  }

  if (params.avoidStreets?.length) {
    const wanted = params.avoidStreets;
    const named = forbidden.ways.filter((w) => w.reason === "named");
    const overpassKm = analyzeRoute(geometry, named.map((w) => w.path)).forbiddenKm;
    const stepKm = round1((detail?.named ?? []).filter((s) => wanted.some((w) => matchesStreet(s.name, w))).reduce((a, s) => a + km(s.path), 0));
    const knownByMap = (w: string) => named.some((n) => n.names.some((x) => matchesStreet(x, w)));
    const known = wanted.filter((w) => knownByMap(w) || (detail?.named ?? []).some((s) => matchesStreet(s.name, w)));
    const value = Math.max(overpassKm, stepKm);
    if (forbidden.failed && !hasNames) {
      rules.push({ rule: "avoid_streets", status: "not_checked", detail: "the map-data service did not answer and the router gave no street names" });
    } else if (value > ACCEPTABLE_BAD_KM) {
      rules.push({ rule: "avoid_streets", status: "not_met", value, detail: forbidden.failed ? "read from the router's street names" : undefined });
    } else if (!forbidden.failed && known.length < wanted.length) {
      const missing = wanted.filter((w) => !known.includes(w));
      rules.push({ rule: "avoid_streets", status: "not_checked", detail: `no street called ${missing.join(", ")} was found near the start: check the spelling` });
    } else {
      rules.push({ rule: "avoid_streets", status: forbidden.failed && known.length < wanted.length ? "partial" : "met", value, ...(forbidden.failed ? { detail: "read from the router's street names" } : {}) });
    }
  }

  if (params.avoidDangerous) {
    if (!forbidden.failed) {
      const dangerous = forbidden.ways.filter((w) => w.reason === "dangerous");
      const value = analyzeRoute(geometry, dangerous.map((w) => w.path)).forbiddenKm;
      rules.push({ rule: "avoid_dangerous", status: value > ACCEPTABLE_BAD_KM ? "not_met" : "met", value });
    } else if (detail?.stateRoads) {
      const value = round1(detail.stateRoads.reduce((a, p) => a + km(p), 0));
      rules.push({ rule: "avoid_dangerous", status: value > ACCEPTABLE_BAD_KM ? "not_met" : "partial", value, detail: "only state roads were checked (the map-data service did not answer)" });
    } else {
      rules.push({ rule: "avoid_dangerous", status: "not_checked", detail: "the map-data service did not answer and the router gave no road types" });
    }
  }

  if (params.stayInArea) {
    if (!boundary) {
      rules.push({ rule: "stay_in_area", status: "not_checked", detail: `no outline found for ${params.stayInArea}` });
    } else {
      // A walker who starts outside the town is not penalised for the way in and out.
      const inside = geometry.map((p) => insideBoundary(p, boundary));
      const first = inside.indexOf(true);
      const last = inside.lastIndexOf(true);
      const startOutside = !insideBoundary(origin, boundary);
      if (first === -1) {
        rules.push({ rule: "stay_in_area", status: "not_met", value: round1(walkKm), detail: `the route never enters ${params.stayInArea}` });
      } else {
        const part = startOutside ? geometry.slice(first, last + 1) : geometry;
        const value = outsideKm(part, boundary);
        rules.push({ rule: "stay_in_area", status: value > ACCEPTABLE_BAD_KM ? "not_met" : "met", value, ...(startOutside ? { detail: `the start is outside ${params.stayInArea}; the way in and out is not counted` } : {}) });
      }
    }
  }

  for (const street of params.viaStreets ?? []) {
    // The router may spell the street in another language than the walker did: OSM knows every spelling, so measure on its ways too.
    const mapWays = (input.viaWays?.ways ?? []).filter((w) => w.names.some((n) => matchesStreet(n, street)));
    const byMap = mapWays.length ? analyzeRoute(geometry, mapWays.map((w) => w.path)).forbiddenKm : 0;
    const byName = (detail?.named ?? []).filter((s) => matchesStreet(s.name, street)).reduce((a, s) => a + km(s.path), 0);
    const along = round2(Math.max(byMap, byName));
    if (along >= VIA_MIN_KM) rules.push({ rule: "via_streets", status: "met", value: along, detail: street });
    else if (mapWays.length) rules.push({ rule: "via_streets", status: "not_met", value: along, detail: street });
    else rules.push({ rule: "via_streets", status: "not_checked", detail: `${street}: not confirmed (the street was not found on the map, so a different spelling cannot be ruled out)` });
  }

  rules.push(...limitRules(params, walkKm, walkMin, input.visitMin));
  return makeVerdict(rules, walkKm, walkMin, input.visitMin);
}

/** What the walker is told when a route could not be built at all: every rule is unchecked, never met. */
export function unavailableVerdict(params: VerdictParams, why: string): Verdict {
  const rules: RuleResult[] = [];
  if (params.endDistanceKm === 0) rules.push({ rule: "loop", status: "not_checked", detail: why });
  if (params.noRepeat) rules.push({ rule: "no_repeat", status: "not_checked", detail: why });
  if (params.avoidStreets?.length) rules.push({ rule: "avoid_streets", status: "not_checked", detail: why });
  if (params.avoidDangerous) rules.push({ rule: "avoid_dangerous", status: "not_checked", detail: why });
  if (params.stayInArea) rules.push({ rule: "stay_in_area", status: "not_checked", detail: why });
  for (const street of params.viaStreets ?? []) rules.push({ rule: "via_streets", status: "not_checked", detail: `${street}: ${why}` });
  if (params.timeMinutes) rules.push({ rule: "time", status: "not_checked", limit: params.timeMinutes, detail: why });
  if (params.maxWalkKm) rules.push({ rule: "max_walk", status: "not_checked", limit: params.maxWalkKm, detail: why });
  return { ok: false, broken: false, unavailable: true, rules, walkKm: 0, walkMin: 0, visitMin: 0, totalMin: 0 };
}

/** Rules that are not met, worst first, for ranking alternatives. */
export function brokenRules(v: Verdict): RuleId[] {
  return v.rules.filter((r) => r.status === "not_met").map((r) => r.rule);
}

/** Kilometres of street-level breakage, to compare two routes that both fail. */
export function brokenKm(v: Verdict): number {
  const amount = (r: RuleResult): number => {
    if (r.rule === "end_distance") return Math.max(0, (r.value ?? 0) - (r.limit ?? 0));
    if (r.rule === "via_streets" || r.rule === "loop") return 0.5;
    return r.value ?? 0;
  };
  return v.rules.filter((r) => r.status === "not_met" && r.rule !== "time" && r.rule !== "max_walk").reduce((a, r) => a + amount(r), 0);
}
