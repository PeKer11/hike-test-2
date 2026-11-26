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

  describe("device fields: provider guess, null/zero rates, interval, accuracy median, stabilizer mode", () => {
    const feed = (n: number, f: (i: number) => { acc: number; speed?: number | null; heading?: number; ivS?: number }) => {
      let t = 1_000_000;
      for (let i = 0; i < n; i++) {
        const x = f(i);
        gpsDebug.received("watch", x.acc, t, x.speed, x.heading);
        t += (x.ivS ?? 1) * 1000;
      }
    };

    it("a GNSS phone with Doppler: prov gps, the interval and the accuracy median", () => {
      feed(40, (i) => ({ acc: 8 + (i % 5), speed: 1.3, heading: 10 }));
      const line = formatGpsDebug(gpsDebug.snapshot(), 17, true);
      expect(line).toContain("prov gps");
      expect(line).toContain("spd∅ 0%");
      expect(line).toContain("spd0 0%");
      expect(line).toContain("hdg∅ 0%");
      expect(line).toContain("iv 1s");
      expect(line).toContain("accMed 10m");
    });

    it("network-only: prov net, speed and heading always missing, a slow interval", () => {
      feed(30, (i) => ({ acc: [40, 60, 90][i % 3], ivS: [2, 5, 9][i % 3] }));
      const line = formatGpsDebug(gpsDebug.snapshot(), 17, true);
      expect(line).toContain("prov net");
      expect(line).toContain("spd∅ 100%");
      expect(line).toContain("hdg∅ 100%");
      expect(line).toContain("iv 5s");
      expect(line).toContain("accMed 60m");
    });

    it("network fixes that report speed exactly 0 are net too; GNSS with Doppler 0 is gps", () => {
      feed(30, () => ({ acc: 60, speed: 0, ivS: 4 }));
      expect(formatGpsDebug(gpsDebug.snapshot(), 17, true)).toContain("prov net");
      expect(formatGpsDebug(gpsDebug.snapshot(), 17, true)).toContain("spd0 100%");
      gpsDebug.reset();
      feed(30, () => ({ acc: 12, speed: 0 }));
      expect(formatGpsDebug(gpsDebug.snapshot(), 17, true)).toContain("prov gps");
    });

    it("anything in between is mix; only the last 30 watch fixes count", () => {
      feed(30, () => ({ acc: 60 }));
      feed(30, (i) => ({ acc: 30, speed: i % 3 === 0 ? 1.2 : null }));
      const line = formatGpsDebug(gpsDebug.snapshot(), 17, true);
      expect(line).toContain("prov mix");
      expect(line).toContain("accMed 30m");
      expect(line).toContain("spd∅ 67%");
    });

    it("shows trend, Doppler trust and contradictions from the stabilizer", () => {
      const base = { state: "nodoppler" as const, holding: false, held: 0, escapes: 3, recentres: 0, raw: { lat: 1, lng: 1 }, shown: { lat: 1, lng: 1 }, timestamp: 1 };
      gpsDebug.dot({ ...base, trend: true, dopplerTrusted: false, contradictions: 2 });
      const line = formatGpsDebug(gpsDebug.snapshot(), 17, true);
      expect(line).toContain("trend y");
      expect(line).toContain("dopT n");
      expect(line).toContain("contra 2");
    });

    it("before any fix: dashes, and the old fields default to trend n, dopT y, contra 0", () => {
      const line = formatGpsDebug(gpsDebug.snapshot(), 17, true);
      expect(line).toContain("prov -");
      expect(line).toContain("iv -");
      expect(line).toContain("accMed -");
      expect(line).toContain("trend n");
      expect(line).toContain("dopT y");
      expect(line).toContain("contra 0");
    });
  });
});
