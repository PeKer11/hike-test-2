"use client";

import { useState } from "react";

import { useCompassHeading } from "@/lib/hooks/useCompassHeading";
import { chooseHeading, nearestEquivalent } from "@/lib/walk/heading-source";

/**
 * The heading the walker's marker shows: the GPS course while walking briskly, the phone's compass when standing or
 * slow (see `chooseHeading`), null when there is no source at all. Never reads the compass in a simulated walk.
 * The value is unwrapped against what was shown last, so switching source (or crossing north) never spins the beam round.
 */
export function useWalkerHeading({
  active,
  gpsHeadingDeg,
  gpsMoving,
  simulated,
}: {
  active: boolean;
  gpsHeadingDeg: number | null;
  gpsMoving: boolean;
  simulated: boolean;
}): number | null {
  const compass = useCompassHeading(active && !simulated);
  const target = active ? chooseHeading({ gps: gpsHeadingDeg, compass, gpsMoving, simulated }) : null;
  // The last value shown, kept as state and adjusted during render (React's pattern for state derived from props).
  const [shown, setShown] = useState<number | null>(null);
  const next = target === null ? null : nearestEquivalent(shown, target);
  if (next !== shown) setShown(next);
  return next;
}
