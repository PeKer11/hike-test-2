import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useConstraints } from "@/lib/hooks/useConstraints";
import { defaultConstraints } from "@/lib/types";

// The hook is thin, but every setter rebuilds a nested object by spreading, and
// the failure mode of that shape is silent: a toggle that forgets to spread
// drops the sibling field (the user's chosen distance, their time window) with
// no error anywhere. These tests pin the siblings, not the toggles.
describe("useConstraints", () => {
  it("keeps the chosen distance when the distance limit is toggled", () => {
    const { result } = renderHook(() => useConstraints());

    act(() => {
      result.current.setMaxDistanceKm(8);
    });
    act(() => {
      result.current.toggleMaxDistance();
    });

    expect(result.current.constraints.maxDistance).toEqual({
      enabled: true,
      maxKm: 8,
    });
  });

  it("keeps the default time window when time windows are toggled", () => {
    const { result } = renderHook(() => useConstraints());

    act(() => {
      result.current.setDefaultTimeWindow({ start: "09:00", end: "17:00" });
    });
    act(() => {
      result.current.toggleTimeWindows();
    });

    expect(result.current.constraints.timeWindows).toEqual({
      enabled: true,
      defaultWindow: { start: "09:00", end: "17:00" },
    });
  });

  it("clears the default time window when none is given", () => {
    const { result } = renderHook(() => useConstraints());

    act(() => {
      result.current.setDefaultTimeWindow({ start: "09:00", end: "17:00" });
    });
    act(() => {
      result.current.setDefaultTimeWindow();
    });

    expect(result.current.constraints.timeWindows.defaultWindow).toBeUndefined();
  });

  it("toggles fixed start/end without disturbing the other constraints", () => {
    const { result } = renderHook(() => useConstraints());

    act(() => {
      result.current.setMaxDistanceKm(3);
    });
    act(() => {
      result.current.toggleFixedStartEnd();
    });

    expect(result.current.constraints.fixedStartEnd.enabled).toBe(true);
    expect(result.current.constraints.maxDistance.maxKm).toBe(3);
  });

  it("resets to the shipped defaults rather than the initial value it was given", () => {
    const { result } = renderHook(() =>
      useConstraints({
        maxDistance: { enabled: true, maxKm: 42 },
        timeWindows: { enabled: true },
        fixedStartEnd: { enabled: true },
      }),
    );

    act(() => {
      result.current.resetConstraints();
    });

    expect(result.current.constraints).toEqual(defaultConstraints);
  });

  it("does not mutate the defaults object shared across the app", () => {
    const { result } = renderHook(() => useConstraints());

    act(() => {
      result.current.setMaxDistanceKm(99);
    });

    expect(defaultConstraints.maxDistance.maxKm).toBe(15);
  });
});
