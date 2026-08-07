import { afterEach, describe, expect, it, vi } from "vitest";

import { planRoute } from "@/lib/optimization/route-planner";
import { defaultConstraints, type ConstraintSet, type Waypoint } from "@/lib/types";

const makeWaypoint = (
  id: string,
  lat: number,
  lng: number,
  overrides: Partial<Waypoint> = {},
): Waypoint => ({
  id,
  name: id,
  coordinates: { lat, lng },
  required: false,
  isStart: false,
  isEnd: false,
  ...overrides,
});

/** Google-format polyline encoder, so tests can state geometry as coordinates. */
function encodePolyline(points: Array<[number, number]>): string {
  let lastLat = 0;
  let lastLng = 0;
  let out = "";

  const encodeValue = (value: number) => {
    let v = value < 0 ? ~(value << 1) : value << 1;
    while (v >= 0x20) {
      out += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
      v >>= 5;
    }
    out += String.fromCharCode(v + 63);
  };

  for (const [lat, lng] of points) {
    const latE5 = Math.round(lat * 1e5);
    const lngE5 = Math.round(lng * 1e5);
    encodeValue(latE5 - lastLat);
    encodeValue(lngE5 - lastLng);
    lastLat = latE5;
    lastLng = lngE5;
  }

  return out;
}

// Roughly [(38.5, -120.2), (40.7, -120.95), (43.252, -126.453)].
const THREE_POINT_LINE = "_p~iF~ps|U_ulLnnqC_mqNvxq`@";
// Same polyline truncated to a single point.
const ONE_POINT_LINE = "_p~iF~ps|U";

function directionsRoute(
  overrides: {
    geometry?: string;
    distance?: number;
    duration?: number;
    segments?: Array<{
      distance: number;
      duration: number;
      steps: Array<{ distance: number; duration: number; instruction: string }>;
    }>;
    wayPoints?: number[];
  } = {},
) {
  const distance = overrides.distance ?? 100;
  const duration = overrides.duration ?? 60;
  return {
    geometry: overrides.geometry ?? THREE_POINT_LINE,
    summary: { distance, duration },
    segments: overrides.segments ?? [{ distance, duration, steps: [] }],
    way_points: overrides.wayPoints ?? [0, 2],
  };
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status });
}

/** Routes each /api/* call to a handler, so a test only states what it cares about. */
function stubApi(handlers: {
  directions?: (body: Record<string, unknown>, call: number) => Response;
  optimization?: (body: Record<string, unknown>) => Response;
}) {
  let directionsCalls = 0;
  const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
    const url = input.toString();
    const body = JSON.parse(init?.body as string) as Record<string, unknown>;

    if (url === "/api/directions") {
      directionsCalls += 1;
      if (!handlers.directions) throw new Error("Unexpected /api/directions call");
      return handlers.directions(body, directionsCalls);
    }

    if (url === "/api/optimization") {
      if (!handlers.optimization) throw new Error("Unexpected /api/optimization call");
      return handlers.optimization(body);
    }

    throw new Error(`Unexpected URL in test: ${url}`);
  });

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/**
 * With three or more waypoints and no fixed start/end, the constraint builder
 * makes waypoints[0] the vehicle's start and numbers the *remaining* waypoints
 * as jobs from 1 — so job 1 is the second waypoint, not the first.
 */
function optimizationResponse(
  jobIds: number[],
  options: { unassigned?: number[]; withStart?: boolean } = {},
) {
  const steps: Array<{ type: string; id: number }> = [];
  if (options.withStart) steps.push({ type: "start", id: 0 });
  for (const id of jobIds) steps.push({ type: "job", id });

  return {
    code: 0,
    summary: { cost: 0, routes: 1, unassigned: options.unassigned?.length ?? 0 },
    unassigned: (options.unassigned ?? []).map((id) => ({ id })),
    routes: [{ vehicle: 1, distance: 0, duration: 0, steps }],
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("planRoute input validation", () => {
  it("refuses to plan a route from a single waypoint", async () => {
    await expect(
      planRoute({
        waypoints: [makeWaypoint("w1", 31.77, 35.21)],
        constraints: defaultConstraints,
      }),
    ).rejects.toThrow("Add at least two waypoints before calculating a route.");
  });
});

describe("planRoute direct directions path", () => {
  it("skips optimization entirely for two unconstrained waypoints", async () => {
    const fetchMock = stubApi({
      directions: () => jsonResponse({ routes: [directionsRoute()] }),
    });

    await planRoute({
      waypoints: [
        makeWaypoint("w1", 38.5, -120.2),
        makeWaypoint("w2", 43.252, -126.453),
      ],
      constraints: defaultConstraints,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/directions");
  });

  it("sends walking coordinates in ORS [lng, lat] order", async () => {
    const fetchMock = stubApi({
      directions: () => jsonResponse({ routes: [directionsRoute()] }),
    });

    await planRoute({
      waypoints: [
        makeWaypoint("w1", 38.5, -120.2),
        makeWaypoint("w2", 43.252, -126.453),
      ],
      constraints: defaultConstraints,
    });

    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body.profile).toBe("foot-walking");
    expect(body.coordinates).toEqual([
      [-120.2, 38.5],
      [-126.453, 43.252],
    ]);
  });

  it("reports the totals ORS gave, not the sum of its own segments", async () => {
    stubApi({
      directions: () =>
        jsonResponse({
          routes: [directionsRoute({ distance: 4321, duration: 3210 })],
        }),
    });

    const route = await planRoute({
      waypoints: [
        makeWaypoint("w1", 38.5, -120.2),
        makeWaypoint("w2", 43.252, -126.453),
      ],
      constraints: defaultConstraints,
    });

    expect(route.totalDistanceMeters).toBe(4321);
    expect(route.totalDurationSeconds).toBe(3210);
    expect(route.warnings).toEqual([]);
    expect(route.geometry).toHaveLength(3);
  });

  it("slices each segment's geometry at the way_point boundaries", async () => {
    stubApi({
      directions: () =>
        jsonResponse({
          routes: [
            directionsRoute({
              wayPoints: [0, 1],
              segments: [{ distance: 10, duration: 5, steps: [] }],
            }),
          ],
        }),
    });

    const route = await planRoute({
      waypoints: [
        makeWaypoint("w1", 38.5, -120.2),
        makeWaypoint("w2", 40.7, -120.95),
      ],
      constraints: defaultConstraints,
    });

    expect(route.segments).toHaveLength(1);
    expect(route.segments[0].geometry).toHaveLength(2);
    expect(route.segments[0].from.id).toBe("w1");
    expect(route.segments[0].to.id).toBe("w2");
  });

  it("carries turn-by-turn steps through onto the segment", async () => {
    stubApi({
      directions: () =>
        jsonResponse({
          routes: [
            directionsRoute({
              segments: [
                {
                  distance: 100,
                  duration: 60,
                  steps: [
                    { distance: 100, duration: 60, instruction: "Head north" },
                  ],
                },
              ],
            }),
          ],
        }),
    });

    const route = await planRoute({
      waypoints: [
        makeWaypoint("w1", 38.5, -120.2),
        makeWaypoint("w2", 43.252, -126.453),
      ],
      constraints: defaultConstraints,
    });

    expect(route.segments[0].steps).toEqual([
      { instruction: "Head north", distanceMeters: 100, durationSeconds: 60 },
    ]);
  });

  it("tells the walker to move a waypoint when ORS finds no route at all", async () => {
    stubApi({ directions: () => jsonResponse({ routes: [] }) });

    await expect(
      planRoute({
        waypoints: [
          makeWaypoint("w1", 38.5, -120.2),
          makeWaypoint("w2", 43.252, -126.453),
        ],
        constraints: defaultConstraints,
      }),
    ).rejects.toThrow("No walking route found between these locations.");
  });

  it("rejects a route whose geometry is a single point", async () => {
    stubApi({
      directions: () =>
        jsonResponse({ routes: [directionsRoute({ geometry: ONE_POINT_LINE })] }),
    });

    await expect(
      planRoute({
        waypoints: [
          makeWaypoint("w1", 38.5, -120.2),
          makeWaypoint("w2", 43.252, -126.453),
        ],
        constraints: defaultConstraints,
      }),
    ).rejects.toThrow("The routing service returned an empty walking route.");
  });

  it("surfaces the API route's own error message", async () => {
    stubApi({
      directions: () =>
        jsonResponse({ error: "Routing quota exceeded for today." }, 429),
    });

    await expect(
      planRoute({
        waypoints: [
          makeWaypoint("w1", 38.5, -120.2),
          makeWaypoint("w2", 43.252, -126.453),
        ],
        constraints: defaultConstraints,
      }),
    ).rejects.toThrow("Routing quota exceeded for today.");
  });

  it("falls back to the status code when the failure body carries no message", async () => {
    stubApi({ directions: () => new Response("<html>502</html>", { status: 502 }) });

    await expect(
      planRoute({
        waypoints: [
          makeWaypoint("w1", 38.5, -120.2),
          makeWaypoint("w2", 43.252, -126.453),
        ],
        constraints: defaultConstraints,
      }),
    ).rejects.toThrow("Request failed (502)");
  });
});

describe("planRoute optimization path", () => {
  const threeWaypoints = [
    makeWaypoint("w1", 38.5, -120.2),
    makeWaypoint("w2", 40.7, -120.95),
    makeWaypoint("w3", 43.252, -126.453),
  ];

  it("optimizes once three waypoints are on the map", async () => {
    const fetchMock = stubApi({
      optimization: () =>
        jsonResponse(optimizationResponse([1, 2], { withStart: true })),
      directions: () => jsonResponse({ routes: [directionsRoute()] }),
    });

    await planRoute({ waypoints: threeWaypoints, constraints: defaultConstraints });

    expect(fetchMock.mock.calls[0][0]).toBe("/api/optimization");
  });

  it("optimizes two waypoints when a constraint is switched on", async () => {
    const constraints: ConstraintSet = {
      ...defaultConstraints,
      maxDistance: { enabled: true, maxKm: 5 },
    };
    const fetchMock = stubApi({
      optimization: () => jsonResponse(optimizationResponse([1, 2])),
      directions: () => jsonResponse({ routes: [directionsRoute()] }),
    });

    await planRoute({
      waypoints: [threeWaypoints[0], threeWaypoints[1]],
      constraints,
    });

    expect(fetchMock.mock.calls[0][0]).toBe("/api/optimization");
  });

  it("walks the waypoints in the order the optimizer returned", async () => {
    stubApi({
      optimization: () =>
        jsonResponse(optimizationResponse([2, 1], { withStart: true })),
      directions: () => jsonResponse({ routes: [directionsRoute()] }),
    });

    const route = await planRoute({
      waypoints: threeWaypoints,
      constraints: defaultConstraints,
    });

    expect(route.orderedWaypoints.map((w) => w.id)).toEqual(["w1", "w3", "w2"]);
  });

  it("sums the per-leg distances rather than trusting the optimizer's cost", async () => {
    stubApi({
      optimization: () =>
        jsonResponse(optimizationResponse([1, 2], { withStart: true })),
      directions: (_body, call) =>
        jsonResponse({
          routes: [directionsRoute({ distance: call * 100, duration: call * 60 })],
        }),
    });

    const route = await planRoute({
      waypoints: threeWaypoints,
      constraints: defaultConstraints,
    });

    expect(route.segments).toHaveLength(2);
    expect(route.totalDistanceMeters).toBe(300);
    expect(route.totalDurationSeconds).toBe(180);
  });

  it("does not repeat the shared point where two legs meet", async () => {
    const legOne = encodePolyline([
      [38.5, -120.2],
      [40.7, -120.95],
    ]);
    const legTwo = encodePolyline([
      [40.7, -120.95],
      [43.252, -126.453],
    ]);
    stubApi({
      optimization: () =>
        jsonResponse(optimizationResponse([1, 2], { withStart: true })),
      directions: (_body, call) =>
        jsonResponse({
          routes: [directionsRoute({ geometry: call === 1 ? legOne : legTwo })],
        }),
    });

    const route = await planRoute({
      waypoints: threeWaypoints,
      constraints: defaultConstraints,
    });

    // Two 2-point legs meeting at (40.7, -120.95): 2 + 2 - 1, not 4.
    expect(route.geometry).toHaveLength(3);
  });

  it("keeps a point that only looks like a join because it is nearby", async () => {
    const legOne = encodePolyline([
      [38.5, -120.2],
      [40.7, -120.95],
    ]);
    const legTwo = encodePolyline([
      [40.70001, -120.95],
      [43.252, -126.453],
    ]);
    stubApi({
      optimization: () =>
        jsonResponse(optimizationResponse([1, 2], { withStart: true })),
      directions: (_body, call) =>
        jsonResponse({
          routes: [directionsRoute({ geometry: call === 1 ? legOne : legTwo })],
        }),
    });

    const route = await planRoute({
      waypoints: threeWaypoints,
      constraints: defaultConstraints,
    });

    expect(route.geometry).toHaveLength(4);
  });

  it("names the required waypoints the optimizer refused to visit", async () => {
    const waypoints = [
      makeWaypoint("w1", 38.5, -120.2),
      makeWaypoint("w2", 40.7, -120.95, { name: "Machane Yehuda", required: true }),
      makeWaypoint("w3", 43.252, -126.453),
    ];
    stubApi({
      optimization: () =>
        jsonResponse(
          optimizationResponse([2], { unassigned: [1], withStart: true }),
        ),
      directions: () => jsonResponse({ routes: [directionsRoute()] }),
    });

    const route = await planRoute({ waypoints, constraints: defaultConstraints });

    expect(route.warnings).toEqual([
      "Required waypoint(s) were dropped by route optimization: Machane Yehuda.",
    ]);
  });

  it("just counts the drops when none of them were required", async () => {
    stubApi({
      optimization: () =>
        jsonResponse(
          optimizationResponse([2], { unassigned: [1], withStart: true }),
        ),
      directions: () => jsonResponse({ routes: [directionsRoute()] }),
    });

    const route = await planRoute({
      waypoints: threeWaypoints,
      constraints: defaultConstraints,
    });

    expect(route.warnings).toEqual([
      "1 waypoint(s) could not be assigned due to constraints.",
    ]);
  });

  it("skips an unroutable leg with a warning instead of failing the whole walk", async () => {
    stubApi({
      optimization: () =>
        jsonResponse(optimizationResponse([1, 2], { withStart: true })),
      directions: (_body, call) =>
        call === 1
          ? jsonResponse({ error: "Segment not routable" }, 400)
          : jsonResponse({ routes: [directionsRoute()] }),
    });

    const route = await planRoute({
      waypoints: threeWaypoints,
      constraints: defaultConstraints,
    });

    expect(route.segments).toHaveLength(1);
    expect(route.warnings).toEqual([
      'Could not get directions from "w1" to "w2". Segment skipped.',
    ]);
  });

  it("warns by name when a leg comes back with no route in it", async () => {
    stubApi({
      optimization: () =>
        jsonResponse(optimizationResponse([1, 2], { withStart: true })),
      directions: (_body, call) =>
        call === 1
          ? jsonResponse({ routes: [] })
          : jsonResponse({ routes: [directionsRoute()] }),
    });

    const route = await planRoute({
      waypoints: threeWaypoints,
      constraints: defaultConstraints,
    });

    expect(route.warnings).toEqual([
      'No walking route found between "w1" and "w2". Try moving that waypoint closer to a path.',
    ]);
  });

  it("throws when optimization cannot build any valid segment", async () => {
    stubApi({
      optimization: () =>
        jsonResponse(optimizationResponse([1, 2], { withStart: true })),
      directions: () => jsonResponse({ error: "Segment not routable" }, 400),
    });

    await expect(
      planRoute({ waypoints: threeWaypoints, constraints: defaultConstraints }),
    ).rejects.toThrow(
      "No walking route could be generated for the optimized waypoint order.",
    );
  });

  it("throws when every surviving leg has an unusable geometry", async () => {
    stubApi({
      optimization: () =>
        jsonResponse(optimizationResponse([1, 2], { withStart: true })),
      directions: () =>
        jsonResponse({ routes: [directionsRoute({ geometry: "" })] }),
    });

    await expect(
      planRoute({ waypoints: threeWaypoints, constraints: defaultConstraints }),
    ).rejects.toThrow("The optimized route has no usable walking path.");
  });

  it("keeps the user's own order when the optimizer returns nothing usable", async () => {
    stubApi({
      optimization: () => jsonResponse(optimizationResponse([])),
      directions: () => jsonResponse({ routes: [directionsRoute()] }),
    });

    const route = await planRoute({
      waypoints: threeWaypoints,
      constraints: defaultConstraints,
    });

    expect(route.orderedWaypoints.map((w) => w.id)).toEqual(["w1", "w2", "w3"]);
  });

  it("routes a pinned start and end directly, without asking the optimizer", async () => {
    const constraints: ConstraintSet = {
      ...defaultConstraints,
      fixedStartEnd: { enabled: true },
    };
    const fetchMock = stubApi({
      directions: () => jsonResponse({ routes: [directionsRoute()] }),
    });

    const route = await planRoute({
      waypoints: [
        makeWaypoint("w1", 38.5, -120.2, { isStart: true }),
        makeWaypoint("w2", 43.252, -126.453, { isEnd: true }),
      ],
      constraints,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/directions");
    expect(route.orderedWaypoints.map((w) => w.id)).toEqual(["w1", "w2"]);
  });
});
