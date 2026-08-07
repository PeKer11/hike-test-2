import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useWaypoints } from "@/lib/hooks/useWaypoints";
import type { Waypoint } from "@/lib/types";

function makeWaypoint(id: string, overrides: Partial<Waypoint> = {}): Waypoint {
  return {
    id,
    name: id,
    coordinates: { lat: 31.77, lng: 35.21 },
    required: false,
    isStart: false,
    isEnd: false,
    ...overrides,
  };
}

function renderWithWaypoints(initial: Waypoint[]) {
  return renderHook(() => useWaypoints(initial));
}

describe("useWaypoints", () => {
  it("numbers an unnamed waypoint by its position in the list", () => {
    const { result } = renderWithWaypoints([makeWaypoint("a"), makeWaypoint("b")]);

    act(() => {
      result.current.addWaypoint({ coordinates: { lat: 32, lng: 34.8 } });
    });

    expect(result.current.waypoints[2].name).toBe("Waypoint 3");
  });

  it("falls back to a numbered name when the given name is only whitespace", () => {
    const { result } = renderWithWaypoints([]);

    act(() => {
      result.current.addWaypoint({
        coordinates: { lat: 32, lng: 34.8 },
        name: "   ",
      });
    });

    expect(result.current.waypoints[0].name).toBe("Waypoint 1");
  });

  it("trims a supplied waypoint name", () => {
    const { result } = renderWithWaypoints([]);

    act(() => {
      result.current.addWaypoint({
        coordinates: { lat: 32, lng: 34.8 },
        name: "  Machane Yehuda  ",
      });
    });

    expect(result.current.waypoints[0].name).toBe("Machane Yehuda");
  });

  it("returns the created waypoint so the caller can select it immediately", () => {
    const { result } = renderWithWaypoints([]);

    let created: Waypoint | undefined;
    act(() => {
      created = result.current.addWaypoint({
        coordinates: { lat: 32, lng: 34.8 },
        name: "Trailhead",
      });
    });

    expect(created?.name).toBe("Trailhead");
    expect(created?.id).toBe(result.current.waypoints[0].id);
  });

  it("gives each added waypoint a distinct id", () => {
    const { result } = renderWithWaypoints([]);

    act(() => {
      result.current.addWaypoint({ coordinates: { lat: 32, lng: 34.8 } });
    });
    act(() => {
      result.current.addWaypoint({ coordinates: { lat: 32.1, lng: 34.9 } });
    });

    const [first, second] = result.current.waypoints;
    expect(first.id).not.toBe(second.id);
  });

  it("updates only the targeted waypoint", () => {
    const { result } = renderWithWaypoints([makeWaypoint("a"), makeWaypoint("b")]);

    act(() => {
      result.current.updateWaypoint("b", { name: "Renamed" });
    });

    expect(result.current.waypoints.map((w) => w.name)).toEqual(["a", "Renamed"]);
  });

  it("removes only the targeted waypoint", () => {
    const { result } = renderWithWaypoints([
      makeWaypoint("a"),
      makeWaypoint("b"),
      makeWaypoint("c"),
    ]);

    act(() => {
      result.current.removeWaypoint("b");
    });

    expect(result.current.waypoints.map((w) => w.id)).toEqual(["a", "c"]);
  });

  it("moves a waypoint to the requested index", () => {
    const { result } = renderWithWaypoints([
      makeWaypoint("a"),
      makeWaypoint("b"),
      makeWaypoint("c"),
    ]);

    act(() => {
      result.current.reorderWaypoints(0, 2);
    });

    expect(result.current.waypoints.map((w) => w.id)).toEqual(["b", "c", "a"]);
  });

  it("leaves the list untouched when a drag ends where it started", () => {
    const initial = [makeWaypoint("a"), makeWaypoint("b")];
    const { result } = renderWithWaypoints(initial);

    act(() => {
      result.current.reorderWaypoints(1, 1);
    });

    expect(result.current.waypoints).toBe(initial);
  });

  it("leaves the list untouched when the source index does not exist", () => {
    const { result } = renderWithWaypoints([makeWaypoint("a"), makeWaypoint("b")]);

    act(() => {
      result.current.reorderWaypoints(7, 0);
    });

    expect(result.current.waypoints.map((w) => w.id)).toEqual(["a", "b"]);
  });

  it("flips required on the targeted waypoint only", () => {
    const { result } = renderWithWaypoints([
      makeWaypoint("a", { required: true }),
      makeWaypoint("b"),
    ]);

    act(() => {
      result.current.toggleRequired("b");
    });

    expect(result.current.waypoints.map((w) => w.required)).toEqual([true, true]);

    act(() => {
      result.current.toggleRequired("b");
    });

    expect(result.current.waypoints.map((w) => w.required)).toEqual([true, false]);
  });

  it("keeps only one start waypoint", () => {
    const { result } = renderWithWaypoints([
      makeWaypoint("a", { isStart: true }),
      makeWaypoint("b"),
    ]);

    act(() => {
      result.current.setStartWaypoint("b");
    });

    expect(result.current.waypoints.map((w) => w.isStart)).toEqual([false, true]);
  });

  it("clears the end flag when the same waypoint becomes the start", () => {
    const { result } = renderWithWaypoints([
      makeWaypoint("a", { isEnd: true }),
      makeWaypoint("b", { isEnd: false }),
    ]);

    act(() => {
      result.current.setStartWaypoint("a");
    });

    expect(result.current.waypoints[0]).toMatchObject({
      isStart: true,
      isEnd: false,
    });
  });

  it("leaves an unrelated waypoint's end flag alone when setting the start", () => {
    const { result } = renderWithWaypoints([
      makeWaypoint("a"),
      makeWaypoint("b", { isEnd: true }),
    ]);

    act(() => {
      result.current.setStartWaypoint("a");
    });

    expect(result.current.waypoints[1].isEnd).toBe(true);
  });

  it("keeps only one end waypoint and clears its start flag", () => {
    const { result } = renderWithWaypoints([
      makeWaypoint("a", { isStart: true, isEnd: true }),
      makeWaypoint("b", { isStart: true }),
    ]);

    act(() => {
      result.current.setEndWaypoint("b");
    });

    expect(result.current.waypoints[0]).toMatchObject({
      isStart: true,
      isEnd: false,
    });
    expect(result.current.waypoints[1]).toMatchObject({
      isStart: false,
      isEnd: true,
    });
  });

  it("sets and then clears a waypoint time window", () => {
    const { result } = renderWithWaypoints([makeWaypoint("a")]);

    act(() => {
      result.current.setWaypointTimeWindow("a", { start: "09:00", end: "11:00" });
    });

    expect(result.current.waypoints[0].timeWindow).toEqual({
      start: "09:00",
      end: "11:00",
    });

    act(() => {
      result.current.setWaypointTimeWindow("a");
    });

    expect(result.current.waypoints[0].timeWindow).toBeUndefined();
  });

  it("empties the list on clearWaypoints", () => {
    const { result } = renderWithWaypoints([makeWaypoint("a"), makeWaypoint("b")]);

    act(() => {
      result.current.clearWaypoints();
    });

    expect(result.current.waypoints).toEqual([]);
  });
});
