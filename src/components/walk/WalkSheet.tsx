"use client";

import { useRef, useState, type ReactNode, type Ref } from "react";

export type SheetState = "peek" | "half";

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
  children,
}: {
  sheetRef?: Ref<HTMLDivElement>;
  /** Extra content shown only in the HALF state. */
  half?: ReactNode;
  /** Past HALF: the walker asked for everything. */
  onFull: () => void;
  /** Accessible name of the handle. */
  label: string;
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
      className="pointer-events-auto absolute inset-x-0 bottom-0 flex flex-col gap-2 rounded-t-[22px] bg-paper px-4 pt-1 pb-[max(12px,env(safe-area-inset-bottom))] shadow-[0_-8px_30px_rgba(30,61,47,0.18)] dark:shadow-[0_-8px_30px_rgba(0,0,0,0.5)] dark:ring-1 dark:ring-inset dark:ring-[rgba(242,235,225,0.06)]"
    >
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
        className="mx-auto flex h-6 w-24 touch-none items-center justify-center"
      >
        <span aria-hidden className="h-1 w-9 rounded-full bg-charcoal/25" />
      </button>
      {children}
      {state === "half" ? half : null}
    </div>
  );
}
