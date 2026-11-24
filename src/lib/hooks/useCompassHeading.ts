"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

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

/**
 * W3C compass heading of the direction the BACK of the phone points (the spec's own example), degrees clockwise from
 * north, from the three Euler angles. Unlike `360 - alpha` it is right when the phone is held upright, which is how
 * people hold a map: there alpha alone is skewed by tens of degrees by a small gamma. Degenerate when the phone lies
 * flat (the back points at the ground): `horizontalBackReach` says how far from that it is.
 */
export function tiltCompensatedHeading(alpha: number, beta: number, gamma: number): number {
  const d = Math.PI / 180;
  const cY = Math.cos(gamma * d), cZ = Math.cos(alpha * d), sX = Math.sin(beta * d), sY = Math.sin(gamma * d), sZ = Math.sin(alpha * d);
  const vx = -cZ * sY - sZ * sX * cY;
  const vy = -sZ * sY + cZ * sX * cY;
  return (((Math.atan2(vx, vy) / d) % 360) + 360) % 360;
}

/** Below this share of the back-vector lying in the horizontal plane (phone nearly flat) the top of the screen is used instead. */
const MIN_BACK_REACH = 0.5;

function androidHeading(alpha: number, beta: unknown, gamma: unknown): number {
  if (typeof beta === "number" && typeof gamma === "number" && Number.isFinite(beta) && Number.isFinite(gamma)) {
    const d = Math.PI / 180;
    const reach = Math.hypot(Math.sin(gamma * d), Math.cos(gamma * d) * Math.sin(beta * d));
    if (reach >= MIN_BACK_REACH) return tiltCompensatedHeading(alpha, beta, gamma);
  }
  // Flat on a table or in a palm: the top of the screen is what points, and alpha is exactly its heading.
  return 360 - alpha;
}

/**
 * Degrees clockwise from north that the top of the screen points to, from one orientation event.
 * undefined: not a compass event (a relative or empty one), ignore it. null: the compass says it cannot be trusted
 * (iOS, uncalibrated), so there is no heading.
 */
function headingOf(e: IOSOrientationEvent, absolute: boolean): number | null | undefined {
  const legacy = typeof window !== "undefined" ? (window as Window & { orientation?: number }).orientation : undefined;
  const screenAngle = typeof screen !== "undefined" && screen.orientation ? screen.orientation.angle : (legacy ?? 0);
  let deg: number;
  if (typeof e.webkitCompassHeading === "number" && Number.isFinite(e.webkitCompassHeading)) {
    // A negative accuracy is iOS saying the compass is not calibrated: no heading is better than a wrong one.
    if (typeof e.webkitCompassAccuracy === "number" && e.webkitCompassAccuracy < 0) return null;
    deg = e.webkitCompassHeading;
  } else if ((absolute || e.absolute) && typeof e.alpha === "number" && Number.isFinite(e.alpha)) deg = androidHeading(e.alpha, e.beta, e.gamma);
  else return undefined;
  return (((deg + screenAngle) % 360) + 360) % 360;
}

/** A compass reading and when it arrived (`Date.now()`), so a consumer can tell a live one from a stale one. */
export interface CompassReading {
  deg: number;
  at: number;
}

/**
 * The phone's compass, as a ref that is written on every orientation event and never causes a React render (the
 * planner is 5,000 lines: 60 renders a second of it was the beam's lag). `.current` is the latest raw heading in
 * 0..360 (no smoothing: the consumer eases it) or null while there is none, on a desktop or when the compass is
 * unavailable, refused or uncalibrated. `onReading` runs after each one, outside React, to wake a render loop.
 * On iOS the page must ask first (`requestCompassPermission`, from a tap): this hook asks again on the first tap while
 * active if nobody has, so a walk that started without one (resumed after a reload) still gets it.
 */
export function useCompassHeading(active: boolean, onReading?: () => void): RefObject<CompassReading | null> {
  const reading = useRef<CompassReading | null>(null);
  const notify = useRef(onReading);
  useEffect(() => {
    notify.current = onReading;
  });
  // Bumped when permission arrives, to attach the listeners again.
  const [grantedAt, setGrantedAt] = useState(0);

  useEffect(() => {
    if (!active || typeof window === "undefined") {
      reading.current = null;
      return;
    }
    const onEvent = (absolute: boolean) => (ev: Event) => {
      const deg = headingOf(ev as IOSOrientationEvent, absolute);
      if (deg === undefined) return;
      reading.current = deg === null ? null : { deg, at: Date.now() };
      notify.current?.();
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
      reading.current = null;
    };
  }, [active, grantedAt]);

  return reading;
}
