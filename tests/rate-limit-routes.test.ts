import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetDirections = vi.fn();
const mockOptimizeRoute = vi.fn();

vi.mock("@/lib/api/ors-client", () => ({
  getDirections: (...args: unknown[]) => mockGetDirections(...args),
  optimizeRoute: (...args: unknown[]) => mockOptimizeRoute(...args),
}));

import { POST as directions } from "@/app/api/directions/route";
import { POST as optimization } from "@/app/api/optimization/route";

/** ORS's per-minute allowance, from `orsRateLimiter` in `rate-limit.ts`. */
const ORS_PER_MINUTE = 40;

const CALLER = "203.0.113.7";
const OTHER_CALLER = "198.51.100.4";

function directionsRequest(ip: string): Request {
  return new Request("http://localhost/api/directions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify({
      profile: "foot-walking",
      coordinates: [
        [34.7742, 32.0779],
        [34.7736, 32.0791],
      ],
    }),
  });
}

function optimizationRequest(ip: string): Request {
  return new Request("http://localhost/api/optimization", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify({
      jobs: [{ id: 1, location: [34.7742, 32.0779] }],
      vehicles: [{ id: 1, profile: "foot-walking", start: [34.7742, 32.0779] }],
    }),
  });
}

beforeEach(() => {
  mockGetDirections.mockReset().mockResolvedValue({ routes: [] });
  mockOptimizeRoute.mockReset().mockResolvedValue({ routes: [], unassigned: [] });
});

describe("rate limiting on the ORS routes", () => {
  it("serves a caller's whole minute's allowance and then refuses", async () => {
    for (let attempt = 0; attempt < ORS_PER_MINUTE; attempt += 1) {
      const response = await directions(directionsRequest(CALLER));
      expect(response.status).toBe(200);
    }

    const refused = await directions(directionsRequest(CALLER));

    expect(refused.status).toBe(429);
    expect(refused.headers.get("Retry-After")).toBe("60");
    expect(await refused.json()).toMatchObject({
      error: "Too many requests. Try again in a moment.",
    });
  });

  it("refuses before spending anything upstream", async () => {
    for (let attempt = 0; attempt < ORS_PER_MINUTE; attempt += 1) {
      await directions(directionsRequest(CALLER));
    }
    expect(mockGetDirections).toHaveBeenCalledTimes(ORS_PER_MINUTE);

    await directions(directionsRequest(CALLER));

    // The whole point of the feature: the refused request never reached ORS.
    expect(mockGetDirections).toHaveBeenCalledTimes(ORS_PER_MINUTE);
  });

  it("shares one allowance between /api/directions and /api/optimization", async () => {
    // Both spend the same 2000/day account quota, so they draw on one bucket:
    // a caller cannot get 40 of each.
    for (let attempt = 0; attempt < ORS_PER_MINUTE; attempt += 1) {
      await directions(directionsRequest(CALLER));
    }

    const refused = await optimization(optimizationRequest(CALLER));

    expect(refused.status).toBe(429);
    expect(mockOptimizeRoute).not.toHaveBeenCalled();
  });

  it("leaves a second caller's allowance untouched", async () => {
    for (let attempt = 0; attempt < ORS_PER_MINUTE + 5; attempt += 1) {
      await directions(directionsRequest(CALLER));
    }

    const response = await directions(directionsRequest(OTHER_CALLER));

    expect(response.status).toBe(200);
  });

  it("checks the limit before validating the body, so a malformed flood is refused too", async () => {
    for (let attempt = 0; attempt < ORS_PER_MINUTE; attempt += 1) {
      await directions(directionsRequest(CALLER));
    }

    const junk = await directions(
      new Request("http://localhost/api/directions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": CALLER,
        },
        body: "not json",
      }),
    );

    expect(junk.status).toBe(429);
  });
});
