import type { Coordinates } from "@/lib/types";

/** Encoded polyline, precision 5 (the common format). A route is ~10x smaller as text than as JSON. */
export function encodePolyline(points: Coordinates[]): string {
  let prevLat = 0;
  let prevLng = 0;
  let out = "";
  const put = (value: number) => {
    let v = value < 0 ? ~(value << 1) : value << 1;
    while (v >= 0x20) {
      out += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
      v >>= 5;
    }
    out += String.fromCharCode(v + 63);
  };
  for (const p of points) {
    const lat = Math.round(p.lat * 1e5);
    const lng = Math.round(p.lng * 1e5);
    put(lat - prevLat);
    put(lng - prevLng);
    prevLat = lat;
    prevLng = lng;
  }
  return out;
}

export function decodePolyline(encoded: string): Coordinates[] {
  const points: Coordinates[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  const read = (): number | null => {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      if (index >= encoded.length) return null;
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (index < encoded.length) {
    const dLat = read();
    const dLng = read();
    if (dLat === null || dLng === null) break;
    lat += dLat;
    lng += dLng;
    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}
