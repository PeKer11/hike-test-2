import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { requestCompassPermission, useCompassHeading } from "@/lib/hooks/useCompassHeading";

type Fields = { alpha?: number | null; absolute?: boolean; webkitCompassHeading?: number; webkitCompassAccuracy?: number };

function fire(type: "deviceorientation" | "deviceorientationabsolute", fields: Fields) {
  const ev = new Event(type);
  Object.assign(ev, { alpha: null, absolute: false, ...fields });
  act(() => {
    window.dispatchEvent(ev);
  });
}
/** Past the throttle between readings. */
const tick = () => vi.advanceTimersByTime(200);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-23T10:00:00Z"));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("useCompassHeading", () => {
  it("is null before any reading, and for a phone with no compass (a desktop's all-null event)", () => {
    const { result } = renderHook(() => useCompassHeading(true));
    expect(result.current).toBeNull();
    fire("deviceorientation", { alpha: null });
    expect(result.current).toBeNull();
  });

  it("reads Android's absolute alpha as 360 - alpha (the compass heading of the top of the phone)", () => {
    const { result } = renderHook(() => useCompassHeading(true));
    fire("deviceorientationabsolute", { alpha: 270, absolute: true });
    expect(result.current).toBe(90);
  });

  it("ignores a relative alpha: it has no north in it", () => {
    const { result } = renderHook(() => useCompassHeading(true));
    fire("deviceorientation", { alpha: 270, absolute: false });
    expect(result.current).toBeNull();
  });

  it("reads iOS's webkitCompassHeading as is", () => {
    const { result } = renderHook(() => useCompassHeading(true));
    fire("deviceorientation", { webkitCompassHeading: 123, webkitCompassAccuracy: 10 });
    expect(result.current).toBe(123);
  });

  it("gives no heading when iOS says the compass is not calibrated", () => {
    const { result } = renderHook(() => useCompassHeading(true));
    fire("deviceorientation", { webkitCompassHeading: 123, webkitCompassAccuracy: -1 });
    expect(result.current).toBeNull();
  });

  it("turns the short way through north, eases towards a new reading and ignores jitter", () => {
    const { result } = renderHook(() => useCompassHeading(true));
    fire("deviceorientation", { webkitCompassHeading: 350 });
    expect(result.current).toBe(350);
    tick();
    fire("deviceorientation", { webkitCompassHeading: 351 }); // 1 degree: inside the dead band
    expect(result.current).toBe(350);
    tick();
    fire("deviceorientation", { webkitCompassHeading: 10 }); // 20 degrees clockwise across north
    expect(result.current).toBeGreaterThan(350);
    expect(result.current).toBeLessThan(370);
    tick();
    fire("deviceorientation", { webkitCompassHeading: 10 });
    expect(result.current).toBeGreaterThan(355); // never swings back through 180
  });

  it("does not re-render for readings closer together than the throttle", () => {
    let renders = 0;
    const { result } = renderHook(() => {
      renders++;
      return useCompassHeading(true);
    });
    fire("deviceorientation", { webkitCompassHeading: 10 });
    const after = renders;
    fire("deviceorientation", { webkitCompassHeading: 90 }); // same instant
    expect(renders).toBe(after);
    expect(result.current).toBe(10);
  });

  it("adds the screen's rotation, so the top of a landscape screen is what points", () => {
    vi.stubGlobal("screen", { orientation: { angle: 90 } });
    const { result } = renderHook(() => useCompassHeading(true));
    fire("deviceorientation", { webkitCompassHeading: 100 });
    expect(result.current).toBe(190);
  });

  it("listens only while active, and clears when it stops", () => {
    const { result, rerender } = renderHook(({ on }) => useCompassHeading(on), { initialProps: { on: false } });
    fire("deviceorientation", { webkitCompassHeading: 50 });
    expect(result.current).toBeNull();
    rerender({ on: true });
    fire("deviceorientation", { webkitCompassHeading: 50 });
    expect(result.current).toBe(50);
    rerender({ on: false });
    expect(result.current).toBeNull();
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
