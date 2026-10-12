import type { Candidate } from "../companion-types";

export interface ConditionsSnapshot {
  apparentTempC: number | null;
  /** Probability (0-100) of rain within the next hour. */
  precipProbabilityPct: number | null;
}

export interface WaterOption {
  name: string;
  distM: number;
}

export const HEAT_THRESHOLD_C = 33;
/** At or above this apparent temperature the water question is a safety one (urgency 3). */
export const HEAT_SAFETY_C = 36;
export const RAIN_THRESHOLD_PCT = 70;
const TTL_MS = 90_000;

/** heat value = 0.6 + 0.1 x (T - 33) at or above 33 C, capped at 1. Needs water that passes the detour rule. */
export function heatCandidate(
  c: ConditionsSnapshot,
  water: WaterOption | null,
  nowMs: number,
): Candidate | null {
  const t = c.apparentTempC;
  if (t === null || !Number.isFinite(t) || t < HEAT_THRESHOLD_C || !water) return null;
  return {
    kind: "heat-water",
    urgency: t >= HEAT_SAFETY_C ? 3 : 2,
    value: Math.min(1, 0.6 + 0.1 * (t - HEAT_THRESHOLD_C)),
    answers: [
      {
        id: "take-me",
        label: "answer.takeMe",
        operator: { op: "find-amenity", kind: "drinking_water" },
      },
      { id: "fine", label: "answer.imFine", operator: { op: "dismiss" } },
    ],
    expiresAtMs: nowMs + TTL_MS,
    context: { t: Math.round(t), place: water.name, d: Math.round(water.distM) },
  };
}

export function rainCandidate(c: ConditionsSnapshot, nowMs: number): Candidate | null {
  const p = c.precipProbabilityPct;
  if (p === null || !Number.isFinite(p) || p < RAIN_THRESHOLD_PCT) return null;
  return {
    kind: "rain",
    urgency: 2,
    value: Math.min(1, 0.5 + (p - RAIN_THRESHOLD_PCT) / 60),
    answers: [
      { id: "head-back", label: "answer.headBack", operator: { op: "head-back" } },
      { id: "continue", label: "answer.continue", operator: { op: "dismiss" } },
    ],
    expiresAtMs: nowMs + TTL_MS,
    context: { p: Math.round(p) },
  };
}
