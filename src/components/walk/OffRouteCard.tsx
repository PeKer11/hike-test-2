"use client";

import { useEffect, useRef, useState } from "react";

import { walkCopy } from "@/lib/walk/walk-copy";

export interface OffRouteCardProps {
  /** "ask": the standing question (silence returns to the route). "notice": auto/off mode, no countdown. */
  mode: "ask" | "notice";
  lang: "he" | "en";
  /** How far from the route, metres (rounded to 10 by the caller). */
  distanceM: number;
  /** The way back, from `turnInstruction`; null until a fix says. */
  hint: { kind: string; distanceM: number; bearing: number } | null;
  /** A way back is being routed. */
  busy: boolean;
  /** Ask mode only: when the question was raised and how long it stands. */
  countdown?: { askedAtMs: number; durationMs: number } | null;
  signedIn: boolean;
  onBack: () => void;
  onBest: () => void;
  onTalk: () => void;
  onDismiss: () => void;
}

const roundTo10 = (m: number) => Math.max(10, Math.round(m / 10) * 10);

/**
 * The off-route question, big and in the middle of the map area (never over the
 * sheet or the map's logo row). One number, one line, three 56px actions and a
 * quiet dismiss. Tapping the scrim, or the corner glyph, folds it into a pill.
 */
export function OffRouteCard({ mode, lang, distanceM, hint, busy, countdown, signedIn, onBack, onBest, onTalk, onDismiss }: OffRouteCardProps) {
  const t = walkCopy.offRouteCard[lang];
  const [minimised, setMinimised] = useState(false);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const titleId = "off-route-title";
  const hintText = busy ? t.finding : hint ? t.hint(hint.kind, roundTo10(hint.distanceM), hint.bearing) : "";

  useEffect(() => {
    primaryRef.current?.focus({ preventScroll: true });
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") navigator.vibrate(120);
  }, []);

  if (minimised) {
    return (
      <div className="pointer-events-none absolute inset-x-0 top-[max(68px,calc(env(safe-area-inset-top)+56px))] z-[650] flex justify-center px-16">
        <button
          type="button"
          data-testid="off-route-pill"
          onClick={() => setMinimised(false)}
          className="pointer-events-auto flex min-h-12 items-center gap-2 rounded-full bg-paper px-5 text-[15px] font-semibold text-tk-ink shadow-tk-card"
        >
          <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-terra" />
          {t.pill(distanceM)}
        </button>
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 bottom-[var(--hud-h,9rem)] z-[650]">
      <button
        type="button"
        tabIndex={-1}
        aria-label={t.minimise}
        data-testid="off-route-scrim"
        onClick={() => setMinimised(true)}
        className="pointer-events-auto absolute inset-0 bg-black/20 backdrop-blur-[2px] dark:bg-black/35"
      />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-4 pb-3 pt-[max(104px,calc(env(safe-area-inset-top)+64px))]">
        <div
          role="alertdialog"
          aria-modal="false"
          aria-labelledby={titleId}
          aria-describedby={mode === "ask" ? "off-route-auto" : undefined}
          data-testid="off-route-card"
          className="pointer-events-auto relative w-full max-w-[420px] rounded-[28px] bg-paper p-5 shadow-tk-card motion-safe:animate-[off-route-in_200ms_ease-out]"
        >
          <button
            type="button"
            onClick={() => setMinimised(true)}
            aria-label={t.minimise}
            className="absolute start-2 top-2 flex h-11 w-11 items-center justify-center rounded-full text-charcoal/60"
          >
            <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/traike/accessories/signpost.png" alt="" aria-hidden className="pointer-events-none absolute end-4 top-3 h-[80px] w-[80px] object-contain drop-shadow-lg" />
          <p className="mt-5 text-[48px] font-light leading-none tabular-nums text-tk-ink">
            {distanceM}
          </p>
          <p className="mt-1 text-[17px] text-charcoal/70">{t.meters}</p>
          <h2 id={titleId} dir="auto" className="mt-3 font-display text-[26px] leading-8 text-forest">
            {mode === "ask" ? t.askTitle : t.title}
          </h2>
          <p dir="auto" className="mt-1 flex min-h-6 items-center gap-2 text-[17px] text-tk-ink" aria-live="polite">
            {busy ? <span aria-hidden className="h-4 w-4 animate-spin rounded-full border-2 border-forest/30 border-t-forest motion-reduce:animate-none" /> : null}
            {hintText}
          </p>
          <div className="mt-4 flex flex-col gap-2.5">
            <button
              ref={primaryRef}
              type="button"
              onClick={onBack}
              className="relative min-h-14 overflow-hidden rounded-full bg-terra px-6 text-[17px] font-semibold text-on-accent"
            >
              {t.back}
              {mode === "ask" && countdown ? <CountdownBar countdown={countdown} /> : null}
            </button>
            <button type="button" onClick={onBest} className="min-h-14 rounded-full bg-forest/10 px-6 text-[17px] font-semibold text-forest">
              {t.best}
            </button>
            {signedIn ? (
              <button type="button" onClick={onTalk} className="min-h-14 rounded-full bg-forest/10 px-6 text-[17px] font-semibold text-forest">
                {t.talk}
              </button>
            ) : null}
            <button type="button" onClick={onDismiss} className="min-h-11 rounded-full px-4 text-[15px] font-medium text-charcoal/70">
              {t.dismiss}
            </button>
          </div>
          {mode === "ask" ? (
            <span id="off-route-auto" className="sr-only">
              {t.autoReturn}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** A 3px bar on the primary button shrinking to nothing as the silent return nears. Hidden under reduced motion. */
function CountdownBar({ countdown }: { countdown: { askedAtMs: number; durationMs: number } }) {
  const [started] = useState(() => Date.now());
  const left = Math.max(0, countdown.durationMs - (started - countdown.askedAtMs));
  const [width, setWidth] = useState(`${(left / countdown.durationMs) * 100}%`);
  useEffect(() => {
    const id = window.requestAnimationFrame(() => setWidth("0%"));
    return () => window.cancelAnimationFrame(id);
  }, []);
  return (
    <span
      aria-hidden
      data-testid="off-route-countdown"
      className="absolute bottom-0 start-0 h-[3px] bg-on-accent/50 motion-reduce:hidden"
      style={{ width, transition: `width ${left}ms linear` }}
    />
  );
}
