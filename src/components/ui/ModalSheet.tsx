"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** A bottom sheet on phones and a centred 480px dialog on desktop. Focus stays inside; Esc and the scrim close it. */
export function ModalSheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const focusables = () =>
      Array.from(ref.current?.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') ?? []);
    (focusables()[0] ?? ref.current)?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[1200] flex items-end justify-center lg:items-center">
      <button type="button" tabIndex={-1} aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/30" />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="relative max-h-[90vh] w-full overflow-y-auto rounded-t-[28px] bg-paper p-5 pb-[calc(20px+env(safe-area-inset-bottom))] shadow-tk-card motion-safe:animate-[sheet-in_280ms_cubic-bezier(.2,.8,.2,1)] lg:max-w-[480px] lg:rounded-[28px]"
      >
        <div aria-hidden className="mx-auto mb-3 h-1 w-10 rounded-full bg-charcoal/20 lg:hidden" />
        {children}
      </div>
    </div>
  );
}
