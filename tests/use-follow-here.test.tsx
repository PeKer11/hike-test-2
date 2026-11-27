import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFollowHere } from "@/lib/hooks/useFollowHere";

type Ok = (p: GeolocationPosition) => void;
const M_PER_DEG = 111_320;
const BASE = { lat: 32.08, lng: 34.77 };

function fix(eastM: number, acc = 9, jitterM = 0): GeolocationPosition {
  return {
    coords: { latitude: BASE.lat + jitterM / M_PER_DEG, longitude: BASE.lng + (eastM + jitterM) / (M_PER_DEG * Math.cos((BASE.lat * Math.PI) / 180)), accuracy: acc, speed: null, heading: null },
    timestamp: Date.now(),
  } as unknown as GeolocationPosition;
}

let watches: Ok[];
let geo: { getCurrentPosition: ReturnType<typeof vi.fn>; watchPosition: ReturnType<typeof vi.fn>; clearWatch: ReturnType<typeof vi.fn> };
let visibility: "visible" | "hidden";

beforeEach(() => {
  vi.useFakeTimers();
  watches = [];
  geo = {
    getCurrentPosition: vi.fn(),
    watchPosition: vi.fn((ok: Ok) => watches.push(ok)),
    clearWatch: vi.fn(),
  };
  vi.stubGlobal("navigator", { geolocation: geo });
  visibility = "visible";
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => visibility });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("useFollowHere", () => {
  it("moves the dot within 8 s of walking at 1.4 m/s after a short stand", () => {
    const dots: Array<{ lat: number; lng: number }> = [];
    renderHook(() => useFollowHere({ enabled: true, onDot: (c) => dots.push(c) }));
    for (let s = 0; s < 20; s++) {
      act(() => watches[0](fix(0, 9, (s % 2 ? 1 : -1) * 2)));
      act(() => void vi.advanceTimersByTime(1000));
    }
    for (let s = 1; s <= 8; s++) {
      act(() => watches[0](fix(1.4 * s)));
      act(() => void vi.advanceTimersByTime(1000));
    }
    const last = dots[dots.length - 1];
    const movedM = (last.lng - BASE.lng) * M_PER_DEG * Math.cos((BASE.lat * Math.PI) / 180);
    expect(movedM).toBeGreaterThan(5);
  });

  it("holds the dot when the phone stands with ±3 m jitter", () => {
    const dots: Array<{ lat: number; lng: number }> = [];
    renderHook(() => useFollowHere({ enabled: true, onDot: (c) => dots.push(c) }));
    for (let s = 0; s < 60; s++) {
      act(() => watches[0](fix(0, 10, (s % 2 ? 1 : -1) * 3)));
      act(() => void vi.advanceTimersByTime(1000));
    }
    const maxM = Math.max(0, ...dots.map((c) => Math.abs((c.lng - BASE.lng) * M_PER_DEG * Math.cos((BASE.lat * Math.PI) / 180))));
    expect(maxM).toBeLessThan(8);
    expect(dots.length).toBeLessThan(6);
  });

  it("stops the watch when the page is hidden, restarts when visible, and when disabled", () => {
    const { rerender, unmount } = renderHook(({ enabled }) => useFollowHere({ enabled, onDot: () => {} }), { initialProps: { enabled: true } });
    expect(geo.watchPosition).toHaveBeenCalledTimes(1);
    visibility = "hidden";
    act(() => void document.dispatchEvent(new Event("visibilitychange")));
    expect(geo.clearWatch).toHaveBeenCalledTimes(1);
    visibility = "visible";
    act(() => void document.dispatchEvent(new Event("visibilitychange")));
    expect(geo.watchPosition).toHaveBeenCalledTimes(2);
    rerender({ enabled: false });
    expect(geo.clearWatch).toHaveBeenCalledTimes(2);
    unmount();
  });

  it("never starts a watch when disabled", () => {
    renderHook(() => useFollowHere({ enabled: false, onDot: () => {} }));
    expect(geo.watchPosition).not.toHaveBeenCalled();
  });
});
