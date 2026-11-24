"use client";

import { useEffect, useState } from "react";

import { formatGpsDebug, gpsDebug, isGpsDebugOn } from "@/lib/geo/gps-debug";

/** The `?gpsdebug=1` counters, one line over the map. Renders nothing otherwise. */
export function GpsDebugLine({ getZoom, follow }: { getZoom: () => number | undefined; follow: boolean }) {
  const [on, setOn] = useState(false);
  const [line, setLine] = useState("");
  useEffect(() => {
    if (!isGpsDebugOn()) return;
    setOn(true);
    const tick = () => setLine(formatGpsDebug(gpsDebug.snapshot(), getZoom(), follow));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [getZoom, follow]);
  if (!on) return null;
  return (
    <div
      className="pointer-events-none absolute left-1 top-1 z-[1000] max-w-[calc(100%-8px)] rounded bg-black/70 px-1.5 py-0.5 font-mono text-[13px] leading-tight text-white"
      data-testid="gps-debug-line"
    >
      {line}
    </div>
  );
}
