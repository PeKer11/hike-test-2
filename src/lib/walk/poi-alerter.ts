import type { Attraction, Coordinates } from "@/lib/types";
import { haversineDistance } from "@/lib/utils/geo";

// POI must be within this radius to trigger an alert
const ALERT_RADIUS_METERS = 120;
// Minimum gap between any two alerts (ms)
const MIN_ALERT_GAP_MS = 5 * 60 * 1000; // 5 minutes
// POI must be roughly "ahead" — within this angular tolerance of travel direction
const DIRECTION_TOLERANCE_DEG = 70;

export interface PoiAlert {
  attraction: Attraction;
  distanceMeters: number;
  message: string;
}

/**
 * Bearing from point a to point b, in degrees (0 = north, clockwise).
 */
function bearing(a: Coordinates, b: Coordinates): number {
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function angleDiff(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

function isAhead(
  current: Coordinates,
  travelDirection: number | null,
  poi: Coordinates,
): boolean {
  if (travelDirection === null) return true; // no direction data — allow all
  const poiBearing = bearing(current, poi);
  return angleDiff(travelDirection, poiBearing) <= DIRECTION_TOLERANCE_DEG;
}

function alertMessage(attraction: Attraction, distanceMeters: number): string {
  const side = distanceMeters < 50 ? "right next to you" : `${Math.round(distanceMeters)} m away`;
  return `Nearby: ${attraction.name} (${side})`;
}

export class PoiAlerter {
  private lastAlertTime = -MIN_ALERT_GAP_MS;
  private alertedIds = new Set<string>();

  /**
   * Call this on every position update.
   * Returns at most one alert, or null if rate-limited / nothing nearby.
   */
  check(
    currentPosition: Coordinates,
    travelDirection: number | null,
    nearbyPois: Attraction[],
    nowMs: number = Date.now(),
  ): PoiAlert | null {
    // Rate limit: no alert if we just showed one
    if (nowMs - this.lastAlertTime < MIN_ALERT_GAP_MS) return null;

    for (const poi of nearbyPois) {
      // Skip already alerted POIs
      if (this.alertedIds.has(poi.id)) continue;

      const dist = haversineDistance(currentPosition, poi.coordinates);
      if (dist > ALERT_RADIUS_METERS) continue;

      // Skip if behind the user
      if (!isAhead(currentPosition, travelDirection, poi.coordinates)) continue;

      this.lastAlertTime = nowMs;
      this.alertedIds.add(poi.id);

      return {
        attraction: poi,
        distanceMeters: dist,
        message: alertMessage(poi, dist),
      };
    }

    return null;
  }

  reset(): void {
    this.lastAlertTime = -MIN_ALERT_GAP_MS;
    this.alertedIds.clear();
  }
}
