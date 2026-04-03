import { describe, expect, it, vi } from "vitest";

const mockOptimizeRoute = vi.fn();

vi.mock("@/lib/api/ors-client", () => ({
  optimizeRoute: (...args: unknown[]) => mockOptimizeRoute(...args),
}));

import { POST } from "@/app/api/optimization/route";

describe("POST /api/optimization", () => {
  it("rejects empty-array fixed endpoints", async () => {
    const response = await POST(
      new Request("http://localhost/api/optimization", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jobs: [],
          vehicles: [
            {
              id: 1,
              profile: "foot-walking",
              start: [],
              end: [],
            },
          ],
        }),
      }),
    );

    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain(
      "Optimization requires at least one vehicle and either one job or a fixed start/end pair.",
    );
    expect(mockOptimizeRoute).not.toHaveBeenCalled();
  });

  it("accepts valid fixed endpoints", async () => {
    mockOptimizeRoute.mockResolvedValueOnce({
      code: 0,
      summary: { cost: 0, routes: 1, unassigned: 0 },
      unassigned: [],
      routes: [],
    });

    const response = await POST(
      new Request("http://localhost/api/optimization", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jobs: [],
          vehicles: [
            {
              id: 1,
              profile: "foot-walking",
              start: [35.21, 31.77],
              end: [35.25, 31.79],
            },
          ],
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mockOptimizeRoute).toHaveBeenCalledOnce();
  });
});
