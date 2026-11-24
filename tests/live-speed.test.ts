import { describe, expect, it } from "vitest";

import { LiveSpeed } from "@/lib/walk/live-speed";

const T0 = 1_700_000_000_000;

function feed(live: LiveSpeed, from: number, to: number, speed: (s: number) => number | undefined) {
  const out: Array<{ s: number; kmh: number | null; state: string }> = [];
  for (let s = from; s < to; s += 1) {
    live.record({ timestamp: T0 + s * 1000, speedMps: speed(s) });
    out.push({ s, ...live.current(T0 + s * 1000) });
  }
  return out;
}

function seeded(seed: number) {
  let x = seed;
  return () => {
    x = (x * 1664525 + 1013904223) % 4294967296;
    return x / 4294967296;
  };
}

describe("LiveSpeed", () => {
  it("is paused from the first fix while standing, then moving within 3 fixes of a start", () => {
    const live = new LiveSpeed();
    const standing = feed(live, 0, 30, () => 0);
    expect(standing.every((r) => r.state === "paused" && r.kmh === 0)).toBe(true);
    const walking = feed(live, 30, 40, () => 1.4);
    const ok = walking.find((r) => r.state === "moving" && (r.kmh ?? 0) >= 4.0);
    expect(ok).toBeDefined();
    expect(ok!.s - 30).toBeLessThanOrEqual(3);
  });

  it("is paused with 0 within 3 fixes of a stop", () => {
    const live = new LiveSpeed();
    feed(live, 0, 20, () => 1.4);
    const stopping = feed(live, 20, 30, () => 0);
    const p = stopping.find((r) => r.state === "paused" && r.kmh === 0);
    expect(p).toBeDefined();
    expect(p!.s - 20).toBeLessThanOrEqual(3);
  });

  it("one odd zero in a walk never pauses", () => {
    const live = new LiveSpeed();
    const r = feed(live, 0, 30, (s) => (s === 15 ? 0 : 1.4));
    expect(r.slice(3).every((x) => x.state === "moving")).toBe(true);
  });

  it("ignores positions entirely: poor accuracy cannot pause a walker, jitter cannot move a stander", () => {
    // Only Doppler is an input, so 30 m accuracy / +-15 m jumps are invisible to it.
    const walking = new LiveSpeed();
    expect(feed(walking, 0, 60, () => 1.4).slice(3).every((r) => r.state === "moving")).toBe(true);
    const standing = new LiveSpeed();
    expect(feed(standing, 0, 60, () => 0).every((r) => r.state === "paused")).toBe(true);
  });

  it("steady walking with Doppler noise changes by at most 0.5 km/h per second", () => {
    const live = new LiveSpeed();
    const rnd = seeded(7);
    const r = feed(live, 0, 120, () => 1.4 + (rnd() * 2 - 1) * 0.12);
    for (let i = 4; i < r.length; i += 1) {
      expect(Math.abs((r[i].kmh as number) - (r[i - 1].kmh as number))).toBeLessThanOrEqual(0.5);
    }
  });

  it("hysteresis: standing with Doppler alternating 0.4 / 0.5 stays paused", () => {
    const live = new LiveSpeed();
    const r = feed(live, 0, 30, (s) => (s % 2 ? 0.5 : 0.4));
    expect(r.every((x) => x.state === "paused")).toBe(true);
  });

  it("is unknown with no reading for 3 s, and fixes without a speed make no reading", () => {
    const live = new LiveSpeed();
    expect(live.current(T0).state).toBe("unknown");
    feed(live, 0, 10, () => undefined);
    expect(live.current(T0 + 10_000)).toEqual({ kmh: null, state: "unknown" });
    feed(live, 10, 20, () => 1.4);
    expect(live.current(T0 + 19_000).state).toBe("moving");
    expect(live.current(T0 + 19_000 + 3_001)).toEqual({ kmh: null, state: "unknown" });
  });
});
