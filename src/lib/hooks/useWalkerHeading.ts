"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";

import { useCompassHeading } from "@/lib/hooks/useCompassHeading";
import { chooseHeading } from "@/lib/walk/heading-source";
import { createHeadingStore, type HeadingStore } from "@/lib/walk/heading-store";

/** Time constant of the beam's easing, ms: 63 % of a turn in 90 ms, 95 % in 270 ms. */
export const HEADING_TAU_MS = 60;
/** Within this many degrees of the target the loop goes idle. */
const SETTLED_DEG = 0.2;
/** The store is written only when the shown value moved this much. */
const WRITE_STEP_DEG = 0.3;
/** Heartbeat while active: notices a compass going stale (and the loop waking after an idle spell). */
const HEARTBEAT_MS = 500;

/** The signed shortest turn from one bearing to another, -180..180. */
const shortestTurn = (from: number, to: number): number => ((((to - from) % 360) + 540) % 360) - 180;

export interface WalkerHeading {
  /** Stable for the life of the component: the marker subscribes to it and rotates its beam without React. */
  store: HeadingStore;
  /** The GPS course (`HeadingSmoother`), pushed on every accepted fix; null when it has none. */
  setGps(headingDeg: number | null): void;
}

/**
 * The heading the walker's marker shows, as a store instead of a number so that a turning phone never re-renders the
 * planner. Sources (see `chooseHeading`): the phone's compass whenever a calibrated reading is under 1.5 s old, else the
 * GPS course; a simulated walk uses its path bearing only and never reads the compass. The compass and GPS write
 * targets into refs; one requestAnimationFrame loop eases the shown value towards the target the short way round
 * (the value is unwrapped, so switching source or crossing north never spins the beam) and writes the store. The loop runs
 * only while active and the page is visible, and idles once settled.
 */
export function useWalkerHeading({ active, simulated }: { active: boolean; simulated: boolean }): WalkerHeading {
  const store = useMemo(() => createHeadingStore(), []);
  const gps = useRef<number | null>(null);
  const kickRef = useRef<() => void>(() => {});
  const kick = useCallback(() => kickRef.current(), []);
  const compass = useCompassHeading(active && !simulated, kick);

  useEffect(() => {
    if (!active || typeof window === "undefined") {
      store.set(null);
      return;
    }
    let shown: number | null = null;
    let written: number | null = null;
    let lastTs: number | null = null;
    let raf: number | null = null;

    const frame = (ts: number) => {
      raf = null;
      const dt = lastTs === null ? 16 : Math.min(100, Math.max(0, ts - lastTs));
      lastTs = ts;
      const c = compass.current;
      const target = chooseHeading({ gps: gps.current, compass: c?.deg ?? null, compassAt: c?.at ?? null, now: Date.now(), simulated });
      if (target === null) {
        shown = null;
        written = null;
        store.set(null);
        return;
      }
      if (shown === null) shown = target;
      else shown += (1 - Math.exp(-dt / HEADING_TAU_MS)) * shortestTurn(shown, target);
      if (written === null || Math.abs(shown - written) >= WRITE_STEP_DEG) {
        written = shown;
        store.set(shown);
      }
      if (Math.abs(shortestTurn(shown, target)) > SETTLED_DEG) schedule();
      else {
        // Settled: land exactly on the target (unwrapped next to what was shown) and wait for the next kick.
        shown += shortestTurn(shown, target);
        if (written !== shown) {
          written = shown;
          store.set(shown);
        }
        lastTs = null;
      }
    };
    const schedule = () => {
      if (raf === null && document.visibilityState === "visible") raf = requestAnimationFrame(frame);
    };
    kickRef.current = schedule;
    const beat = setInterval(schedule, HEARTBEAT_MS);
    document.addEventListener("visibilitychange", schedule);
    schedule();
    return () => {
      kickRef.current = () => {};
      clearInterval(beat);
      document.removeEventListener("visibilitychange", schedule);
      if (raf !== null) cancelAnimationFrame(raf);
      store.set(null);
    };
  }, [active, simulated, compass, store]);

  const setGps = useCallback(
    (headingDeg: number | null) => {
      gps.current = headingDeg;
      kick();
    },
    [kick],
  );
  return useMemo(() => ({ store, setGps }), [store, setGps]);
}
