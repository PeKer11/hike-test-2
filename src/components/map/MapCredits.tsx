"use client";

import { useState } from "react";

/**
 * Our data credits as one small chip: the openrouteservice credit in its required wording always visible, the full lines on tap.
 * Google's own logo and terms are never covered — this chip sits above them.
 */
export function MapCredits({ lines, className = "" }: { lines: string[]; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`pointer-events-auto absolute z-[400] ${className}`}>
      {open ? (
        <div role="dialog" aria-label="Map credits" className="mb-1 max-w-[min(280px,70vw)] rounded-[10px] bg-paper px-3 py-2 text-[11px] leading-[14px] text-charcoal shadow-tk-card">
          {lines.map((line) => (
            <p key={line} className="[&:not(:first-child)]:mt-1">
              {line}
            </p>
          ))}
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Map credits"
        className="ms-auto flex max-w-[calc(100vw-1rem)] items-center gap-1 rounded-full bg-paper/90 px-2 py-0.5 text-[11px] leading-[14px] text-charcoal shadow-tk-soft"
      >
        <span aria-hidden>ⓘ</span>
        <span>© openrouteservice by HeiGIT | Data from OpenStreetMap</span>
      </button>
    </div>
  );
}
