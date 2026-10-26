import { describe, expect, it } from "vitest";
import { decodePolyline } from "@/lib/utils/polyline";

describe("decodePolyline", () => {
  it("decodes a known encoded polyline", () => {
    // Encoded polyline for approximately [(38.5, -120.2), (40.7, -120.95), (43.252, -126.453)]
    const encoded = "_p~iF~ps|U_ulLnnqC_mqNvxq`@";
    const result = decodePolyline(encoded);

    expect(result.length).toBe(3);
    expect(result[0].lat).toBeCloseTo(38.5, 1);
    expect(result[0].lng).toBeCloseTo(-120.2, 1);
    expect(result[1].lat).toBeCloseTo(40.7, 1);
    expect(result[1].lng).toBeCloseTo(-120.95, 1);
  });

  it("returns empty array for empty string", () => {
    expect(decodePolyline("")).toEqual([]);
  });

  it("returns { lat, lng } objects (not [lng, lat])", () => {
    const encoded = "_p~iF~ps|U";
    const result = decodePolyline(encoded);
    expect(result[0]).toHaveProperty("lat");
    expect(result[0]).toHaveProperty("lng");
  });
});

describe("decodePolyline 3D", () => {
  const enc = (n: number) => {
    let v = Math.round(n) < 0 ? ~(Math.round(n) << 1) : Math.round(n) << 1;
    let out = "";
    while (v >= 0x20) {
      out += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
      v >>= 5;
    }
    return out + String.fromCharCode(v + 63);
  };
  const encode = (pts: Array<[number, number, number?]>, is3d: boolean) => {
    let prev = [0, 0, 0];
    return pts
      .map(([lat, lng, h = 0]) => {
        const cur = [Math.round(lat * 1e5), Math.round(lng * 1e5), Math.round(h * 100)];
        const out = enc(cur[0] - prev[0]) + enc(cur[1] - prev[1]) + (is3d ? enc(cur[2] - prev[2]) : "");
        prev = cur;
        return out;
      })
      .join("");
  };
  const pts: Array<[number, number, number]> = [[32.07, 34.78, 12], [32.071, 34.781, 40.5], [32.0725, 34.779, 8]];

  it("gives the same points as the 2D twin", () => {
    expect(decodePolyline(encode(pts, true), 5, true)).toEqual(decodePolyline(encode(pts, false), 5, false));
  });
});
