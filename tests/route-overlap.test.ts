import { describe, expect, it } from "vitest";

import { overlap, samplePath } from "@/lib/walk/route-overlap";
import { at } from "./helpers/discovery";

const track = [at(0, 0), at(0, 1000)];

describe("overlap", () => {
  it("is 1.0 for an identical route", () => {
    expect(overlap(track, track)).toBe(1);
  });

  it("is ~0 for a route running 60 m beside the reference", () => {
    expect(overlap([at(60, 0), at(60, 1000)], track)).toBe(0);
  });

  it("counts a route within the 25 m tolerance", () => {
    expect(overlap([at(20, 0), at(20, 1000)], track)).toBe(1);
  });

  it("ignores the first 100 m, where any route starts on the walker", () => {
    // Shares only the first 100 m with the reference, then veers away.
    const veer = [at(0, 0), at(0, 100), at(800, 100)];
    expect(overlap(veer, track)).toBeLessThan(0.1);
    expect(overlap(veer, track, { skipFirstM: 0 })).toBeGreaterThan(0.12);
  });

  it("measures the shared fraction for a half-retraced route", () => {
    const half = [at(0, 0), at(0, 500), at(300, 500), at(300, 1000)];
    const o = overlap(half, track, { skipFirstM: 0 });
    expect(o).toBeGreaterThan(0.2);
    expect(o).toBeLessThan(0.5);
  });

  it("is 0 for empty inputs", () => {
    expect(overlap([], track)).toBe(0);
    expect(overlap(track, [])).toBe(0);
  });
});

describe("samplePath", () => {
  it("samples every step and honours the skip", () => {
    expect(samplePath(track, 20)).toHaveLength(51);
    expect(samplePath(track, 20, 100)).toHaveLength(46);
    expect(samplePath([at(0, 0)], 20, 100)).toEqual([]);
  });
});
