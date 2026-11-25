import { describe, expect, it } from "vitest";

import { TrailFilter, withLiveTail } from "@/lib/walk/trail-filter";
import { haversineDistance } from "@/lib/utils/geo";
import type { Coordinates } from "@/lib/types";

const M_PER_DEG = 111_320;
const at = (northM: number, eastM = 0): Coordinates => ({ lat: 32 + northM / M_PER_DEG, lng: 34 + eastM / (M_PER_DEG * Math.cos((32 * Math.PI) / 180)) });
const length = (pts: Coordinates[]) => pts.slice(1).reduce((s, p, i) => s + haversineDistance(pts[i], p), 0);

describe("TrailFilter", () => {
  it("a phone standing still with 5-35 m reported accuracy keeps at most 2 points over 180 fixes", () => {
    // Reported accuracy is a radius that holds the truth; the real error stays within half of it.
    const f = new TrailFilter();
    const kept: Coordinates[] = [];
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
    for (let i = 0; i < 180; i += 1) {
      const noise = 5 + Math.abs(rnd()) * 30;
      const c = at((rnd() * noise) / 2.2, (rnd() * noise) / 2.2);
      if (f.accept(c, i * 1000, noise)) kept.push(c);
    }
    expect(kept.length).toBeLessThanOrEqual(2);
  });

  it("a straight walk at 1.4 m/s with 10 m accuracy is within 10% of the true length", () => {
    const f = new TrailFilter();
    const kept: Coordinates[] = [];
    for (let i = 0; i <= 300; i += 1) {
      const c = at(i * 1.4);
      if (f.accept(c, i * 1000, 10)) kept.push(c);
    }
    const truth = 300 * 1.4;
    expect(Math.abs(length(kept) - truth) / truth).toBeLessThan(0.1);
  });

  it("drops a single 60 m spike and keeps walking", () => {
    const f = new TrailFilter();
    const kept: Coordinates[] = [];
    for (let i = 0; i <= 60; i += 1) {
      const c = i === 30 ? at(i * 1.4 + 60, 60) : at(i * 1.4);
      if (f.accept(c, i * 1000, 10)) kept.push(c);
    }
    expect(kept.every((c) => haversineDistance(c, at(0)) < 100)).toBe(true);
    expect(length(kept)).toBeLessThan(60 * 1.4 * 1.1);
  });

  it("re-baselines after a realistic tunnel: a 12 s gap, then 2 fixes that agree", () => {
    const f = new TrailFilter();
    expect(f.accept(at(0), 0, 10)).not.toBeNull();
    expect(f.accept(at(500), 12_000, 10)).toBeNull();
    expect(f.accept(at(502), 13_000, 10)).not.toBeNull();
    expect(f.accept(at(515), 20_000, 10)).not.toBeNull();
  });

  it("measures speed from the last good fix, so a long still period does not let a 100 m jump through", () => {
    const f = new TrailFilter();
    expect(f.accept(at(0), 0, 10)).not.toBeNull();
    for (let i = 1; i <= 60; i += 1) f.accept(at(1), i * 1000, 10);
    expect(f.accept(at(100), 61_000, 20)).toBeNull();
    expect(f.accept(at(1), 62_000, 10)).toBeNull();
  });

  it("a fix after a 30 s silence needs a second fix that agrees (a lone Wi-Fi fix draws nothing)", () => {
    const f = new TrailFilter();
    expect(f.accept(at(0), 0, 10)).not.toBeNull();
    expect(f.accept(at(100), 30_000, 12)).toBeNull();
    expect(f.accept(at(1), 31_000, 10)).toBeNull();
    expect(f.accept(at(2), 32_000, 10)).toBeNull();
  });

  it("ignores fixes worse than 50 m and reset forgets the last point", () => {
    const f = new TrailFilter();
    expect(f.accept(at(0), 0, 60)).toBeNull();
    expect(f.accept(at(0), 1000, 10)).not.toBeNull();
    expect(f.accept(at(0), 2000, 10)).toBeNull();
    f.reset();
    expect(f.accept(at(0), 3000, 10)).not.toBeNull();
  });

  it("walking at 1.4 m/s with steady 30 m accuracy still adds a point at least every 20 s (noisy fixes)", () => {
    const f = new TrailFilter();
    let seed = 11;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
    const keptAt: number[] = [];
    for (let i = 0; i < 180; i += 1) {
      const c = at(i * 1.4 + (rnd() * 30) / 2.2, (rnd() * 30) / 2.2);
      if (f.accept(c, i * 1000, 30)) keptAt.push(i);
    }
    expect(keptAt.length).toBeGreaterThan(5);
    const gaps = keptAt.slice(1).map((t, k) => t - keptAt[k]);
    expect(Math.max(...gaps, 180 - keptAt[keptAt.length - 1])).toBeLessThanOrEqual(20);
  });

  it("at 12 m accuracy the trail end stays within 12 m of the dot", () => {
    const f = new TrailFilter();
    let end = at(0);
    let worst = 0;
    for (let i = 0; i <= 200; i += 1) {
      const c = at(i * 1.4);
      if (f.accept(c, i * 1000, 12)) end = c;
      worst = Math.max(worst, haversineDistance(end, c));
    }
    expect(worst).toBeLessThanOrEqual(12);
  });

  it("standing still with 30-40 m accuracy and 15 m wobble keeps at most 3 points without a device speed", () => {
    const f = new TrailFilter();
    let seed = 5;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
    let kept = 0;
    for (let i = 0; i < 300; i += 1) {
      if (f.accept(at(rnd() * 15, rnd() * 15), i * 1000, 30 + Math.abs(rnd()) * 10)) kept += 1;
    }
    expect(kept).toBeLessThanOrEqual(3);
  });

  it("returns the point to draw: a noisy fix that passes is drawn at the mean of the recent fixes, not at the raw fix", () => {
    const f = new TrailFilter();
    expect(f.accept(at(0), 0, 30)).toBeNull(); // a coarse first fix alone does not start the trail
    expect(f.accept(at(1), 500, 30)).not.toBeNull();
    let drawn: Coordinates | null = null;
    let raw = at(0);
    for (let i = 1; i <= 12 && !drawn; i += 1) {
      raw = at(i * 3);
      drawn = f.accept(raw, i * 1000, 30);
    }
    expect(drawn).not.toBeNull();
    expect(drawn).not.toEqual(raw);
    expect(haversineDistance(drawn as Coordinates, raw)).toBeGreaterThan(2);
  });

  describe("a standing phone with a Doppler speed", () => {
    // Real stationary GPS: a few metres of noise, a Doppler speed near zero.
    const standingGps = (f: TrailFilter, fromS: number, toS: number, kept: Coordinates[]) => {
      for (let s = fromS; s < toS; s += 1) {
        const p = f.accept(at(Math.sin(s) * 2, Math.cos(s * 1.3) * 2), s * 1000, 10, 0.05);
        if (p) kept.push(p);
      }
    };
    const farthest = (pts: Coordinates[]) => Math.max(0, ...pts.map((p) => haversineDistance(p, at(0))));

    it("a 4-fix Wi-Fi cluster 130 m away (no speed) does not become the trail", () => {
      const f = new TrailFilter();
      const kept: Coordinates[] = [];
      standingGps(f, 0, 60, kept);
      for (let s = 60; s < 64; s += 1) {
        const p = f.accept(at(130 + (s % 2), 1), s * 1000, 30);
        if (p) kept.push(p);
      }
      standingGps(f, 64, 120, kept);
      expect(farthest(kept)).toBeLessThan(20);
    });

    it("GPS that keeps agreeing somewhere else while standing moves the anchor silently and draws nothing", () => {
      const f = new TrailFilter();
      const kept: Coordinates[] = [];
      standingGps(f, 0, 30, kept);
      for (let s = 30; s < 60; s += 1) {
        const p = f.accept(at(130 + (s % 3)), s * 1000, 10, 0.05);
        if (p) kept.push(p);
      }
      expect(farthest(kept)).toBeLessThan(20);
    });

    it("a walker whose fixes jump 200 m ahead and keep agreeing with a real walking speed re-baselines within 3 fixes", () => {
      const f = new TrailFilter();
      for (let s = 0; s <= 10; s += 1) f.accept(at(s * 1.4), s * 1000, 10, 1.4);
      expect(f.accept(at(220), 11_000, 10, 1.4)).toBeNull();
      expect(f.accept(at(221.4), 12_000, 10, 1.4)).toBeNull();
      expect(f.accept(at(222.8), 13_000, 10, 1.4)).not.toBeNull();
    });
  });

  describe("Doppler freeze and provider switch", () => {
    it("GPS-only drift of a standing phone (Doppler near 0) keeps at most 1 point over 5 minutes", () => {
      const f = new TrailFilter();
      let n = 0;
      let e = 0;
      let seed = 21;
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
      let kept = 0;
      for (let s = 0; s < 300; s += 1) {
        n = 0.95 * n + rnd() * 3;
        e = 0.95 * e + rnd() * 3;
        if (f.accept(at(n, e), s * 1000, 8 + Math.abs(rnd()) * 6, Math.abs(rnd()) * 0.15)) kept += 1;
      }
      expect(kept).toBeLessThanOrEqual(1);
    });

    it("a fix with no device speed among fixes that carry one is a Wi-Fi/cell fix: never a point, never a tail", () => {
      const f = new TrailFilter();
      for (let s = 0; s <= 10; s += 1) f.accept(at(s * 1.4), s * 1000, 10, 1.4);
      expect(f.accept(at(10 * 1.4 + 14), 11_000, 12)).toBeNull();
      expect(f.tailAllowed(at(28), 12)).toBe(false);
      expect(f.accept(at(11 * 1.4), 12_000, 10, 1.4)).toBeNull(); // normal fix back, within a step
      expect(f.tailAllowed(at(16), 10)).toBe(true);
    });

    it("a walker's moving fixes still draw while the Doppler says moving", () => {
      const f = new TrailFilter();
      let kept = 0;
      for (let s = 0; s <= 60; s += 1) if (f.accept(at(s * 1.4), s * 1000, 10, 1.4)) kept += 1;
      expect(kept).toBeGreaterThan(5);
    });
  });

  it("a one-shot read (quick or re-arm) never enters the trail, and never starts it", () => {
    const f = new TrailFilter();
    expect(f.accept(at(120), 0, 12, undefined, "quick")).toBeNull();
    expect(f.accept(at(0), 1000, 10, 0.1, "watch")).not.toBeNull();
    for (let s = 2; s < 8; s += 1) f.accept(at(s * 1.4), s * 1000, 10, 1.4, "watch");
    expect(f.accept(at(12), 8000, 10, 1.4, "rearm")).toBeNull();
  });

  it("the live tail is allowed only for a dot the filter believes and that is near the trail's end", () => {
    const f = new TrailFilter();
    expect(f.tailAllowed(at(5), 10)).toBe(false); // nothing kept yet
    f.accept(at(0), 0, 10);
    for (let i = 1; i <= 5; i += 1) f.accept(at(i * 1.4), i * 1000, 10);
    expect(f.tailAllowed(at(9), 10)).toBe(true);
    expect(f.tailAllowed(at(9), 80)).toBe(false);
    expect(f.tailAllowed(at(120), 10)).toBe(false); // too far from the trail's end
    // a lone outlier 120 m away is a jump: no tail until a good fix follows
    f.accept(at(120), 6000, 15);
    expect(f.tailAllowed(at(10), 10)).toBe(false);
    f.accept(at(9), 7000, 10);
    expect(f.tailAllowed(at(9), 10)).toBe(true);
  });

  it("withLiveTail leaves the trail alone when the tail is not allowed", () => {
    const walked = [at(0), at(20)];
    expect(withLiveTail(walked, at(31), 12, false)).toBe(walked);
    expect(withLiveTail(walked, at(31), 12, true)).toEqual([at(0), at(20), at(31)]);
  });

  it("withLiveTail ends the line at the dot, and leaves an empty trail or a poor dot alone", () => {
    const walked = [at(0), at(20)];
    expect(withLiveTail(walked, at(31), 12)).toEqual([at(0), at(20), at(31)]);
    expect(withLiveTail(walked, at(31), 80)).toBe(walked);
    expect(withLiveTail(walked, undefined, 12)).toBe(walked);
    const empty: Coordinates[] = [];
    expect(withLiveTail(empty, at(31), 12)).toBe(empty);
    expect(withLiveTail(walked, at(20), 12)).toBe(walked);
  });
});
