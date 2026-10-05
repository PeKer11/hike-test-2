import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useWakeLock, useWalkTicker } from "@/lib/hooks/useWalkTicker";

function setHidden(hidden: boolean) {
  Object.defineProperty(document, "hidden", { configurable: true, value: hidden });
  document.dispatchEvent(new Event("visibilitychange"));
}

beforeEach(() => {
  vi.useFakeTimers();
  setHidden(false);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("useWalkTicker", () => {
  it("ticks on one interval while enabled", () => {
    const onTick = vi.fn();
    renderHook(() => useWalkTicker(true, onTick, 5000));
    vi.advanceTimersByTime(15_000);
    expect(onTick).toHaveBeenCalledTimes(3);
  });

  it("does not tick when disabled", () => {
    const onTick = vi.fn();
    renderHook(() => useWalkTicker(false, onTick, 5000));
    vi.advanceTimersByTime(20_000);
    expect(onTick).not.toHaveBeenCalled();
  });

  it("skips ticks while the tab is hidden and runs one immediately on return", () => {
    const onTick = vi.fn();
    renderHook(() => useWalkTicker(true, onTick, 5000));
    act(() => setHidden(true));
    vi.advanceTimersByTime(30_000);
    expect(onTick).not.toHaveBeenCalled();
    act(() => setHidden(false));
    expect(onTick).toHaveBeenCalledTimes(1);
  });

  it("clears the interval and listener on unmount", () => {
    const onTick = vi.fn();
    const { unmount } = renderHook(() => useWalkTicker(true, onTick, 5000));
    unmount();
    vi.advanceTimersByTime(30_000);
    act(() => setHidden(false));
    expect(onTick).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("uses the latest callback without restarting the interval", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(({ cb }) => useWalkTicker(true, cb, 5000), {
      initialProps: { cb: first },
    });
    rerender({ cb: second });
    vi.advanceTimersByTime(5000);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});

describe("useWakeLock", () => {
  function stubWakeLock() {
    const release = vi.fn().mockResolvedValue(undefined);
    const request = vi.fn().mockResolvedValue({ release });
    vi.stubGlobal("navigator", { ...navigator, wakeLock: { request } });
    return { request, release };
  }

  it("acquires while walking and releases on unmount", async () => {
    const { request, release } = stubWakeLock();
    const { unmount } = renderHook(() => useWakeLock(true));
    await act(async () => {});
    expect(request).toHaveBeenCalledWith("screen");
    unmount();
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("is a no-op when unsupported or not walking", async () => {
    const { request } = stubWakeLock();
    renderHook(() => useWakeLock(false));
    await act(async () => {});
    expect(request).not.toHaveBeenCalled();
    vi.stubGlobal("navigator", { ...navigator, wakeLock: undefined });
    expect(() => renderHook(() => useWakeLock(true))).not.toThrow();
  });
});
