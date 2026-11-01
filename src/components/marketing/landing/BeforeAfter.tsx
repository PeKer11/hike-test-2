"use client";

import { useRef, useState } from "react";

import { RouteMap } from "./RouteMap";

/* "Their tour" vs "Your walk". Left of the handle shows the grey fixed tour,
   right of it the built-for-you route. */
export function BeforeAfter() {
  const [pos, setPos] = useState(55);
  const box = useRef<HTMLDivElement>(null);

  const moveTo = (clientX: number) => {
    const r = box.current!.getBoundingClientRect();
    setPos(Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100)));
  };

  const onKey = (e: React.KeyboardEvent) => {
    const step = e.key === "ArrowLeft" ? -5 : e.key === "ArrowRight" ? 5 : 0;
    if (step) {
      e.preventDefault();
      setPos((p) => Math.max(0, Math.min(100, p + step)));
    } else if (e.key === "Home") {
      e.preventDefault();
      setPos(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setPos(100);
    }
  };

  return (
    <div
      ref={box}
      className="relative mx-auto aspect-[4/5] w-full max-w-[960px] touch-pan-y select-none overflow-hidden rounded-[28px] shadow-[0_24px_60px_rgba(30,61,47,0.28)] md:aspect-[3/2]"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        moveTo(e.clientX);
      }}
      onPointerMove={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) moveTo(e.clientX);
      }}
    >
      <RouteMap look="before" plate="/images/landing/map-plate.webp" className="absolute inset-0 h-full w-full" />
      <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${pos}%)` }}>
        <RouteMap look="after" plate="/images/landing/map-plate.webp" className="absolute inset-0 h-full w-full" />
      </div>

      <span className="absolute left-4 top-4 rounded-full bg-white/90 px-4 py-2 text-[15px] font-semibold text-charcoal/70 shadow">
        Their tour
      </span>
      <span className="absolute right-4 top-4 rounded-full bg-terra px-4 py-2 text-[15px] font-semibold text-cream shadow">
        Your walk
      </span>

      <div
        className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-cream shadow-[0_0_12px_rgba(0,0,0,0.25)]"
        style={{ left: `${pos}%` }}
      >
        <div
          role="slider"
          tabIndex={0}
          aria-label="Compare a fixed tour with a walk built for you"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pos)}
          aria-valuetext={`Your walk, ${Math.round(100 - pos)}% shown`}
          onKeyDown={onKey}
          className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize items-center justify-center rounded-full bg-cream text-forest shadow-[0_6px_20px_rgba(0,0,0,0.3)] outline-offset-4"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden>
            <path d="m9 7-5 5 5 5M15 7l5 5-5 5" />
          </svg>
        </div>
      </div>
    </div>
  );
}
