/** At or above this device speed (m/s) the direction of travel beats the compass: a phone in a pocket or swung in a hand lies, the GPS course does not. */
export const GPS_HEADING_MIN_SPEED_MPS = 1;

export interface HeadingSources {
  /** The smoothed GPS / movement heading (`HeadingSmoother`), degrees clockwise from north; null when it has none. */
  gps: number | null;
  /** The smoothed compass heading of the phone, degrees clockwise from north; null with no compass (desktop, refused, uncalibrated). */
  compass: number | null;
  /** The device's own speed is at least `GPS_HEADING_MIN_SPEED_MPS`. */
  gpsMoving: boolean;
  /** The walk is simulated: its path bearing is the truth, and the real phone's compass says nothing about it. */
  simulated: boolean;
}

/**
 * Which way the walker's marker faces. Walking briskly: the GPS course. Standing or slow: the compass, the only thing that
 * knows which way the phone is turned. Either source alone is used when the other has nothing; with neither there is no
 * heading and the marker draws no beam (never a made-up direction). A simulated walk never reads the compass.
 */
export function chooseHeading({ gps, compass, gpsMoving, simulated }: HeadingSources): number | null {
  if (simulated) return gps;
  if (gps !== null && gpsMoving) return gps;
  return compass ?? gps;
}

/**
 * The angle equal to `next` (mod 360) that lies closest to `previous`, so a CSS rotation from one source's heading to
 * the other's takes the short way instead of spinning round. Each source is unwrapped on its own, so they can disagree
 * by whole turns.
 */
export function nearestEquivalent(previous: number | null, next: number): number {
  if (previous === null) return next;
  return next + 360 * Math.round((previous - next) / 360);
}
