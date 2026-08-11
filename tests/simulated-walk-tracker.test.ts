import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Coordinates } from "@/lib/types";
import { haversineDistance } from "@/lib/utils/geo";
import { detectDeviation } from "@/lib/walk/deviation-detector";
import {
  SIMULATED_FAST_PACE_FACTOR,
  SIMULATED_SLOW_PACE_FACTOR,
} from "@/lib/walk/planner-actions";
import {
  replanPaceDirection,
  ReplanTrigger,
  type ReplanReason,
} from "@/lib/walk/replan-trigger";
import { SimulatedWalkTracker } from "@/lib/walk/simulated-walk-tracker";
import type { PaceUpdate } from "@/lib/walk/walk-tracker";

// A straight kilometre due north. Straight on purpose: a perpendicular offset
// is exactly that far from the segment it was taken off, and only a route that
// does not double back guarantees no other segment is nearer.
const ROUTE: Coordinates[] = [
  { lat: 32.08, lng: 34.78 },
  { lat: 32.089, lng: 34.78 },
];

// Long enough that a slow walker can spend a full 15-minute window on it
// without running out of route and being stopped by `totalDistance`.
const LONG_ROUTE: Coordinates[] = [
  { lat: 32.08, lng: 34.78 },
  { lat: 32.17, lng: 34.78 },
];

const PACE_MIN_PER_KM = 15;
const SPEED = 10;
const TICK_MS = 500;
// (1000 / (15 * 60)) * 10 * 0.5 — what one tick advances along the route.
const METERS_PER_TICK = 5.555555555555555;

// A real ORS detour would come back as an encoded polyline, so the fake
// `/api/directions` hands back one too and the tracker runs its own decoder
// over it. This path east, north and back west is ~190 m off the planned line
// at its widest — far enough that a position on it cannot be confused with the
// 80 m synthetic offset the fallback would produce.
const DETOUR: Coordinates[] = [
  { lat: 32.08, lng: 34.78 },
  { lat: 32.08, lng: 34.782 },
  { lat: 32.0827, lng: 34.782 },
  { lat: 32.0827, lng: 34.78 },
];

function encodeSignedValue(value: number): string {
  let remaining = value < 0 ? ~(value << 1) : value << 1;
  let encoded = "";
  while (remaining >= 0x20) {
    encoded += String.fromCharCode((0x20 | (remaining & 0x1f)) + 63);
    remaining >>= 5;
  }
  return encoded + String.fromCharCode(remaining + 63);
}

function encodePolyline(coords: Coordinates[]): string {
  let lastLat = 0;
  let lastLng = 0;
  let encoded = "";
  for (const coord of coords) {
    const lat = Math.round(coord.lat * 1e5);
    const lng = Math.round(coord.lng * 1e5);
    encoded += encodeSignedValue(lat - lastLat) + encodeSignedValue(lng - lastLng);
    lastLat = lat;
    lastLng = lng;
  }
  return encoded;
}

function makeTracker(onUpdate: (update: PaceUpdate) => void) {
  return new SimulatedWalkTracker(
    ROUTE,
    onUpdate,
    [],
    PACE_MIN_PER_KM,
    SPEED,
    TICK_MS,
  );
}

/** Every position the tracker reported, in order. */
function collect(): { updates: PaceUpdate[]; onUpdate: (u: PaceUpdate) => void } {
  const updates: PaceUpdate[] = [];
  return { updates, onUpdate: (update) => updates.push(update) };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("SimulatedWalkTracker — staying on the route", () => {
  it("reports positions the deviation detector reads as on-route", () => {
    const { updates, onUpdate } = collect();
    const tracker = makeTracker(onUpdate);

    tracker.start();
    vi.advanceTimersByTime(TICK_MS * 10);
    tracker.stop();

    expect(updates.length).toBe(10);
    for (const update of updates) {
      const deviation = detectDeviation(update.currentPosition, ROUTE);
      expect(deviation.deviationMeters).toBeLessThan(1);
      expect(deviation.needsReroute).toBe(false);
    }
  });

  it("has nothing to report as straying until asked", () => {
    const tracker = makeTracker(vi.fn());
    expect(tracker.isStraying).toBe(false);
  });
});

// The whole point: `deviation-detector.ts`'s >50 m trigger and the banner it
// drives could not be exercised end to end before this, because every reported
// position was interpolated along the route's own geometry.
//
// The stray used to be a perpendicular offset bolted onto the reported
// position — a line parallel to the route that snapped back onto it. Ariel's
// verdict watching it was that it "goes around and comes back" rather than
// reading as a wrong turn, so it is now a path ORS actually routed through a
// side point and back to a rejoin point ahead. `fetch` is the only thing faked
// below: the tracker's own decoding, distance tables and tick walking are all
// real.
describe("SimulatedWalkTracker — straying off the route", () => {
  /** How far along ROUTE a position sits, for checking the rejoin. */
  function distanceAlongRoute(position: Coordinates): number {
    return haversineDistance(
      ROUTE[0],
      detectDeviation(position, ROUTE).closestPointOnRoute,
    );
  }

  function mockDirections(geometry: Coordinates[] = DETOUR) {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        routes: [{ geometry: encodePolyline(geometry) }],
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("asks for a walking route through the walker, a side point and a rejoin point", async () => {
    const fetchMock = mockDirections();
    const tracker = makeTracker(vi.fn());

    tracker.start();
    vi.advanceTimersByTime(TICK_MS * 3);
    const startDistance = METERS_PER_TICK * 3;
    await tracker.strayOffRoute(80, 300);
    tracker.stop();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      { body: string },
    ];
    expect(url).toBe("/api/directions");

    const body = JSON.parse(init.body) as {
      profile: string;
      coordinates: Array<[number, number]>;
    };
    expect(body.profile).toBe("foot-walking");
    expect(body.coordinates).toHaveLength(3);

    // ORS takes [lng, lat], which is the opposite order to everything else here.
    const [a, b, c] = body.coordinates.map((coord) => ({
      lng: coord[0],
      lat: coord[1],
    }));

    // A is where the walker is: three ticks up a route that starts at ROUTE[0].
    expect(distanceAlongRoute(a)).toBeCloseTo(startDistance, 0);
    // B is genuinely off the line, by the offset it was given.
    expect(detectDeviation(b, ROUTE).deviationMeters).toBeCloseTo(80, 0);
    // C is `forMeters` further along the planned route, and still on it.
    expect(detectDeviation(c, ROUTE).deviationMeters).toBeLessThan(1);
    expect(distanceAlongRoute(c)).toBeCloseTo(startDistance + 300, 0);
  });

  it("defaults the rejoin point to 300 m ahead when not told otherwise", async () => {
    const fetchMock = mockDirections();
    const tracker = makeTracker(vi.fn());

    await tracker.strayOffRoute(80);

    const body = JSON.parse(
      (fetchMock.mock.calls[0] as unknown as [string, { body: string }])[1].body,
    ) as { coordinates: Array<[number, number]> };
    const c = { lng: body.coordinates[2][0], lat: body.coordinates[2][1] };

    expect(distanceAlongRoute(c)).toBeCloseTo(300, 0);
  });

  it("walks the fetched detour geometry instead of the planned line", async () => {
    const { updates, onUpdate } = collect();
    const tracker = makeTracker(onUpdate);
    mockDirections();

    tracker.start();
    await tracker.strayOffRoute(80, 300);
    expect(tracker.strayMode).toBe("detour");

    // Far enough along the detour's first leg to be out near its east side.
    vi.advanceTimersByTime(TICK_MS * 30);
    tracker.stop();

    const position = updates.at(-1)!.currentPosition;
    // Straight out east along the detour, not the 80 m the offset would give.
    expect(position.lng).toBeGreaterThan(34.781);
    expect(detectDeviation(position, ROUTE).deviationMeters).toBeGreaterThan(150);
    expect(detectDeviation(position, ROUTE).needsReroute).toBe(true);

    // Every reported position sits on the detour polyline, not beside it.
    for (const update of updates) {
      expect(
        detectDeviation(update.currentPosition, DETOUR).deviationMeters,
      ).toBeLessThan(1);
    }
  });

  it("picks the planned route back up at the rejoin point when the detour ends", async () => {
    const { updates, onUpdate } = collect();
    const tracker = makeTracker(onUpdate);
    mockDirections();

    tracker.start();
    await tracker.strayOffRoute(80, 300);
    // The detour is ~680 m of walking; 200 ticks is comfortably past its end.
    vi.advanceTimersByTime(TICK_MS * 200);
    tracker.stop();

    const last = updates.at(-1)!.currentPosition;
    expect(tracker.isStraying).toBe(false);
    expect(tracker.strayMode).toBeNull();
    expect(detectDeviation(last, ROUTE).deviationMeters).toBeLessThan(1);

    // Back on the planned route's own distance table at the rejoin point, and
    // walking on from there rather than restarting from where they left.
    expect(distanceAlongRoute(last)).toBeGreaterThan(300);
    const firstAfterRejoin = updates.find(
      (update, index) =>
        index > 0 &&
        detectDeviation(update.currentPosition, ROUTE).deviationMeters < 1,
    )!;
    expect(distanceAlongRoute(firstAfterRejoin.currentPosition)).toBeCloseTo(
      300,
      0,
    );
  });

  it("reports a loading status until the detour has been routed", async () => {
    let resolveFetch: (value: unknown) => void = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise((resolve) => {
            resolveFetch = resolve;
          }),
      ),
    );
    const tracker = makeTracker(vi.fn());

    expect(tracker.strayStatus).toBe("idle");

    const pending = tracker.strayOffRoute(80, 300);
    expect(tracker.strayStatus).toBe("loading");
    // A stray that is still being routed already counts as one, so a second
    // click on the button cancels rather than queuing another request.
    expect(tracker.isStraying).toBe(true);
    expect(tracker.strayMode).toBeNull();

    resolveFetch({
      ok: true,
      json: async () => ({ routes: [{ geometry: encodePolyline(DETOUR) }] }),
    });
    await pending;

    expect(tracker.strayStatus).toBe("active");
    expect(tracker.strayMode).toBe("detour");
  });

  it("stays on the planned line while the detour is still loading", async () => {
    const { updates, onUpdate } = collect();
    const tracker = makeTracker(onUpdate);
    let resolveFetch: (value: unknown) => void = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise((resolve) => {
            resolveFetch = resolve;
          }),
      ),
    );

    tracker.start();
    const pending = tracker.strayOffRoute(80, 300);
    vi.advanceTimersByTime(TICK_MS * 3);

    for (const update of updates) {
      expect(
        detectDeviation(update.currentPosition, ROUTE).deviationMeters,
      ).toBeLessThan(1);
    }

    resolveFetch({
      ok: true,
      json: async () => ({ routes: [{ geometry: encodePolyline(DETOUR) }] }),
    });
    await pending;
    tracker.stop();
  });

  // Best-effort, like the rest of this codebase's network work: a dev machine
  // with no ORS key must not take the walk simulation down with it.
  describe("when the routing service will not produce a detour", () => {
    it("falls back to the synthetic offset instead of throwing", async () => {
      const { updates, onUpdate } = collect();
      const tracker = makeTracker(onUpdate);
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => {
          throw new Error("ORS_API_KEY is not configured.");
        }),
      );

      tracker.start();
      await expect(tracker.strayOffRoute(80, 300)).resolves.toBe(false);

      expect(tracker.strayMode).toBe("synthetic");
      expect(tracker.strayStatus).toBe("active");
      expect(tracker.lastDetourError).toBe("ORS_API_KEY is not configured.");

      vi.advanceTimersByTime(TICK_MS * 3);
      tracker.stop();

      const deviation = detectDeviation(updates.at(-1)!.currentPosition, ROUTE);
      expect(deviation.deviationMeters).toBeCloseTo(80, 0);
      expect(deviation.needsReroute).toBe(true);
    });

    it("surfaces the API's own message for a non-OK response", async () => {
      const tracker = makeTracker(vi.fn());
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({
          ok: false,
          status: 429,
          json: async () => ({ error: "Rate limit exceeded." }),
        })),
      );

      await tracker.strayOffRoute(80, 300);

      expect(tracker.lastDetourError).toBe("Rate limit exceeded.");
      expect(tracker.strayMode).toBe("synthetic");
    });

    it("falls back when the service routes nothing at all", async () => {
      const tracker = makeTracker(vi.fn());
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({ ok: true, json: async () => ({ routes: [] }) })),
      );

      await tracker.strayOffRoute(80, 300);

      expect(tracker.strayMode).toBe("synthetic");
      expect(tracker.lastDetourError).toBe(
        "No walkable detour exists around this point.",
      );
    });

    // The synthetic fallback still has to end where the detour would have.
    it("rejoins the route at the point the detour would have come back to", async () => {
      const { updates, onUpdate } = collect();
      const tracker = makeTracker(onUpdate);
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => {
          throw new Error("network down");
        }),
      );

      tracker.start();
      await tracker.strayOffRoute(80, METERS_PER_TICK * 2.5);
      vi.advanceTimersByTime(TICK_MS * 5);
      tracker.stop();

      const deviations = updates.map(
        (update) => detectDeviation(update.currentPosition, ROUTE).deviationMeters,
      );

      expect(deviations[0]).toBeCloseTo(80, 0);
      expect(deviations[1]).toBeCloseTo(80, 0);
      expect(deviations[3]).toBeLessThan(1);
      expect(deviations[4]).toBeLessThan(1);
    });
  });

  it("rejoins the route on demand, mid-detour", async () => {
    const { updates, onUpdate } = collect();
    const tracker = makeTracker(onUpdate);
    mockDirections();

    tracker.start();
    await tracker.strayOffRoute(80, 300);
    vi.advanceTimersByTime(TICK_MS * 20);
    const wandered = detectDeviation(
      updates.at(-1)!.currentPosition,
      ROUTE,
    ).deviationMeters;

    tracker.returnToRoute();
    vi.advanceTimersByTime(TICK_MS * 2);
    tracker.stop();

    expect(wandered).toBeGreaterThan(50);
    expect(tracker.isStraying).toBe(false);
    expect(
      detectDeviation(updates.at(-1)!.currentPosition, ROUTE).deviationMeters,
    ).toBeLessThan(1);
  });

  it("cancels a detour that is still loading when told to rejoin", async () => {
    const { updates, onUpdate } = collect();
    const tracker = makeTracker(onUpdate);
    let resolveFetch: (value: unknown) => void = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise((resolve) => {
            resolveFetch = resolve;
          }),
      ),
    );

    tracker.start();
    const pending = tracker.strayOffRoute(80, 300);
    tracker.returnToRoute();
    expect(tracker.strayStatus).toBe("idle");

    // The response lands after the walker has already been put back: it must
    // not drag them off the line again.
    resolveFetch({
      ok: true,
      json: async () => ({ routes: [{ geometry: encodePolyline(DETOUR) }] }),
    });
    await expect(pending).resolves.toBe(false);

    vi.advanceTimersByTime(TICK_MS * 3);
    tracker.stop();

    expect(tracker.isStraying).toBe(false);
    for (const update of updates) {
      expect(
        detectDeviation(update.currentPosition, ROUTE).deviationMeters,
      ).toBeLessThan(1);
    }
  });

  it("ignores an offset that is not a usable distance", async () => {
    const fetchMock = mockDirections();
    const tracker = makeTracker(vi.fn());

    await tracker.strayOffRoute(Number.NaN);
    expect(tracker.isStraying).toBe(false);

    await tracker.strayOffRoute(0);
    expect(tracker.isStraying).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("drops a standing detour when the walk is stopped", async () => {
    mockDirections();
    const tracker = makeTracker(vi.fn());

    tracker.start();
    await tracker.strayOffRoute(80, 300);
    expect(tracker.strayMode).toBe("detour");

    tracker.stop();

    expect(tracker.isStraying).toBe(false);
    expect(tracker.strayStatus).toBe("idle");
  });
});

// The pace equivalent of the stray suite: `ReplanTrigger`'s 15-minute average
// is not something a human can produce by clicking, so the slow/fast re-plan
// path had no end-to-end exercise at all. Everything below runs the real
// trigger over the real emitted stream — no stubbed reasons.
describe("SimulatedWalkTracker — drifting off the planned pace", () => {
  // One tick is `tickMs * SPEED` = 5 simulated seconds, so a 15-minute window
  // takes 180 ticks to fill. 200 clears the 90% coverage rule with room.
  const TICKS_PER_WINDOW = 200;

  function makeLongTracker(onUpdate: (update: PaceUpdate) => void) {
    return new SimulatedWalkTracker(
      LONG_ROUTE,
      onUpdate,
      [],
      PACE_MIN_PER_KM,
      SPEED,
      TICK_MS,
    );
  }

  /** What the real trigger makes of a slice of the reported stream. */
  function evaluateOver(updates: PaceUpdate[]): ReplanReason | null {
    const trigger = new ReplanTrigger(PACE_MIN_PER_KM);
    for (const update of updates) {
      trigger.recordSample({
        coordinates: update.currentPosition,
        timestamp: update.timestamp,
      });
    }
    return trigger.evaluate(updates[updates.length - 1].timestamp);
  }

  it("reports the new pace on every update after the change", () => {
    const { updates, onUpdate } = collect();
    const tracker = makeLongTracker(onUpdate);

    tracker.start();
    vi.advanceTimersByTime(TICK_MS * 2);
    tracker.setPace(24);
    vi.advanceTimersByTime(TICK_MS * 2);
    tracker.stop();

    expect(updates.map((u) => u.paceMinPerKm)).toEqual([15, 15, 24, 24]);
  });

  it("covers less ground per tick once the pace slows", () => {
    const { updates, onUpdate } = collect();
    const tracker = makeLongTracker(onUpdate);

    tracker.start();
    vi.advanceTimersByTime(TICK_MS * 2);
    tracker.setPace(30); // half speed
    vi.advanceTimersByTime(TICK_MS * 2);
    tracker.stop();

    const plannedHop = haversineDistance(
      updates[0].currentPosition,
      updates[1].currentPosition,
    );
    const slowHop = haversineDistance(
      updates[2].currentPosition,
      updates[3].currentPosition,
    );

    expect(plannedHop).toBeCloseTo(METERS_PER_TICK, 1);
    expect(slowHop).toBeCloseTo(METERS_PER_TICK / 2, 1);
  });

  it("drives the real trigger to sustained-slow-pace after a full window", () => {
    const { updates, onUpdate } = collect();
    const tracker = makeLongTracker(onUpdate);

    tracker.start();
    tracker.setPace(PACE_MIN_PER_KM * SIMULATED_SLOW_PACE_FACTOR);
    vi.advanceTimersByTime(TICK_MS * TICKS_PER_WINDOW);
    tracker.stop();

    const reason = evaluateOver(updates);
    expect(reason).toBe("sustained-slow-pace");
    expect(replanPaceDirection(reason!)).toBe("slow");
  });

  it("drives the real trigger to sustained-fast-pace after a full window", () => {
    const { updates, onUpdate } = collect();
    const tracker = makeLongTracker(onUpdate);

    tracker.start();
    tracker.setPace(PACE_MIN_PER_KM * SIMULATED_FAST_PACE_FACTOR);
    vi.advanceTimersByTime(TICK_MS * TICKS_PER_WINDOW);
    tracker.stop();

    const reason = evaluateOver(updates);
    expect(reason).toBe("sustained-fast-pace");
    expect(replanPaceDirection(reason!)).toBe("fast");
  });

  it("says nothing while the walker holds the planned pace", () => {
    const { updates, onUpdate } = collect();
    const tracker = makeLongTracker(onUpdate);

    tracker.start();
    vi.advanceTimersByTime(TICK_MS * TICKS_PER_WINDOW);
    tracker.stop();

    expect(evaluateOver(updates)).toBeNull();
  });

  // 18 min/km against a planned 15 is 1.2×, inside the 1.3× threshold: behind,
  // but not far enough behind that the plan stops fitting.
  it("says nothing for a drift too small to cross the slow ratio", () => {
    const { updates, onUpdate } = collect();
    const tracker = makeLongTracker(onUpdate);

    tracker.start();
    tracker.setPace(18);
    vi.advanceTimersByTime(TICK_MS * TICKS_PER_WINDOW);
    tracker.stop();

    expect(evaluateOver(updates)).toBeNull();
  });

  it("does not fire before the window has been drifted for long enough", () => {
    const { updates, onUpdate } = collect();
    const tracker = makeLongTracker(onUpdate);

    tracker.start();
    tracker.setPace(PACE_MIN_PER_KM * SIMULATED_SLOW_PACE_FACTOR);
    // Half a window's worth of ticks at the drifted pace.
    vi.advanceTimersByTime(TICK_MS * (TICKS_PER_WINDOW / 2));
    tracker.stop();

    expect(evaluateOver(updates)).toBeNull();
  });

  // Five samples is the floor, and four of them spread over a full window is
  // still not a pace — the coverage and count rules have to both hold.
  it("does not fire on too few samples, however slow they are", () => {
    const { updates, onUpdate } = collect();
    const tracker = makeLongTracker(onUpdate);

    tracker.start();
    tracker.setPace(PACE_MIN_PER_KM * SIMULATED_SLOW_PACE_FACTOR);
    vi.advanceTimersByTime(TICK_MS * TICKS_PER_WINDOW);
    tracker.stop();

    // The same drifted walk, thinned to four widely-spaced fixes.
    const sparse = [0, 60, 120, 179].map((i) => updates[i]);
    expect(evaluateOver(sparse)).toBeNull();
  });

  it("stops triggering once the pace is put back to normal", () => {
    const { updates, onUpdate } = collect();
    const tracker = makeLongTracker(onUpdate);

    tracker.start();
    tracker.setPace(PACE_MIN_PER_KM * SIMULATED_SLOW_PACE_FACTOR);
    vi.advanceTimersByTime(TICK_MS * TICKS_PER_WINDOW);
    const drifted = updates.length;

    tracker.resetPace();
    vi.advanceTimersByTime(TICK_MS * TICKS_PER_WINDOW);
    tracker.stop();

    // The window that was all slow fires; the window after the reset does not.
    expect(evaluateOver(updates.slice(0, drifted))).toBe("sustained-slow-pace");
    expect(evaluateOver(updates.slice(drifted))).toBeNull();
    expect(tracker.currentPaceMinPerKm).toBe(PACE_MIN_PER_KM);
  });

  it("ignores a pace that is not a usable speed", () => {
    const tracker = makeLongTracker(vi.fn());

    for (const bad of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      tracker.setPace(bad);
      expect(tracker.currentPaceMinPerKm).toBe(PACE_MIN_PER_KM);
    }
  });

  it("drops a drifted pace when the walk is stopped", () => {
    const tracker = makeLongTracker(vi.fn());

    tracker.start();
    tracker.setPace(24);
    tracker.stop();

    expect(tracker.currentPaceMinPerKm).toBe(PACE_MIN_PER_KM);
    expect(tracker.plannedPace).toBe(PACE_MIN_PER_KM);
  });
});
