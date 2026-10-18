import {
  askBlocked,
  localTimeOf,
  peakEstimate,
  type Habit,
  type HabitState,
} from "@/lib/preferences/habit-model";
import type { Coordinates } from "@/lib/types";
import type { DiscoveryItem, WalkEnvironment } from "@/lib/types/discovery";
import type { CopyLang } from "@/lib/walk/discovery-copy";

import { pickAmenity, type AmenityItem } from "./amenity-detour";
import type { AskRecord, Candidate } from "./companion-types";
import { habitOfAttraction } from "./habit-walk-end";
import { habitCandidate } from "./producers/habit";

/**
 * Feeds the routine-habit producer from what the screen already knows. Pure.
 * Everything here runs on the device from the walker's own habit rows; none of
 * it is ever put in front of an LLM (the producer asks fixed-template questions).
 */

/** A food stop visited/added in the last 2 h counts as "already done". */
export const DONE_WINDOW_MS = 2 * 3_600_000;

/** What the screen hands the ticker for habits; null/absent without learning consent. */
export interface HabitTickFacts {
  habits: HabitState;
  /** IANA zone of the walk location (`resolveTimeZone`). */
  timeZone: string;
  /** Food-dwell events of this walk (`FoodDwellTracker.events`). */
  foodEvents: ReadonlyArray<{ habit: Habit; atMs: number }>;
}

/** The two facts only the hook knows, added per tick. */
export interface HabitTickExtras {
  /** Habit questions shown in the last 7 days, all habits together. */
  weeklyAsks: number;
  /** A habit question was already shown this walk (any habit). */
  askedThisWalk: boolean;
}

export const HABIT_AMENITY: Record<Habit, "food" | "cafe"> = { eat: "food", coffee: "cafe" };

/**
 * Food and cafe places from the discovery items as amenity items, so the
 * producer can pick one ahead and the "take me" answer can route to it. A
 * satellite-detected item is never one; visited and dismissed places are not offered.
 */
export function foodAmenityItems(items: DiscoveryItem[]): AmenityItem[] {
  const out: AmenityItem[] = [];
  for (const item of items) {
    if (item.tier === "detected") continue;
    if (item.state === "dismissed" || item.state === "visited") continue;
    const habit = habitOfAttraction(item.attraction);
    if (!habit) continue;
    out.push({
      id: item.id,
      kind: HABIT_AMENITY[habit],
      name: item.attraction.name,
      coordinates: item.attraction.coordinates,
      lateralM: item.frame?.lateralM ?? null,
      alongM: item.frame?.alongM ?? null,
    });
  }
  return out;
}

/** Habits with a food stop already visited/added (or dwelt at) in the last 2 h. */
export function habitsDoneThisWalk(
  items: DiscoveryItem[],
  foodEvents: HabitTickFacts["foodEvents"],
  nowMs: number,
): Set<Habit> {
  const done = new Set<Habit>();
  for (const e of foodEvents) {
    if (Number.isFinite(e.atMs) && nowMs - e.atMs <= DONE_WINDOW_MS) done.add(e.habit);
  }
  // Items carry no timestamp: a place visited or added this walk counts.
  for (const item of items) {
    if (item.state !== "visited" && item.state !== "added") continue;
    const habit = habitOfAttraction(item.attraction);
    if (habit) done.add(habit);
  }
  return done;
}

export function askedHabitQuestion(records: readonly AskRecord[]): boolean {
  return records.some((r) => r.kind === "habit-eat" || r.kind === "habit-coffee");
}

export interface HabitCandidatesInput {
  facts: HabitTickFacts;
  extras: HabitTickExtras;
  items: DiscoveryItem[];
  amenities: AmenityItem[];
  position: Coordinates;
  environment: WalkEnvironment;
  speedMpm: number;
  remainingWalkMin: number;
  walkerAlongM: number | null;
  nowMs: number;
  lang: CopyLang;
}

/** The routine questions worth considering now (each already fully gated by the producer). */
export function habitCandidates(i: HabitCandidatesInput): Candidate[] {
  const { facts } = i;
  if (facts.habits.length === 0) return [];
  const local = localTimeOf(i.nowMs, facts.timeZone);
  if (!local) return [];
  const done = habitsDoneThisWalk(i.items, facts.foodEvents, i.nowMs);
  const out: Candidate[] = [];
  for (const habit of ["eat", "coffee"] as const) {
    const estimate = peakEstimate(facts.habits, habit, local.dayType);
    if (!estimate) continue;
    const amenity = pickAmenity({
      items: i.amenities,
      kind: HABIT_AMENITY[habit],
      position: i.position,
      environment: i.environment,
      speedMpm: i.speedMpm,
      remainingWalkMin: i.remainingWalkMin,
      walkerAlongM: i.walkerAlongM,
    });
    const c = habitCandidate({
      habit,
      estimate,
      localMinute: local.minuteOfDay,
      dayType: local.dayType,
      alreadyDoneThisWalk: done.has(habit),
      amenity,
      askedThisWalk: i.extras.askedThisWalk,
      muted: askBlocked(facts.habits, habit, i.nowMs),
      weeklyAsks: i.extras.weeklyAsks,
      lang: i.lang,
      nowMs: i.nowMs,
    });
    if (c) out.push(c);
  }
  return out;
}
