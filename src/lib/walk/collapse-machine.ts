import {
  COLLAPSE_COOLDOWN_MS,
  COLLAPSE_DEVIATION_M,
  COLLAPSE_MAX_PER_WALK,
  COLLAPSE_OFF_ROUTE_MAX_MS,
  COLLAPSE_REJOIN_DELAY_MS,
  COLLAPSE_REJOIN_FAILURES,
  COLLAPSE_RETURN_M,
  COLLAPSE_SUSTAIN_MS,
} from "./discovery-cadence";
import {
  LOCAL_REJOIN_COOLDOWN_MS,
  OFF_ROUTE_MAX_ACCURACY_M,
  OFF_ROUTE_OFF_M,
  OFF_ROUTE_ON_M,
} from "./walk-cadence";

export type CollapsePhase =
  | "ON_ROUTE"
  | "OFF_ROUTE"
  | "REJOINING"
  | "COLLAPSED"
  | "OFFERING";

export interface CollapseState {
  phase: CollapsePhase;
  offSinceMs: number | null;
  /** Since when the walker has been beyond `COLLAPSE_DEVIATION_M`. */
  farSinceMs: number | null;
  lastRejoinAttemptMs: number | null;
  rejoinFailures: number;
  collapseCount: number;
  lastCollapseMs: number | null;
}

/** What the caller must do after a transition. */
export type CollapseEffect = "none" | "start-rejoin" | "collapse";

export interface CollapseStep {
  state: CollapseState;
  effect: CollapseEffect;
}

export interface CollapseFix {
  /** The fix's own timestamp, never `Date.now()`. */
  atMs: number;
  /** Metres from the (old) planned route. */
  deviationM: number;
  accuracyM: number;
}

export function initialCollapseState(): CollapseState {
  return {
    phase: "ON_ROUTE",
    offSinceMs: null,
    farSinceMs: null,
    lastRejoinAttemptMs: null,
    rejoinFailures: 0,
    collapseCount: 0,
    lastCollapseMs: null,
  };
}

const settled = (state: CollapseState): CollapseState => ({
  ...state,
  phase: "ON_ROUTE",
  offSinceMs: null,
  farSinceMs: null,
  lastRejoinAttemptMs: null,
  rejoinFailures: 0,
});

/** Cooldown and per-walk cap, for callers deciding whether to wait for a collapse. */
export function collapseAllowed(state: CollapseState, atMs: number): boolean {
  return (
    state.collapseCount < COLLAPSE_MAX_PER_WALK &&
    (state.lastCollapseMs === null ||
      atMs - state.lastCollapseMs >= COLLAPSE_COOLDOWN_MS)
  );
}

function collapse(state: CollapseState, atMs: number): CollapseStep {
  return {
    state: {
      ...state,
      phase: "COLLAPSED",
      collapseCount: state.collapseCount + 1,
      lastCollapseMs: atMs,
    },
    effect: "collapse",
  };
}

/**
 * Advance on a GPS fix. Off route when > 50 m and beyond the fix accuracy, back
 * on below 30 m, and fixes worse than 50 m change nothing. After 30 s off route
 * a local rejoin is requested; the walker COLLAPSES when 400 m+ away for 60 s,
 * after two failed rejoins, or after 8 minutes off route (10 min cooldown, at
 * most 4 per walk, otherwise the caller's full re-plan covers it).
 */
export function stepCollapse(prev: CollapseState, fix: CollapseFix): CollapseStep {
  if (fix.accuracyM > OFF_ROUTE_MAX_ACCURACY_M) {
    return { state: prev, effect: "none" };
  }
  const { atMs, deviationM, accuracyM } = fix;

  if (prev.phase === "ON_ROUTE") {
    if (deviationM > OFF_ROUTE_ON_M && deviationM > accuracyM) {
      return {
        state: {
          ...prev,
          phase: "OFF_ROUTE",
          offSinceMs: atMs,
          farSinceMs: deviationM > COLLAPSE_DEVIATION_M ? atMs : null,
          lastRejoinAttemptMs: null,
        },
        effect: "none",
      };
    }
    return { state: prev, effect: "none" };
  }

  if (prev.phase === "COLLAPSED" || prev.phase === "OFFERING") {
    // Walking back onto the old route dissolves the collapse by itself.
    if (deviationM < COLLAPSE_RETURN_M) {
      return { state: settled(prev), effect: "none" };
    }
    return { state: prev, effect: "none" };
  }

  // OFF_ROUTE or REJOINING
  if (deviationM < OFF_ROUTE_OFF_M) {
    return { state: settled(prev), effect: "none" };
  }
  const offSinceMs = prev.offSinceMs ?? atMs;
  const farSinceMs =
    deviationM > COLLAPSE_DEVIATION_M ? (prev.farSinceMs ?? atMs) : null;
  const next: CollapseState = { ...prev, offSinceMs, farSinceMs };

  const shouldCollapse =
    (farSinceMs !== null && atMs - farSinceMs >= COLLAPSE_SUSTAIN_MS) ||
    next.rejoinFailures >= COLLAPSE_REJOIN_FAILURES ||
    atMs - offSinceMs > COLLAPSE_OFF_ROUTE_MAX_MS;
  if (shouldCollapse && collapseAllowed(next, atMs)) return collapse(next, atMs);

  if (prev.phase === "OFF_ROUTE") {
    const due =
      next.lastRejoinAttemptMs === null
        ? atMs - offSinceMs >= COLLAPSE_REJOIN_DELAY_MS
        : atMs - next.lastRejoinAttemptMs >= LOCAL_REJOIN_COOLDOWN_MS;
    // A walker 400 m+ away is not near the route; skip the local way back.
    if (due && deviationM <= COLLAPSE_DEVIATION_M) {
      return {
        state: { ...next, phase: "REJOINING", lastRejoinAttemptMs: atMs },
        effect: "start-rejoin",
      };
    }
  }
  return { state: next, effect: "none" };
}

/** Report the outcome of a local rejoin; an implausible connector is a failure. */
export function rejoinResult(
  prev: CollapseState,
  result: { ok: boolean; atMs: number },
): CollapseStep {
  if (prev.phase !== "REJOINING") return { state: prev, effect: "none" };
  if (result.ok) return { state: settled(prev), effect: "none" };
  const next: CollapseState = {
    ...prev,
    phase: "OFF_ROUTE",
    rejoinFailures: prev.rejoinFailures + 1,
  };
  if (
    next.rejoinFailures >= COLLAPSE_REJOIN_FAILURES &&
    collapseAllowed(next, result.atMs)
  ) {
    return collapse(next, result.atMs);
  }
  return { state: next, effect: "none" };
}

/** Direction options are ready to show. */
export function optionsReady(prev: CollapseState): CollapseState {
  return prev.phase === "COLLAPSED" ? { ...prev, phase: "OFFERING" } : prev;
}

/** The walker picked an option, or "Back to my plan": a new route is in force. */
export function resolveCollapse(prev: CollapseState): CollapseState {
  return settled(prev);
}
