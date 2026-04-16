import {
  clampPaceCheckInterval,
  type WalkSettings,
} from "@/lib/types/walk-settings";

export class PaceChecker {
  private settings: WalkSettings;
  private readonly plannedPaceMinPerKm: number;
  private readonly onSlowPace: (latestPace: number) => void;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private getLatestPaceRef: (() => number | null) | null = null;

  constructor(
    settings: WalkSettings,
    plannedPaceMinPerKm: number,
    onSlowPace: (latestPace: number) => void,
  ) {
    this.settings = {
      ...settings,
      paceCheckIntervalMs: clampPaceCheckInterval(settings.paceCheckIntervalMs),
    };
    this.plannedPaceMinPerKm = plannedPaceMinPerKm;
    this.onSlowPace = onSlowPace;
  }

  start(getLatestPace: () => number | null): void {
    this.getLatestPaceRef = getLatestPace;

    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    const intervalMs = clampPaceCheckInterval(this.settings.paceCheckIntervalMs);

    this.intervalId = setInterval(() => {
      if (!this.settings.paceCheckEnabled) {
        return;
      }

      const latestPace = this.getLatestPaceRef?.();
      if (latestPace === null || latestPace === undefined) {
        return;
      }

      if (latestPace > this.plannedPaceMinPerKm * 1.3) {
        this.onSlowPace(latestPace);
      }
    }, intervalMs);
  }

  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  updateSettings(settings: WalkSettings): void {
    this.settings = {
      ...settings,
      paceCheckIntervalMs: clampPaceCheckInterval(settings.paceCheckIntervalMs),
    };

    const latestPaceGetter = this.getLatestPaceRef;
    this.stop();

    if (latestPaceGetter) {
      this.start(latestPaceGetter);
    }
  }
}
