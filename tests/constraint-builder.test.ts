import { describe, expect, it } from "vitest";
import { buildOptimizationRequest } from "@/lib/optimization/constraint-builder";
import type { ConstraintSet, Waypoint } from "@/lib/types";

function makeWaypoint(overrides: Partial<Waypoint> & { id: string }): Waypoint {
  return {
    name: `Waypoint ${overrides.id}`,
    coordinates: { lat: 47.0, lng: 8.0 },
    required: true,
    isStart: false,
    isEnd: false,
    ...overrides,
  };
}

const defaultConstraints: ConstraintSet = {
  maxDistance: { enabled: false, maxKm: 50 },
  timeWindows: { enabled: false, defaultWindow: undefined },
  fixedStartEnd: { enabled: false },
};

describe("buildOptimizationRequest", () => {
  it("uses the first waypoint as an implicit start for 3+ waypoints when start/end are not fixed", () => {
    const waypoints = [
      makeWaypoint({ id: "a", coordinates: { lat: 47.0, lng: 8.0 } }),
      makeWaypoint({ id: "b", coordinates: { lat: 47.1, lng: 8.1 } }),
      makeWaypoint({ id: "c", coordinates: { lat: 47.2, lng: 8.2 } }),
    ];

    const result = buildOptimizationRequest(waypoints, defaultConstraints);
    expect(result.request.jobs).toHaveLength(2);
    expect(result.request.vehicles).toHaveLength(1);
    expect(result.request.vehicles[0].profile).toBe("foot-walking");
    expect(result.request.vehicles[0].start).toEqual([8.0, 47.0]);
    expect(result.request.jobs[0].location).toEqual([8.1, 47.1]);
    expect(result.request.jobs[1].location).toEqual([8.2, 47.2]);
    expect(result.startWaypoint?.id).toBe("a");
  });

  it("uses [lng, lat] order in job locations", () => {
    const waypoints = [
      makeWaypoint({ id: "a", coordinates: { lat: 47.0, lng: 8.5 } }),
    ];

    const result = buildOptimizationRequest(waypoints, defaultConstraints);
    expect(result.request.jobs[0].location).toEqual([8.5, 47.0]);
  });

  it("sets priority 100 for required, 0 for optional", () => {
    const waypoints = [
      makeWaypoint({ id: "a", required: true }),
      makeWaypoint({ id: "b", required: false }),
    ];

    const result = buildOptimizationRequest(waypoints, defaultConstraints);
    expect(result.request.jobs[0].priority).toBe(100);
    expect(result.request.jobs[1].priority).toBe(0);
  });

  it("sets max_distance in meters when enabled", () => {
    const constraints: ConstraintSet = {
      ...defaultConstraints,
      maxDistance: { enabled: true, maxKm: 25 },
    };

    const result = buildOptimizationRequest(
      [makeWaypoint({ id: "a" })],
      constraints,
    );
    expect(result.request.vehicles[0].max_distance).toBe(25000);
  });

  it("does not set max_distance when disabled", () => {
    const result = buildOptimizationRequest(
      [makeWaypoint({ id: "a" })],
      defaultConstraints,
    );
    expect(result.request.vehicles[0].max_distance).toBeUndefined();
  });

  it("excludes start/end waypoints from jobs when fixedStartEnd enabled", () => {
    const constraints: ConstraintSet = {
      ...defaultConstraints,
      fixedStartEnd: { enabled: true },
    };

    const waypoints = [
      makeWaypoint({ id: "start", isStart: true, coordinates: { lat: 47.0, lng: 8.0 } }),
      makeWaypoint({ id: "mid", coordinates: { lat: 47.1, lng: 8.1 } }),
      makeWaypoint({ id: "end", isEnd: true, coordinates: { lat: 47.2, lng: 8.2 } }),
    ];

    const result = buildOptimizationRequest(waypoints, constraints);
    expect(result.request.jobs).toHaveLength(1);
    expect(result.request.jobs[0].location).toEqual([8.1, 47.1]);
    expect(result.request.vehicles[0].start).toEqual([8.0, 47.0]);
    expect(result.request.vehicles[0].end).toEqual([8.2, 47.2]);
    expect(result.startWaypoint?.id).toBe("start");
    expect(result.endWaypoint?.id).toBe("end");
  });

  it("adds time windows when enabled and waypoint has one", () => {
    const constraints: ConstraintSet = {
      ...defaultConstraints,
      timeWindows: { enabled: true, defaultWindow: undefined },
    };

    const waypoints = [
      makeWaypoint({
        id: "a",
        timeWindow: { start: "09:00", end: "11:00" },
      }),
    ];

    const result = buildOptimizationRequest(waypoints, constraints);
    expect(result.request.jobs[0].time_windows).toEqual([
      [9 * 3600, 11 * 3600],
    ]);
  });

  it("omits time windows when start >= end", () => {
    const constraints: ConstraintSet = {
      ...defaultConstraints,
      timeWindows: { enabled: true, defaultWindow: undefined },
    };

    const waypoints = [
      makeWaypoint({
        id: "a",
        timeWindow: { start: "15:00", end: "09:00" },
      }),
    ];

    const result = buildOptimizationRequest(waypoints, constraints);
    expect(result.request.jobs[0].time_windows).toBeUndefined();
  });

  it("maps job IDs to waypoints in jobWaypointMap", () => {
    const waypoints = [
      makeWaypoint({ id: "a" }),
      makeWaypoint({ id: "b" }),
    ];

    const result = buildOptimizationRequest(waypoints, defaultConstraints);
    expect(result.jobWaypointMap.get(1)?.id).toBe("a");
    expect(result.jobWaypointMap.get(2)?.id).toBe("b");
  });
});
