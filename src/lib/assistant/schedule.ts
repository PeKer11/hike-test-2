import { scheduleOf, scheduleRules } from "@/lib/walk/schedule-rules";
import { stopAccessRules } from "@/lib/walk/access-rules";
import type { RuleResult, Verdict } from "@/lib/walk/rule-verdict";
import type { Timeline } from "@/lib/walk/timing";
import { zoneOf, type Candidate, type WalkParams } from "./state";

/** Clock, opening-hours and order rules for stops in visiting order, plus the clock time of each stop. */
export function scheduleFor(params: WalkParams, stops: Candidate[], t: Timeline): { rules: RuleResult[]; schedule: Verdict["schedule"] } {
  const startAt = params.startAt && params.startAt > Date.now() - 6 * 3600000 ? params.startAt : undefined;
  const input = {
    timeline: t,
    stops: stops.map((c) => ({ id: c.id, name: c.name, category: c.category, hours: c.hours })),
    plans: params.stops,
    startAt,
    timeZone: zoneOf(params, startAt),
    endBy: params.endBy,
    meals: params.meals,
    order: params.order,
  };
  const access = params.access ? stopAccessRules(stops, params.access) : [];
  return { rules: [...scheduleRules(input), ...access], schedule: scheduleOf(input) };
}
