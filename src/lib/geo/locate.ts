import type { Coordinates } from "@/lib/types";

/**
 * The one place in the app that talks to `navigator.geolocation`.
 *
 * Staged, so the walker sees something fast and it then gets better:
 *   1. the last known fix (start only, under 10 min old) shown as coarse;
 *   2. a quick low-accuracy `getCurrentPosition` (cached up to 2 min, 4 s);
 *   3. a high-accuracy `watchPosition` that refines it (and, for a walk, IS the tracker);
 *   4. retries with backoff while nothing has answered;
 *   5. an IP-city fallback (start only) when nothing answers in 6 s.
 * Errors reach the UI only as a state, and only when no fix exists after 12 s.
 *
 * A walk also keeps its watch alive: a page that was hidden (another app, a locked phone) may come
 * back with a watch that never delivers again, so it is re-armed on return and whenever no fix has
 * got through for 30 s while the page is visible.
 */

export type LocateState =
  | "idle"
  | "searching"
  | "coarse"
  | "good"
  | "denied"
  | "unavailable"
  | "timeout";

export type LocatePurpose = "start" | "walk";

export interface LocateFix {
  coordinates: Coordinates;
  accuracyMeters: number;
  /** ms since epoch, from the device. */
  timestamp: number;
  speedMps?: number;
  /** The device's own heading (`coords.heading`), degrees clockwise from north; only when it is a real number. */
  headingDeg?: number;
  source: "cache" | "gps" | "ip";
  /** The city, for an IP fix ("roughly in {city}"). */
  city?: string;
}

export interface LocateError {
  code: number;
  message: string;
  isTimeout: boolean;
}

export interface LocateOptions {
  purpose: LocatePurpose;
  onUpdate: (fix: LocateFix) => void;
  onState?: (state: LocateState) => void;
  /** Every raw device error, for logs. The UI should follow `onState`, not this. */
  onError?: (error: LocateError) => void;
}

export const LAST_FIX_KEY = "traike.lastFix.v1";
export const GOOD_ACCURACY_M = 50;
const CACHE_MAX_AGE_MS = 10 * 60_000;
const COARSE_MAX_AGE_MS = 120_000;
const COARSE_TIMEOUT_MS = 4_000;
const WATCH_MAX_AGE_MS = 5_000;
const WATCH_TIMEOUT_MS = 20_000;
const START_WATCH_CAP_MS = 25_000;
const NO_FIX_STATE_MS = 12_000;
const IP_FALLBACK_MS = 6_000;
/** A walk ignores a fix older than this: a cached one would move the dot backwards and start the clock early. */
const WALK_MAX_FIX_AGE_MS = 15_000;
const RETRY_DELAYS_MS = [3_000, 6_000, 12_000];
/** A walk whose watch has been silent this long, with the page visible, is re-armed. */
const WALK_SILENT_MS = 30_000;
const WALK_WATCHDOG_MS = 10_000;
const REARM_FIX_TIMEOUT_MS = 10_000;

// GeolocationPositionError codes (the constants are not on every mocked error).
const PERMISSION_DENIED = 1;
const POSITION_UNAVAILABLE = 2;
const TIMEOUT = 3;

export function geolocationSupported(): boolean {
  return typeof navigator !== "undefined" && !!navigator.geolocation;
}

/** `undefined` where the Permissions API is missing (older iOS). */
export async function queryLocationPermission(): Promise<PermissionState | undefined> {
  try {
    const status = await navigator.permissions?.query({ name: "geolocation" });
    return status?.state;
  } catch {
    return undefined;
  }
}

function readLastFix(): { lat: number; lng: number; acc: number; ts: number } | null {
  try {
    const raw = JSON.parse(localStorage.getItem(LAST_FIX_KEY) ?? "null") as Record<string, unknown> | null;
    if (!raw) return null;
    const { lat, lng, acc, ts } = raw;
    if ([lat, lng, acc, ts].some((v) => typeof v !== "number" || !Number.isFinite(v))) return null;
    return { lat: lat as number, lng: lng as number, acc: acc as number, ts: ts as number };
  } catch {
    return null;
  }
}

/** Remember a real fix, so the next visit has something to show at once. */
export function saveLastFix(fix: Pick<LocateFix, "coordinates" | "accuracyMeters">): void {
  try {
    localStorage.setItem(
      LAST_FIX_KEY,
      JSON.stringify({ lat: fix.coordinates.lat, lng: fix.coordinates.lng, acc: fix.accuracyMeters, ts: Date.now() }),
    );
  } catch {
    // Storage blocked: the cache is a convenience.
  }
}

function toFix(pos: GeolocationPosition): LocateFix {
  const speed = pos.coords.speed;
  // Standing (or on some iOS versions, slow) the browser reports null, NaN or -1: no heading at all, never a made-up one.
  const heading = pos.coords.heading;
  return {
    coordinates: { lat: pos.coords.latitude, lng: pos.coords.longitude },
    accuracyMeters: pos.coords.accuracy,
    timestamp: pos.timestamp,
    speedMps: typeof speed === "number" && Number.isFinite(speed) ? speed : undefined,
    headingDeg: typeof heading === "number" && Number.isFinite(heading) && heading >= 0 && heading <= 360 ? heading : undefined,
    source: "gps",
  };
}

export function locate(options: LocateOptions): { stop(): void } {
  const { purpose, onUpdate, onState, onError } = options;
  const geo = typeof navigator !== "undefined" ? navigator.geolocation : undefined;

  let stopped = false;
  let state: LocateState = "idle";
  let best: LocateFix | null = null;
  let hasLiveFix = false;
  let lastErrorCode: number | null = null;
  let watchId: number | null = null;
  let retries = 0;
  let lastWalkFixTs = 0;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  let removeVisibility: (() => void) | null = null;
  // A walk's liveness: when a usable fix last got through, when the watch was last re-armed.
  let lastLiveFixAt = 0;
  let lastRearmAt = 0;
  let removeLiveness: (() => void) | null = null;

  const later = (ms: number, fn: () => void) => {
    const t = setTimeout(() => {
      timers.delete(t);
      if (!stopped) fn();
    }, ms);
    timers.add(t);
  };

  const setState = (next: LocateState) => {
    if (next === state) return;
    state = next;
    onState?.(next);
  };

  const clearWatch = () => {
    if (watchId !== null) {
      geo?.clearWatch?.(watchId);
      watchId = null;
    }
  };

  const handleFix = (fix: LocateFix) => {
    if (stopped) return;
    if (purpose === "walk" && fix.source === "gps") {
      // No wall-clock age check: a device fix is stamped by the GPS/OS clock, and a phone clock a few seconds off
      // used to discard every fix. Only out-of-order fixes are dropped; a clock jump back recovers.
      if (fix.timestamp < lastWalkFixTs && lastWalkFixTs - fix.timestamp < WALK_MAX_FIX_AGE_MS) return;
      lastWalkFixTs = fix.timestamp;
    }
    if (fix.source === "gps") {
      hasLiveFix = true;
      lastLiveFixAt = Date.now();
    }
    // A walk consumes every fix (the tracker filters). A start only wants an improving one.
    const improves = !best || fix.accuracyMeters <= best.accuracyMeters;
    if (purpose === "start" && !improves) return;
    if (!best || fix.accuracyMeters <= best.accuracyMeters) best = fix;
    if (fix.source === "gps") saveLastFix(fix);
    setState(fix.accuracyMeters <= GOOD_ACCURACY_M ? "good" : "coarse");
    onUpdate(fix);
    if (purpose === "start" && fix.source === "gps" && fix.accuracyMeters <= GOOD_ACCURACY_M) clearWatch();
  };

  const handleError = (err: GeolocationPositionError) => {
    if (stopped) return;
    lastErrorCode = err.code;
    onError?.({ code: err.code, message: err.message, isTimeout: err.code === TIMEOUT });
    if (err.code === PERMISSION_DENIED) {
      clearWatch();
      timers.forEach(clearTimeout);
      timers.clear();
      setState("denied");
      watchForPermission();
    }
  };

  /** Back from Settings: the tab becomes visible and the permission is no longer "denied". */
  const watchForPermission = () => {
    if (removeVisibility || typeof document === "undefined") return;
    const onVisible = async () => {
      if (document.visibilityState !== "visible" || stopped) return;
      const perm = await queryLocationPermission();
      if (stopped || perm === "denied") return;
      removeVisibility?.();
      removeVisibility = null;
      begin();
    };
    document.addEventListener("visibilitychange", onVisible);
    removeVisibility = () => document.removeEventListener("visibilitychange", onVisible);
  };

  const quickFix = () => {
    if (!geo || typeof geo.getCurrentPosition !== "function") return;
    geo.getCurrentPosition(
      (pos) => handleFix(toFix(pos)),
      (err) => {
        handleError(err);
        if (stopped || err.code === PERMISSION_DENIED || hasLiveFix) return;
        const delay = RETRY_DELAYS_MS[retries];
        if (delay === undefined) return;
        retries += 1;
        later(delay, quickFix);
      },
      { enableHighAccuracy: false, maximumAge: purpose === "walk" ? WATCH_MAX_AGE_MS : COARSE_MAX_AGE_MS, timeout: COARSE_TIMEOUT_MS },
    );
  };

  const ipFallback = async () => {
    if (purpose !== "start" || best) return;
    try {
      const res = await fetch("/api/geo/ip", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { lat?: unknown; lng?: unknown; city?: unknown };
      if (stopped || best) return;
      if (typeof data.lat !== "number" || typeof data.lng !== "number") return;
      handleFix({
        coordinates: { lat: data.lat, lng: data.lng },
        accuracyMeters: 25_000,
        timestamp: Date.now(),
        source: "ip",
        city: typeof data.city === "string" ? data.city : undefined,
      });
    } catch {
      // No fallback available: the state timers below still report honestly.
    }
  };

  const startWatch = () => {
    watchId = geo?.watchPosition(
      (pos) => handleFix(toFix(pos)),
      handleError,
      { enableHighAccuracy: true, maximumAge: WATCH_MAX_AGE_MS, timeout: WATCH_TIMEOUT_MS },
    ) ?? null;
  };

  /** Drop the watch and open a new one, plus one fresh read so the dot does not wait for it. */
  const rearm = () => {
    if (stopped || !geo || state === "denied") return;
    lastRearmAt = Date.now();
    clearWatch();
    startWatch();
    geo.getCurrentPosition?.(
      (pos) => handleFix(toFix(pos)),
      handleError,
      { enableHighAccuracy: true, maximumAge: WATCH_MAX_AGE_MS, timeout: REARM_FIX_TIMEOUT_MS },
    );
  };

  /** A walk only: back from another app, or silent for too long, the watch is re-armed. */
  const keepWalkWatchAlive = () => {
    if (purpose !== "walk" || removeLiveness || typeof document === "undefined") return;
    const onVisible = () => {
      if (document.visibilityState === "visible") rearm();
    };
    document.addEventListener("visibilitychange", onVisible);
    const dog = setInterval(() => {
      if (stopped || document.visibilityState === "hidden") return;
      if (Date.now() - Math.max(lastLiveFixAt, lastRearmAt) >= WALK_SILENT_MS) rearm();
    }, WALK_WATCHDOG_MS);
    lastLiveFixAt = Date.now();
    removeLiveness = () => {
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(dog);
    };
  };

  function begin() {
    if (stopped) return;
    if (!geo) {
      setState("unavailable");
      return;
    }
    setState("searching");
    retries = 0;
    lastErrorCode = null;

    // 1. Instant: the last fix, only to start a walk's origin, never to track one.
    if (purpose === "start") {
      const cached = readLastFix();
      if (cached && Date.now() - cached.ts < CACHE_MAX_AGE_MS) {
        handleFix({
          coordinates: { lat: cached.lat, lng: cached.lng },
          accuracyMeters: Math.max(cached.acc, GOOD_ACCURACY_M + 1),
          timestamp: cached.ts,
          source: "cache",
        });
      }
    }

    // 2. Quick coarse fix, 3. refining watch, both at once.
    quickFix();
    startWatch();
    keepWalkWatchAlive();
    if (purpose === "start") later(START_WATCH_CAP_MS, clearWatch);

    // 5. Nothing at all in 6 s: the IP city.
    if (purpose === "start") later(IP_FALLBACK_MS, () => void ipFallback());

    // The UI hears about a failure only when there is still no fix after 12 s.
    later(NO_FIX_STATE_MS, () => {
      if (best || state === "denied") return;
      setState(lastErrorCode === POSITION_UNAVAILABLE ? "unavailable" : lastErrorCode === TIMEOUT ? "timeout" : state);
    });
  }

  begin();

  return {
    stop() {
      stopped = true;
      clearWatch();
      timers.forEach(clearTimeout);
      timers.clear();
      removeVisibility?.();
      removeVisibility = null;
      removeLiveness?.();
      removeLiveness = null;
    },
  };
}
