import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { formatGpsDebug, gpsDebug } from "@/lib/geo/gps-debug";
import { locate } from "@/lib/geo/locate";

type Ok = (pos: GeolocationPosition) => void;

function fakeGeo() {
  const watches: Array<{ ok: Ok }> = [];
  vi.stubGlobal("navigator", {
    geolocation: {
      getCurrentPosition: vi.fn(),
      watchPosition: vi.fn((ok: Ok) => watches.push({ ok })),
      clearWatch: vi.fn(),
    },
  });
  return { watches };
}
const at = (t: number, acc = 8) =>
  ({ coords: { latitude: 32.08, longitude: 34.77, accuracy: acc, speed: null, heading: null }, timestamp: t }) as unknown as GeolocationPosition;

beforeEach(() => {
  vi.useFakeTimers();
  gpsDebug.reset();
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("gps debug counters", () => {
  it("counts received fixes and an out-of-order drop with its delta", () => {
    const { watches } = fakeGeo();
    locate({ purpose: "walk", onUpdate: () => {} });
    watches[0].ok(at(100_000));
    watches[0].ok(at(95_000, 12));
    const s = gpsDebug.snapshot();
    expect(s.received).toBe(2);
    expect(s.receivedWatch).toBe(2);
    expect(s.droppedOrder).toBe(1);
    expect(s.lastDeltaMs).toBe(5_000);
    expect(s.lastAccuracyM).toBe(12);
  });

  it("formats one line", () => {
    gpsDebug.published();
    expect(formatGpsDebug(gpsDebug.snapshot(), 17, true)).toContain("pub 1");
    expect(formatGpsDebug(gpsDebug.snapshot(), 17, true)).toContain("z 17");
  });
});
