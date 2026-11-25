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

  it("shows the device speed and how many fixes carry one", () => {
    gpsDebug.received("watch", 12, Date.now(), 1.34);
    let line = formatGpsDebug(gpsDebug.snapshot(), 17, true);
    expect(line).toContain("dop 1.3");
    expect(line).toContain("dop% 100");
    gpsDebug.received("watch", 12, Date.now());
    line = formatGpsDebug(gpsDebug.snapshot(), 17, true);
    expect(line).toContain("dop -");
    expect(line).toContain("dop% 50");
  });
  it("shows the dot stabilizer fields", () => {
    const here = { lat: 32.08, lng: 34.78 };
    const off = { lat: 32.08 + 6 / 111320, lng: 34.78 };
    gpsDebug.dot({ state: "stopped", holding: true, held: 12, escapes: 1, recentres: 2, raw: off, shown: here, timestamp: 100_000 });
    const s = gpsDebug.snapshot();
    expect(s.dotState).toBe("stopped");
    const line = formatGpsDebug(s, 17, true);
    expect(line).toContain("st stop");
    expect(line).toContain("hold y");
    expect(line).toContain("held 12");
    expect(line).toContain("esc 1");
    expect(line).toContain("rc 2");
    expect(line).toContain("d60 0m");
    expect(line).toContain("raw>dot 6m");
  });

  it("d60 sums the shown dot's path over the last 60 s of fixes", () => {
    const at = (m: number) => ({ lat: 32.08 + m / 111320, lng: 34.78 });
    const base = { state: "moving" as const, holding: false, held: 0, escapes: 0, recentres: 0 };
    gpsDebug.dot({ ...base, raw: at(0), shown: at(0), timestamp: 0 });
    gpsDebug.dot({ ...base, raw: at(10), shown: at(10), timestamp: 20_000 });
    gpsDebug.dot({ ...base, raw: at(25), shown: at(25), timestamp: 90_000 });
    // the first move is 70 s old (out), the second (15 m) is new (in)
    expect(formatGpsDebug(gpsDebug.snapshot(), 17, true)).toContain("d60 15m");
  });

  it("labels no-Doppler and unsure states", () => {
    const base = { holding: true, held: 0, escapes: 0, recentres: 0, raw: { lat: 1, lng: 1 }, shown: { lat: 1, lng: 1 }, timestamp: 1 };
    gpsDebug.dot({ ...base, state: "nodoppler" });
    expect(formatGpsDebug(gpsDebug.snapshot(), 17, true)).toContain("st nodop");
    gpsDebug.dot({ ...base, state: "unsure", holding: false });
    expect(formatGpsDebug(gpsDebug.snapshot(), 17, true)).toContain("st unsure");
    expect(formatGpsDebug(gpsDebug.snapshot(), 17, true)).toContain("hold n");
  });
});
