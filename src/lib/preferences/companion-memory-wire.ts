import type { SupabaseClient } from "@supabase/supabase-js";

import {
  loadCompanionMemory,
  sanitizePaceByEnv,
  type CompanionMemory,
  type InteractionRow,
  type PaceByEnv,
} from "@/lib/preferences/companion-memory";
import type { HabitState } from "@/lib/preferences/habit-model";
import { sanitizeHabitRows } from "@/lib/preferences/routine-habits";
import type { AskPriors } from "@/lib/walk/companion/companion-types";

/**
 * What `/api/walk-plan` hands the client for the walker's own standing memory
 * (numeric signals only, consent-gated upstream). Treated as untrusted on the
 * way in: `parseMemoryWire` re-validates every field.
 */
export interface CompanionMemoryWire {
  sessionCount: number;
  paceByEnv: PaceByEnv;
  interactions: InteractionRow[];
  priors: AskPriors;
  /** Routine habits, for the on-device habit producer. Never sent to an LLM. */
  habits: HabitState;
}

/** Keeps the payload small: the most recent interactions only. */
export const MAX_WIRE_INTERACTIONS = 400;

const KINDS = new Set(["visited", "dismissed", "declined_detour", "added", "offered"]);
const QUESTION_KINDS = [
  "pace-slow",
  "pace-fast",
  "toward-green",
  "sunset",
  "heat-water",
  "rest",
  "stop-closing",
  "rain",
  "habit-eat",
  "habit-coffee",
] as const;

export function toMemoryWire(mem: CompanionMemory): CompanionMemoryWire {
  return {
    sessionCount: mem.sessionCount,
    paceByEnv: mem.paceByEnv,
    interactions: [...mem.interactions]
      .sort((a, b) => b.last_session - a.last_session)
      .slice(0, MAX_WIRE_INTERACTIONS),
    priors: mem.priors,
    habits: mem.habits ?? [],
  };
}

function nonNegInt(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
}

/** Null for anything that is not an object; field-level garbage is dropped, not trusted. */
export function parseMemoryWire(raw: unknown): CompanionMemoryWire | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const interactions = (Array.isArray(r.interactions) ? r.interactions : [])
    .filter(
      (i): i is InteractionRow =>
        typeof i === "object" &&
        i !== null &&
        typeof (i as InteractionRow).poi_key === "string" &&
        KINDS.has((i as InteractionRow).kind) &&
        Number.isFinite((i as InteractionRow).last_session) &&
        Number.isFinite((i as InteractionRow).count),
    )
    .slice(0, MAX_WIRE_INTERACTIONS);
  const priors: AskPriors = {};
  const rawPriors = (typeof r.priors === "object" && r.priors !== null ? r.priors : {}) as Record<
    string,
    { asked?: unknown; answered?: unknown }
  >;
  for (const kind of QUESTION_KINDS) {
    const p = rawPriors[kind];
    if (!p) continue;
    const asked = nonNegInt(p.asked);
    priors[kind] = { asked, answered: Math.min(asked, nonNegInt(p.answered)) };
  }
  return {
    sessionCount: nonNegInt(r.sessionCount),
    paceByEnv: sanitizePaceByEnv(r.paceByEnv),
    interactions,
    priors,
    habits: sanitizeHabitRows(r.habits),
  };
}

/** Consent-gated: null without consent, without a profile, or on any failure. */
export async function loadMemoryWire(
  client: SupabaseClient,
  userId: string,
  learnPreferences: boolean,
): Promise<CompanionMemoryWire | null> {
  try {
    const mem = await loadCompanionMemory(client, userId, learnPreferences);
    return mem ? toMemoryWire(mem) : null;
  } catch {
    return null;
  }
}
