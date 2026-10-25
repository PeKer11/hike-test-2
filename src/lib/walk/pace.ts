/** Minutes per km for a normal walker, with street crossings: the "Normal" preset the walker sees. */
export const DEFAULT_PACE_MIN_PER_KM = 15;

/** Words the walker uses for how fast to walk a stretch, as a factor on the base pace. */
export const PACE_FACTOR = { brisk: 0.8, normal: 1, stroll: 1.33 } as const;
export type PaceWord = keyof typeof PACE_FACTOR;

export const MIN_PACE_MIN_PER_KM = 6;
export const MAX_PACE_MIN_PER_KM = 40;

export function clampPace(minPerKm: number): number {
  return Math.min(MAX_PACE_MIN_PER_KM, Math.max(MIN_PACE_MIN_PER_KM, minPerKm));
}

/** Learned pace is only worth using once it rests on a couple of walks. */
export const MIN_LEARNED_WALKS = 2;
