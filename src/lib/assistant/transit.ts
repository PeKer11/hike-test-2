import { planTransit, TRANSIT_ATTRIBUTION, TransitDisabledError } from "@/lib/api/transit-client";
import { formatClock, tzOffsetMin } from "@/lib/walk/clock";
import type { Coordinates } from "@/lib/types";
import type { Verdict } from "@/lib/walk/rule-verdict";
import { zoneOf, type WalkParams } from "./state";

/** The ride back from where the walk ends to the start. Adds the rule and the extra minutes; never throws. */
export async function withTransitBack(verdict: Verdict, endAt: Coordinates, origin: Coordinates, params: WalkParams, ride = planTransit): Promise<Verdict> {
  if (!params.transit?.back || verdict.unavailable) return verdict;
  const startAt = params.startAt && params.startAt > Date.now() - 6 * 3600000 ? params.startAt : undefined;
  const rule = (r: Verdict["rules"][number]): Verdict => ({ ...verdict, rules: [...verdict.rules, r], ok: verdict.ok && r.status === "met", broken: verdict.broken || r.status === "not_met" });
  if (params.endDistanceKm === 0) return rule({ rule: "transit", status: "not_met", detail: "a loop already brings the walker back to the start: a ride home conflicts with it" });
  if (startAt === undefined) return rule({ rule: "transit", status: "not_checked", dataGap: true, detail: "the start time is not known, so the timetable was not checked" });
  const walkEnd = startAt + verdict.totalMin * 60000;
  try {
    const leg = await ride(endAt, origin, walkEnd);
    if (!leg) return rule({ rule: "transit", status: "not_met", detail: `no public transport found from the end of the walk back to the start after ${hhmm(walkEnd, params, startAt)}` });
    const extra = Math.round((leg.arriveMs - walkEnd) / 60000);
    const r: Verdict["rules"][number] = {
      rule: "transit",
      status: "met",
      value: extra,
      detail: `${leg.lines.join(" + ") || "transit"} leaves ${hhmm(leg.departMs, params, startAt)}, back at the start ${hhmm(leg.arriveMs, params, startAt)} (${extra} min after the walk ends, waiting included). Timetable data, no live delays. ${TRANSIT_ATTRIBUTION}`,
    };
    return { ...rule(r), transitMin: extra };
  } catch (err) {
    if (err instanceof TransitDisabledError) return rule({ rule: "transit", status: "not_checked", dataGap: true, detail: "public transport timetables are not available in the app yet, so the ride home was not checked" });
    return rule({ rule: "transit", status: "not_checked", dataGap: true, detail: "the public transport service did not answer" });
  }
}

function hhmm(ms: number, params: WalkParams, startAt: number): string {
  return formatClock(ms, (zoneOf(params) ? tzOffsetMin(zoneOf(params)!, startAt) : null) ?? 0);
}
