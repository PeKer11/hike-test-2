import { describe, expect, it } from "vitest";

import { OffRouteDismissal } from "@/lib/walk/off-route-dismissal";

const T0 = 1_000_000;
const s = (n: number) => T0 + n * 1000;

describe("OffRouteDismissal", () => {
  it("25/55 m jitter alternating for 3 minutes stays dismissed", () => {
    const d = new OffRouteDismissal();
    d.dismiss({ atMs: s(0), deviationM: 60 });
    for (let i = 1; i <= 180; i += 1) {
      const off = i % 2 === 0;
      d.feed({ atMs: s(i), offRoute: off, deviationM: off ? 55 : 25, accuracyM: 10 });
      expect(d.active()).toBe(true);
    }
  });

  it("a real rejoin of 40 s lifts it", () => {
    const d = new OffRouteDismissal();
    d.dismiss({ atMs: s(0), deviationM: 60 });
    for (let i = 1; i <= 29; i += 1) d.feed({ atMs: s(i), offRoute: false, deviationM: 10, accuracyM: 10 });
    expect(d.active()).toBe(true);
    for (let i = 30; i <= 40; i += 1) d.feed({ atMs: s(i), offRoute: false, deviationM: 10, accuracyM: 10 });
    expect(d.active()).toBe(false);
  });

  it("going from 60 m to 260 m lifts it, 150 m further", () => {
    const d = new OffRouteDismissal();
    d.dismiss({ atMs: s(0), deviationM: 60 });
    d.feed({ atMs: s(5), offRoute: true, deviationM: 200, accuracyM: 10 });
    expect(d.active()).toBe(true);
    d.feed({ atMs: s(10), offRoute: true, deviationM: 260, accuracyM: 10 });
    expect(d.active()).toBe(false);
  });

  it("a poor fix (over 50 m) changes nothing", () => {
    const d = new OffRouteDismissal();
    d.dismiss({ atMs: s(0), deviationM: 60 });
    for (let i = 1; i <= 60; i += 1) d.feed({ atMs: s(i), offRoute: false, deviationM: 5, accuracyM: 80 });
    d.feed({ atMs: s(61), offRoute: true, deviationM: 900, accuracyM: 80 });
    expect(d.active()).toBe(true);
  });

  it("15 minutes lift it, even with no fix", () => {
    const d = new OffRouteDismissal();
    d.dismiss({ atMs: s(0), deviationM: 60 });
    expect(d.active(s(14 * 60))).toBe(true);
    expect(d.active(s(15 * 60))).toBe(false);
  });

  it("clear() lifts it at once", () => {
    const d = new OffRouteDismissal();
    d.dismiss({ atMs: s(0), deviationM: 60 });
    d.clear();
    expect(d.active()).toBe(false);
  });
});
