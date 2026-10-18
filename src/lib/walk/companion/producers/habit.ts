import { inAskWindow, type DayType, type Habit, type HabitEstimate } from "@/lib/preferences/habit-model";
import { companionText } from "@/lib/walk/companion-copy";
import type { CopyLang } from "@/lib/walk/discovery-copy";

import type { AmenityPick } from "../amenity-detour";
import type { AmenityKind, Candidate, QuestionKind } from "../companion-types";

/** Routine suggestions across all habits, per rolling week. */
export const MAX_WEEKLY_HABIT_ASKS = 4;
const TTL_MS = 90_000;
const MAX_VALUE = 0.9;

const KIND: Record<Habit, { question: QuestionKind; amenity: AmenityKind; already: string }> = {
  eat: { question: "habit-eat", amenity: "food", already: "answer.habitAlreadyEat" },
  coffee: { question: "habit-coffee", amenity: "cafe", already: "answer.habitAlreadyCoffee" },
};

export interface HabitProducerInput {
  habit: Habit;
  /** From `peakEstimate`; null = not established. */
  estimate: HabitEstimate | null;
  /** Local minutes since midnight at the walk location. */
  localMinute: number;
  dayType: DayType;
  /** A food stop was visited/added in the last 2 h of this walk. */
  alreadyDoneThisWalk: boolean;
  /** `pickAmenity(kind food|cafe)`: a real, offerable place ahead on the route. */
  amenity: AmenityPick | null;
  /** A habit question was already asked this walk (once per walk, any habit). */
  askedThisWalk: boolean;
  /** Muted (30 days after 3 declines) or inside the decline-streak minimum gap. */
  muted: boolean;
  /** Habit questions asked in the last 7 days, all habits together. */
  weeklyAsks: number;
  lang: CopyLang;
  nowMs: number;
}

/**
 * A fixed-template routine question ("around the time you usually eat"). Never an
 * LLM, and never without an actionable place: we do not ask "want to eat?"
 * without an answer to "where?". Null unless every gate passes.
 */
export function habitCandidate(input: HabitProducerInput): Candidate | null {
  const { estimate, amenity } = input;
  if (!estimate || estimate.habit !== input.habit) return null;
  if (input.muted || input.askedThisWalk || input.alreadyDoneThisWalk) return null;
  if (!(input.weeklyAsks < MAX_WEEKLY_HABIT_ASKS)) return null;
  if (!Number.isFinite(input.localMinute) || !inAskWindow(estimate, input.localMinute)) return null;
  const k = KIND[input.habit];
  if (!amenity || amenity.item.kind !== k.amenity) return null;
  const value = Math.min(MAX_VALUE, estimate.mean);
  if (!(value > 0)) return null;
  const place = amenity.item.name?.trim() || companionText(input.lang, "habit.somePlace");
  return {
    kind: k.question,
    urgency: 1,
    value,
    answers: [
      {
        id: "take-me",
        label: "answer.habitTakeMe",
        operator: { op: "find-amenity", kind: k.amenity },
      },
      { id: "already", label: k.already, operator: { op: "dismiss" } },
      { id: "not-now", label: "answer.notNow", operator: { op: "dismiss" } },
    ],
    expiresAtMs: input.nowMs + TTL_MS,
    context: { place, d: Math.round(amenity.distM), habit: input.habit },
  };
}
