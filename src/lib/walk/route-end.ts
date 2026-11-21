/**
 * "You've reached the end of your route": when is the walker really there?
 *
 * `remainingM` is a position along the line (the projected fix), so a fix with 10-30 m of error
 * moves it by that much. The first version asked once, at 40 m, and a field walk saw the card
 * appear about 30 s before the end. So now the walker has to be within `ROUTE_END_RADIUS_M`
 * of the end, on a fix good enough to say so, and stay there for `ROUTE_END_DWELL_MS`.
 * Time is the fixes' own timestamps: a tick re-reading the same stale fix never adds to it.
 */
export const ROUTE_END_RADIUS_M = 15;
export const ROUTE_END_MAX_ACCURACY_M = 30;
export const ROUTE_END_DWELL_MS = 5_000;

export class RouteEndDetector {
  private since: number | null = null;
  private lastAt = Number.NEGATIVE_INFINITY;
  private confirmed = false;

  /** Feed one fix's progress. Returns whether the walker has been at the end long enough. */
  update(sample: { remainingM: number; accuracyM: number; atMs: number }): boolean {
    // The same fix again (a tick, a re-render) or an older one says nothing new.
    if (sample.atMs <= this.lastAt) return this.confirmed;
    this.lastAt = sample.atMs;

    // A fix too coarse to place the walker within 15 m says nothing either way: it neither
    // starts the dwell nor breaks one.
    if (sample.accuracyM > ROUTE_END_MAX_ACCURACY_M) return this.confirmed;

    if (sample.remainingM > ROUTE_END_RADIUS_M) {
      this.since = null;
      this.confirmed = false;
      return false;
    }
    if (this.since === null) this.since = sample.atMs;
    this.confirmed = sample.atMs - this.since >= ROUTE_END_DWELL_MS;
    return this.confirmed;
  }

  reset(): void {
    this.since = null;
    this.lastAt = Number.NEGATIVE_INFINITY;
    this.confirmed = false;
  }
}
