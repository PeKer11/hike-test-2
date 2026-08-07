/**
 * What the app is allowed to do when the walker's pace has drifted far enough
 * from the plan to matter.
 *
 *   auto — rebuild the route silently, which is what the old single
 *          `paceCheckEnabled` flag did in both directions.
 *   ask  — raise the question and wait. Nothing is rebuilt without an answer.
 *   off  — say nothing. The walker keeps the route they started on.
 */
export type PaceResponseMode = "auto" | "ask" | "off";

export const PACE_RESPONSE_MODES: readonly PaceResponseMode[] = [
  "auto",
  "ask",
  "off",
];

export interface WalkSettings {
  /**
   * Walking faster than planned and walking slower than planned are separate
   * settings because they are separate situations: running late is a problem
   * to be fixed, while being ahead is spare time the walker may simply want to
   * keep. Wanting a silent rebuild for one and silence for the other is an
   * ordinary preference, and a single flag could not express it.
   */
  fastPaceMode: PaceResponseMode;
  slowPaceMode: PaceResponseMode;
  /**
   * After a pace-triggered rebuild, whether live GPS tracking picks straight up
   * on the new route or the walker is handed the plan to start themselves.
   * Separate from the modes above because it answers a different question: those
   * decide whether the route changes at all, this decides whether the walker
   * gets to look at the change before they are walking it.
   */
  autoResumeAfterRebuild: boolean;
  paceCheckIntervalMs: number; // enforced min: 30_000
  // Gates both learning ends: the preference pass over the "name your own
  // stops" text, and the post-walk feedback question. Client-side only — the
  // flag rides along in the request body and the server obeys it.
  preferenceLearningEnabled: boolean;
}

export const MIN_PACE_CHECK_INTERVAL_MS = 30_000;

export const DEFAULT_WALK_SETTINGS: WalkSettings = {
  // Both default to the old behaviour, so a walker who never opens settings
  // sees exactly what they saw before the split.
  fastPaceMode: "auto",
  slowPaceMode: "auto",
  // Also the old behaviour: before this flag existed, a pace rebuild always
  // resumed tracking on its own.
  autoResumeAfterRebuild: true,
  paceCheckIntervalMs: 60_000,
  preferenceLearningEnabled: true,
};

/**
 * A stored settings value as a mode this code can act on.
 *
 * These settings live in localStorage, so a returning walker's blob predates
 * this type and has no such field at all — and the one it does have is the old
 * `paceCheckEnabled` boolean. Reading that as the fallback is what keeps the
 * split from silently switching pace checking back on for someone who
 * deliberately turned it off: false meant "leave my route alone", which is
 * `off` in both directions.
 */
export function toPaceResponseMode(
  value: unknown,
  legacyPaceCheckEnabled: unknown,
): PaceResponseMode {
  if (PACE_RESPONSE_MODES.includes(value as PaceResponseMode)) {
    return value as PaceResponseMode;
  }

  if (legacyPaceCheckEnabled === false) {
    return "off";
  }

  return "auto";
}

export function clampPaceCheckInterval(ms: number): number {
  // A non-finite value would reach setInterval() and make it fire continuously.
  if (!Number.isFinite(ms)) {
    return DEFAULT_WALK_SETTINGS.paceCheckIntervalMs;
  }

  return Math.max(MIN_PACE_CHECK_INTERVAL_MS, ms);
}
