import { describe, expect, it } from "vitest";

import type { Coordinates } from "@/lib/types";
import { bearingBetween, haversineDistance } from "@/lib/utils/geo";
import {
  HeadingMonitor,
  HEADING_SUSTAIN_MS,
  HEADING_TOLERANCE_DEG,
  MIN_HEADING_CHORD_METERS,
} from "@/lib/walk/heading-monitor";

const T0 = 1_700_000_000_000;
const TICK_MS = 1_000;
const START: Coordinates = { lat: 32.08, lng: 34.78 };

/** ~1.4 m/s, an ordinary walking pace, which is what the constants are sized against. */
const WALK_SPEED_MPS = 1.4;

const METERS_PER_DEG_LAT = 111_320;
function metersPerDegLng(lat: number): number {
  return METERS_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
}

/** Move `meters` from `from` along a compass `bearing`. */
function step(from: Coordinates, bearing: number, meters: number): Coordinates {
  const rad = (bearing * Math.PI) / 180;
  return {
    lat: from.lat + (meters * Math.cos(rad)) / METERS_PER_DEG_LAT,
    lng: from.lng + (meters * Math.sin(rad)) / metersPerDegLng(from.lat),
  };
}

/**
 * Feed one fix a second along a bearing, the way the planner's throttled
 * position handler does. Returns where and when the walker ended up, so legs
 * can be chained into a turn.
 */
function walk(
  monitor: HeadingMonitor,
  bearing: number,
  durationMs: number,
  from: Coordinates = START,
  at: number = T0,
  speedMps: number = WALK_SPEED_MPS,
): { position: Coordinates; timestamp: number } {
  let position = from;
  let t = at;

  monitor.record(position, t);
  for (let elapsed = TICK_MS; elapsed <= durationMs; elapsed += TICK_MS) {
    position = step(position, bearing, (speedMps * TICK_MS) / 1000);
    t = at + elapsed;
    monitor.record(position, t);
  }

  return { position, timestamp: t };
}

/**
 * Walk a wobble: alternating five-second legs `amplitude` degrees either side
 * of `center`, for comfortably longer than the window. This is the shape of an
 * ordinary pavement — stepping round people, drifting to one side and back —
 * and it must not read as a change of mind.
 */
function weave(
  monitor: HeadingMonitor,
  center: number,
  amplitude: number,
): { timestamp: number } {
  const LEG_SECONDS = 5;
  const legs = Math.ceil((HEADING_SUSTAIN_MS * 1.5) / 1000 / LEG_SECONDS);

  let position = START;
  let t = T0;
  monitor.record(position, t);

  for (let leg = 0; leg < legs; leg += 1) {
    const bearing = center + (leg % 2 === 0 ? amplitude : -amplitude);
    for (let i = 0; i < LEG_SECONDS; i += 1) {
      position = step(position, bearing, WALK_SPEED_MPS);
      t += TICK_MS;
      monitor.record(position, t);
    }
  }

  return { timestamp: t };
}

describe("HeadingMonitor sustain window", () => {
  it("has no answer before the window has been filled", () => {
    const monitor = new HeadingMonitor();

    const { timestamp } = walk(monitor, 90, HEADING_SUSTAIN_MS - 5_000);

    expect(monitor.sustainedHeading(timestamp)).toBeNull();
  });

  it("reports the direction once the walker has held it for the window", () => {
    const monitor = new HeadingMonitor();

    const { timestamp } = walk(monitor, 90, HEADING_SUSTAIN_MS);

    expect(monitor.sustainedHeading(timestamp)).toBeCloseTo(90, 0);
  });

  it("reports a north-westerly heading as the bearing it actually was", () => {
    const monitor = new HeadingMonitor();

    const { timestamp } = walk(monitor, 315, HEADING_SUSTAIN_MS);

    expect(monitor.sustainedHeading(timestamp)).toBeCloseTo(315, 0);
  });

  it("has no answer from a single fix, however old its timestamp claims to be", () => {
    const monitor = new HeadingMonitor();

    monitor.record(START, T0);

    expect(monitor.sustainedHeading(T0 + HEADING_SUSTAIN_MS * 10)).toBeNull();
  });

  it("forgets the direction a walker held before a new walk started", () => {
    const monitor = new HeadingMonitor();
    const { timestamp } = walk(monitor, 90, HEADING_SUSTAIN_MS);

    monitor.reset();

    expect(monitor.sustainedHeading(timestamp)).toBeNull();
  });
});

describe("HeadingMonitor rejects what is not a chosen direction", () => {
  it("has no answer for a walker who turned a corner mid-window", () => {
    const monitor = new HeadingMonitor();

    // Due north for half the window, then due east for the other half: a
    // corner, not a direction.
    const north = walk(monitor, 0, HEADING_SUSTAIN_MS / 2);
    const east = walk(
      monitor,
      90,
      HEADING_SUSTAIN_MS / 2,
      north.position,
      north.timestamp + TICK_MS,
    );

    expect(monitor.sustainedHeading(east.timestamp)).toBeNull();
  });

  it("has no answer for a walker who doubled back on themselves", () => {
    const monitor = new HeadingMonitor();

    const out = walk(monitor, 0, HEADING_SUSTAIN_MS / 2);
    const back = walk(
      monitor,
      180,
      HEADING_SUSTAIN_MS / 2,
      out.position,
      out.timestamp + TICK_MS,
    );

    expect(monitor.sustainedHeading(back.timestamp)).toBeNull();
  });

  it("has no answer for a walker who has stopped, however long they stand there", () => {
    const monitor = new HeadingMonitor();

    // Standing still: plenty of fixes spanning the window, no ground covered,
    // so no chord ever reaches the minimum displacement.
    const { timestamp } = walk(monitor, 90, HEADING_SUSTAIN_MS * 2, START, T0, 0);

    expect(monitor.sustainedHeading(timestamp)).toBeNull();
  });

  it("has no answer for a walker too slow to cover two chords in the window", () => {
    const monitor = new HeadingMonitor();

    // Dead straight, but at a shuffle: 30 m over the window is one chord's
    // worth of displacement, and one chord is a direction rather than a
    // sustained one.
    const speed = (MIN_HEADING_CHORD_METERS * 1.5) / (HEADING_SUSTAIN_MS / 1000);
    const { timestamp } = walk(
      monitor,
      90,
      HEADING_SUSTAIN_MS,
      START,
      T0,
      speed,
    );

    expect(monitor.sustainedHeading(timestamp)).toBeNull();
  });

  it("has no answer once the fixes have gone quiet for longer than the window", () => {
    const monitor = new HeadingMonitor();

    const { timestamp } = walk(monitor, 90, HEADING_SUSTAIN_MS);

    expect(monitor.sustainedHeading(timestamp + 1_000)).toBeCloseTo(90, 0);
    expect(
      monitor.sustainedHeading(timestamp + HEADING_SUSTAIN_MS + 1_000),
    ).toBeNull();
  });
});

describe("HeadingMonitor tolerance", () => {
  it("still answers for a walker weaving about a steady direction", () => {
    const monitor = new HeadingMonitor();

    const { timestamp } = weave(monitor, 90, HEADING_TOLERANCE_DEG - 5);

    const heading = monitor.sustainedHeading(timestamp);
    expect(heading).not.toBeNull();
    expect(Math.abs((heading as number) - 90)).toBeLessThan(
      HEADING_TOLERANCE_DEG,
    );
  });

  it("has no answer for a walker who turned less than a right angle", () => {
    const monitor = new HeadingMonitor();

    // The case that caught the first version of this rule out. Measured
    // against the window's average heading, an 80° turn read as "consistent":
    // the average landed between the two streets and the chord straddling the
    // turn reported the blend. Measured chord against chord, it is a turn.
    const first = walk(monitor, 50, HEADING_SUSTAIN_MS / 2);
    const second = walk(
      monitor,
      130,
      HEADING_SUSTAIN_MS / 2,
      first.position,
      first.timestamp + TICK_MS,
    );

    expect(monitor.sustainedHeading(second.timestamp)).toBeNull();
  });

  it("answers across the 0°/360° seam rather than reading it as a reversal", () => {
    const monitor = new HeadingMonitor();

    // Due north with a wobble that crosses due north: the naive
    // subtract-and-compare reads 350° and 10° as 340° apart.
    const { timestamp } = weave(monitor, 0, 20);

    const heading = monitor.sustainedHeading(timestamp);
    expect(heading).not.toBeNull();
    // Expressed as a distance from north so a legitimate 359.4° doesn't read
    // as a failure.
    expect(Math.min(heading as number, 360 - (heading as number))).toBeLessThan(
      5,
    );
  });
});

describe("HeadingMonitor window boundaries", () => {
  it("answers about the last half minute, not about a direction abandoned before it", () => {
    const monitor = new HeadingMonitor();

    const east = walk(monitor, 90, HEADING_SUSTAIN_MS);
    // A full fresh window due south. The eastward leg is now entirely outside
    // the window and must not drag the answer round with it.
    const south = walk(
      monitor,
      180,
      HEADING_SUSTAIN_MS,
      east.position,
      east.timestamp + TICK_MS,
    );

    expect(monitor.sustainedHeading(south.timestamp)).toBeCloseTo(180, 0);
  });

  it("keeps enough history to span the window rather than trimming just inside it", () => {
    const monitor = new HeadingMonitor();

    // Exactly the window and not a fix more. Trimming to the cutoff instead of
    // keeping one sample at or before it would leave the span a second short,
    // and the monitor would never answer at all.
    const { timestamp } = walk(monitor, 90, HEADING_SUSTAIN_MS * 3);

    expect(monitor.sustainedHeading(timestamp)).toBeCloseTo(90, 0);
  });
});

describe("the test's own geometry", () => {
  // `step` is the only thing in this file the implementation doesn't own, and
  // every expectation above is stated in the bearings it produces.
  it("steps the distance and the bearing it was asked for", () => {
    const moved = step(START, 90, 100);

    expect(haversineDistance(START, moved)).toBeCloseTo(100, 0);
    expect(bearingBetween(START, moved)).toBeCloseTo(90, 1);
  });
});
