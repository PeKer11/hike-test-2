import {
  activeBinsForSpan,
  binOfMinute,
  HABITS,
  localTimeOf,
  TOO_EARLY_WINDOW_MIN,
  type AnswerEvent,
  type Habit,
  type HabitAnswer,
  type WalkObservation,
} from "@/lib/preferences/habit-model";
import type { HabitWalkEnd } from "@/lib/preferences/routine-habits";
import type { Attraction, Coordinates } from "@/lib/types";
import { haversineDistance } from "@/lib/utils/geo";

import type { AskRecord } from "./companion-types";

/**
 * Turns a finished walk into habit evidence: which local 30-minute bins the
 * walker was active in (opportunities) and when the first food/coffee event was
 * (success). Pure; the dwell tracker below is the only state, and it is plain
 * data fed with fix timestamps. Numbers only: no positions leave this file.
 */

/** A fix this close to a food place counts as being at it. */
export const FOOD_DWELL_RADIUS_M = 60;
/** ...for at least this long, so walking past a cafe is not "having coffee". */
export const FOOD_DWELL_MIN = 8;

export interface FoodEvent {
  habit: Habit;
  /** Epoch ms when the walker arrived at the place. */
  atMs: number;
}

/** Which habit a place serves: cafes are coffee; restaurants and fast food are eating; bars are neither. */
export function habitOfAttraction(a: Attraction): Habit | null {
  const amenity = a.tags?.amenity;
  if (amenity === "cafe") return "coffee";
  if (amenity === "restaurant" || amenity === "fast_food" || amenity === "food_court") return "eat";
  if (amenity === "bar" || amenity === "pub") return null;
  return a.category === "food" ? "eat" : null;
}

/** Detects dwells at food places from the accepted-fix stream. One event per place. */
export class FoodDwellTracker {
  private since = new Map<string, number>();
  private fired = new Set<string>();
  private out: FoodEvent[] = [];

  update(position: Coordinates, nowMs: number, places: Attraction[]): void {
    if (!Number.isFinite(nowMs)) return;
    const near = new Set<string>();
    for (const p of places) {
      const habit = habitOfAttraction(p);
      if (!habit || this.fired.has(p.id)) continue;
      if (haversineDistance(position, p.coordinates) > FOOD_DWELL_RADIUS_M) continue;
      near.add(p.id);
      const start = this.since.get(p.id) ?? nowMs;
      this.since.set(p.id, start);
      if (nowMs - start >= FOOD_DWELL_MIN * 60_000) {
        this.fired.add(p.id);
        this.out.push({ habit, atMs: start });
      }
    }
    for (const id of [...this.since.keys()]) if (!near.has(id)) this.since.delete(id);
  }

  get events(): readonly FoodEvent[] {
    return this.out;
  }

  reset(): void {
    this.since.clear();
    this.fired.clear();
    this.out = [];
  }
}

/** Israel's coarse envelope. Outside it the device zone is used (tourists arrive with a home-zone phone). */
export function resolveTimeZone(
  position: Coordinates | null,
  deviceTimeZone: string | null,
): string {
  if (
    position &&
    position.lat >= 29.4 &&
    position.lat <= 33.4 &&
    position.lng >= 34.2 &&
    position.lng <= 36.0
  ) {
    return "Asia/Jerusalem";
  }
  return deviceTimeZone || "Asia/Jerusalem";
}

export interface HabitWalkFacts {
  startedAtMs: number;
  actualMin: number;
  timeZone: string;
  records: AskRecord[];
  foodEvents: readonly FoodEvent[];
}

const ANSWER_IDS: ReadonlySet<string> = new Set(["take-me", "already", "not-now"]);

function habitOfKind(kind: AskRecord["kind"]): Habit | null {
  return kind === "habit-eat" ? "eat" : kind === "habit-coffee" ? "coffee" : null;
}

/** Null when the walk says nothing (no local time, no active bin, no event). */
export function buildHabitWalkEnd(f: HabitWalkFacts): HabitWalkEnd | null {
  const start = localTimeOf(f.startedAtMs, f.timeZone);
  if (!start) return null;
  const endMs = f.startedAtMs + Math.max(0, f.actualMin) * 60_000;
  const activeBins = activeBinsForSpan(f.startedAtMs, endMs, f.timeZone);

  const binAt = (ms: number): number | null => {
    const t = localTimeOf(ms, f.timeZone);
    return t ? binOfMinute(t.minuteOfDay) : null;
  };

  const observations: WalkObservation[] = [];
  const answers: AnswerEvent[] = [];
  for (const habit of HABITS) {
    const times: number[] = f.foodEvents.filter((e) => e.habit === habit).map((e) => e.atMs);
    for (const r of f.records) {
      if (habitOfKind(r.kind) !== habit) continue;
      const answer: HabitAnswer =
        r.outcome === "ignored" || !r.answerId || !ANSWER_IDS.has(r.answerId)
          ? "timeout"
          : (r.answerId as HabitAnswer);
      // The ask itself is a food event when the walker took it or already had it.
      if (answer === "take-me" || answer === "already") times.push(r.askedAt);
      const bin = binAt(r.askedAt);
      if (bin === null) continue;
      answers.push({
        habit,
        dayType: localTimeOf(r.askedAt, f.timeZone)?.dayType ?? start.dayType,
        answer,
        bin,
        askedAtMs: r.askedAt,
        ...(answer === "not-now"
          ? {
              visitedFoodWithin30Min: f.foodEvents.some(
                (e) =>
                  e.habit === habit &&
                  e.atMs > r.askedAt &&
                  e.atMs - r.askedAt <= TOO_EARLY_WINDOW_MIN * 60_000,
              ),
            }
          : {}),
      });
    }
    const first = times.length > 0 ? Math.min(...times.filter(Number.isFinite)) : null;
    const firstEventBin = first !== null && Number.isFinite(first) ? binAt(first) : null;
    if (activeBins.length === 0 && firstEventBin === null) continue;
    observations.push({
      habit,
      dayType: start.dayType,
      activeBins,
      firstEventBin,
      epochDay: start.epochDay,
    });
  }
  return observations.length === 0
    ? null
    : { startedAtMs: f.startedAtMs, observations, answers };
}
