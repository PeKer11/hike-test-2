/** Official weather warnings (MeteoAlarm CAP feed, Israel). Pure helpers; the assistant tool does the I/O. */

export const SAFETY_FEED_URL = "https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-israel";
export const SAFETY_ATTRIBUTION = "Warnings by MeteoAlarm.org / the Israel Meteorological Service (CC BY 4.0)";

export interface SafetyWarning {
  event: string;
  severity: string;
  area: string;
  onset: string;
  expires: string;
  polygon: [number, number][];
}

/** Israel only: the feed covers no other region we use. */
export const inSafetyCoverage = (lat: number, lng: number) => lat >= 29.4 && lat <= 33.4 && lng >= 34.2 && lng <= 35.95;

const tag = (xml: string, name: string) => xml.match(new RegExp(`<${name}>([^<]*)</${name}>`))?.[1]?.trim() ?? "";

export function parseWarnings(xml: string): SafetyWarning[] {
  const out: SafetyWarning[] = [];
  for (const entry of xml.split("<entry>").slice(1)) {
    const polygon = tag(entry, "cap:polygon")
      .split(/\s+/)
      .map((pair) => pair.split(",").map(Number))
      .filter((p): p is [number, number] => p.length === 2 && p.every(Number.isFinite));
    if (polygon.length < 3) continue;
    out.push({ event: tag(entry, "cap:event"), severity: tag(entry, "cap:severity"), area: tag(entry, "cap:areaDesc"), onset: tag(entry, "cap:onset"), expires: tag(entry, "cap:expires"), polygon });
  }
  return out;
}

/** Ray casting; polygon points are [lat, lng]. */
export function pointInPolygon(lat: number, lng: number, polygon: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [yi, xi] = polygon[i];
    const [yj, xj] = polygon[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Warnings that cover the point and are active now or start within the next `withinHours`. */
export function warningsAt(warnings: SafetyWarning[], lat: number, lng: number, now: Date, withinHours: number): SafetyWarning[] {
  const end = now.getTime() + withinHours * 3_600_000;
  return warnings.filter((w) => {
    const from = Date.parse(w.onset);
    const to = Date.parse(w.expires);
    return Number.isFinite(from) && Number.isFinite(to) && to > now.getTime() && from <= end && pointInPolygon(lat, lng, w.polygon);
  });
}
