import { afterEach, describe, expect, it, vi } from "vitest";

import { planRoute } from "@/lib/optimization/route-planner";
import { defaultConstraints, type Waypoint } from "@/lib/types";

const makeWaypoint = (id: string, lat: number, lng: number): Waypoint => ({
  id,
  name: id,
  coordinates: { lat, lng },
  required: false,
  isStart: false,
  isEnd: false,
});

describe("planRoute optimization flow", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("throws when optimization cannot build any valid segment", async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = input.toString();

      if (url === "/api/optimization") {
        return new Response(
          JSON.stringify({
            code: 0,
            summary: { cost: 0, routes: 1, unassigned: 0 },
            unassigned: [],
            routes: [
              {
                vehicle: 1,
                distance: 0,
                duration: 0,
                steps: [
                  { type: "start", id: 0 },
                  { type: "job", id: 1 },
                  { type: "job", id: 2 },
                ],
              },
            ],
          }),
          { status: 200 },
        );
      }

      if (url === "/api/directions") {
        return new Response(JSON.stringify({ error: "Segment not routable" }), {
          status: 400,
        });
      }

      throw new Error(`Unexpected URL in test: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    const waypoints: Waypoint[] = [
      makeWaypoint("w1", 31.77, 35.21),
      makeWaypoint("w2", 31.771, 35.212),
      makeWaypoint("w3", 31.772, 35.214),
    ];

    await expect(
      planRoute({
        waypoints,
        constraints: defaultConstraints,
      }),
    ).rejects.toThrow(
      "No walking route could be generated for the optimized waypoint order.",
    );
  });
});
