import type { Coordinates, OrsCoordinate } from "@/lib/types";

const EARTH_RADIUS_METERS = 6371000;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function haversineDistance(a: Coordinates, b: Coordinates): number {
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const deltaLat = toRadians(b.lat - a.lat);
  const deltaLng = toRadians(b.lng - a.lng);

  const hav =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(hav));
}

/**
 * Compass bearing from a to b, in degrees clockwise from north.
 *
 * `walk-tracker.ts` and `poi-alerter.ts` each carry their own private copy of
 * this; they are deliberately left alone rather than pointed here, since
 * rewriting two working files is not part of any change that needed a third
 * caller. New callers use this one.
 */
export function bearingBetween(a: Coordinates, b: Coordinates): number {
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const dLng = toRadians(b.lng - a.lng);

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/**
 * The smaller of the two angles between two bearings, 0–180 degrees. Wraps, so
 * 350° and 10° are 20° apart rather than 340°.
 */
export function angleDifference(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

export function toOrsCoord(coord: Coordinates): OrsCoordinate {
  return [coord.lng, coord.lat];
}

export function fromOrsCoord(coord: OrsCoordinate): Coordinates {
  return { lat: coord[1], lng: coord[0] };
}

export function closestPointOnSegment(
  p: Coordinates,
  a: Coordinates,
  b: Coordinates,
): Coordinates {
  const dx = b.lng - a.lng;
  const dy = b.lat - a.lat;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return a;
  const t = Math.max(0, Math.min(1, ((p.lng - a.lng) * dx + (p.lat - a.lat) * dy) / lenSq));
  return { lat: a.lat + t * dy, lng: a.lng + t * dx };
}

function positionAlongRoute(point: Coordinates, geometry: Coordinates[]): number {
  let minDist = Infinity;
  let bestPos = 0;
  let cumDist = 0;

  for (let i = 0; i < geometry.length - 1; i++) {
    const proj = closestPointOnSegment(point, geometry[i], geometry[i + 1]);
    const dist = haversineDistance(point, proj);
    if (dist < minDist) {
      minDist = dist;
      bestPos = cumDist + haversineDistance(geometry[i], proj);
    }
    cumDist += haversineDistance(geometry[i], geometry[i + 1]);
  }

  return bestPos;
}

// Walking distance from `from` to `to` along the route geometry.
// Returns 0 if `to` is behind `from` (already passed).
export function routeDistanceBetween(
  geometry: Coordinates[],
  from: Coordinates,
  to: Coordinates,
): number {
  if (geometry.length < 2) return haversineDistance(from, to);
  const fromPos = positionAlongRoute(from, geometry);
  const toPos = positionAlongRoute(to, geometry);
  return Math.max(0, toPos - fromPos);
}

export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters)) {
    return "Unknown distance";
  }

  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }

  return `${(meters / 1000).toFixed(1)} km`;
}
