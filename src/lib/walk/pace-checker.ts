import {
  clampPaceCheckInterval,
  type WalkSettings,
} from "@/lib/types/walk-settings";
import {
  ReplanTrigger,
  type ReplanReason,
  type ReplanSample,
} from "@/lib/walk/replan-trigger";

export class PaceChecker {
  private settings: WalkSettings;
  private readonly trigger: ReplanTrigger;
  private readonly onReplanNeeded: (reason: ReplanReason) => void;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;

  constructor(
    settings: WalkSettings,
    plannedPaceMinPerKm: number,
    onReplanNeeded: (reason: ReplanReason) => void,
  ) {
    this.settings = {
      ...settings,
      paceCheckIntervalMs: clampPaceCheckInterval(settings.paceCheckIntervalMs),
    };
    this.trigger = new ReplanTrigger(plannedPaceMinPerKm);
    this.onReplanNeeded = onReplanNeeded;
  }

  /** Feed every accepted GPS position here — the trigger windows are built from these. */
  recordSample(sample: ReplanSample): void {
    this.trigger.recordSample(sample);
  }

  start(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = true;
    const intervalMs = clampPaceCheckInterval(this.settings.paceCheckIntervalMs);

    this.intervalId = setInterval(() => {
      if (!this.settings.paceCheckEnabled) {
        return;
      }

      const reason = this.trigger.evaluate(Date.now());
      if (reason !== null) {
        this.onReplanNeeded(reason);
      }
    }, intervalMs);
  }

  stop(): void {
    this.isRunning = false;
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

    // Restart the timer with the new interval, but keep the collected samples and
    // the cooldown — changing a setting is not a reason to re-arm either trigger.
    if (this.isRunning) {
      this.start();
    }
  }
}
