import { beforeEach, describe, expect, it, vi } from "vitest";

const getDirections = vi.fn();
vi.mock("@/lib/api/ors-client", () => ({ getDirections: (...a: unknown[]) => getDirections(...a) }));

import { orsRoute } from "@/lib/walk/ors-route";

const start = { lat: 32.0785, lng: 34.7745 };
const end = { lat: 32.0795, lng: 34.7755 };

function encodeNum(n: number): string {
  let v = n < 0 ? ~(n << 1) : n << 1;
  let out = "";
  while (v >= 0x20) {
    out += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
    v >>= 5;
  }
  return out + String.fromCharCode(v + 63);
}

// 3D polyline as ORS sends it: lat, lng at 1e5, height in cm (all delta-encoded).
function encode3d(points: Array<[number, number, number]>): string {
  let prev = [0, 0, 0];
  let out = "";
  for (const [lat, lng, h] of points) {
    const cur = [Math.round(lat * 1e5), Math.round(lng * 1e5), Math.round(h * 100)];
    out += cur.map((c, i) => encodeNum(c - prev[i])).join("");
    prev = cur;
  }
  return out;
}

beforeEach(() => getDirections.mockReset());

describe("orsRoute line format", () => {
  it("reads the 3D line correctly even when a leg has no ascent", async () => {
    getDirections.mockResolvedValue({
      routes: [{
        geometry: encode3d([[start.lat, start.lng, 14], [32.079, 34.775, 15], [end.lat, end.lng, 16]]),
        segments: [
          { distance: 100, steps: [{ way_points: [0, 1] }] },
          { distance: 100, ascent: 1, steps: [{ way_points: [1, 2] }] },
        ],
      }],
    });
    const line = await orsRoute([start, end], null);
    expect(line).toHaveLength(3);
    expect(Math.abs(line[0].lat - start.lat)).toBeLessThan(0.0001);
    expect(Math.abs(line[2].lat - end.lat)).toBeLessThan(0.0001);
  });

  it("rejects a line that starts far from the start point", async () => {
    getDirections.mockResolvedValue({
      routes: [{
        geometry: encode3d([[start.lat + 0.02, start.lng, 0], [end.lat + 0.02, end.lng, 0]]),
        segments: [{ distance: 100, ascent: 0, steps: [{ way_points: [0, 1] }] }],
      }],
    });
    await expect(orsRoute([start, { lat: 32.0786, lng: 34.7746 }], null)).rejects.toThrow(/start/);
  });
});
