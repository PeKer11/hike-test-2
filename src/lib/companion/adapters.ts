/**
 * Thin adapters over the EXISTING pure functions (plan §3.4). Each wraps one
 * function and adds nothing: the logic and its tests stay where they are.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  loadCompanionMemory,
  persistWalkEnd,
} from "@/lib/preferences/companion-memory";
import {
  binOfMinute,
  estimateForBin,
} from "@/lib/preferences/habit-model";
import {
  foldHabitWalk,
  loadRoutineHabits,
  persistRoutineHabits,
} from "@/lib/preferences/routine-habits";
import {
  getPreferredCategoryWeights,
  getTrendingCategoryCounts,
} from "@/lib/preferences/preference-store";

import { arbiterPolicy } from "./arbiter-policy";
import type {
  CandidateProducer,
  HabitModel,
  MemoryRepository,
  Recommendation,
  Recommender,
  WalkFrame,
} from "./ports";

/** Wrap a candidate function and the frame -> input map that feeds it. */
export function producerOf<F extends WalkFrame, I>(
  id: string,
  fn: (input: I) => ReturnType<CandidateProducer["produce"]>,
  toInput: (frame: F) => I,
): CandidateProducer<F> {
  return { id, produce: (frame) => fn(toInput(frame)) };
}

export { arbiterPolicy };

export const habitModel: HabitModel = {
  estimate: (state, habit, dayType, localMinute) =>
    estimateForBin(state, habit, dayType, binOfMinute(localMinute)),
  foldWalk: foldHabitWalk,
};

/**
 * `learnPreferences` is the consent gate `loadCompanionMemory` already takes;
 * the repository is built per session, after consent is known.
 */
export function supabaseMemoryRepository(
  client: SupabaseClient,
  opts: { learnPreferences: boolean },
): MemoryRepository {
  return {
    loadCompanion: (userId) => loadCompanionMemory(client, userId, opts.learnPreferences),
    saveWalkEnd: (userId, input, s) =>
      persistWalkEnd(client, userId, input, s.currentSession, s.prevPaceByEnv),
    loadHabits: (userId) => loadRoutineHabits(client, userId),
    saveHabitWalk: (userId, walk) => persistRoutineHabits(client, userId, walk),
  };
}

type ServerClient = Parameters<typeof getPreferredCategoryWeights>[0];

/** Scale a category -> number map by its largest value into 0..1. */
function normalised<K>(m: Map<K, number>): Array<[K, number]> {
  let max = 0;
  for (const v of m.values()) if (v > max) max = v;
  if (!(max > 0)) return [];
  return [...m].map(([k, v]) => [k, v / max]);
}

export function personalRecommender(client: ServerClient): Recommender {
  return {
    source: "personal",
    async recommend(q) {
      if (!q.userId) return [];
      const weights = await getPreferredCategoryWeights(client, q.userId);
      return normalised(weights).map(
        ([category, score]): Recommendation => ({ category, score, reason: "personal" }),
      );
    },
  };
}

export function trendingRecommender(client: ServerClient): Recommender {
  return {
    source: "trending",
    async recommend() {
      const counts = await getTrendingCategoryCounts(client);
      return normalised(counts).map(
        ([category, score]): Recommendation => ({ category, score, reason: "trending" }),
      );
    },
  };
}
