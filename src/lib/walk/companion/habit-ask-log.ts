/**
 * The rolling 7-day count of routine questions the walker was shown, kept in
 * this browser only (the producer caps them at 4 a week). Hour-truncated times,
 * no kinds, no places; never sent anywhere. Every storage access is guarded:
 * a blocked or full storage just means "no history".
 */

export const HABIT_ASK_KEY = "traike.habitAsks.v1";
export const WEEK_MS = 7 * 86_400_000;
const HOUR_MS = 3_600_000;
const MAX_KEPT = 50;

/** Valid, in-window, newest last. */
export function recentAsks(raw: unknown, nowMs: number): number[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((t): t is number => typeof t === "number" && Number.isFinite(t))
    .filter((t) => nowMs - t < WEEK_MS && t <= nowMs + HOUR_MS)
    .sort((a, b) => a - b)
    .slice(-MAX_KEPT);
}

export function countWeeklyAsks(raw: unknown, nowMs: number): number {
  return recentAsks(raw, nowMs).length;
}

export function withAsk(raw: unknown, nowMs: number): number[] {
  return [...recentAsks(raw, nowMs), Math.floor(nowMs / HOUR_MS) * HOUR_MS].slice(-MAX_KEPT);
}

export function loadHabitAsks(storage?: Pick<Storage, "getItem">): unknown {
  try {
    const s = storage ?? (typeof localStorage !== "undefined" ? localStorage : null);
    const raw = s?.getItem(HABIT_ASK_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function recordHabitAsk(nowMs: number, storage?: Pick<Storage, "getItem" | "setItem">): void {
  try {
    const s = storage ?? (typeof localStorage !== "undefined" ? localStorage : null);
    if (!s) return;
    s.setItem(HABIT_ASK_KEY, JSON.stringify(withAsk(loadHabitAsks(s), nowMs)));
  } catch {
    // Quota or blocked storage: the weekly cap just sees no history.
  }
}
