import {
  BIN_MINUTES,
  binLabel,
  isMuted,
  localTimeOf,
  mod,
  peakEstimate,
  type Habit,
  type HabitState,
} from "@/lib/preferences/habit-model";
import type { Attraction, AttractionCategory } from "@/lib/types";
import { habitOfAttraction, resolveTimeZone } from "@/lib/walk/companion/habit-walk-end";

/**
 * Plan-time routine hints (plan 2.5): "you usually eat around 16:00, add a food
 * stop?" as a chip, zero interruption cost. Fixed EN/HE templates filled with a
 * clock label and nothing else; never an LLM, and the habit state is read from
 * the walker's own rows only after the caller has checked the learning consent.
 */

export interface HabitHint {
  habit: Habit;
  /** "HH:MM" of the habit's peak bin, local to the walk. */
  localTime: string;
  confidence: "high" | "medium";
  text: { en: string; he: string };
}

/** A mean at or above this reads as "high" confidence. */
export const HIGH_CONFIDENCE_MEAN = 0.7;

const MINUTES_PER_DAY = 1440;

const TEMPLATES: Record<Habit, { en: (t: string) => string; he: (t: string) => string }> = {
  eat: {
    en: (t) => `You usually eat around ${t}. Add a food stop then?`,
    he: (t) => `בדרך כלל אתם אוכלים בסביבות ${t}. להוסיף עצירת אוכל?`,
  },
  coffee: {
    en: (t) => `You usually have coffee around ${t}. Add a coffee stop then?`,
    he: (t) => `בדרך כלל אתם שותים קפה בסביבות ${t}. להוסיף עצירת קפה?`,
  },
};

export interface HabitHintInput {
  habits: HabitState;
  /** Planned start, epoch ms. */
  startMs: number;
  availableMinutes: number;
  /** IANA zone of the walk; an unknown zone yields no hints. */
  timeZone: string;
  /** Habits the walker already asked for in words (a food/cafe stop is in the plan). */
  skip?: ReadonlySet<Habit>;
}

/** Hints for established habits whose peak falls inside the walk's time span. */
export function buildHabitHints(input: HabitHintInput): HabitHint[] {
  const { habits, startMs, availableMinutes, timeZone } = input;
  if (!Array.isArray(habits) || habits.length === 0) return [];
  if (!Number.isFinite(availableMinutes) || availableMinutes <= 0) return [];
  const local = localTimeOf(startMs, timeZone);
  if (!local) return [];
  const span = Math.min(availableMinutes, MINUTES_PER_DAY - BIN_MINUTES);

  const found: Array<{ rel: number; hint: HabitHint }> = [];
  for (const habit of ["eat", "coffee"] as const) {
    if (input.skip?.has(habit)) continue;
    if (isMuted(habits, habit, startMs)) continue;
    const est = peakEstimate(habits, habit, local.dayType);
    if (!est) continue;
    const rel = mod(est.bin * BIN_MINUTES - local.minuteOfDay, MINUTES_PER_DAY);
    if (rel > span) continue;
    const t = binLabel(est.bin);
    found.push({
      rel,
      hint: {
        habit,
        localTime: t,
        confidence: est.mean >= HIGH_CONFIDENCE_MEAN ? "high" : "medium",
        text: { en: TEMPLATES[habit].en(t), he: TEMPLATES[habit].he(t) },
      },
    });
  }
  return found.sort((a, b) => a.rel - b.rel).map((f) => f.hint);
}

/**
 * The hints for a freshly built plan. The caller passes habits only for a
 * signed-in walker with the learning consent. Nothing when the walker already
 * asked for food in words, or the plan already holds a stop of that kind.
 * `clientTimeZone` is untrusted: an unknown zone just yields no hints.
 */
export function planTimeHabitHints(args: {
  habits: HabitState | undefined;
  nowMs: number;
  availableMinutes: number;
  origin: { lat: number; lng: number };
  clientTimeZone: unknown;
  requestedCategories: readonly AttractionCategory[] | undefined;
  planned: readonly Attraction[];
}): HabitHint[] {
  if (!args.habits || args.habits.length === 0) return [];
  const skip = new Set<Habit>();
  if (args.requestedCategories?.includes("food")) {
    skip.add("eat");
    skip.add("coffee");
  }
  for (const a of args.planned) {
    const h = habitOfAttraction(a);
    if (h) skip.add(h);
  }
  const tz = resolveTimeZone(
    args.origin,
    typeof args.clientTimeZone === "string" && args.clientTimeZone.length <= 64
      ? args.clientTimeZone
      : null,
  );
  return buildHabitHints({
    habits: args.habits,
    startMs: args.nowMs,
    availableMinutes: args.availableMinutes,
    timeZone: tz,
    skip,
  });
}
