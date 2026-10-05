import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetDirections = vi.fn();

vi.mock("@/lib/api/ors-client", () => ({
  getDirections: (...args: unknown[]) => mockGetDirections(...args),
}));

import { POST } from "@/app/api/reroute/route";

function encodeValue(value: number): string {
  let v = value < 0 ? ~(value << 1) : value << 1;
  let out = "";
  while (v >= 0x20) {
    out += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
    v >>= 5;
  }
  return out + String.fromCharCode(v + 63);
}

function encode(points: Array<{ lat: number; lng: number }>): string {
  let prevLat = 0;
  let prevLng = 0;
  let out = "";
  for (const p of points) {
    const lat = Math.round(p.lat * 1e5);
    const lng = Math.round(p.lng * 1e5);
    out += encodeValue(lat - prevLat) + encodeValue(lng - prevLng);
    prevLat = lat;
    prevLng = lng;
  }
  return out;
}

const FROM = { lat: 32.08, lng: 34.78 };
const C1 = { lat: 32.081, lng: 34.78 }; // ~111 m
const C2 = { lat: 32.0805, lng: 34.7805 };

function request(body: unknown, ip: string): Request {
  return new Request("http://localhost/api/reroute", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

function route(distance: number, points = [FROM, C1]) {
  return { routes: [{ summary: { distance }, geometry: encode(points) }] };
}

beforeEach(() => {
  mockGetDirections.mockReset();
});

describe("POST /api/reroute", () => {
  it("rejects malformed input without touching ORS", async () => {
    const res = await request({ from: { lat: "x", lng: 1 }, candidates: [C1] }, "10.0.0.1");
    const response = await POST(res);
    expect(response.status).toBe(400);
    const tooMany = await POST(request({ from: FROM, candidates: [C1, C2, C1] }, "10.0.0.1"));
    expect(tooMany.status).toBe(400);
    expect(mockGetDirections).not.toHaveBeenCalled();
  });

  it("answers 400, not 500, for a null or non-object body", async () => {
    for (const body of [null, 5, "x", [1]]) {
      expect((await POST(request(body, "10.0.0.9"))).status).toBe(400);
    }
    expect(mockGetDirections).not.toHaveBeenCalled();
  });

  it("returns the first plausible connector with ORS [lng,lat] input", async () => {
    mockGetDirections.mockResolvedValueOnce(route(130));
    const response = await POST(request({ from: FROM, candidates: [C1, C2] }, "10.0.0.2"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.candidateIndex).toBe(0);
    expect(body.geometry.length).toBeGreaterThanOrEqual(2);
    expect(mockGetDirections).toHaveBeenCalledTimes(1);
    expect(mockGetDirections.mock.calls[0][0]).toMatchObject({
      coordinates: [[FROM.lng, FROM.lat], [C1.lng, C1.lat]],
      profile: "foot-walking",
    });
  });

  it("falls to candidate 2 when the first is an implausible detour", async () => {
    mockGetDirections
      .mockResolvedValueOnce(route(2000)) // crow ~111 m -> 2000 m is absurd
      .mockResolvedValueOnce(route(70, [FROM, C2]));
    const response = await POST(request({ from: FROM, candidates: [C1, C2] }, "10.0.0.3"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.candidateIndex).toBe(1);
    expect(mockGetDirections).toHaveBeenCalledTimes(2);
  });

  it("answers 422 when both are implausible", async () => {
    mockGetDirections.mockResolvedValue(route(5000));
    const response = await POST(request({ from: FROM, candidates: [C1, C2] }, "10.0.0.4"));
    expect(response.status).toBe(422);
  });
});
