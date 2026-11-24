import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useWalkerHeading } from "@/lib/hooks/useWalkerHeading";

function compass(deg: number) {
  const ev = new Event("deviceorientation");
  Object.assign(ev, { webkitCompassHeading: deg, alpha: null, absolute: false });
  act(() => {
    window.dispatchEvent(ev);
  });
}
/** Lets the rAF loop run for this long (fake rAF, 16 ms frames), with the clock moving too. */
const run = (ms: number) =>
  act(() => {
    for (let t = 0; t < ms; t += 16) vi.advanceTimersByTime(16);
  });

type Props = { active?: boolean; simulated?: boolean };
const mount = (initial: Props = {}) => {
  const hook = renderHook((p: Props) => useWalkerHeading({ active: true, simulated: false, ...p }), { initialProps: initial });
  return { ...hook, shown: () => hook.result.current.store.get(), gps: (d: number | null) => act(() => hook.result.current.setGps(d)) };
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-24T10:00:00Z"));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("useWalkerHeading (a store the beam turns from, no React value)", () => {
  it("returns the same store for the life of the component", () => {
    const { result, rerender } = mount();
    const first = result.current.store;
    rerender({ active: true });
    expect(result.current.store).toBe(first);
  });

  it("shows no heading with no source: no compass, no GPS course", () => {
    const m = mount();
    run(200);
    expect(m.shown()).toBeNull();
  });

  it("shows the compass heading while standing, so the beam is there before the first step", () => {
    const m = mount();
    compass(80);
    run(100);
    expect(m.shown()).toBeCloseTo(80, 1);
  });

  it("shows the GPS heading when there is no compass", () => {
    const m = mount();
    m.gps(135);
    run(100);
    expect(m.shown()).toBeCloseTo(135, 1);
  });

  it("follows a 90 degree turn to within 10 degrees in 300 ms of 60 Hz compass events", () => {
    const m = mount();
    compass(0);
    run(100);
    expect(m.shown()).toBeCloseTo(0, 1);
    for (let t = 0; t < 300; t += 16) {
      compass(90);
      run(16);
    }
    expect(Math.abs(90 - m.shown()!)).toBeLessThanOrEqual(10);
  });

  it("prefers a fresh compass to the GPS course, and the GPS course once the compass is stale", () => {
    const m = mount();
    m.gps(135);
    compass(80);
    run(600);
    expect(m.shown()).toBeCloseTo(80, 0);
    run(10_500); // the compass sends nothing for over 10 s
    expect(m.shown()).toBeCloseTo(135, 0);
    compass(80);
    run(600);
    expect(m.shown()).toBeCloseTo(80, 0);
  });

  it("switches source without spinning the long way round", () => {
    const m = mount();
    m.gps(355);
    run(100);
    expect(m.shown()).toBeCloseTo(355, 1);
    compass(5);
    const seen: number[] = [];
    for (let i = 0; i < 20; i++) {
      run(16);
      seen.push(m.shown()!);
    }
    expect(Math.min(...seen)).toBeGreaterThanOrEqual(354.9); // 355 -> 365, never back down through 180
    expect(m.shown()).toBeCloseTo(365, 0);
  });

  it("goes to null when the sources run dry, and comes back from there", () => {
    const m = mount();
    m.gps(200);
    run(100);
    expect(m.shown()).toBeCloseTo(200, 1);
    m.gps(null);
    run(100);
    expect(m.shown()).toBeNull();
    m.gps(20);
    run(100);
    expect(m.shown()).toBeCloseTo(20, 1);
  });

  it("shows nothing when the walk is not active, whatever the sources say", () => {
    const m = mount({ active: false });
    m.gps(90);
    compass(80);
    run(200);
    expect(m.shown()).toBeNull();
  });

  it("clears the store when the walk stops", () => {
    const m = mount();
    m.gps(90);
    run(100);
    expect(m.shown()).not.toBeNull();
    m.rerender({ active: false });
    expect(m.shown()).toBeNull();
  });

  it("in a simulated walk follows the simulated path and ignores the compass", () => {
    const m = mount({ simulated: true });
    m.gps(250);
    compass(80);
    run(100);
    expect(m.shown()).toBeCloseTo(250, 1);
    m.gps(260);
    run(500);
    expect(m.shown()).toBeCloseTo(260, 1);
  });

  it("does not re-render its host for any of it", () => {
    let renders = 0;
    const { result } = renderHook(() => {
      renders++;
      return useWalkerHeading({ active: true, simulated: false });
    });
    const before = renders;
    for (let i = 0; i < 100; i++) {
      compass(i * 3);
      run(16);
    }
    act(() => result.current.setGps(40));
    expect(renders).toBe(before);
  });

  it("idles when settled: no frames are requested once it reached its target", () => {
    const m = mount();
    m.gps(90);
    run(1000);
    const raf = vi.spyOn(window, "requestAnimationFrame");
    run(300); // under the 500 ms heartbeat
    expect(raf).not.toHaveBeenCalled();
    expect(m.shown()).toBeCloseTo(90, 1);
  });
});
