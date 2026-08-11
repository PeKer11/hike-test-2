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

/**
 * An alias, not a second type: going off route offers the walker exactly the
 * same three answers as pace drift, and a parallel union would only invite the
 * two to drift apart. The name is here so the field below reads as what it is.
 */
export type DeviationResponseMode = PaceResponseMode;

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
   * What to do when the walker has left the planned route far enough, and for
   * long enough, that they are not coming straight back to it.
   *
   * Defaults to `ask` where the pace modes default to `off`, and the two
   * defaults disagree for a reason. Drifting off the planned pace is usually
   * just how someone wants to walk that day — there is nothing wrong to fix.
   * Being 50 m off the route for half a minute might mean they are lost, which
   * is worth raising. It might equally mean they ducked into a shop, which is
   * why it is not worth rebuilding over without an answer.
   */
  deviationMode: DeviationResponseMode;
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
  // Both off by default. Testing settled it: pace drift is usually just how
  // someone feels like walking that day, so a brand-new walker should not have
  // their route silently rebuilt — or even be asked about it — until they say
  // they want that. Note this is deliberately *not* the same answer as
  // `toPaceResponseMode`'s fallback: "what does a new walker get" and "what
  // does an existing walker's stored blob become" are different questions, and
  // changing the second would retroactively switch off something a returning
  // walker already had.
  fastPaceMode: "off",
  slowPaceMode: "off",
  deviationMode: "ask",
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

/**
 * A stored settings value as a deviation mode.
 *
 * Unlike `toPaceResponseMode` there is no legacy flag to honour: before this
 * field existed nothing happened when a walker went off route at all, so no
 * returning walker has an off-route preference that could be overridden. A
 * missing field is simply someone who has never been asked, and they get the
 * same `ask` a brand-new walker gets.
 */
export function toDeviationResponseMode(value: unknown): DeviationResponseMode {
  if (PACE_RESPONSE_MODES.includes(value as DeviationResponseMode)) {
    return value as DeviationResponseMode;
  }

  return DEFAULT_WALK_SETTINGS.deviationMode;
}

export function clampPaceCheckInterval(ms: number): number {
  // A non-finite value would reach setInterval() and make it fire continuously.
  if (!Number.isFinite(ms)) {
    return DEFAULT_WALK_SETTINGS.paceCheckIntervalMs;
  }

  return Math.max(MIN_PACE_CHECK_INTERVAL_MS, ms);
}
