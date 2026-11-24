/** A compass reading older than this (ms) is stale: the sensor stopped, was refused or lost calibration. */
export const COMPASS_FRESH_MS = 1500;

export interface HeadingSources {
  /** The smoothed GPS / movement heading (`HeadingSmoother`), degrees clockwise from north; null when it has none. */
  gps: number | null;
  /** The phone's last calibrated compass heading, degrees clockwise from north; null with no compass (desktop, refused, uncalibrated). */
  compass: number | null;
  /** When that compass reading arrived (ms, `Date.now()` clock). */
  compassAt: number | null;
  /** Now (ms, same clock as `compassAt`). */
  now: number;
  /** The walk is simulated: its path bearing is the truth, and the real phone's compass says nothing about it. */
  simulated: boolean;
}

/**
 * Which way the walker's marker faces. The beam is only ever seen with the phone in the hand and the screen on, and
 * then the compass is the truth (it is how Google Maps' own blue dot works), and it has none of the 1 to 3 s lag of the
 * GPS course. So: a calibrated compass reading at most `COMPASS_FRESH_MS` old wins. Without one the GPS course is used;
 * with neither, the last (stale) compass reading is better than a vanished beam on a phone lying still, whose sensor only
 * reports changes. No source at all is no heading (never a made-up direction). A simulated walk never reads the compass.
 */
export function chooseHeading({ gps, compass, compassAt, now, simulated }: HeadingSources): number | null {
  if (simulated) return gps;
  if (compass !== null && compassAt !== null && now - compassAt <= COMPASS_FRESH_MS) return compass;
  return gps ?? compass;
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
