import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useRouteCalculation } from "@/lib/hooks/useRouteCalculation";
import { defaultConstraints, type CalculatedRoute, type Waypoint } from "@/lib/types";

// `planRoute` is this project's own module, so it is used for real; only the
// network boundary underneath it (`fetch` to /api/*) is stubbed.
const makeWaypoint = (id: string, lat: number, lng: number): Waypoint => ({
  id,
  name: id,
  coordinates: { lat, lng },
  required: false,
  isStart: false,
  isEnd: false,
});

// Encoded polyline for roughly [(38.5, -120.2), (40.7, -120.95), (43.252, -126.453)].
const ENCODED_LINE = "_p~iF~ps|U_ulLnnqC_mqNvxq`@";

function stubDirections(payload: unknown, status = 200) {
  const fetchMock = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify(payload), { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useRouteCalculation", () => {
  it("starts with nothing calculated", () => {
    const { result } = renderHook(() => useRouteCalculation());

    expect(result.current.route).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it("stores the calculated route and returns it to the caller", async () => {
    stubDirections({
      routes: [
        {
          geometry: ENCODED_LINE,
          summary: { distance: 1234, duration: 900 },
          segments: [{ distance: 1234, duration: 900, steps: [] }],
          way_points: [0, 2],
        },
      ],
    });

    const { result } = renderHook(() => useRouteCalculation());

    let returned: CalculatedRoute | null = null;
    await act(async () => {
      returned = await result.current.calculateRoute(
        [makeWaypoint("a", 38.5, -120.2), makeWaypoint("b", 43.252, -126.453)],
        defaultConstraints,
      );
    });

    expect(returned).not.toBeNull();
    expect(result.current.route?.totalDistanceMeters).toBe(1234);
    expect(result.current.route).toBe(returned);
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it("surfaces the planner's message and returns null when routing fails", async () => {
    const { result } = renderHook(() => useRouteCalculation());

    let returned: CalculatedRoute | null = {} as CalculatedRoute;
    await act(async () => {
      returned = await result.current.calculateRoute(
        [makeWaypoint("a", 31.77, 35.21)],
        defaultConstraints,
      );
    });

    expect(returned).toBeNull();
    expect(result.current.error).toBe(
      "Add at least two waypoints before calculating a route.",
    );
    expect(result.current.route).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it("drops a previously calculated route when a later calculation fails", async () => {
    stubDirections({
      routes: [
        {
          geometry: ENCODED_LINE,
          summary: { distance: 500, duration: 400 },
          segments: [{ distance: 500, duration: 400, steps: [] }],
          way_points: [0, 2],
        },
      ],
    });

    const { result } = renderHook(() => useRouteCalculation());

    await act(async () => {
      await result.current.calculateRoute(
        [makeWaypoint("a", 38.5, -120.2), makeWaypoint("b", 43.252, -126.453)],
        defaultConstraints,
      );
    });
    expect(result.current.route).not.toBeNull();

    await act(async () => {
      await result.current.calculateRoute([], defaultConstraints);
    });

    expect(result.current.route).toBeNull();
    expect(result.current.error).toBe(
      "Add at least two waypoints before calculating a route.",
    );
  });

  it("clears a stale error when a route is applied from elsewhere", async () => {
    const { result } = renderHook(() => useRouteCalculation());

    await act(async () => {
      await result.current.calculateRoute([], defaultConstraints);
    });
    expect(result.current.error).not.toBeNull();

    const applied = {
      orderedWaypoints: [],
      segments: [],
      geometry: [],
      totalDistanceMeters: 42,
      totalDurationSeconds: 60,
      warnings: [],
    } satisfies CalculatedRoute;

    act(() => {
      result.current.applyRoute(applied);
    });

    expect(result.current.route).toBe(applied);
    expect(result.current.error).toBeNull();
  });

  it("clears both the route and the error on clearRoute", async () => {
    const { result } = renderHook(() => useRouteCalculation());

    await act(async () => {
      await result.current.calculateRoute([], defaultConstraints);
    });

    act(() => {
      result.current.clearRoute();
    });

    expect(result.current.route).toBeNull();
    expect(result.current.error).toBeNull();
  });
});
