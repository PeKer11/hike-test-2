export interface WalkSettings {
  paceCheckEnabled: boolean;
  paceCheckIntervalMs: number; // enforced min: 30_000
  // Gates both learning ends: the preference pass over the "name your own
  // stops" text, and the post-walk feedback question. Client-side only — the
  // flag rides along in the request body and the server obeys it.
  preferenceLearningEnabled: boolean;
}

export const MIN_PACE_CHECK_INTERVAL_MS = 30_000;

export const DEFAULT_WALK_SETTINGS: WalkSettings = {
  paceCheckEnabled: true,
  paceCheckIntervalMs: 60_000,
  preferenceLearningEnabled: true,
};

export function clampPaceCheckInterval(ms: number): number {
  // A non-finite value would reach setInterval() and make it fire continuously.
  if (!Number.isFinite(ms)) {
    return DEFAULT_WALK_SETTINGS.paceCheckIntervalMs;
  }

  return Math.max(MIN_PACE_CHECK_INTERVAL_MS, ms);
}
