/**
 * Type-only ports for the companion (docs/PERSONALIZATION_SOCIAL_PLAN.md §3.2).
 * No runtime code lives here: every port has an adapter over an EXISTING pure
 * function in `adapters.ts`, so the functional core keeps its tests.
 *
 * Deviations from the plan text, each forced by what the existing code looks
 * like (an adapter must be thin, so the port bends, not the function):
 *  - `CandidateProducer` is generic over its frame. Today's producers take
 *    differently shaped inputs; the adapter supplies the frame -> input map.
 *  - `HabitModel` methods take the `HabitState` (the existing functions are
 *    state-in/state-out and the plan's signature omitted it).
 *  - `MemoryRepository.saveWalkEnd` takes the session context
 *    `persistWalkEnd` needs, and habits are saved per walk
 *    (`persistRoutineHabits`), not as a whole state (no such function exists).
 *  - `Recommendation` may be category-level: the personal and trending sources
 *    are category weights today, not POI keys.
 */
import type { AttractionCategory } from "@/lib/types/walk-plan";
import type {
  ArbiterCtx,
  AskHistory,
  Candidate,
} from "@/lib/walk/companion/companion-types";
import type {
  CompanionMemory,
  PaceByEnv,
  WalkEndInput,
} from "@/lib/preferences/companion-memory";
import type {
  DayType,
  Habit,
  HabitEstimate,
  HabitState,
} from "@/lib/preferences/habit-model";
import type { HabitWalkEnd } from "@/lib/preferences/routine-habits";

export interface Clock {
  now(): number;
}

export interface Rng {
  /** [0, 1) */
  next(): number;
}

/** Everything a producer may read on one tick; `nowMs` is the fix time. */
export interface WalkFrame {
  nowMs: number;
}

export interface CandidateProducer<F extends WalkFrame = WalkFrame> {
  /** "pace" | "sunset" | "heat" | "rain" | "habit-eat" | ... */
  readonly id: string;
  produce(frame: F): Candidate | null;
}

export interface AskPolicy {
  choose(
    cands: Candidate[],
    ctx: ArbiterCtx,
    history: AskHistory,
    nowMs: number,
  ): Candidate | null;
}

export interface HabitModel {
  estimate(
    state: HabitState,
    habit: Habit,
    dayType: DayType,
    localMinute: number,
  ): HabitEstimate | null;
  /** Pure: returns the new state. */
  foldWalk(state: HabitState, walk: HabitWalkEnd): HabitState;
}

export interface MemoryRepository {
  loadCompanion(userId: string): Promise<CompanionMemory | null>;
  saveWalkEnd(
    userId: string,
    input: WalkEndInput,
    session: { currentSession: number; prevPaceByEnv: PaceByEnv },
  ): Promise<boolean>;
  loadHabits(userId: string): Promise<HabitState>;
  saveHabitWalk(userId: string, walk: HabitWalkEnd): Promise<boolean>;
}

export type ReasonCode = "personal" | "trending" | "community" | "similar";

export interface RecQuery {
  /** Only the sources that need it (personal) read this. */
  userId?: string;
  poiKeys?: string[];
}

export interface Recommendation {
  /** Absent for category-level sources (personal, trending). */
  poiKey?: string;
  category?: AttractionCategory;
  /** 0..1, normalised per source. */
  score: number;
  /** An enum -> fixed template; never free text. */
  reason: ReasonCode;
  /** Never an exact count. */
  supportersBucket?: "5+" | "10+" | "25+";
}

export interface Recommender {
  readonly source: ReasonCode;
  recommend(q: RecQuery): Promise<Recommendation[]>;
}
