"use client";

import { useState } from "react";

/**
 * Our data credits as one quiet line: the openrouteservice credit in its required wording always visible (no pill, small,
 * lightly faded, with a paper halo so it still reads on satellite), the full lines on tap.
 * The wording is HeiGIT's and must stay exact; only its weight is ours to tune. Google's own logo and terms are never
 * covered — this line sits above them.
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
        className="ms-auto flex max-w-[calc(100vw-1rem)] items-center gap-1 px-1 py-1 text-[10.5px] leading-[13px] text-charcoal/80 [text-shadow:0_0_3px_var(--tk-paper),0_0_3px_var(--tk-paper),0_0_6px_var(--tk-paper)]"
      >
        <span aria-hidden>ⓘ</span>
        <span>© openrouteservice by HeiGIT | Data from OpenStreetMap</span>
      </button>
    </div>
  );
}
