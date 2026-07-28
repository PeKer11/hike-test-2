export interface WalkSettings {
  paceCheckEnabled: boolean;
  paceCheckIntervalMs: number; // enforced min: 30_000
}

export const MIN_PACE_CHECK_INTERVAL_MS = 30_000;

export const DEFAULT_WALK_SETTINGS: WalkSettings = {
  paceCheckEnabled: true,
  paceCheckIntervalMs: 60_000,
};

export function clampPaceCheckInterval(ms: number): number {
  // A non-finite value would reach setInterval() and make it fire continuously.
  if (!Number.isFinite(ms)) {
    return DEFAULT_WALK_SETTINGS.paceCheckIntervalMs;
  }

  return Math.max(MIN_PACE_CHECK_INTERVAL_MS, ms);
}
