import { describe, it, expect } from "vitest";
import {
  ReplanTrigger,
  FULL_STOP_WINDOW_MS,
  SUSTAINED_SLOW_WINDOW_MS,
  REPLAN_COOLDOWN_MS,
} from "@/lib/walk/replan-trigger";
import type { Coordinates } from "@/lib/types";

const START: Coordinates = { lat: 32.08, lng: 34.78 };
const T0 = 1_700_000_000_000;
const SAMPLE_INTERVAL_MS = 30_000;

// Meters → degrees of longitude at the test latitude.
function eastOf(base: Coordinates, meters: number): Coordinates {
  const metersPerDegree = 111_320 * Math.cos((base.lat * Math.PI) / 180);
  return { lat: base.lat, lng: base.lng + meters / metersPerDegree };
}

/**
 * Feeds `durationMs` of samples walking due east at `paceMinPerKm`
 * (pace = null means standing still). Returns the timestamp of the last sample.
 */
function walk(
  trigger: ReplanTrigger,
  from: number,
  durationMs: number,
  paceMinPerKm: number | null,
  distanceSoFar = { meters: 0 },
): number {
  let t = from;
  const end = from + durationMs;
  while (t <= end) {
    trigger.recordSample({
      coordinates: eastOf(START, distanceSoFar.meters),
      timestamp: t,
    });
    if (paceMinPerKm !== null) {
      distanceSoFar.meters += SAMPLE_INTERVAL_MS / 60_000 / paceMinPerKm * 1000;
    }
    t += SAMPLE_INTERVAL_MS;
  }
  return end;
}

describe("ReplanTrigger — full stop", () => {
  it("fires when the walker has not moved for the whole 4-minute window", () => {
    const trigger = new ReplanTrigger(15);
    const end = walk(trigger, T0, FULL_STOP_WINDOW_MS, null);
    expect(trigger.evaluate(end)).toBe("full-stop");
  });

  it("does not fire for a short pause inside a normal walk", () => {
    const trigger = new ReplanTrigger(15);
    const walked = { meters: 0 };
    const afterWalking = walk(trigger, T0, 10 * 60_000, 15, walked);
    // 50 seconds of standing still — well under the 4-minute window
    const afterPause = walk(trigger, afterWalking + SAMPLE_INTERVAL_MS, 50_000, null, walked);
    expect(trigger.evaluate(afterPause)).toBeNull();
  });

  it("does not fire before the window is filled with samples", () => {
    const trigger = new ReplanTrigger(15);
    const end = walk(trigger, T0, 2 * 60_000, null);
    expect(trigger.evaluate(end)).toBeNull();
  });
});

describe("ReplanTrigger — sustained slow pace", () => {
  it("fires when the 15-minute rolling average is more than 1.3x the planned pace", () => {
    const trigger = new ReplanTrigger(15); // threshold: 19.5 min/km
    const end = walk(trigger, T0, SUSTAINED_SLOW_WINDOW_MS, 25);
    expect(trigger.evaluate(end)).toBe("sustained-slow-pace");
  });

  it("does not fire when the rolling average is on plan", () => {
    const trigger = new ReplanTrigger(15);
    const end = walk(trigger, T0, SUSTAINED_SLOW_WINDOW_MS, 15);
    expect(trigger.evaluate(end)).toBeNull();
  });

  it("does not fire on a slow stretch that has not filled the window", () => {
    const trigger = new ReplanTrigger(15);
    const walked = { meters: 0 };
    const afterNormal = walk(trigger, T0, 10 * 60_000, 15, walked);
    const end = walk(trigger, afterNormal + SAMPLE_INTERVAL_MS, 3 * 60_000, 28, walked);
    expect(trigger.evaluate(end)).toBeNull();
  });
});

describe("ReplanTrigger — cooldown", () => {
  it("stays quiet right after firing, even while the condition holds", () => {
    const trigger = new ReplanTrigger(15);
    const end = walk(trigger, T0, FULL_STOP_WINDOW_MS, null);
    expect(trigger.evaluate(end)).toBe("full-stop");

    const stillStopped = walk(trigger, end + SAMPLE_INTERVAL_MS, FULL_STOP_WINDOW_MS, null);
    expect(trigger.evaluate(stillStopped)).toBeNull();
  });

  it("can fire again once the cooldown has elapsed", () => {
    const trigger = new ReplanTrigger(15);
    const firstEnd = walk(trigger, T0, FULL_STOP_WINDOW_MS, null);
    expect(trigger.evaluate(firstEnd)).toBe("full-stop");

    const secondStart = firstEnd + REPLAN_COOLDOWN_MS + SAMPLE_INTERVAL_MS;
    const secondEnd = walk(trigger, secondStart, FULL_STOP_WINDOW_MS, null);
    expect(trigger.evaluate(secondEnd)).toBe("full-stop");
  });

  it("reset() clears samples and the cooldown", () => {
    const trigger = new ReplanTrigger(15);
    const end = walk(trigger, T0, FULL_STOP_WINDOW_MS, null);
    expect(trigger.evaluate(end)).toBe("full-stop");

    trigger.reset();
    const afterReset = walk(trigger, end + SAMPLE_INTERVAL_MS, FULL_STOP_WINDOW_MS, null);
    expect(trigger.evaluate(afterReset)).toBe("full-stop");
  });
});
