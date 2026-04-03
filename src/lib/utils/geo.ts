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

export function toOrsCoord(coord: Coordinates): OrsCoordinate {
  return [coord.lng, coord.lat];
}

export function fromOrsCoord(coord: OrsCoordinate): Coordinates {
  return { lat: coord[1], lng: coord[0] };
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
