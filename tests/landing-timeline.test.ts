import { describe, expect, it } from "vitest";

import { clamp, remap, stateAt } from "@/components/marketing/landing/timeline";

describe("landing hero timeline", () => {
  it("clamps and remaps", () => {
    expect(clamp(-1)).toBe(0);
    expect(clamp(2)).toBe(1);
    expect(remap(0.5, 0.25, 0.75)).toBe(0.5);
    expect(remap(0, 0.25, 0.75)).toBe(0);
  });

  it("starts at rest and ends on the full map", () => {
    const a = stateAt(0);
    expect(a.copyO).toBe(1);
    expect(a.push).toBe(0);
    expect(a.cloudO).toBe(0);
    expect(a.phoneVisible).toBe(true);
    expect(a.mapVisible).toBe(false);
    const z = stateAt(1);
    expect(z.mapVisible).toBe(true);
    expect(z.phoneVisible).toBe(false);
    expect(z.cloudO).toBe(0);
    expect(z.mapScale).toBe(1);
    expect(z.play).toBe(true);
  });

  it("is fully covered by clouds before the phone is swapped for the map", () => {
    for (const p of [0.44, 0.46, 0.48, 0.49]) expect(stateAt(p).cloudO).toBe(1);
    // the handover happens inside the fully covered window
    expect(stateAt(0.47).phoneVisible).toBe(true);
    expect(stateAt(0.48).phoneVisible).toBe(false);
    expect(stateAt(0.48).mapVisible).toBe(true);
    expect(stateAt(0.48).cloudO).toBe(1);
  });

  it("holds still after the map settles", () => {
    expect(stateAt(0.7)).toEqual(stateAt(0.99));
  });

  it("turns the phone one full turn, face-on when it fills the stage, misted by clouds", () => {
    expect(stateAt(0).spin).toBe(0);
    expect(stateAt(0.36).spin).toBe(360);
    expect(stateAt(0.36).push).toBe(1);
    expect(stateAt(0.21).spin).toBeGreaterThan(150);
    expect(stateAt(0.21).spin).toBeLessThan(210);
    expect(stateAt(0.2).cloudO).toBeGreaterThan(0.1); // mist arrives during the turn
    expect(stateAt(0.2).cloudO).toBeLessThan(0.6);
  });

  it("never lets the cloud layer be visible on a still hero", () => {
    expect(stateAt(0.1).cloudO).toBe(0);
  });
});
