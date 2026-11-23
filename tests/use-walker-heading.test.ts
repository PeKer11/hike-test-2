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

type Props = { active?: boolean; gpsHeadingDeg?: number | null; gpsMoving?: boolean; simulated?: boolean };
const mount = (initial: Props = {}) =>
  renderHook((p: Props) => useWalkerHeading({ active: true, gpsHeadingDeg: null, gpsMoving: false, simulated: false, ...p }), { initialProps: initial });

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-23T10:00:00Z"));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("useWalkerHeading", () => {
  it("shows no heading with no source: standing, no compass, no GPS course", () => {
    const { result } = mount();
    expect(result.current).toBeNull();
  });

  it("shows the compass heading while standing, so the beam is there before the first step", () => {
    const { result } = mount();
    compass(80);
    expect(result.current).toBe(80);
  });

  it("shows the GPS heading when there is no compass", () => {
    const { result, rerender } = mount();
    rerender({ gpsHeadingDeg: 135 });
    expect(result.current).toBe(135);
  });

  it("prefers the compass standing and the GPS course walking briskly", () => {
    const { result, rerender } = mount({ gpsHeadingDeg: 135 });
    compass(80);
    expect(result.current).toBe(80);
    rerender({ gpsHeadingDeg: 135, gpsMoving: true });
    expect(result.current).toBe(135);
    rerender({ gpsHeadingDeg: 135, gpsMoving: false });
    expect(result.current).toBe(80);
  });

  it("switches source without spinning the long way round", () => {
    const { result, rerender } = mount({ gpsHeadingDeg: 355 });
    expect(result.current).toBe(355); // the GPS heading is what showed first
    compass(5);
    expect(result.current).toBe(365); // the compass is 10 degrees clockwise of it: 365, not 5 (a 350 degree spin back)
    rerender({ gpsHeadingDeg: 355, gpsMoving: true });
    expect(result.current).toBe(355); // and back again, a 10 degree turn
  });

  it("goes to null when the sources run dry, and comes back from there", () => {
    const { result, rerender } = mount({ gpsHeadingDeg: 200 });
    expect(result.current).toBe(200);
    rerender({ gpsHeadingDeg: null });
    expect(result.current).toBeNull();
    rerender({ gpsHeadingDeg: 20 });
    expect(result.current).toBe(20);
  });

  it("shows nothing when the walk is not active, whatever the sources say", () => {
    const { result } = mount({ active: false, gpsHeadingDeg: 90 });
    compass(80);
    expect(result.current).toBeNull();
  });

  it("in a simulated walk follows the simulated path and ignores the compass", () => {
    const { result, rerender } = mount({ simulated: true, gpsHeadingDeg: 250, gpsMoving: false });
    compass(80);
    expect(result.current).toBe(250);
    rerender({ simulated: true, gpsHeadingDeg: 260, gpsMoving: false });
    expect(result.current).toBe(260);
  });
});
