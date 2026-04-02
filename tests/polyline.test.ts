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
