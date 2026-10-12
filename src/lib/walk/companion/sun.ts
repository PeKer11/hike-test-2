/**
 * Sunset time, NOAA solar-position formulas (no dependency, no network).
 * Accurate to a couple of minutes at the latitudes this app serves.
 */

const RAD = Math.PI / 180;
const DAY_MS = 86_400_000;

/** UTC ms of the sunset on the solar date at `lng` that contains `nowMs`, or null in polar day/night. */
export function sunsetMs(nowMs: number, lat: number, lng: number): number | null {
  // UTC midnight of the local *solar* date, so lng far from 0 does not pick the wrong day.
  const base = Math.floor((nowMs + lng * 240_000) / DAY_MS) * DAY_MS;
  // Evaluate the sun at local solar noon of that date.
  const noonMs = base + DAY_MS / 2 - lng * 240_000;
  const jd = noonMs / DAY_MS + 2440587.5;
  const t = (jd - 2451545) / 36525;

  const l0 = (280.46646 + t * (36000.76983 + t * 0.0003032)) % 360;
  const m = 357.52911 + t * (35999.05029 - 0.0001537 * t);
  const e = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
  const mr = m * RAD;
  const c =
    Math.sin(mr) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
    Math.sin(2 * mr) * (0.019993 - 0.000101 * t) +
    Math.sin(3 * mr) * 0.000289;
  const omega = (125.04 - 1934.136 * t) * RAD;
  const lambda = (l0 + c - 0.00569 - 0.00478 * Math.sin(omega)) * RAD;
  const eps0 =
    23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60;
  const eps = (eps0 + 0.00256 * Math.cos(omega)) * RAD;
  const decl = Math.asin(Math.sin(eps) * Math.sin(lambda));

  const y = Math.tan(eps / 2) ** 2;
  const l0r = l0 * RAD;
  const eqTimeMin =
    4 *
    (1 / RAD) *
    (y * Math.sin(2 * l0r) -
      2 * e * Math.sin(mr) +
      4 * e * y * Math.sin(mr) * Math.cos(2 * l0r) -
      0.5 * y * y * Math.sin(4 * l0r) -
      1.25 * e * e * Math.sin(2 * mr));

  const latR = lat * RAD;
  const cosHa =
    Math.cos(90.833 * RAD) / (Math.cos(latR) * Math.cos(decl)) -
    Math.tan(latR) * Math.tan(decl);
  if (cosHa < -1 || cosHa > 1) return null;
  const haDeg = Math.acos(cosHa) / RAD;

  const sunsetMinUtc = 720 - 4 * lng - eqTimeMin + 4 * haDeg;
  return base + sunsetMinUtc * 60_000;
}
