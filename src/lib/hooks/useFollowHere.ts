"use client";

import { useEffect, useRef } from "react";
import type { Coordinates } from "@/lib/types";
import { locate } from "@/lib/geo/locate";
import { DotStabilizer } from "@/lib/walk/dot-stabilizer";

const PUBLISH_MS = 1_000;

/**
 * Keeps the Plan map's "my location" dot live while it is visible. Fixes go through their own DotStabilizer, so a
 * standing phone's jitter is held; the camera is never moved. Stops whenever the page is hidden or `enabled` is false.
 */
export function useFollowHere({ enabled, onDot }: { enabled: boolean; onDot: (coordinates: Coordinates) => void }) {
  const onDotRef = useRef(onDot);
  onDotRef.current = onDot;

  useEffect(() => {
    if (!enabled || typeof document === "undefined") return;
    let handle: { stop(): void } | null = null;

    const start = () => {
      if (handle) return;
      const stabilizer = new DotStabilizer();
      let lastPublishAt = 0;
      handle = locate({
        purpose: "follow",
        onUpdate: (fix) => {
          if (fix.source !== "gps") return;
          const decision = stabilizer.push({
            coordinates: fix.coordinates,
            accuracyM: fix.accuracyMeters,
            speedMps: fix.speedMps,
            timestamp: fix.timestamp,
          });
          const now = Date.now();
          if (!decision.publish || now - lastPublishAt < PUBLISH_MS) return;
          lastPublishAt = now;
          onDotRef.current(decision.coordinates);
        },
      });
    };
    const stop = () => {
      handle?.stop();
      handle = null;
    };
    const onVisibility = () => (document.visibilityState === "visible" ? start() : stop());

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      stop();
    };
  }, [enabled]);
}
