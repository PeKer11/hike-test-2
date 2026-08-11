import { describe, expect, it } from "vitest";

import type { Coordinates } from "@/lib/types";
import {
  DEFAULT_WALK_SETTINGS,
  type DeviationResponseMode,
  type WalkSettings,
} from "@/lib/types/walk-settings";
import { detectDeviation } from "@/lib/walk/deviation-detector";
import {
  DeviationMonitor,
  DEVIATION_REBUILD_COOLDOWN_MS,
  DEVIATION_SUSTAIN_MS,
} from "@/lib/walk/deviation-monitor";
import type { ReplanResponse } from "@/lib/walk/pace-checker";

const T0 = 1_700_000_000_000;
const TICK_MS = 1_000;

function settings(mode: DeviationResponseMode): WalkSettings {
  return { ...DEFAULT_WALK_SETTINGS, deviationMode: mode };
}

function setup(mode: DeviationResponseMode = "ask") {
  const responses: ReplanResponse[] = [];
  const monitor = new DeviationMonitor(settings(mode), (response) =>
    responses.push(response),
  );
  return { monitor, responses };
}

/**
 * Feed one deviation verdict per second, the way the planner's throttled
 * position handler does.
 */
function feed(
  monitor: DeviationMonitor,
  offRoute: boolean,
  durationMs: number,
  from = T0,
): number {
  let t = from;
  for (; t <= from + durationMs; t += TICK_MS) {
    monitor.record(offRoute, t);
  }
  return t;
}

describe("DeviationMonitor sustain window", () => {
  it("says nothing about a blip that ends before the window closes", () => {
    const { monitor, responses } = setup();

    feed(monitor, true, DEVIATION_SUSTAIN_MS - 5_000);

    expect(responses).toEqual([]);
  });

  it("raises the question once the walker has stayed off route for the window", () => {
    const { monitor, responses } = setup();

    feed(monitor, true, DEVIATION_SUSTAIN_MS);

    expect(responses).toEqual(["ask"]);
  });

  it("cancels a pending trigger when the walker rejoins the route in time", () => {
    const { monitor, responses } = setup();

    const t = feed(monitor, true, DEVIATION_SUSTAIN_MS - 5_000);
    monitor.record(false, t);
    // Straying again immediately starts a fresh window rather than resuming the
    // old one — otherwise a walker weaving around a corner would accumulate.
    feed(monitor, true, DEVIATION_SUSTAIN_MS - 5_000, t + TICK_MS);

    expect(responses).toEqual([]);
  });

  // "Asks again on a genuinely new excursion" now depends on the rebuild
  // cooldown as well as on the latch clearing, so it lives with the other
  // cooldown cases below.

  it("asks only once however long a single excursion lasts", () => {
    const { monitor, responses } = setup();

    feed(monitor, true, DEVIATION_SUSTAIN_MS * 5);

    expect(responses).toEqual(["ask"]);
  });

  it("refuses to call a window sustained on the strength of two fixes", () => {
    const { monitor, responses } = setup();

    // A GPS gap: two fixes an hour apart, both off route. The elapsed time
    // clears the window on its own, but nothing shows the walker was off route
    // in between.
    monitor.record(true, T0);
    monitor.record(true, T0 + 60 * 60_000);

    expect(responses).toEqual([]);
  });

  it("reads its clock from the fixes, not the wall clock", () => {
    const { monitor, responses } = setup();

    // The simulator's timestamps run ahead of Date.now(). Timestamps far in
    // the future must still measure a window correctly.
    const future = Date.now() + 10 * 60 * 60_000;
    feed(monitor, true, DEVIATION_SUSTAIN_MS, future);

    expect(responses).toEqual(["ask"]);
  });

  it("starts a fresh window after reset", () => {
    const { monitor, responses } = setup();

    const t = feed(monitor, true, DEVIATION_SUSTAIN_MS - 5_000);
    monitor.reset();
    feed(monitor, true, DEVIATION_SUSTAIN_MS - 5_000, t + TICK_MS);

    expect(responses).toEqual([]);
  });
});

describe("DeviationMonitor mode gate", () => {
  it("rebuilds without asking on auto", () => {
    const { monitor, responses } = setup("auto");

    feed(monitor, true, DEVIATION_SUSTAIN_MS);

    expect(responses).toEqual(["auto"]);
  });

  it("does nothing beyond the passive badge on off", () => {
    const { monitor, responses } = setup("off");

    feed(monitor, true, DEVIATION_SUSTAIN_MS * 3);

    expect(responses).toEqual([]);
  });

  it("acts on the mode in force when the window closes, not when it opened", () => {
    const { monitor, responses } = setup("ask");

    const t = feed(monitor, true, DEVIATION_SUSTAIN_MS - 5_000);
    monitor.updateSettings(settings("auto"));
    feed(monitor, true, 5_000, t + TICK_MS);

    expect(responses).toEqual(["auto"]);
  });

  it("keeps the window filling while off, so switching it on mid-excursion is immediate", () => {
    const { monitor, responses } = setup("off");

    // Off for the whole window: the walker sees nothing, but the excursion is
    // still being measured...
    const t = feed(monitor, true, DEVIATION_SUSTAIN_MS);
    expect(responses).toEqual([]);

    // ...so switching to ask is answered from the next fix, not from a fresh
    // 30-second clock started by touching the setting.
    monitor.updateSettings(settings("ask"));
    monitor.record(true, t + TICK_MS);

    expect(responses).toEqual(["ask"]);
  });
});

/**
 * One complete excursion: off route long enough to close the sustain window,
 * then back on the route. Returns the timestamp the next fix should carry.
 *
 * Rejoining is what makes this interesting — it clears the once-per-excursion
 * latch, so without a cooldown every one of these is a fresh rebuild.
 */
function excursion(monitor: DeviationMonitor, from: number): number {
  const rejoinedAt = feed(monitor, true, DEVIATION_SUSTAIN_MS, from);
  monitor.record(false, rejoinedAt);
  return rejoinedAt + TICK_MS;
}

describe("DeviationMonitor rebuild cooldown", () => {
  it("acts on the first sustained deviation with no cooldown in the way", () => {
    const { monitor, responses } = setup();

    excursion(monitor, T0);

    expect(responses).toEqual(["ask"]);
  });

  it("ignores a second excursion that starts inside the cooldown", () => {
    const { monitor, responses } = setup();

    const next = excursion(monitor, T0);
    excursion(monitor, next);

    expect(responses).toEqual(["ask"]);
  });

  it("ignores a second excursion inside the cooldown on auto too", () => {
    const { monitor, responses } = setup("auto");

    const next = excursion(monitor, T0);
    excursion(monitor, next);

    expect(responses).toEqual(["auto"]);
  });

  it("holds off a walker flapping across the threshold for the whole cooldown", () => {
    const { monitor, responses } = setup("auto");

    // The abuse case: rejoin, stray, rejoin, stray. Every cycle clears the
    // once-per-excursion latch, so the cooldown is the only thing standing
    // between this and a rebuild every thirty seconds.
    let t = T0;
    for (let i = 0; i < 5; i += 1) {
      t = excursion(monitor, t);
    }

    // Five excursions span about 2.7 minutes, inside the 3-minute cooldown.
    expect(t - T0).toBeLessThan(DEVIATION_REBUILD_COOLDOWN_MS);
    expect(responses).toEqual(["auto"]);
  });

  it("asks again on a genuinely new excursion once the cooldown has lapsed", () => {
    const { monitor, responses } = setup();

    excursion(monitor, T0);
    const firedAt = T0 + DEVIATION_SUSTAIN_MS;
    excursion(monitor, firedAt + DEVIATION_REBUILD_COOLDOWN_MS + TICK_MS);

    expect(responses).toEqual(["ask", "ask"]);
  });

  it("answers a walker still off route the moment the cooldown lapses", () => {
    const { monitor, responses } = setup();

    // A window that closed during the cooldown is not spent: the walker did
    // not get a rebuild out of it, so they must not be left on a stale route
    // for the rest of the excursion.
    const next = excursion(monitor, T0);
    const cooldownEndsAt = T0 + DEVIATION_SUSTAIN_MS + DEVIATION_REBUILD_COOLDOWN_MS;
    feed(monitor, true, cooldownEndsAt + 10_000 - next, next);

    expect(responses).toEqual(["ask", "ask"]);
  });

  it("arms the cooldown on ask even though the walker was never asked to confirm", () => {
    const { monitor, responses } = setup("ask");

    // Nothing here ever tells the monitor what the walker chose — dismissing
    // the banner and confirming it are the same from its side, and both leave
    // the cooldown armed. If arming depended on a rebuild really happening,
    // this second excursion would fire.
    const next = excursion(monitor, T0);
    excursion(monitor, next);

    expect(responses).toEqual(["ask"]);
  });

  it("charges no cooldown for a window that closed while the mode was off", () => {
    const { monitor, responses } = setup("off");

    // `off` decided nothing and called nothing, so it has spent nothing: the
    // walker who switches the feature on gets answered straight away.
    const next = excursion(monitor, T0);
    expect(responses).toEqual([]);

    monitor.updateSettings(settings("ask"));
    excursion(monitor, next);

    expect(responses).toEqual(["ask"]);
  });

  it("keeps the cooldown across a mid-walk deviationMode change", () => {
    const { monitor, responses } = setup("ask");

    const next = excursion(monitor, T0);
    // Toggling the setting must not be a cheap way to clear the cooldown.
    monitor.updateSettings(settings("auto"));
    excursion(monitor, next);

    expect(responses).toEqual(["ask"]);
  });

  it("clears the cooldown on reset, since a new walk owes nothing to the last", () => {
    const { monitor, responses } = setup();

    const next = excursion(monitor, T0);
    monitor.reset();
    excursion(monitor, next);

    expect(responses).toEqual(["ask", "ask"]);
  });
});

describe("DeviationMonitor against real detectDeviation output", () => {
  // A straight route running east along a line of latitude.
  const route: Coordinates[] = Array.from({ length: 40 }, (_, i) => ({
    lat: 32.08,
    lng: 34.78 + i * 0.0005,
  }));

  /** Roughly `meters` north of the route at the same longitude. */
  function northOf(index: number, meters: number): Coordinates {
    return {
      lat: route[index].lat + meters / 111_320,
      lng: route[index].lng,
    };
  }

  it("stays quiet for a walker weaving inside the 50 m threshold", () => {
    const { monitor, responses } = setup();

    let t = T0;
    for (let i = 0; i < 40; i += 1) {
      const position = northOf(i % route.length, i % 2 === 0 ? 5 : 30);
      const result = detectDeviation(position, route, null);
      monitor.record(result.needsReroute, t);
      t += TICK_MS;
    }

    expect(responses).toEqual([]);
  });

  it("asks for a walker genuinely 200 m off the path for the window", () => {
    const { monitor, responses } = setup();

    let t = T0;
    let segmentIndex: number | null = null;
    for (let i = 0; i <= DEVIATION_SUSTAIN_MS / TICK_MS; i += 1) {
      const result = detectDeviation(northOf(5, 200), route, segmentIndex);
      segmentIndex = result.closestSegmentIndex;
      monitor.record(result.needsReroute, t);
      t += TICK_MS;
    }

    expect(responses).toEqual(["ask"]);
  });

  it("keeps reporting off-route on every fix while the cooldown suppresses the offer", () => {
    const { monitor, responses } = setup();

    // The badge in WalkPlannerApp is driven by `needsReroute` straight off
    // `detectDeviation`, never through the monitor. It costs nothing and tells
    // the walker something true, so the cooldown must not touch it: every fix
    // out here still says "off route" even while the rebuild offer is held.
    const verdicts: boolean[] = [];
    let t = T0;
    let segmentIndex: number | null = null;
    // Long enough to span an excursion, a rejoin and a second excursion inside
    // the cooldown.
    while (t < T0 + DEVIATION_REBUILD_COOLDOWN_MS) {
      const result = detectDeviation(northOf(5, 200), route, segmentIndex);
      segmentIndex = result.closestSegmentIndex;
      verdicts.push(result.needsReroute);
      monitor.record(result.needsReroute, t);
      t += TICK_MS;
    }

    expect(verdicts.every(Boolean)).toBe(true);
    expect(verdicts.length).toBeGreaterThan(DEVIATION_SUSTAIN_MS / TICK_MS);
    expect(responses).toEqual(["ask"]);
  });

  it("does not ask for a single 200 m outlier fix among on-route ones", () => {
    const { monitor, responses } = setup();

    let t = T0;
    let segmentIndex: number | null = null;
    for (let i = 0; i < 60; i += 1) {
      // One bad fix every ten seconds, on route otherwise.
      const position = i % 10 === 0 ? northOf(i % 30, 200) : northOf(i % 30, 3);
      const result = detectDeviation(position, route, segmentIndex);
      segmentIndex = result.closestSegmentIndex;
      monitor.record(result.needsReroute, t);
      t += TICK_MS;
    }

    expect(responses).toEqual([]);
  });
});
