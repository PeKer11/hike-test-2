import { describe, it, expect, vi, afterEach } from "vitest";
import {
  ReplanTrigger,
  replanPaceDirection,
  FULL_STOP_WINDOW_MS,
  SUSTAINED_SLOW_WINDOW_MS,
  REPLAN_COOLDOWN_MS,
} from "@/lib/walk/replan-trigger";
import type { ReplanReason } from "@/lib/walk/replan-trigger";
import { PaceChecker } from "@/lib/walk/pace-checker";
import {
  DEFAULT_WALK_SETTINGS,
  toPaceResponseMode,
  type WalkSettings,
} from "@/lib/types/walk-settings";
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
  afterEach(() => {
    vi.useRealTimers();
  });

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

  // A re-plan tears the PaceChecker down and builds a new one. If the checker
  // owned its trigger, every re-plan would hand back a zeroed cooldown and the
  // 12-minute throttle would never hold.
  it("survives the PaceChecker being rebuilt by the re-plan it triggered", () => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);

    const trigger = new ReplanTrigger(15);
    const fired: ReplanReason[] = [];
    const onReplan = (reason: ReplanReason) => fired.push(reason);

    const stand = (checker: PaceChecker, from: number, durationMs: number) => {
      for (let t = from; t <= from + durationMs; t += SAMPLE_INTERVAL_MS) {
        checker.recordSample({ coordinates: START, timestamp: t });
      }
    };

    // Explicit `auto`: the shipped default is `off`, which would never report
    // and so could not show a cooldown holding across the rebuild.
    const checkerSettings: WalkSettings = {
      ...DEFAULT_WALK_SETTINGS,
      slowPaceMode: "auto",
    };
    const first = new PaceChecker(checkerSettings, trigger, onReplan);
    first.start();
    stand(first, T0, FULL_STOP_WINDOW_MS);
    vi.setSystemTime(T0 + FULL_STOP_WINDOW_MS);
    vi.advanceTimersByTime(DEFAULT_WALK_SETTINGS.paceCheckIntervalMs);
    expect(fired).toEqual(["full-stop"]);

    // The re-plan: old checker discarded, new one built on the same trigger.
    first.stop();
    const firedAt = Date.now();
    const second = new PaceChecker(checkerSettings, trigger, onReplan);
    second.start();
    stand(second, firedAt + SAMPLE_INTERVAL_MS, FULL_STOP_WINDOW_MS);
    vi.advanceTimersByTime(FULL_STOP_WINDOW_MS + DEFAULT_WALK_SETTINGS.paceCheckIntervalMs);

    // Still stopped, but inside the cooldown — must not re-plan again.
    expect(fired).toEqual(["full-stop"]);
    second.stop();
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

describe("ReplanTrigger — sustained fast pace", () => {
  it("fires when the 15-minute rolling average is well under the planned pace", () => {
    const trigger = new ReplanTrigger(15); // threshold: 11.55 min/km
    const end = walk(trigger, T0, SUSTAINED_SLOW_WINDOW_MS, 9);
    expect(trigger.evaluate(end)).toBe("sustained-fast-pace");
  });

  // Being ahead for one downhill stretch is no more a pace than being behind
  // for one uphill one — the fast side shares the slow side's window on purpose.
  it("does not fire on a quick stretch that has not filled the window", () => {
    const trigger = new ReplanTrigger(15);
    const walked = { meters: 0 };
    const afterNormal = walk(trigger, T0, 10 * 60_000, 15, walked);
    const end = walk(trigger, afterNormal + SAMPLE_INTERVAL_MS, 3 * 60_000, 8, walked);
    expect(trigger.evaluate(end)).toBeNull();
  });

  it("does not fire when the rolling average is on plan", () => {
    const trigger = new ReplanTrigger(15);
    const end = walk(trigger, T0, SUSTAINED_SLOW_WINDOW_MS, 15);
    expect(trigger.evaluate(end)).toBeNull();
  });

  it("classifies each reason's direction, counting a full stop as slow", () => {
    expect(replanPaceDirection("sustained-fast-pace")).toBe("fast");
    expect(replanPaceDirection("sustained-slow-pace")).toBe("slow");
    // The extreme end of the same complaint: the walk no longer fits the time.
    expect(replanPaceDirection("full-stop")).toBe("slow");
  });
});

// The two directions are independent settings, and each has three modes. What
// matters is that `off` is genuinely silent, `auto` still behaves the way the
// old single flag did, and `ask` reaches the caller as a question rather than
// as a rebuild.
describe("PaceChecker — per-direction pace modes", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  type Fired = [ReplanReason, "auto" | "ask"];

  function runUntilTrigger(
    settings: Partial<WalkSettings>,
    paceMinPerKm: number | null,
    windowMs: number,
  ): Fired[] {
    vi.useFakeTimers();
    vi.setSystemTime(T0);

    const trigger = new ReplanTrigger(15);
    const fired: Fired[] = [];
    const checker = new PaceChecker(
      { ...DEFAULT_WALK_SETTINGS, ...settings },
      trigger,
      (reason, response) => fired.push([reason, response]),
    );
    checker.start();

    const walked = { meters: 0 };
    let t = T0;
    while (t <= T0 + windowMs) {
      checker.recordSample({
        coordinates: eastOf(START, walked.meters),
        timestamp: t,
      });
      if (paceMinPerKm !== null) {
        walked.meters += (SAMPLE_INTERVAL_MS / 60_000 / paceMinPerKm) * 1000;
      }
      t += SAMPLE_INTERVAL_MS;
    }

    vi.setSystemTime(T0 + windowMs);
    vi.advanceTimersByTime(DEFAULT_WALK_SETTINGS.paceCheckIntervalMs);
    checker.stop();

    return fired;
  }

  const slow = (settings: Partial<WalkSettings>) =>
    runUntilTrigger(settings, 25, SUSTAINED_SLOW_WINDOW_MS);
  const fast = (settings: Partial<WalkSettings>) =>
    runUntilTrigger(settings, 9, SUSTAINED_SLOW_WINDOW_MS);

  it("never raises a slow trigger when the slow direction is off", () => {
    expect(slow({ slowPaceMode: "off" })).toEqual([]);
  });

  it("never raises a fast trigger when the fast direction is off", () => {
    expect(fast({ fastPaceMode: "off" })).toEqual([]);
  });

  it("asks for an immediate rebuild when the direction is on auto", () => {
    expect(slow({ slowPaceMode: "auto" })).toEqual([
      ["sustained-slow-pace", "auto"],
    ]);
    expect(fast({ fastPaceMode: "auto" })).toEqual([
      ["sustained-fast-pace", "auto"],
    ]);
  });

  it("asks the walker first when the direction is on ask", () => {
    expect(slow({ slowPaceMode: "ask" })).toEqual([
      ["sustained-slow-pace", "ask"],
    ]);
    expect(fast({ fastPaceMode: "ask" })).toEqual([
      ["sustained-fast-pace", "ask"],
    ]);
  });

  // The whole point of the split: one direction silenced must not silence the
  // other.
  it("keeps each direction's setting to itself", () => {
    expect(slow({ slowPaceMode: "auto", fastPaceMode: "off" })).toEqual([
      ["sustained-slow-pace", "auto"],
    ]);
    expect(fast({ fastPaceMode: "auto", slowPaceMode: "off" })).toEqual([
      ["sustained-fast-pace", "auto"],
    ]);
  });

  it("treats a full stop as the slow direction", () => {
    expect(
      runUntilTrigger({ slowPaceMode: "off" }, null, FULL_STOP_WINDOW_MS),
    ).toEqual([]);
    expect(
      runUntilTrigger({ slowPaceMode: "ask" }, null, FULL_STOP_WINDOW_MS),
    ).toEqual([["full-stop", "ask"]]);
  });

  // `evaluate` is what arms the cooldown and clears the window, so gating on
  // the setting before calling it would leave a stale window behind.
  it("still consumes the trigger window for a direction that is off", () => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);

    const trigger = new ReplanTrigger(15);
    const fired: Fired[] = [];
    const checker = new PaceChecker(
      { ...DEFAULT_WALK_SETTINGS, slowPaceMode: "off" },
      trigger,
      (reason, response) => fired.push([reason, response]),
    );
    checker.start();

    for (let t = T0; t <= T0 + FULL_STOP_WINDOW_MS; t += SAMPLE_INTERVAL_MS) {
      checker.recordSample({ coordinates: START, timestamp: t });
    }
    vi.setSystemTime(T0 + FULL_STOP_WINDOW_MS);
    vi.advanceTimersByTime(DEFAULT_WALK_SETTINGS.paceCheckIntervalMs);
    expect(fired).toEqual([]);

    // Turned back on, still standing still — the cooldown from the suppressed
    // evaluation holds, rather than a stale window firing instantly.
    checker.updateSettings({ ...DEFAULT_WALK_SETTINGS, slowPaceMode: "auto" });
    vi.advanceTimersByTime(DEFAULT_WALK_SETTINGS.paceCheckIntervalMs);
    expect(fired).toEqual([]);
    checker.stop();
  });
});

describe("toPaceResponseMode", () => {
  it("takes a stored mode at face value", () => {
    expect(toPaceResponseMode("ask", undefined)).toBe("ask");
    expect(toPaceResponseMode("off", true)).toBe("off");
  });

  // A returning walker's localStorage blob predates the split entirely.
  it("reads the old paceCheckEnabled flag when there is no mode yet", () => {
    expect(toPaceResponseMode(undefined, false)).toBe("off");
    expect(toPaceResponseMode(undefined, true)).toBe("auto");
  });

  it("defaults to auto for a blob that says nothing either way", () => {
    expect(toPaceResponseMode(undefined, undefined)).toBe("auto");
    expect(toPaceResponseMode("sometimes", undefined)).toBe("auto");
  });
});
