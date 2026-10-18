import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getDirections, ORS_TIMEOUT_MS } from "@/lib/api/ors-client";

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv("ORS_API_KEY", "test-key");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("ORS requests", () => {
  it("give up after ORS_TIMEOUT_MS instead of hanging the walk build", async () => {
    // A server that never answers: the fetch settles only when it is aborted.
    const fetchMock = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          );
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = getDirections({
      coordinates: [
        [34.78, 32.08],
        [34.79, 32.09],
      ],
    }).then(
      () => "resolved",
      () => "rejected",
    );

    await vi.advanceTimersByTimeAsync(ORS_TIMEOUT_MS);

    expect(await result).toBe("rejected");
  });

  it("answers from the OSRM foot fallback when ORS hangs", async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url.includes("routing.openstreetmap.de")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            code: "Ok",
            routes: [
              {
                geometry: "_p~iF~ps|U_ulLnnqC_mqNvxq`@",
                distance: 100,
                duration: 80,
                legs: [
                  {
                    distance: 100,
                    duration: 80,
                    steps: [
                      { distance: 100, duration: 80, name: "Main St", maneuver: { type: "depart", modifier: "north" } },
                    ],
                  },
                ],
              },
            ],
            waypoints: [
              { location: [-120.2, 38.5] },
              { location: [-126.453, 43.252] },
            ],
          }),
        });
      }
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("aborted", "AbortError")),
        );
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = getDirections({
      coordinates: [
        [-120.2, 38.5],
        [-126.453, 43.252],
      ],
    });
    await vi.advanceTimersByTimeAsync(4_000);
    const response = await result;

    expect(response.routes[0].summary.distance).toBe(100);
    expect(response.routes[0].way_points).toEqual([0, 2]);
    expect(response.routes[0].segments[0].steps[0].instruction).toBe(
      "Head north onto Main St",
    );
  });
});
