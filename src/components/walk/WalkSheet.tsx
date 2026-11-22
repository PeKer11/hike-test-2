"use client";

import { useRef, useState, type ReactNode, type Ref } from "react";

export type SheetState = "peek" | "half";

/**
 * From md the sheet no longer runs edge to edge. It floats over the map with the map's own bottom strip left clear (Google's
 * logo and terms, Leaflet's credit): centred and 560px wide on a tablet, a 400px panel at the start side on a
 * desktop. WalkHud tells the map and the off-route card about it (`--hud-h`, `--hud-o`, `--hud-w`). Phones keep the bottom sheet.
 */
const FLOAT =
  "md:inset-x-0 md:bottom-8 md:mx-auto md:max-h-[calc(100%-96px)] md:w-[560px] md:max-w-[calc(100%-32px)] md:overflow-y-auto md:rounded-[6px] md:border-[1.5px] md:shadow-[0_8px_24px_rgba(30,20,10,0.28)] lg:inset-x-auto lg:start-4 lg:mx-0 lg:w-[400px]";

/**
 * The walk's bottom sheet: one opaque surface with a drag handle. PEEK is the default; HALF adds
 * the "coming up" content; one more step up (drag or tap) opens the full Details. Pointer events
 * only, no gesture library. Tapping the handle cycles peek, half, details.
 */
export function WalkSheet({
  sheetRef,
  half,
  onFull,
  label,
  deck,
  children,
}: {
  sheetRef?: Ref<HTMLDivElement>;
  /** Extra content shown only in the HALF state. */
  half?: ReactNode;
  /** Past HALF: the walker asked for everything. */
  onFull: () => void;
  /** Accessible name of the handle. */
  label: string;
  /** The sunset deck (round 13) at the very top; the handle floats over it. */
  deck?: ReactNode;
  children: ReactNode;
}) {
  const [state, setState] = useState<SheetState>("peek");
  const startY = useRef<number | null>(null);
  const dragged = useRef(false);

  const up = () => (state === "peek" ? setState("half") : onFull());
  const down = () => setState("peek");

  return (
    <div
      ref={sheetRef}
      data-testid="walk-hud"
      data-sheet={state}
      className={`${FLOAT} pointer-events-auto absolute inset-x-0 bottom-0 flex flex-col gap-2 overflow-hidden rounded-t-[6px] border-t-[1.5px] border-[var(--tk-lip)] bg-paper px-4 pb-[max(12px,env(safe-area-inset-bottom))] shadow-[0_-6px_18px_rgba(30,20,10,0.16)] dark:shadow-[0_-8px_30px_rgba(0,0,0,0.5)] ${deck ? "" : "pt-1"}`}
    >
      {deck}
      <button
        type="button"
        aria-label={label}
        onPointerDown={(e) => {
          startY.current = e.clientY;
        }}
        onPointerUp={(e) => {
          const from = startY.current;
          startY.current = null;
          if (from === null) return;
          const dy = e.clientY - from;
          if (Math.abs(dy) < 24) return; // a tap: onClick handles it
          dragged.current = true;
          if (dy < 0) up();
          else down();
        }}
        onClick={() => {
          if (dragged.current) {
            dragged.current = false;
            return;
          }
          up();
        }}
        className={`mx-auto flex h-6 w-24 touch-none items-center justify-center ${deck ? "absolute inset-x-0 top-1 z-10" : ""}`}
      >
        <span aria-hidden className={`h-1 w-9 rounded-full ${deck ? "bg-[rgba(255,247,236,0.5)]" : "bg-charcoal/25"}`} />
      </button>
      {children}
      {state === "half" ? half : null}
    </div>
  );
}
