import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAlong = vi.fn();
const mockAround = vi.fn();

vi.mock("@/lib/places/nearby-provider", () => ({
  getNearbyProvider: () => ({ fetchAlongPath: mockAlong, fetchAround: mockAround }),
}));

import { POST } from "@/app/api/nearby/route";

const place = (id: string, lat: number, lng: number) => ({
  id,
  name: id,
  coordinates: { lat, lng },
  category: "food",
  avgVisitMinutes: 45,
  tags: {},
  source: "osm",
  verification: "registered",
  kind: "poi",
});

let ipCounter = 0;
function request(body: unknown): Request {
  ipCounter += 1;
  return new Request("http://localhost/api/nearby", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": `10.1.0.${ipCounter}` },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  mockAlong.mockReset();
  mockAround.mockReset();
});

describe("POST /api/nearby", () => {
  it("rejects bad input without calling the provider", async () => {
    for (const body of [
      {},
      { path: [{ lat: 1, lng: 1 }] },
      { path: [{ lat: 1, lng: 1 }, { lat: "x", lng: 2 }] },
      { point: { lat: 200, lng: 0 } },
    ]) {
      expect((await POST(request(body))).status).toBe(400);
    }
    expect(mockAlong).not.toHaveBeenCalled();
    expect(mockAround).not.toHaveBeenCalled();
  });

  it("answers 400, not 500, for a null or non-object body", async () => {
    for (const body of [null, 5, "x", [1]]) {
      expect((await POST(request(body))).status).toBe(400);
    }
  });

  it("simplifies the path to <=80 points and clamps the radius to 250", async () => {
    mockAlong.mockResolvedValue([place("near", 32.08, 34.78)]);
    const path = Array.from({ length: 400 }, (_, i) => ({ lat: 32.08 + i * 1e-5, lng: 34.78 }));
    const res = await POST(request({ path, radiusMeters: 9999 }));
    expect(res.status).toBe(200);
    const [sentPath, radius] = mockAlong.mock.calls[0];
    expect(sentPath.length).toBeLessThanOrEqual(80);
    expect(radius).toBe(250);
  });

  it("drops places that are not actually near the walk and caches repeats", async () => {
    mockAlong.mockResolvedValue([
      place("near", 32.0801, 34.78),
      place("far-polygon-centre", 32.2, 34.9),
    ]);
    const body = { path: [{ lat: 32.08, lng: 34.78 }, { lat: 32.082, lng: 34.78 }] };
    const first = await (await POST(request(body))).json();
    expect(first.places.map((p: { id: string }) => p.id)).toEqual(["near"]);
    await POST(request(body));
    expect(mockAlong).toHaveBeenCalledTimes(1);
  });

  it("supports a point lookup with a 300 m cap", async () => {
    mockAround.mockResolvedValue([]);
    const res = await POST(request({ point: { lat: 32.5, lng: 35 }, radiusMeters: 5000 }));
    expect(res.status).toBe(200);
    expect(mockAround.mock.calls[0][1]).toBe(300);
  });

  it("answers 502 when the provider fails", async () => {
    mockAround.mockRejectedValue(new Error("overpass down"));
    const res = await POST(request({ point: { lat: 32.6, lng: 35.1 } }));
    expect(res.status).toBe(502);
  });
});
