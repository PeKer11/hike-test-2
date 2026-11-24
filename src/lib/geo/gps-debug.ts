/**
 * On-phone GPS counters for diagnosing a walk whose dot does not move. Pure: no React, no network.
 * Always counting (a few integer increments per fix); shown only with `?gpsdebug=1` (see GpsDebugLine).
 */

export type GpsFixKind = "watch" | "quick" | "rearm";

export interface GpsDebugSnapshot {
  received: number;
  receivedWatch: number;
  receivedQuick: number;
  receivedRearm: number;
  /** Dropped by locate()'s out-of-order timestamp guard. */
  droppedOrder: number;
  /** `lastWalkFixTs - fix.timestamp` of the last such drop, ms. */
  lastDeltaMs: number | null;
  /** Dropped by the tracker's accuracy gate (over DOT_MAX_ACCURACY_M). */
  droppedTracker: number;
  /** Fixes handed to the map. */
  published: number;
  lastAccuracyM: number | null;
  /** `Date.now() - fix.timestamp` of the last fix, ms. */
  lastAgeMs: number | null;
  /** Fixes that carried a device (Doppler) speed. */
  withSpeed: number;
  /** `coords.speed` of the last fix, m/s (null when the device sent none). */
  lastSpeedMps: number | null;
  errors: number;
  lastError: string | null;
}

const EMPTY: GpsDebugSnapshot = {
  received: 0,
  receivedWatch: 0,
  receivedQuick: 0,
  receivedRearm: 0,
  droppedOrder: 0,
  lastDeltaMs: null,
  droppedTracker: 0,
  published: 0,
  lastAccuracyM: null,
  lastAgeMs: null,
  withSpeed: 0,
  lastSpeedMps: null,
  errors: 0,
  lastError: null,
};

let state: GpsDebugSnapshot = { ...EMPTY };

export const gpsDebug = {
  reset(): void {
    state = { ...EMPTY };
  },
  snapshot(): GpsDebugSnapshot {
    return { ...state };
  },
  received(kind: GpsFixKind, accuracyM: number, fixTimestamp: number, speedMps?: number | null): void {
    state.received += 1;
    if (kind === "watch") state.receivedWatch += 1;
    else if (kind === "quick") state.receivedQuick += 1;
    else state.receivedRearm += 1;
    state.lastAccuracyM = accuracyM;
    state.lastAgeMs = Date.now() - fixTimestamp;
    const hasSpeed = typeof speedMps === "number" && Number.isFinite(speedMps);
    if (hasSpeed) state.withSpeed += 1;
    state.lastSpeedMps = hasSpeed ? (speedMps as number) : null;
  },
  droppedOrder(deltaMs: number): void {
    state.droppedOrder += 1;
    state.lastDeltaMs = deltaMs;
  },
  droppedTracker(): void {
    state.droppedTracker += 1;
  },
  published(): void {
    state.published += 1;
  },
  error(e: unknown): void {
    state.errors += 1;
    state.lastError = e instanceof Error ? e.message : String(e);
  },
};

let latched = false;
/** True when the page was opened with `?gpsdebug=1`; remembered for the session because in-app navigation drops the query. */
export function isGpsDebugOn(): boolean {
  if (latched) return true;
  try {
    if (typeof window === "undefined") return false;
    if (new URLSearchParams(window.location.search).get("gpsdebug") === "1") {
      latched = true;
      try {
        sessionStorage.setItem("traike.gpsdebug", "1");
      } catch {}
      return true;
    }
    if (sessionStorage.getItem("traike.gpsdebug") === "1") {
      latched = true;
      return true;
    }
  } catch {}
  return false;
}

/** One short monospace line for the overlay. */
export function formatGpsDebug(s: GpsDebugSnapshot, zoom: number | undefined, follow: boolean): string {
  const n = (v: number | null, d = 0) => (v === null ? "-" : v.toFixed(d));
  return [
    `rx ${s.received} (w${s.receivedWatch} q${s.receivedQuick} r${s.receivedRearm})`,
    `ord-drop ${s.droppedOrder} d${s.lastDeltaMs === null ? "-" : Math.round(s.lastDeltaMs / 100) / 10}s`,
    `trk-drop ${s.droppedTracker}`,
    `pub ${s.published}`,
    `acc ${n(s.lastAccuracyM)}m`,
    `age ${s.lastAgeMs === null ? "-" : Math.round(s.lastAgeMs / 100) / 10}s`,
    `dop ${n(s.lastSpeedMps, 1)}`,
    `dop% ${s.received === 0 ? "-" : Math.round((100 * s.withSpeed) / s.received)}`,
    `err ${s.errors}`,
    `z ${zoom === undefined ? "-" : Math.round(zoom * 10) / 10}`,
    `follow ${follow ? "on" : "off"}`,
  ].join(" | ");
}
