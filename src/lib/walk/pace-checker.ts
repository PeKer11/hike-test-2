import {
  clampPaceCheckInterval,
  type WalkSettings,
} from "@/lib/types/walk-settings";
import {
  replanPaceDirection,
  ReplanTrigger,
  type ReplanReason,
  type ReplanSample,
} from "@/lib/walk/replan-trigger";

/**
 * What the caller should do about a trigger, decided here from the direction's
 * setting so the UI never has to re-derive it. `off` never reaches the caller
 * at all — a mode of `off` means the callback is simply not made.
 */
export type ReplanResponse = "auto" | "ask";

export class PaceChecker {
  private settings: WalkSettings;
  private readonly trigger: ReplanTrigger;
  private readonly onReplanNeeded: (
    reason: ReplanReason,
    response: ReplanResponse,
  ) => void;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;
  private lastSampleTimestamp: number | null = null;

  // The trigger is owned by the caller, not by this instance: a re-plan tears the
  // PaceChecker down and builds a new one, and a cooldown that died with the old
  // instance would never actually hold back the next re-plan.
  constructor(
    settings: WalkSettings,
    trigger: ReplanTrigger,
    onReplanNeeded: (reason: ReplanReason, response: ReplanResponse) => void,
  ) {
    this.settings = {
      ...settings,
      paceCheckIntervalMs: clampPaceCheckInterval(settings.paceCheckIntervalMs),
    };
    this.trigger = trigger;
    this.onReplanNeeded = onReplanNeeded;
  }

  /** Feed every accepted GPS position here — the trigger windows are built from these. */
  recordSample(sample: ReplanSample): void {
    this.lastSampleTimestamp = sample.timestamp;
    this.trigger.recordSample(sample);
  }

  /**
   * The walk's own clock: the timestamp of the last position we were handed.
   *
   * The trigger's windows are built entirely out of sample timestamps, so
   * evaluating them against `Date.now()` compares two different clocks. With
   * real GPS the two agree to within a tick and it never showed. With the
   * simulator they do not agree at all — its timestamps run `speedMultiplier`×
   * ahead of the wall clock, which put every sample in the *future* relative to
   * `Date.now()` and made the "does this window cover 15 minutes" check come out
   * negative forever. Falls back to the wall clock before any sample arrives.
   */
  private evaluationTime(): number {
    return this.lastSampleTimestamp ?? Date.now();
  }

  start(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = true;
    const intervalMs = clampPaceCheckInterval(this.settings.paceCheckIntervalMs);

    this.intervalId = setInterval(() => {
      const reason = this.trigger.evaluate(this.evaluationTime());
      if (reason === null) {
        return;
      }

      // Gated after `evaluate`, not before it. Evaluating is what arms the
      // cooldown and clears the window, so short-circuiting on the setting
      // would leave a walker with one direction off carrying a stale 15-minute
      // window into the moment they switch it back on.
      const mode =
        replanPaceDirection(reason) === "fast"
          ? this.settings.fastPaceMode
          : this.settings.slowPaceMode;

      if (mode === "off") {
        return;
      }

      this.onReplanNeeded(reason, mode);
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
