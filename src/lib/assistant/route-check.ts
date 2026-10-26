import type { Coordinates } from "@/lib/types";
import { haversineDistance } from "@/lib/utils/geo";
import { buildCleanRoute } from "@/lib/walk/clean-route";
import { fetchForbiddenWays, matchesStreet, type ForbiddenWay } from "@/lib/walk/forbidden-ways";
import type { Boundary } from "@/lib/walk/loop-search";
import { isRouteCached, orsRoute, routeDetail } from "@/lib/walk/ors-route";
import { BudgetExceeded, budgeted, makeBudget, type RoutingBudget } from "@/lib/walk/routing-budget";
import type { AvoidPolygons } from "@/lib/walk/clean-route";
import { ACCESS_PROFILES } from "@/lib/walk/access";
import { satisfies } from "@/lib/walk/stop-order";
import { scheduleFor } from "./schedule";
import { brokenKm, brokenRules, evaluateRoute, unavailableVerdict, type RuleId, type Verdict } from "@/lib/walk/rule-verdict";
import { OrsNoRouteError } from "@/lib/walk/ors-errors";
import { fetchTownBoundary } from "@/lib/walk/town-boundary";
import { legKmsFromGeometry, timeline } from "@/lib/walk/timing";
import { DEFAULT_PACE_MIN_PER_KM, visitMinutes, type Candidate, type WalkParams } from "./state";

/** Directions calls one assistant turn may spend across all its tools (ORS free tier: ~40 a minute). */
export const TURN_ROUTING_CALLS = 35;
/** Visit orders tried when the first one repeats a street. */
const ORDERS_TRIED = 4;
const MAX_ALTERNATIVES = 3;

/** Rules that set_walk_params clear cannot remove: the tool call that does. */
const GIVE_UP_WITH: Partial<Record<RuleId, string>> = {
  open_hours: "set_clock clear",
  end_by: "set_clock clear",
  stop_time: "set_stop_plan clear_ids",
  meal: "set_breaks clear",
  stop_order: "set_stop_order clear",
  transit: "set_transit back false",
  no_steps: "set_walk_params access none",
  max_grade: "set_walk_params access none",
  surface: "set_walk_params access none",
  accessible_stops: "set_walk_params access none",
};

/** Another way to finish the walk when the current one breaks a rule; numbers are from a real route. */
export interface Alternative {
  option: string;
  stop_ids: string[];
  /** Rules this alternative still breaks (empty: it meets every rule once the named rule is given up). */
  rulesBroken: RuleId[];
  walkKm: number;
  totalMin: number;
  repeatedKm?: number;
  outsideKm?: number;
}

export interface Judged {
  verdict: Verdict;
  /** Stop ids in the order that was checked; build with this order. */
  orderIds: string[];
  /** The walking route that was checked (for `orderIds`); the map must show this one. */
  geometry?: Coordinates[];
  alternatives?: Alternative[];
}

/** True when the walker's rules need a real route to be checked (limits alone are checked on the estimate). */
export function needsRouteCheck(params: WalkParams): boolean {
  return params.endDistanceKm === 0 || params.noRepeat === true || Boolean(params.avoidStreets?.length) || params.avoidDangerous === true || Boolean(params.stayInArea) || Boolean(params.viaStreets?.length) || Boolean(params.access);
}

/** Map data fetched once per check and shared by every route tried. */
export interface CheckEnv {
  boundary: Boundary | null;
  forbidden: { ways: ForbiddenWay[]; failed: boolean };
  /** Where the streets the walk must go along are on the map. */
  viaWays: { ways: ForbiddenWay[]; failed: boolean };
}

export async function loadEnv(origin: Candidate["coordinates"], params: WalkParams): Promise<CheckEnv> {
  const streets = params.avoidStreets ?? [];
  const boundary = params.stayInArea ? await fetchTownBoundary(params.stayInArea) : null;
  let failed = false;
  const ways =
    streets.length || params.avoidDangerous
      ? await fetchForbiddenWays(origin, Math.max((params.radiusKm ?? 3) * 1500, 2000), { streets, dangerous: params.avoidDangerous, onError: () => (failed = true) })
      : [];
  let viaFailed = false;
  const viaWays = params.viaStreets?.length
    ? await fetchForbiddenWays(origin, Math.max((params.radiusKm ?? 3) * 1500, 2000), { streets: params.viaStreets, onError: () => (viaFailed = true) })
    : [];
  return { boundary, forbidden: { ways, failed }, viaWays: { ways: viaWays.filter((w) => w.reason === "named"), failed: viaFailed } };
}

/** Orders of `order` other than the given one, shortest straight-line tour first (a loop and its reverse count once). */
function otherOrders(origin: Candidate["coordinates"], order: Candidate[], loop: boolean): Candidate[][] {
  const out: Candidate[][] = [];
  const permute = (rest: Candidate[], acc: Candidate[]) => {
    if (!rest.length) {
      out.push(acc);
      return;
    }
    rest.forEach((c, i) => permute([...rest.slice(0, i), ...rest.slice(i + 1)], [...acc, c]));
  };
  permute(order, []);
  const key = (o: Candidate[]) => o.map((c) => c.id).join();
  const seen = new Set([key(order), ...(loop ? [key([...order].reverse())] : [])]);
  const tour = (o: Candidate[]) => [origin, ...o.map((c) => c.coordinates), ...(loop ? [origin] : [])].reduce((a, p, i, all) => a + (i ? haversineDistance(all[i - 1], p) : 0), 0);
  return out
    .filter((o) => {
      const k = key(o);
      if (seen.has(k)) return false;
      seen.add(k);
      if (loop) seen.add(key([...o].reverse()));
      return true;
    })
    .sort((a, b) => tour(a) - tour(b));
}

/**
 * Checks `order` against every rule on a real walking route, and, when a rule fails, finds what could be given
 * up or changed. All routing goes through one budget; when it (or the router) fails the verdict says "not checked".
 */
export async function routeAndJudge(
  origin: Candidate["coordinates"],
  order: Candidate[],
  params: WalkParams,
  spares: Candidate[] = [],
  opts: { alternatives?: boolean; orderSearch?: boolean; budget?: RoutingBudget; env?: CheckEnv } = {},
): Promise<Judged> {
  const budget = opts.budget ?? makeBudget(TURN_ROUTING_CALLS);
  const profile = params.access ? ACCESS_PROFILES[params.access] : undefined;
  const mode = profile?.mode;
  const route = budgeted((w: Candidate["coordinates"][], a: AvoidPolygons | null) => orsRoute(w, a, mode), budget, (w, a) => isRouteCached(w, a, mode));
  const loop = params.endDistanceKm === 0;
  const pace = (params.paceMinPerKm ?? DEFAULT_PACE_MIN_PER_KM) * (profile?.paceFactor ?? 1);
  const streets = params.avoidStreets ?? [];
  const env = opts.env ?? (await loadEnv(origin, params));

  const waypointsOf = (stops: Candidate[]) => [origin, ...stops.map((s) => s.coordinates), ...(loop ? [origin] : [])];

  async function judge(stops: Candidate[], maxAttempts: number): Promise<{ verdict: Verdict; stops: Candidate[]; geometry: Coordinates[] }> {
    const waypoints = waypointsOf(stops);
    const forbiddenWays = env.forbidden.ways.map((w) => w.path);
    if (streets.length || (params.avoidDangerous && env.forbidden.failed)) {
      // The map-data service may be down or spell the street differently: the router's own names steer the re-route too.
      const detail = routeDetail(await route(waypoints, null));
      for (const s of detail?.named ?? []) if (streets.some((w) => matchesStreet(s.name, w))) forbiddenWays.push(s.path);
      if (params.avoidDangerous && env.forbidden.failed) forbiddenWays.push(...(detail?.stateRoads ?? []));
    }
    const clean = await buildCleanRoute({ waypoints, route, noRepeat: params.noRepeat === true, forbiddenWays, maxAttempts });
    const legKms = legKmsFromGeometry(clean.geometry, waypoints);
    const heights = routeDetail(clean.geometry)?.legs;
    const t = timeline(
      stops.map((c) => ({ id: c.id, visitMin: visitMinutes(c.category) })),
      legKms,
      params.stops,
      pace,
      heights && heights.length === legKms.length ? heights.map((l) => l.ascentM * (profile?.climbFactor ?? 1)) : null,
      params.breaks,
    );
    const sched = scheduleFor(params, stops, t);
    const verdict = evaluateRoute({
      geometry: clean.geometry,
      detail: routeDetail(clean.geometry),
      origin,
      params,
      forbidden: env.forbidden,
      viaWays: env.viaWays,
      boundary: env.boundary,
      paceMinPerKm: pace,
      visitMin: t.visitMin + t.restMin,
      extraRules: sched.rules,
      access: params.access,
      maxGradePct: params.maxGradePct,
      // Per-leg pace and climbing change the walking time; without either it is the whole route at one pace, as before.
      ...((params.stops && Object.keys(params.stops).length) || t.climbKnown ? { walkMin: t.walkMin } : {}),
      ...(t.climbKnown ? { climbMin: t.climbMin } : {}),
    });
    if (t.restMin) verdict.restMin = Math.round(t.restMin);
    if (sched.schedule) verdict.schedule = sched.schedule;
    return { verdict, stops, geometry: clean.geometry };
  }

  // With no_repeat, a different visiting order often repeats less street: keep the one whose real route repeats least.
  let best = order;
  let main: Verdict | null = null;
  let mainGeometry: Coordinates[] | undefined;
  try {
    const first = await judge(order, 3);
    main = first.verdict;
    mainGeometry = first.geometry;
    if (opts.orderSearch !== false && params.noRepeat && order.length >= 3 && order.length <= 6) {
      // Fewer broken rules first, then fewer broken kilometres.
      const bad = (v: Verdict) => brokenRules(v).length * 1000 + brokenKm(v);
      for (const o of otherOrders(origin, order, loop).filter((o) => satisfies(o.map((c) => ({ id: c.id, category: c.category })), params.order)).slice(0, ORDERS_TRIED)) {
        if (bad(main) <= 0.05) break;
        const tried = await judge(o, 1);
        if (bad(tried.verdict) < bad(main)) {
          best = o;
          main = tried.verdict;
          mainGeometry = tried.geometry;
        }
      }
      if (best !== order) {
        const again = await judge(best, 3);
        main = again.verdict;
        mainGeometry = again.geometry;
      }
    }
  } catch (err) {
    const why = err instanceof BudgetExceeded ? "the routing limit for this request was reached" : "the routing service did not answer";
    if (!(err instanceof BudgetExceeded) && !(err instanceof OrsNoRouteError)) console.error("[assistant] route check failed:", err);
    if (!main && err instanceof OrsNoRouteError && params.access) {
      // The router answered: there is no step-free / wheel-friendly way between these places. That is a failed set, not an outage.
      const base = unavailableVerdict(params, "no route");
      const rules = [{ rule: "no_steps" as const, status: "not_met" as const, detail: `no ${params.access} route reaches these places (${err.message})` }, ...base.rules];
      return { verdict: { ...base, unavailable: undefined, ok: false, broken: true, rules }, orderIds: order.map((s) => s.id) };
    }
    if (!main) return { verdict: { ...unavailableVerdict(params, why), ...(err instanceof OrsNoRouteError ? { noRoute: true } : {}) }, orderIds: order.map((s) => s.id) };
  }
  const verdict = main as Verdict;
  const result: Judged = { verdict, orderIds: best.map((s) => s.id), geometry: mainGeometry };
  if (!verdict.broken || opts.alternatives === false) return result;

  const summary = (v: Verdict) => ({ walkKm: v.walkKm, totalMin: v.totalMin, repeatedKm: v.rules.find((r) => r.rule === "no_repeat")?.value, outsideKm: v.rules.find((r) => r.rule === "stay_in_area")?.value });
  const alts: Array<Alternative & { km: number }> = [];
  const broken = brokenRules(verdict);
  // Keeping this very route and giving up one rule costs no further routing.
  for (const rule of broken) {
    const left = broken.filter((r) => r !== rule);
    alts.push({ option: `keep this route and give up: ${rule}${GIVE_UP_WITH[rule] ? ` (${GIVE_UP_WITH[rule]})` : ""}`, stop_ids: result.orderIds, rulesBroken: left, ...summary(verdict), km: brokenKm(verdict) });
  }
  try {
    if (best.length > 1) {
      for (let k = 0; k < best.length; k++) {
        const rest = best.filter((_, i) => i !== k);
        const r = await judge(rest, 2);
        const left = brokenRules(r.verdict);
        if (left.length < broken.length || brokenKm(r.verdict) < brokenKm(verdict)) {
          alts.push({ option: `drop ${best[k].name}`, stop_ids: rest.map((s) => s.id), rulesBroken: left, ...summary(r.verdict), km: brokenKm(r.verdict) });
        }
        if (r.verdict.ok) {
          // A clean route exists without this stop: try another place of the same kind in its place.
          const swaps = spares.filter((c) => c.category === best[k].category && !best.some((s) => s.id === c.id)).slice(0, 3);
          for (const alt of swaps) {
            const swapped = best.map((s, i) => (i === k ? alt : s));
            const sr = await judge(swapped, 1);
            if (sr.verdict.ok) {
              alts.push({ option: `replace ${best[k].name} with ${alt.name}`, stop_ids: swapped.map((s) => s.id), rulesBroken: [], ...summary(sr.verdict), km: 0 });
              break;
            }
          }
        }
      }
    }
  } catch {
    // budget or router ran out: the alternatives found so far stand
  }
  // Giving up the walker's safety rule is the last suggestion, never the first.
  const rank = (a: Alternative & { km: number }) => (a.option === "keep this route and give up: avoid_dangerous" ? 1 : 0);
  alts.sort((a, b) => rank(a) - rank(b) || a.rulesBroken.length - b.rulesBroken.length || a.km - b.km);
  result.alternatives = alts.slice(0, MAX_ALTERNATIVES).map((a) => ({ option: a.option, stop_ids: a.stop_ids, rulesBroken: a.rulesBroken, walkKm: a.walkKm, totalMin: a.totalMin, repeatedKm: a.repeatedKm, outsideKm: a.outsideKm }));
  return result;
}
