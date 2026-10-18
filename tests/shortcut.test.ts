import { describe, expect, it } from "vitest";

import {
  acceptConnector,
  requiredSavingM,
  shortcutTarget,
  ShortcutGate,
  worthChecking,
  type ShortcutStop,
} from "@/lib/walk/shortcut";
import { at } from "./helpers/discovery";

// A U-shaped route: 800 m north, 600 m east, 800 m south. The finish is 600 m
// from the start as the crow flies but 2200 m along the route.
const U = [at(0, 0), at(0, 800), at(600, 800), at(600, 0)];
const stop = (id: string, east: number, north: number): ShortcutStop => ({
  id,
  point: at(east, north),
  label: id,
});

describe("shortcutTarget", () => {
  it("ends at the nearest unvisited stop, never past it", () => {
    const t = shortcutTarget(U, 0, U[0], [stop("far", 600, 5), stop("near", 3, 400)]);
    expect(t?.stopId).toBe("near");
    expect(t?.alongM).toBeGreaterThan(395);
    expect(t?.alongM).toBeLessThan(405);
  });

  it("is null when the nearest stop is more than 80 m off the line", () => {
    expect(shortcutTarget(U, 0, U[0], [stop("park", 200, 400), stop("far", 600, 5)])).toBeNull();
  });

  it("targets the finish when no stops are left", () => {
    const t = shortcutTarget(U, 0, U[0], []);
    expect(t?.stopId).toBeNull();
    expect(t?.point).toEqual(U[3]);
    expect(t?.alongM).toBeGreaterThan(2190);
    expect(t?.alongM).toBeLessThan(2210);
  });

  it("ignores stops behind the walker", () => {
    // Walker is 300 m up segment 0; a stop 100 m up the same segment is behind.
    const t = shortcutTarget(U, 0, at(0, 300), [stop("behind", 3, 100), stop("ahead", 600, 5)]);
    expect(t?.stopId).toBe("ahead");
  });
});

describe("worthChecking", () => {
  it("is true on a U-shaped route", () => {
    expect(worthChecking(2200, 600, 1.3)).toBe(true);
  });
  it("is false when the street path cannot beat the route by enough", () => {
    // Without the 1.15 street factor this would pass (300 >= 195).
    expect(worthChecking(1300, 1000, 1.3)).toBe(false);
  });
  it("is false when the gap is too small or too large", () => {
    expect(worthChecking(2200, 199, 1.3)).toBe(false);
    expect(worthChecking(5000, 1501, 1.3)).toBe(false);
  });
});

describe("acceptConnector thresholds", () => {
  it("metres floor (150 m)", () => {
    expect(requiredSavingM(500, 0.5)).toBe(150);
    expect(acceptConnector(500, 350, 0.5)).not.toBeNull();
    expect(acceptConnector(500, 350.5, 0.5)).toBeNull();
  });
  it("ratio (15% of the remaining route)", () => {
    expect(acceptConnector(2000, 1700, 0.5)).not.toBeNull();
    expect(acceptConnector(2000, 1700.5, 0.5)).toBeNull();
  });
  it("time (120 s of walking)", () => {
    expect(acceptConnector(500, 260, 2)).not.toBeNull();
    expect(acceptConnector(500, 260.5, 2)).toBeNull();
  });
  it("reports minutes and metres saved", () => {
    expect(acceptConnector(2200, 650, 1.3)).toEqual({ savingM: 1550, savingMin: 20 });
  });
});

describe("ShortcutGate", () => {
  const g = [] as unknown[];
  const other = [] as unknown[];
  const primed = () => {
    const gate = new ShortcutGate();
    gate.recordCheck(1_000, g, 200);
    return gate;
  };

  it("allows a check once everything is clear", () => {
    expect(primed().canCheck(91_000, g, 400, null)).toBe(true);
  });
  it("cooldown alone blocks (90 s)", () => {
    const gate = primed();
    expect(gate.canCheck(90_999, g, 400, null)).toBe(false);
    expect(gate.canCheck(91_000, g, 400, null)).toBe(true);
  });
  it("progress alone blocks (150 m)", () => {
    const gate = primed();
    expect(gate.canCheck(91_000, g, 349, null)).toBe(false);
    expect(gate.canCheck(91_000, g, 350, null)).toBe(true);
  });
  it("needs 150 m of progress before the first check", () => {
    expect(new ShortcutGate().canCheck(0, g, 149, null)).toBe(false);
    expect(new ShortcutGate().canCheck(0, g, 150, null)).toBe(true);
  });
  it("cap alone blocks (12 per walk)", () => {
    const gate = new ShortcutGate();
    for (let i = 0; i < 12; i += 1) {
      expect(gate.canCheck(i * 100_000, g, (i + 1) * 200, null)).toBe(true);
      gate.recordCheck(i * 100_000, g, (i + 1) * 200);
    }
    expect(gate.canCheck(12 * 100_000, g, 13 * 200, null)).toBe(false);
  });
  it("a decline blocks that stop on that geometry only", () => {
    const gate = primed();
    gate.decline(g, "a");
    expect(gate.canCheck(91_000, g, 400, "a")).toBe(false);
    expect(gate.canCheck(91_000, g, 400, "b")).toBe(true);
    expect(gate.canCheck(91_000, other, 400, "a")).toBe(true);
  });
  it("reset forgets everything", () => {
    const gate = primed();
    gate.decline(g, "a");
    gate.reset();
    expect(gate.canCheck(1_000, g, 150, "a")).toBe(true);
  });
  it("a new geometry needs fresh 150 m progress (walkedM restarts after a splice)", () => {
    const gate = primed(); // checked at walkedM 200 on g
    expect(gate.canCheck(91_000, other, 100, null)).toBe(false);
    expect(gate.canCheck(91_000, other, 150, null)).toBe(true);
    // On the same geometry the old baseline still applies.
    expect(gate.canCheck(91_000, g, 100, null)).toBe(false);
  });
  it("canCheckGlobal ignores declines", () => {
    const gate = primed();
    gate.decline(g, "a");
    expect(gate.canCheckGlobal(91_000, g, 400)).toBe(true);
  });
});
