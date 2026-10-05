import { describe, expect, it } from "vitest";

import {
  initialCollapseState,
  optionsReady,
  rejoinResult,
  resolveCollapse,
  stepCollapse,
  type CollapseState,
} from "@/lib/walk/collapse-machine";

const T0 = 1_000_000;
const fix = (atMs: number, deviationM: number, accuracyM = 10) => ({ atMs, deviationM, accuracyM });

/** Feed one fix per second from `from` for `seconds`. */
function drive(state: CollapseState, from: number, seconds: number, dev: number) {
  let s = state;
  const effects: string[] = [];
  for (let i = 0; i <= seconds; i += 1) {
    const r = stepCollapse(s, fix(from + i * 1000, dev));
    s = r.state;
    if (r.effect !== "none") effects.push(r.effect);
  }
  return { state: s, effects };
}

describe("collapse machine", () => {
  it("goes off route past 50 m and beyond the accuracy, not before", () => {
    const s0 = initialCollapseState();
    expect(stepCollapse(s0, fix(T0, 40)).state.phase).toBe("ON_ROUTE");
    expect(stepCollapse(s0, fix(T0, 70, 90)).state.phase).toBe("ON_ROUTE"); // accuracy gate
    expect(stepCollapse(s0, fix(T0, 55, 10)).state.phase).toBe("OFF_ROUTE");
  });

  it("requests a local rejoin after 30 s off route", () => {
    const { state, effects } = drive(initialCollapseState(), T0, 31, 120);
    expect(effects).toEqual(["start-rejoin"]);
    expect(state.phase).toBe("REJOINING");
  });

  it("COLLAPSES at 450 m sustained for 60 s of fix time", () => {
    const { state, effects } = drive(initialCollapseState(), T0, 61, 450);
    expect(effects).toEqual(["collapse"]);
    expect(state.phase).toBe("COLLAPSED");
    expect(state.collapseCount).toBe(1);
  });

  it("does not collapse before 60 s, nor at 350 m", () => {
    expect(drive(initialCollapseState(), T0, 50, 450).state.phase).toBe("OFF_ROUTE");
    const at350 = drive(initialCollapseState(), T0, 120, 350);
    expect(at350.effects).not.toContain("collapse");
    expect(at350.state.phase).not.toBe("COLLAPSED");
  });

  it("uses only fix timestamps: a slow clock still collapses once 60 s of fixes pass", () => {
    let s = stepCollapse(initialCollapseState(), fix(T0, 450)).state;
    s = stepCollapse(s, fix(T0 + 59_000, 450)).state;
    expect(s.phase).toBe("OFF_ROUTE");
    expect(stepCollapse(s, fix(T0 + 60_000, 450)).effect).toBe("collapse");
  });

  it("resets the 60 s clock when the walker comes back under 400 m", () => {
    let s = stepCollapse(initialCollapseState(), fix(T0, 450)).state;
    s = stepCollapse(s, fix(T0 + 40_000, 380)).state;
    expect(s.farSinceMs).toBeNull();
    s = stepCollapse(s, fix(T0 + 41_000, 450)).state;
    expect(stepCollapse(s, fix(T0 + 90_000, 450)).effect).toBe("none");
  });

  it("collapses after two failed rejoins", () => {
    let s = drive(initialCollapseState(), T0, 31, 120).state; // REJOINING
    let r = rejoinResult(s, { ok: false, atMs: T0 + 32_000 });
    expect(r.effect).toBe("none");
    expect(r.state.phase).toBe("OFF_ROUTE");
    // next attempt after the 60 s local-rejoin cooldown
    s = r.state;
    s = stepCollapse(s, fix(T0 + 95_000, 120)).state;
    expect(s.phase).toBe("REJOINING");
    r = rejoinResult(s, { ok: false, atMs: T0 + 96_000 });
    expect(r.effect).toBe("collapse");
    expect(r.state.phase).toBe("COLLAPSED");
  });

  it("a successful rejoin returns to ON_ROUTE and clears the failure count", () => {
    const s = drive(initialCollapseState(), T0, 31, 120).state;
    const r = rejoinResult(s, { ok: true, atMs: T0 + 33_000 });
    expect(r.state).toMatchObject({ phase: "ON_ROUTE", rejoinFailures: 0, offSinceMs: null });
  });

  it("collapses after 8 minutes off route even when rejoins never ran", () => {
    let s = stepCollapse(initialCollapseState(), fix(T0, 120)).state;
    s = { ...s, phase: "OFF_ROUTE", lastRejoinAttemptMs: T0 + 8 * 60_000 }; // suppress rejoin timing
    expect(stepCollapse(s, fix(T0 + 8 * 60_000 + 1000, 120)).effect).toBe("collapse");
  });

  it("enforces a 10 minute cooldown between collapses", () => {
    const first = drive(initialCollapseState(), T0, 61, 450).state;
    const resolved = resolveCollapse(first);
    expect(resolved.collapseCount).toBe(1);
    // strays again 3 minutes later and stays out 70 s: cooldown blocks the collapse
    const soon = drive(resolved, T0 + 180_000, 70, 450);
    expect(soon.effects).not.toContain("collapse");
    // 11 minutes after the first collapse it is allowed again
    const later = drive(resolveCollapse(soon.state), T0 + 11 * 60_000, 61, 450);
    expect(later.effects).toContain("collapse");
  });

  it("allows at most 4 collapses per walk", () => {
    let s = initialCollapseState();
    let collapses = 0;
    for (let k = 0; k < 6; k += 1) {
      const r = drive(s, T0 + k * 12 * 60_000, 61, 450);
      collapses += r.effects.filter((e) => e === "collapse").length;
      s = resolveCollapse(r.state);
    }
    expect(collapses).toBe(4);
  });

  it("returns to ON_ROUTE when the walker is back within 30 m of the old route", () => {
    const collapsed = drive(initialCollapseState(), T0, 61, 450).state;
    expect(stepCollapse(collapsed, fix(T0 + 100_000, 200)).state.phase).toBe("COLLAPSED");
    const offering = optionsReady(collapsed);
    expect(offering.phase).toBe("OFFERING");
    expect(stepCollapse(offering, fix(T0 + 120_000, 20)).state.phase).toBe("ON_ROUTE");
  });

  it("stays on route for hysteresis jitter between 30 and 50 m", () => {
    let s = initialCollapseState();
    s = stepCollapse(s, fix(T0, 45)).state;
    expect(s.phase).toBe("ON_ROUTE");
    s = stepCollapse(s, fix(T0 + 1000, 60)).state;
    s = stepCollapse(s, fix(T0 + 2000, 40)).state; // still off: needs < 30 m
    expect(s.phase).toBe("OFF_ROUTE");
    s = stepCollapse(s, fix(T0 + 3000, 25)).state;
    expect(s.phase).toBe("ON_ROUTE");
  });

  it("ignores fixes worse than 50 m accuracy", () => {
    const s0 = initialCollapseState();
    expect(stepCollapse(s0, fix(T0, 500, 60))).toEqual({ state: s0, effect: "none" });
  });
});
