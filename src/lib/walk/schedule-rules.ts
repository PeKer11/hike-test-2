import { formatClock, localTimeOnDay, tzOffsetMin } from "./clock";
import { minutesUntilClose, openThrough, type WeeklyHours } from "./opening-hours";
import type { RuleResult } from "./rule-verdict";
import { satisfies, unresolvedRefs, type StopOrder } from "./stop-order";
import type { StopPlan, Timeline } from "./timing";

export interface MealWindow {
  from: string;
  to: string;
  minutes: number;
}

export interface ScheduleStop {
  id: string;
  name: string;
  category: string;
  hours?: WeeklyHours;
}

export interface ScheduleInput {
  timeline: Timeline;
  /** In visiting order, matching `timeline.at`. */
  stops: ScheduleStop[];
  plans?: Record<string, StopPlan>;
  /** Epoch ms of the start; absent when the walker has not said. */
  startAt?: number;
  timeZone?: string;
  endBy?: string;
  meals?: MealWindow[];
  order?: StopOrder;
}

const MIN = 60000;

/** Clock time of each stop for the verdict ("HH:MM"). */
export function scheduleOf(i: Pick<ScheduleInput, "timeline" | "startAt" | "timeZone">): Array<{ id: string; arrive: string; leave: string }> | undefined {
  if (i.startAt === undefined) return undefined;
  const off = (i.timeZone ? tzOffsetMin(i.timeZone, i.startAt) : null) ?? 0;
  return i.timeline.at.map((a) => ({ id: a.id, arrive: formatClock(i.startAt! + a.arriveMin * MIN, off), leave: formatClock(i.startAt! + a.leaveMin * MIN, off) }));
}

/** Rules that need the clock, the places' facts or the order. Pure. Never "met" for something that was not checked. */
export function scheduleRules(i: ScheduleInput): RuleResult[] {
  const rules: RuleResult[] = [];
  const off = i.startAt !== undefined && i.timeZone ? (tzOffsetMin(i.timeZone, i.startAt) ?? 0) : 0;
  const clockOf = (min: number) => formatClock(i.startAt! + min * MIN, off);

  if (i.order && (i.order.first || i.order.last || i.order.endAt || i.order.before?.length)) {
    const missing = unresolvedRefs(i.order, i.stops);
    if (missing.length) rules.push({ rule: "stop_order", status: "not_checked", detail: `not in the walk: ${missing.join(", ")}` });
    else rules.push({ rule: "stop_order", status: satisfies(i.stops, i.order) ? "met" : "not_met" });
  }

  const wantsClock = Boolean(i.endBy) || Boolean(i.meals?.length) || Object.values(i.plans ?? {}).some((p) => p.arriveAfter || p.arriveBefore);
  if (i.startAt === undefined) {
    if (wantsClock) rules.push({ rule: "stop_time", status: "not_checked", dataGap: true, detail: "the start time is not known" });
    return rules;
  }
  const tz = i.timeZone ?? "UTC";
  const byId = new Map(i.timeline.at.map((a) => [a.id, a]));

  // Opening hours: stops visited for more than a pass-by.
  const visited = i.stops.filter((s) => s.category !== "area" && (byId.get(s.id)?.leaveMin ?? 0) > (byId.get(s.id)?.arriveMin ?? 0));
  if (visited.length) {
    const bad: string[] = [];
    let unknown = 0;
    for (const s of visited) {
      const a = byId.get(s.id)!;
      const state = openThrough(s.hours, i.startAt + a.arriveMin * MIN, a.leaveMin - a.arriveMin, off);
      if (state === "unknown") unknown += 1;
      else if (state === "closed") bad.push(`${s.name}: closed at ${clockOf(a.arriveMin)}`);
      else if (state === "closes_during") {
        const left = minutesUntilClose(s.hours, i.startAt + a.arriveMin * MIN, off);
        bad.push(`${s.name}: closes ${left !== null ? `${clockOf(a.arriveMin + left)}` : "during the stay"}, before the visit ends`);
      }
    }
    if (bad.length) rules.push({ rule: "open_hours", status: "not_met", value: bad.length, detail: bad.join("; ") });
    else if (unknown === visited.length) rules.push({ rule: "open_hours", status: "not_checked", dataGap: true, detail: "no opening hours known for these places" });
    else if (unknown) rules.push({ rule: "open_hours", status: "partial", dataGap: true, detail: `${unknown} of ${visited.length} places have no opening hours` });
    else rules.push({ rule: "open_hours", status: "met" });
  }

  // The walker's own windows per stop.
  const timed = i.stops.filter((s) => i.plans?.[s.id]?.arriveAfter || i.plans?.[s.id]?.arriveBefore);
  if (timed.length) {
    const bad: string[] = [];
    for (const s of timed) {
      const a = byId.get(s.id)!;
      const arrive = i.startAt + a.arriveMin * MIN;
      const after = i.plans?.[s.id]?.arriveAfter ? localTimeOnDay(i.plans![s.id].arriveAfter!, tz, i.startAt) : null;
      const before = i.plans?.[s.id]?.arriveBefore ? localTimeOnDay(i.plans![s.id].arriveBefore!, tz, i.startAt) : null;
      if (after !== null && arrive < after) bad.push(`${s.name}: arrives ${clockOf(a.arriveMin)}, wanted after ${i.plans![s.id].arriveAfter}`);
      if (before !== null && arrive > before) bad.push(`${s.name}: arrives ${clockOf(a.arriveMin)}, wanted before ${i.plans![s.id].arriveBefore}`);
    }
    rules.push(bad.length ? { rule: "stop_time", status: "not_met", value: bad.length, detail: bad.join("; ") } : { rule: "stop_time", status: "met" });
  }

  if (i.endBy) {
    const raw = localTimeOnDay(i.endBy, tz, i.startAt);
    // "by 00:30" after a 21:00 start means the next night.
    const limit = raw !== null && raw < i.startAt ? raw + 24 * 60 * MIN : raw;
    if (limit === null) rules.push({ rule: "end_by", status: "not_checked", detail: `could not read "${i.endBy}"` });
    else {
      const end = i.startAt + i.timeline.totalMin * MIN;
      rules.push({ rule: "end_by", status: end <= limit ? "met" : "not_met", value: Math.round((end - i.startAt) / MIN), limit: Math.round((limit - i.startAt) / MIN), detail: `ends ${clockOf(i.timeline.totalMin)}, by ${i.endBy}` });
    }
  }

  for (const meal of i.meals ?? []) {
    const from = localTimeOnDay(meal.from, tz, i.startAt);
    const rawTo = localTimeOnDay(meal.to, tz, i.startAt);
    // A window that crosses midnight ends on the next day.
    const to = rawTo !== null && from !== null && rawTo < from ? rawTo + 24 * 60 * MIN : rawTo;
    if (from === null || to === null) {
      rules.push({ rule: "meal", status: "not_checked", detail: `could not read ${meal.from}-${meal.to}` });
      continue;
    }
    const walkEnd = i.startAt + i.timeline.totalMin * MIN;
    if (walkEnd < from || i.startAt > to) {
      rules.push({ rule: "meal", status: "met", detail: `the walk does not overlap ${meal.from}-${meal.to}` });
      continue;
    }
    const ok = i.stops.some((s) => {
      const a = byId.get(s.id);
      if (!a || s.category !== "food") return false;
      return i.startAt! + a.arriveMin * MIN <= to && i.startAt! + a.leaveMin * MIN >= from && a.leaveMin - a.arriveMin >= meal.minutes;
    });
    rules.push(ok ? { rule: "meal", status: "met", detail: `${meal.from}-${meal.to}` } : { rule: "meal", status: "not_met", detail: `no food stop of ${meal.minutes} min inside ${meal.from}-${meal.to}` });
  }
  return rules;
}
