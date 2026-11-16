import type { Coordinates } from "@/lib/types";
import type { WalkPlan } from "@/lib/types/walk-plan";
import type { WalkCompanionInput } from "@/lib/types/walk-companion";

/**
 * A walk in progress, saved on the device so a reload (or a phone that killed the tab) does not end it.
 * Written when a real walk starts and as it moves on; cleared when the walker ends it.
 */
export interface ActiveWalkSnapshot {
  plan: WalkPlan;
  geometry: Coordinates[];
  input: WalkCompanionInput;
  visitedIds: string[];
  startedAt: number;
  lastFix: Coordinates | null;
  savedAt: number;
}

export const ACTIVE_WALK_KEY = "traike.activeWalk.v1";
/** Older than this, a snapshot is a walk someone abandoned, not one to continue. */
export const ACTIVE_WALK_MAX_AGE_MS = 2 * 60 * 60_000;

export function saveActiveWalk(snapshot: Omit<ActiveWalkSnapshot, "savedAt">, now = Date.now()): void {
  try {
    localStorage.setItem(ACTIVE_WALK_KEY, JSON.stringify({ ...snapshot, savedAt: now }));
  } catch {
    // Storage blocked or full: the walk itself carries on, it just cannot be resumed.
  }
}

export function loadActiveWalk(now = Date.now()): ActiveWalkSnapshot | null {
  try {
    const raw = localStorage.getItem(ACTIVE_WALK_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Partial<ActiveWalkSnapshot>;
    const usable =
      s &&
      typeof s.savedAt === "number" &&
      now - s.savedAt <= ACTIVE_WALK_MAX_AGE_MS &&
      s.plan &&
      Array.isArray(s.plan.orderedAttractions) &&
      Array.isArray(s.geometry) &&
      s.geometry.length >= 2 &&
      s.input &&
      Array.isArray(s.visitedIds);
    if (!usable) {
      clearActiveWalk();
      return null;
    }
    return s as ActiveWalkSnapshot;
  } catch {
    return null;
  }
}

export function clearActiveWalk(): void {
  try {
    localStorage.removeItem(ACTIVE_WALK_KEY);
  } catch {
    // Nothing to clear.
  }
}
