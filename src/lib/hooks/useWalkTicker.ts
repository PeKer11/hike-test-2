"use client";

import { useEffect, useRef } from "react";

import { WALK_TICK_MS } from "@/lib/walk/walk-cadence";

/**
 * One interval for everything on the live-walk screen that should be looked at
 * on a schedule rather than on every GPS fix: the pace advisor, the stats bar,
 * callout expiry. Per-fix work stays fix-driven.
 *
 * Ticks are skipped while the tab is hidden (a backgrounded page has nothing to
 * show anyone), and one tick runs the moment it becomes visible again so the
 * screen is current instead of up to one interval stale.
 *
 * `onTick` is read through a ref, so a new closure each render neither restarts
 * the interval nor goes stale.
 */
export function useWalkTicker(
  enabled: boolean,
  onTick: () => void,
  intervalMs: number = WALK_TICK_MS,
): void {
  const onTickRef = useRef(onTick);
  useEffect(() => {
    onTickRef.current = onTick;
  });

  useEffect(() => {
    if (!enabled) return;

    const tick = () => {
      if (document.hidden) return;
      onTickRef.current();
    };
    const onVisibility = () => {
      if (!document.hidden) onTickRef.current();
    };

    const id = window.setInterval(tick, intervalMs);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, intervalMs]);
}

type WakeLockSentinelLike = { release: () => Promise<void> };
type WakeLockNavigator = Navigator & {
  wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
};

/**
 * Keeps the screen on while `enabled` (a walk is under way). Feature-detected —
 * unsupported browsers and denied requests are silently a no-op, because a
 * screen that dims is an inconvenience, not a failure. The browser drops the
 * lock whenever the tab is hidden, so it is re-acquired on becoming visible.
 */
export function useWakeLock(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    const nav = navigator as WakeLockNavigator;
    if (!nav.wakeLock) return;

    let sentinel: WakeLockSentinelLike | null = null;
    let cancelled = false;

    const acquire = async () => {
      try {
        const next = await nav.wakeLock?.request("screen");
        if (!next) return;
        if (cancelled) {
          void next.release().catch(() => {});
          return;
        }
        sentinel = next;
      } catch {
        // Denied or unavailable (battery saver, permissions policy): carry on.
      }
    };
    const onVisibility = () => {
      if (document.hidden) {
        // The browser has already dropped it; forget it so it can be re-taken.
        sentinel = null;
      } else if (sentinel === null) {
        void acquire();
      }
    };

    void acquire();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      const held = sentinel;
      sentinel = null;
      if (held) void held.release().catch(() => {});
    };
  }, [enabled]);
}
