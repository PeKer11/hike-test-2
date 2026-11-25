import { describe, expect, it } from "vitest";

import { OffRouteGate } from "@/lib/walk/deviation-detector";
import { TrailFilter } from "@/lib/walk/trail-filter";
import type { Coordinates } from "@/lib/types";

const M_PER_DEG = 111_320;
const at = (northM: number, eastM = 0): Coordinates => ({ lat: 32 + northM / M_PER_DEG, lng: 34 + eastM / (M_PER_DEG * Math.cos((32 * Math.PI) / 180)) });

describe("OffRouteGate", () => {
  it("one over-threshold fix does not switch the pill on; a second in a row does", () => {
    const g = new OffRouteGate();
    expect(g.next(false, 40, 10, 20, { trusted: true, stopped: false })).toBe(false);
    expect(g.next(false, 41, 10, 20, { trusted: true, stopped: false })).toBe(true);
  });

  it("a fix in between that is back on the line resets the count", () => {
    const g = new OffRouteGate();
    g.next(false, 40, 10, 20, { trusted: true, stopped: false });
    g.next(false, 5, 10, 20, { trusted: true, stopped: false });
    expect(g.next(false, 40, 10, 20, { trusted: true, stopped: false })).toBe(false);
  });

  it("a fix the trail filter did not believe never counts and never changes the state", () => {
    const g = new OffRouteGate();
    for (let i = 0; i < 5; i += 1) expect(g.next(false, 120, 12, 20, { trusted: false, stopped: false })).toBe(false);
    expect(g.next(true, 120, 12, 20, { trusted: false, stopped: false })).toBe(true);
  });

  it("while standing, it needs more than twice the accuracy", () => {
    const g = new OffRouteGate();
    g.next(false, 30, 18, 20, { trusted: true, stopped: true });
    expect(g.next(false, 30, 18, 20, { trusted: true, stopped: true })).toBe(false);
    g.next(false, 45, 18, 20, { trusted: true, stopped: true });
    expect(g.next(false, 45, 18, 20, { trusted: true, stopped: true })).toBe(true);
  });

  it("a walker really 25 m off the line gets the pill within 2 fixes", () => {
    const g = new OffRouteGate();
    expect(g.next(false, 25, 8, 20, { trusted: true, stopped: false })).toBe(false);
    expect(g.next(false, 26, 8, 20, { trusted: true, stopped: false })).toBe(true);
  });
});

describe("TrailFilter.judgedGood", () => {
  it("is true for a normal fix and false for an outlier, a one-shot read, or a fix with no speed among speed fixes", () => {
    const f = new TrailFilter();
    for (let s = 0; s <= 10; s += 1) f.accept(at(s * 1.4), s * 1000, 10, 1.4);
    expect(f.judgedGood(10_000)).toBe(true);
    f.accept(at(150), 11_000, 12, 1.4);
    expect(f.judgedGood(11_000)).toBe(false);
    f.accept(at(15.4), 12_000, 10, 1.4);
    expect(f.judgedGood(12_000)).toBe(true);
    f.accept(at(30), 13_000, 12);
    expect(f.judgedGood(13_000)).toBe(false);
    expect(f.judgedGood(99_000)).toBe(false); // never judged
  });

  it("one outlier 120 m away while standing next to the line does not switch the pill on", () => {
    const f = new TrailFilter();
    const g = new OffRouteGate();
    let off = false;
    for (let s = 0; s < 120; s += 1) {
      const outlier = s === 60;
      const pos = outlier ? at(120) : at(Math.sin(s) * 2, 18 + Math.cos(s) * 2); // 18 m from the line (the line is north-south at east 0)
      const acc = outlier ? 25 : 10;
      f.accept(pos, s * 1000, acc, outlier ? undefined : 0.05);
      const deviation = Math.abs((pos.lng - 34) * M_PER_DEG * Math.cos((32 * Math.PI) / 180));
      off = g.next(off, outlier ? 120 : deviation, acc, 20, { trusted: f.judgedGood(s * 1000), stopped: f.isStopped(s * 1000) });
      expect(off).toBe(false);
    }
  });
});
