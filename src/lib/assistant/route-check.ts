import { haversineDistance } from "@/lib/utils/geo";
import { buildCleanRoute } from "@/lib/walk/clean-route";
import { fetchForbiddenWays, matchesStreet, type ForbiddenWay } from "@/lib/walk/forbidden-ways";
import type { Boundary } from "@/lib/walk/loop-search";
import { isRouteCached, orsRoute, routeDetail } from "@/lib/walk/ors-route";
import { BudgetExceeded, budgeted, makeBudget, type RoutingBudget } from "@/lib/walk/routing-budget";
import { brokenKm, brokenRules, evaluateRoute, unavailableVerdict, type RuleId, type Verdict } from "@/lib/walk/rule-verdict";
import { fetchTownBoundary } from "@/lib/walk/town-boundary";
import { DEFAULT_PACE_MIN_PER_KM, visitMinutes, type Candidate, type WalkParams } from "./state";

/** Directions calls one tool call may spend (ORS free tier: ~40 a minute). */
export const ROUTING_CALLS_PER_TOOL = 30;
/** Visit orders tried when the first one repeats a street. */
const ORDERS_TRIED = 4;
const MAX_ALTERNATIVES = 3;

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
  alternatives?: Alternative[];
}

/** True when the walker's rules need a real route to be checked (limits alone are checked on the estimate). */
export function needsRouteCheck(params: WalkParams): boolean {
  return params.endDistanceKm === 0 || params.noRepeat === true || Boolean(params.avoidStreets?.length) || params.avoidDangerous === true || Boolean(params.stayInArea) || Boolean(params.viaStreets?.length);
}

/** Map data fetched once per check and shared by every route tried. */
export interface CheckEnv {
  boundary: Boundary | null;
  forbidden: { ways: ForbiddenWay[]; failed: boolean };
}

export async function loadEnv(origin: Candidate["coordinates"], params: WalkParams): Promise<CheckEnv> {
  const streets = params.avoidStreets ?? [];
  const boundary = params.stayInArea ? await fetchTownBoundary(params.stayInArea) : null;
  let failed = false;
  const ways =
    streets.length || params.avoidDangerous
      ? await fetchForbiddenWays(origin, Math.max((params.radiusKm ?? 3) * 1500, 2000), { streets, dangerous: params.avoidDangerous, onError: () => (failed = true) })
      : [];
  return { boundary, forbidden: { ways, failed } };
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
  const budget = opts.budget ?? makeBudget(ROUTING_CALLS_PER_TOOL);
  const route = budgeted(orsRoute, budget, isRouteCached);
  const loop = params.endDistanceKm === 0;
  const pace = params.paceMinPerKm ?? DEFAULT_PACE_MIN_PER_KM;
  const streets = params.avoidStreets ?? [];
  const env = opts.env ?? (await loadEnv(origin, params));

  const waypointsOf = (stops: Candidate[]) => [origin, ...stops.map((s) => s.coordinates), ...(loop ? [origin] : [])];

  async function judge(stops: Candidate[], maxAttempts: number): Promise<{ verdict: Verdict; stops: Candidate[] }> {
    const waypoints = waypointsOf(stops);
    const forbiddenWays = env.forbidden.ways.map((w) => w.path);
    if (streets.length || (params.avoidDangerous && env.forbidden.failed)) {
      // The map-data service may be down or spell the street differently: the router's own names steer the re-route too.
      const detail = routeDetail(await route(waypoints, null));
      for (const s of detail?.named ?? []) if (streets.some((w) => matchesStreet(s.name, w))) forbiddenWays.push(s.path);
      if (params.avoidDangerous && env.forbidden.failed) forbiddenWays.push(...(detail?.stateRoads ?? []));
    }
    const clean = await buildCleanRoute({ waypoints, route, noRepeat: params.noRepeat === true, forbiddenWays, maxAttempts });
    const verdict = evaluateRoute({
      geometry: clean.geometry,
      detail: routeDetail(clean.geometry),
      origin,
      params,
      forbidden: env.forbidden,
      boundary: env.boundary,
      paceMinPerKm: pace,
      visitMin: stops.reduce((a, s) => a + visitMinutes(s.category), 0),
    });
    return { verdict, stops };
  }

  // With no_repeat, a different visiting order often repeats less street: keep the one whose real route repeats least.
  let best = order;
  let main: Verdict | null = null;
  try {
    const first = await judge(order, 3);
    main = first.verdict;
    if (opts.orderSearch !== false && params.noRepeat && order.length >= 3 && order.length <= 6) {
      const bad = (v: Verdict) => brokenKm(v);
      for (const o of otherOrders(origin, order, loop).slice(0, ORDERS_TRIED)) {
        if (bad(main) <= 0.05) break;
        const tried = await judge(o, 1);
        if (bad(tried.verdict) < bad(main)) {
          best = o;
          main = tried.verdict;
        }
      }
      if (best !== order) main = (await judge(best, 3)).verdict;
    }
  } catch (err) {
    const why = err instanceof BudgetExceeded ? "the routing limit for this request was reached" : "the routing service did not answer";
    if (!(err instanceof BudgetExceeded)) console.error("[assistant] route check failed:", err);
    if (!main) return { verdict: unavailableVerdict(params, why), orderIds: order.map((s) => s.id) };
  }
  const verdict = main as Verdict;
  const result: Judged = { verdict, orderIds: best.map((s) => s.id) };
  if (verdict.ok || opts.alternatives === false) return result;

  const summary = (v: Verdict) => ({ walkKm: v.walkKm, totalMin: v.totalMin, repeatedKm: v.rules.find((r) => r.rule === "no_repeat")?.value, outsideKm: v.rules.find((r) => r.rule === "stay_in_area")?.value });
  const alts: Array<Alternative & { km: number }> = [];
  const broken = brokenRules(verdict);
  // Keeping this very route and giving up one rule costs no further routing.
  for (const rule of broken) {
    const left = broken.filter((r) => r !== rule);
    alts.push({ option: `keep this route and give up: ${rule}`, stop_ids: result.orderIds, rulesBroken: left, ...summary(verdict), km: brokenKm(verdict) });
  }
  try {
    if (best.length > 1) {
      for (let k = 0; k < best.length; k++) {
        const rest = best.filter((_, i) => i !== k);
        const r = await judge(rest, 1);
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
  alts.sort((a, b) => a.rulesBroken.length - b.rulesBroken.length || a.km - b.km);
  result.alternatives = alts.slice(0, MAX_ALTERNATIVES).map((a) => ({ option: a.option, stop_ids: a.stop_ids, rulesBroken: a.rulesBroken, walkKm: a.walkKm, totalMin: a.totalMin, repeatedKm: a.repeatedKm, outsideKm: a.outsideKm }));
  return result;
}
