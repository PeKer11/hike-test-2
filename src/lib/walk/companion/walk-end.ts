import {
  persistWalkEnd,
  type PaceByEnv,
  type WalkEndInput,
} from "@/lib/preferences/companion-memory";
import type { HabitWalkEnd } from "@/lib/preferences/routine-habits";
import type { DiscoveryItem, WalkEnvironment } from "@/lib/types/discovery";

import { interactionsFromItems, questionEntries } from "./companion-glue";
import type { AskRecord } from "./companion-types";

export interface WalkEndFacts {
  learnPreferences: boolean;
  startedAtMs: number;
  plannedMin: number;
  actualMin: number;
  distanceM: number;
  environment: WalkEnvironment;
  stopsPlanned: number;
  stopsVisited: number;
  records: AskRecord[];
  collapseCount: number;
  items: DiscoveryItem[];
  /** Measured active pace, min/km, or null when unknown. */
  paceMinPerKm: number | null;
  /** Routine-habit evidence; set only when `learningConsent === "granted"`. */
  habits?: HabitWalkEnd | null;
}

/**
 * What a finished walk writes. One environment for the whole walk (the
 * collection's classification), which is coarse; `updatePaceByEnv` ignores a
 * walk with less than 10 active minutes.
 */
export function buildWalkEndInput(f: WalkEndFacts): WalkEndInput {
  return {
    learnPreferences: f.learnPreferences,
    startedAtMs: f.startedAtMs,
    areaLabel: null,
    plannedMin: f.plannedMin,
    actualMin: f.actualMin,
    distanceM: f.distanceM,
    envMinutes: { [f.environment]: Math.max(0, f.actualMin) },
    stopsPlanned: f.stopsPlanned,
    stopsVisited: f.stopsVisited,
    questions: questionEntries(f.records),
    collapseCount: f.collapseCount,
    paceSamples:
      f.paceMinPerKm !== null
        ? [{ env: f.environment, activeMinutes: f.actualMin, minPerKm: f.paceMinPerKm }]
        : [],
    interactions: interactionsFromItems(f.items),
    habits: f.habits ?? null,
  };
}

/**
 * Writes the walk summary with the signed-in browser session. Consent-gated
 * twice (here and inside `persistWalkEnd`); any failure is swallowed, since a
 * finished walk must never show an error for a memory write.
 */
export async function persistWalkEndFromBrowser(
  input: WalkEndInput,
  sessionCount: number,
  paceByEnv: PaceByEnv,
): Promise<boolean> {
  if (input.learnPreferences !== true) return false;
  try {
    const { createClient } = await import("@/lib/supabase/client");
    const client = createClient();
    const { data } = await client.auth.getUser();
    if (!data.user) return false;
    return await persistWalkEnd(client, data.user.id, input, sessionCount, paceByEnv);
  } catch {
    return false;
  }
}
