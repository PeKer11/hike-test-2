import { describe, expect, it } from "vitest";

import { TrailFilter } from "@/lib/walk/trail-filter";
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

  it("re-baselines after 3 consistent fixes far away (a tunnel)", () => {
    const f = new TrailFilter();
    expect(f.accept(at(0), 0, 10)).toBe(true);
    const far = at(500);
    expect(f.accept(far, 2000, 10)).toBe(false);
    expect(f.accept(at(502), 3000, 10)).toBe(false);
    expect(f.accept(at(504), 4000, 10)).toBe(true);
    expect(f.accept(at(515), 12_000, 10)).toBe(true);
  });

  it("ignores fixes worse than 25 m and reset forgets the last point", () => {
    const f = new TrailFilter();
    expect(f.accept(at(0), 0, 30)).toBe(false);
    expect(f.accept(at(0), 1000, 10)).toBe(true);
    expect(f.accept(at(0), 2000, 10)).toBe(false);
    f.reset();
    expect(f.accept(at(0), 3000, 10)).toBe(true);
  });
});
