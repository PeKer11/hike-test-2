"use client";

import { useEffect, useRef, useState } from "react";

type IOSOrientationEvent = DeviceOrientationEvent & { webkitCompassHeading?: number; webkitCompassAccuracy?: number };
type OrientationCtor = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<"granted" | "denied"> };

/** Fired on `window` once the compass is allowed, so a listener added before the answer can attach again (iOS only starts events after it). */
const COMPASS_GRANTED = "tk-compass-granted";

/** The page has been given the compass this session; nothing more to ask. */
let compassGranted = false;

const orientationCtor = (): OrientationCtor | undefined =>
  typeof DeviceOrientationEvent === "undefined" ? undefined : (DeviceOrientationEvent as OrientationCtor);

/** iOS only lets a page read the compass after a tap: call this from a click. Resolves false when refused or unsupported. */
export async function requestCompassPermission(): Promise<boolean> {
  try {
    const ctor = orientationCtor();
    if (!ctor) return false;
    if (typeof ctor.requestPermission === "function") {
      const granted = (await ctor.requestPermission()) === "granted";
      if (granted) {
        compassGranted = true;
        window.dispatchEvent(new Event(COMPASS_GRANTED));
      }
      return granted;
    }
    return true;
  } catch {
    return false;
  }
}

/** Degrees clockwise from north that the top of the screen points to, from one orientation event; null if the event has no compass. */
function headingOf(e: IOSOrientationEvent, absolute: boolean): number | null {
  const legacy = typeof window !== "undefined" ? (window as Window & { orientation?: number }).orientation : undefined;
  const screenAngle = typeof screen !== "undefined" && screen.orientation ? screen.orientation.angle : (legacy ?? 0);
  let deg: number | null = null;
  if (typeof e.webkitCompassHeading === "number" && Number.isFinite(e.webkitCompassHeading)) {
    // A negative accuracy is iOS saying the compass is not calibrated: no heading is better than a wrong one.
    if (typeof e.webkitCompassAccuracy === "number" && e.webkitCompassAccuracy < 0) return null;
    deg = e.webkitCompassHeading;
  } else if ((absolute || e.absolute) && typeof e.alpha === "number" && Number.isFinite(e.alpha)) deg = 360 - e.alpha;
  if (deg === null) return null;
  return (((deg + screenAngle) % 360) + 360) % 360;
}

/** At most one reading per this many ms: a render of the planner per compass tick would cost more than the beam is worth. */
const MIN_INTERVAL_MS = 150;
/** A reading closer than this to the shown heading is noise (a hand is never perfectly still). */
const DEAD_BAND_DEG = 2.5;
/** Weight of each reading, so a quick turn catches up in a few ticks. */
const EASE = 0.5;

/**
 * The phone's compass heading while `active`, smoothed and unwrapped (may leave 0..360, so a CSS rotation turns the
 * short way). null on a desktop or when the compass is unavailable, refused or uncalibrated: the caller falls back to
 * the GPS heading. On iOS the page must ask first (`requestCompassPermission`, from a tap): this hook asks again on the
 * first tap while active if nobody has, so a walk that started without one (resumed after a reload) still gets it.
 */
export function useCompassHeading(active: boolean): number | null {
  const [heading, setHeading] = useState<number | null>(null);
  // Bumped when permission arrives, to attach the listeners again.
  const [grantedAt, setGrantedAt] = useState(0);
  const smoothed = useRef<number | null>(null);
  const lastAt = useRef(0);

  useEffect(() => {
    if (!active || typeof window === "undefined") {
      smoothed.current = null;
      setHeading(null);
      return;
    }
    const onEvent = (absolute: boolean) => (ev: Event) => {
      const raw = headingOf(ev as IOSOrientationEvent, absolute);
      if (raw === null) return;
      const now = Date.now();
      if (now - lastAt.current < MIN_INTERVAL_MS) return;
      lastAt.current = now;
      const prev = smoothed.current;
      // Unwrap onto the previous value so 359 -> 1 is a 2 degree turn, then ease towards it.
      const delta = ((((raw - (prev ?? raw)) % 360) + 540) % 360) - 180;
      if (prev !== null && Math.abs(delta) < DEAD_BAND_DEG) return;
      const next = prev === null ? raw : prev + EASE * delta;
      smoothed.current = next;
      setHeading(next);
    };
    const abs = onEvent(true);
    const rel = onEvent(false);
    window.addEventListener("deviceorientationabsolute", abs);
    window.addEventListener("deviceorientation", rel);
    const onGranted = () => setGrantedAt(Date.now());
    window.addEventListener(COMPASS_GRANTED, onGranted);
    // iOS: until someone has asked, no event ever arrives. Ask on the first tap.
    const ask = () => void requestCompassPermission();
    const needsAsk = !compassGranted && typeof orientationCtor()?.requestPermission === "function";
    if (needsAsk) document.addEventListener("click", ask, { once: true, capture: true });
    return () => {
      window.removeEventListener("deviceorientationabsolute", abs);
      window.removeEventListener("deviceorientation", rel);
      window.removeEventListener(COMPASS_GRANTED, onGranted);
      if (needsAsk) document.removeEventListener("click", ask, { capture: true });
      smoothed.current = null;
      setHeading(null);
    };
  }, [active, grantedAt]);

  return heading;
}
