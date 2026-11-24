import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { requestCompassPermission, tiltCompensatedHeading, useCompassHeading } from "@/lib/hooks/useCompassHeading";

type Fields = { alpha?: number | null; beta?: number; gamma?: number; absolute?: boolean; webkitCompassHeading?: number; webkitCompassAccuracy?: number };

function fire(type: "deviceorientation" | "deviceorientationabsolute", fields: Fields) {
  const ev = new Event(type);
  Object.assign(ev, { alpha: null, absolute: false, ...fields });
  act(() => {
    window.dispatchEvent(ev);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-23T10:00:00Z"));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("useCompassHeading (a plain reader: a ref, never React state)", () => {
  const read = (r: { current: { current: { deg: number; at: number } | null } }) => r.current.current?.deg ?? null;

  it("is null before any reading, and for a phone with no compass (a desktop's all-null event)", () => {
    const { result } = renderHook(() => useCompassHeading(true));
    expect(read(result)).toBeNull();
    fire("deviceorientation", { alpha: null });
    expect(read(result)).toBeNull();
  });

  it("reads a flat Android phone's absolute alpha as 360 - alpha (the heading of the top of the phone)", () => {
    const { result } = renderHook(() => useCompassHeading(true));
    fire("deviceorientationabsolute", { alpha: 270, absolute: true, beta: 0, gamma: 0 });
    expect(read(result)).toBe(90);
  });

  it("uses the tilt-compensated heading on Android when the phone is held upright (beta 70, gamma 10)", () => {
    const { result } = renderHook(() => useCompassHeading(true));
    // Facing due north (alpha 0) with a slight roll: the back of the phone points 10.6 degrees west of north.
    // 360 - alpha would say 0, tens of degrees off for a bigger roll; the compensated value follows the pose.
    fire("deviceorientationabsolute", { alpha: 0, beta: 70, gamma: 10, absolute: true });
    expect(read(result)).toBeCloseTo(349.4, 0);
    fire("deviceorientationabsolute", { alpha: 0, beta: 70, gamma: 0, absolute: true });
    expect(read(result)).toBeCloseTo(0, 5); // no roll: same as 360 - alpha
    fire("deviceorientationabsolute", { alpha: 90, beta: 80, gamma: 0, absolute: true });
    expect(read(result)).toBeCloseTo(270, 5);
  });

  it("matches the W3C compass-heading example numerically", () => {
    expect(tiltCompensatedHeading(0, 90, 0)).toBeCloseTo(0, 6);
    expect(tiltCompensatedHeading(90, 90, 0)).toBeCloseTo(270, 6);
    expect(tiltCompensatedHeading(180, 60, 0)).toBeCloseTo(180, 6);
  });

  it("ignores a relative alpha: it has no north in it", () => {
    const { result } = renderHook(() => useCompassHeading(true));
    fire("deviceorientation", { alpha: 270, absolute: false });
    expect(read(result)).toBeNull();
  });

  it("a relative event does not wipe a good absolute reading (Android fires both)", () => {
    const { result } = renderHook(() => useCompassHeading(true));
    fire("deviceorientationabsolute", { alpha: 270, absolute: true, beta: 0, gamma: 0 });
    fire("deviceorientation", { alpha: 12, absolute: false });
    expect(read(result)).toBe(90);
  });

  it("reads iOS's webkitCompassHeading as is", () => {
    const { result } = renderHook(() => useCompassHeading(true));
    fire("deviceorientation", { webkitCompassHeading: 123, webkitCompassAccuracy: 10 });
    expect(read(result)).toBe(123);
  });

  it("gives no heading when iOS says the compass is not calibrated, even after a good one", () => {
    const { result } = renderHook(() => useCompassHeading(true));
    fire("deviceorientation", { webkitCompassHeading: 123, webkitCompassAccuracy: 10 });
    fire("deviceorientation", { webkitCompassHeading: 123, webkitCompassAccuracy: -1 });
    expect(read(result)).toBeNull();
  });

  it("reads every event: no throttle and no dead band (the consumer does the smoothing)", () => {
    const { result } = renderHook(() => useCompassHeading(true));
    fire("deviceorientation", { webkitCompassHeading: 350 });
    fire("deviceorientation", { webkitCompassHeading: 351 });
    expect(read(result)).toBe(351);
  });

  it("stamps each reading with the time it arrived, for the freshness rule", () => {
    const { result } = renderHook(() => useCompassHeading(true));
    fire("deviceorientation", { webkitCompassHeading: 10 });
    expect(result.current.current?.at).toBe(Date.now());
  });

  it("wakes its consumer on each reading", () => {
    const wake = vi.fn();
    renderHook(() => useCompassHeading(true, wake));
    fire("deviceorientation", { webkitCompassHeading: 10 });
    fire("deviceorientation", { webkitCompassHeading: 20 });
    expect(wake).toHaveBeenCalledTimes(2);
  });

  it("never sets React state per orientation event (render count stays at most 1 over 600 events)", () => {
    let renders = 0;
    renderHook(() => {
      renders++;
      return useCompassHeading(true);
    });
    const before = renders;
    for (let i = 0; i < 600; i++) fire("deviceorientation", { webkitCompassHeading: (i * 7) % 360 });
    expect(renders - before).toBeLessThanOrEqual(1);
  });

  it("adds the screen's rotation, so the top of a landscape screen is what points", () => {
    vi.stubGlobal("screen", { orientation: { angle: 90 } });
    const { result } = renderHook(() => useCompassHeading(true));
    fire("deviceorientation", { webkitCompassHeading: 100 });
    expect(read(result)).toBe(190);
  });

  it("listens only while active, and clears when it stops", () => {
    const { result, rerender } = renderHook(({ on }) => useCompassHeading(on), { initialProps: { on: false } });
    fire("deviceorientation", { webkitCompassHeading: 50 });
    expect(read(result)).toBeNull();
    rerender({ on: true });
    fire("deviceorientation", { webkitCompassHeading: 50 });
    expect(read(result)).toBe(50);
    rerender({ on: false });
    expect(read(result)).toBeNull();
  });

  it("removes its listeners on unmount", () => {
    const remove = vi.spyOn(window, "removeEventListener");
    const { unmount } = renderHook(() => useCompassHeading(true));
    unmount();
    const removed = remove.mock.calls.map((c) => c[0]);
    expect(removed).toEqual(expect.arrayContaining(["deviceorientation", "deviceorientationabsolute"]));
    remove.mockRestore();
  });
});

describe("requestCompassPermission", () => {
  it("is true where no permission is needed (Android, desktop) and false with no sensor API at all", async () => {
    expect(await requestCompassPermission()).toBe(true);
    vi.stubGlobal("DeviceOrientationEvent", undefined);
    expect(await requestCompassPermission()).toBe(false);
  });

  it("asks iOS and reports its answer", async () => {
    const ask = vi.fn().mockResolvedValue("denied");
    vi.stubGlobal("DeviceOrientationEvent", Object.assign(function () {}, { requestPermission: ask }));
    expect(await requestCompassPermission()).toBe(false);
    expect(ask).toHaveBeenCalledTimes(1);
  });

  it("never throws when the browser refuses", async () => {
    vi.stubGlobal("DeviceOrientationEvent", Object.assign(function () {}, { requestPermission: () => Promise.reject(new Error("no gesture")) }));
    expect(await requestCompassPermission()).toBe(false);
  });
});
