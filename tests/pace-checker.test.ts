import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_WALK_SETTINGS,
  MIN_PACE_CHECK_INTERVAL_MS,
  type PaceResponseMode,
  type WalkSettings,
} from "@/lib/types/walk-settings";
import { PaceChecker, type ReplanResponse } from "@/lib/walk/pace-checker";
import { SIMULATED_SLOW_PACE_FACTOR } from "@/lib/walk/planner-actions";
import { ReplanTrigger, type ReplanReason } from "@/lib/walk/replan-trigger";
import { SimulatedWalkTracker } from "@/lib/walk/simulated-walk-tracker";

/**
 * A ReplanTrigger that reports whatever the test wants on the next evaluate.
 * The real trigger's own windows are covered by replan-trigger.test.ts; what
 * matters here is only what the checker does with a reason once it has one.
 */
class StubTrigger extends ReplanTrigger {
  next: ReplanReason | null = null;
  evaluateCalls = 0;

  override evaluate(): ReplanReason | null {
    this.evaluateCalls += 1;
    const reason = this.next;
    this.next = null;
    return reason;
  }
}

function settings(overrides: Partial<WalkSettings> = {}): WalkSettings {
  return {
    ...DEFAULT_WALK_SETTINGS,
    paceCheckIntervalMs: MIN_PACE_CHECK_INTERVAL_MS,
    ...overrides,
  };
}

function setup(overrides: Partial<WalkSettings> = {}) {
  const trigger = new StubTrigger(12);
  const calls: { reason: ReplanReason; response: ReplanResponse }[] = [];
  const checker = new PaceChecker(settings(overrides), trigger, (reason, response) =>
    calls.push({ reason, response }),
  );
  return { trigger, calls, checker };
}

/** Run one check cycle with the trigger primed to fire. */
function fire(
  trigger: StubTrigger,
  checker: PaceChecker,
  reason: ReplanReason,
): void {
  trigger.next = reason;
  vi.advanceTimersByTime(MIN_PACE_CHECK_INTERVAL_MS);
  void checker;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("PaceChecker pace-mode gate", () => {
  const cases: {
    reason: ReplanReason;
    setting: "fastPaceMode" | "slowPaceMode";
    mode: PaceResponseMode;
    expected: ReplanResponse | "silent";
  }[] = [
    { reason: "sustained-fast-pace", setting: "fastPaceMode", mode: "auto", expected: "auto" },
    { reason: "sustained-fast-pace", setting: "fastPaceMode", mode: "ask", expected: "ask" },
    { reason: "sustained-fast-pace", setting: "fastPaceMode", mode: "off", expected: "silent" },
    { reason: "sustained-slow-pace", setting: "slowPaceMode", mode: "auto", expected: "auto" },
    { reason: "sustained-slow-pace", setting: "slowPaceMode", mode: "ask", expected: "ask" },
    { reason: "sustained-slow-pace", setting: "slowPaceMode", mode: "off", expected: "silent" },
    { reason: "full-stop", setting: "slowPaceMode", mode: "ask", expected: "ask" },
    { reason: "full-stop", setting: "slowPaceMode", mode: "off", expected: "silent" },
  ];

  for (const { reason, setting, mode, expected } of cases) {
    it(`${reason} with ${setting}=${mode} ${
      expected === "silent" ? "tells the walker nothing" : `asks the caller to ${expected}`
    }`, () => {
      const { trigger, calls, checker } = setup({ [setting]: mode });
      checker.start();

      fire(trigger, checker, reason);

      if (expected === "silent") {
        expect(calls).toEqual([]);
      } else {
        expect(calls).toEqual([{ reason, response: expected }]);
      }
      checker.stop();
    });
  }

  it("reads the fast setting for a fast trigger and the slow one for a slow trigger", () => {
    // Opposite modes, so a checker reading the wrong one is unmissable.
    const { trigger, calls, checker } = setup({
      fastPaceMode: "off",
      slowPaceMode: "ask",
    });
    checker.start();

    fire(trigger, checker, "sustained-fast-pace");
    expect(calls).toEqual([]);

    fire(trigger, checker, "sustained-slow-pace");
    expect(calls).toEqual([{ reason: "sustained-slow-pace", response: "ask" }]);
    checker.stop();
  });

  it("still evaluates the trigger for a direction set to off, so the window can't go stale", () => {
    const { trigger, checker } = setup({ slowPaceMode: "off" });
    checker.start();

    fire(trigger, checker, "sustained-slow-pace");

    expect(trigger.evaluateCalls).toBe(1);
    checker.stop();
  });

  it("says nothing at all while the trigger reports no drift", () => {
    const { calls, checker } = setup();
    checker.start();

    vi.advanceTimersByTime(MIN_PACE_CHECK_INTERVAL_MS * 3);

    expect(calls).toEqual([]);
    checker.stop();
  });

  it("stops checking once the walk ends", () => {
    const { trigger, calls, checker } = setup();
    checker.start();
    checker.stop();

    trigger.next = "sustained-slow-pace";
    vi.advanceTimersByTime(MIN_PACE_CHECK_INTERVAL_MS * 2);

    expect(calls).toEqual([]);
  });

  it("applies a mode changed mid-walk to the very next check", () => {
    const { trigger, calls, checker } = setup({ slowPaceMode: "auto" });
    checker.start();

    checker.updateSettings(settings({ slowPaceMode: "off" }));
    fire(trigger, checker, "sustained-slow-pace");

    expect(calls).toEqual([]);
    checker.stop();
  });

  // The checker's own clock, not the wall clock. The trigger's windows are
  // built out of sample timestamps, and the simulator's run ahead of real time
  // by its speed multiplier — comparing the two put every sample in the future
  // and made the coverage check unsatisfiable, so a simulated walk could never
  // trigger a re-plan however far off pace it went.
  it("fires for a simulated walker whose timestamps run ahead of the wall clock", () => {
    const calls: ReplanReason[] = [];
    const checker = new PaceChecker(
      settings({ slowPaceMode: "auto" }),
      new ReplanTrigger(15),
      (reason) => calls.push(reason),
    );

    const tracker = new SimulatedWalkTracker(
      // ~10 km due north: long enough for a slow walker to spend a full window on.
      [
        { lat: 32.08, lng: 34.78 },
        { lat: 32.17, lng: 34.78 },
      ],
      (update) =>
        checker.recordSample({
          coordinates: update.currentPosition,
          timestamp: update.timestamp,
        }),
      [],
      15,
      10,
      500,
    );

    checker.start();
    tracker.start();
    tracker.setPace(15 * SIMULATED_SLOW_PACE_FACTOR);
    // 100 s of wall clock = ~16 simulated minutes, one full 15-minute window.
    vi.advanceTimersByTime(100_000);
    tracker.stop();
    checker.stop();

    expect(calls).toContain("sustained-slow-pace");
  });

  it("refuses a check interval faster than the 30s floor", () => {
    const { trigger, calls, checker } = setup({ paceCheckIntervalMs: 1_000 });
    checker.start();

    trigger.next = "sustained-slow-pace";
    vi.advanceTimersByTime(MIN_PACE_CHECK_INTERVAL_MS - 1_000);
    expect(calls).toEqual([]);

    vi.advanceTimersByTime(1_000);
    expect(calls).toEqual([
      { reason: "sustained-slow-pace", response: "auto" },
    ]);
    checker.stop();
  });
});
