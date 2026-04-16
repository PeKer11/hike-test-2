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
  return Math.max(MIN_PACE_CHECK_INTERVAL_MS, ms);
}
