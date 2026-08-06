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
      const reason = this.trigger.evaluate(Date.now());
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
