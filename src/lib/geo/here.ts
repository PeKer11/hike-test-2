import type { Coordinates } from "@/lib/types";

import { locate } from "./locate";

/**
 * Where the walker is, once, for a decision (not a walk): the first real fix, even a coarse one.
 * Gives up with null after `timeoutMs`, or at once when location is blocked or unavailable.
 * A city-level IP guess is never returned: it is good for centring a map, not for deciding where to walk.
 */
export function locateOnce(timeoutMs = 6000): Promise<Coordinates | null> {
  return new Promise((resolve) => {
    let handle: { stop(): void } | null = null;
    let done = false;
    const finish = (value: Coordinates | null) => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      handle?.stop();
      resolve(value);
    };
    const timer = window.setTimeout(() => finish(null), timeoutMs);
    handle = locate({
      purpose: "start",
      onUpdate: (fix) => {
        if (fix.source === "gps" || fix.source === "cache") finish(fix.coordinates);
      },
      onState: (state) => {
        if (state === "denied" || state === "unavailable" || state === "timeout") finish(null);
      },
    });
    if (done) handle.stop();
  });
}
