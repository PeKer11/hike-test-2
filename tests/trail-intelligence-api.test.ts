import { describe, expect, it } from "vitest";

import { POST } from "@/app/api/trail-intelligence/route";

describe("POST /api/trail-intelligence", () => {
  it("rejects missing route payload", async () => {
    const response = await POST(
      new Request("http://localhost/api/trail-intelligence", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      }),
    );

    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("A valid calculated route is required.");
  });

  it("returns a trail briefing for a valid route", async () => {
    const response = await POST(
      new Request("http://localhost/api/trail-intelligence", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          route: {
            orderedWaypoints: [
              {
                id: "w1",
                name: "Start",
                coordinates: { lat: 31.7683, lng: 35.2137 },
                required: true,
                isStart: true,
                isEnd: false,
              },
              {
                id: "w2",
                name: "Finish",
                coordinates: { lat: 31.779, lng: 35.22 },
                required: true,
                isStart: false,
                isEnd: true,
              },
            ],
            segments: [],
            geometry: [
              { lat: 31.7683, lng: 35.2137 },
              { lat: 31.779, lng: 35.22 },
            ],
            totalDistanceMeters: 5400,
            totalDurationSeconds: 4500,
            warnings: [],
            source: "fallback",
          },
        }),
      }),
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.recommendation).toBeDefined();
    expect(body.routeSummary.title).toBe("Trail description");
  });
});
