"use client";

import { useEffect, useRef, useState } from "react";

import { ChevronDownIcon } from "@/components/ui/icons";
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
 * The off-route question, in the middle of the map area (never over the sheet,
 * the map's logo row or its controls). One number, one line, big actions and a
 * quiet dismiss. Tapping the scrim, the corner glyph, or "Tell me" folds it into
 * a pill. When the map area is short (small phone, chat open) the layout goes
 * compact and the card scrolls rather than spilling over its neighbours.
 */
// Heights (px) each layout needs, measured in a real browser, and the room kept clear around the card:
// the map's own controls above it (112 px, or 60 px when the card gives up the controls' column) and
// the map's logo row below it (32 px).
const NEEDS = { full: { out: 396, in: 460 }, mid: { out: 298, in: 354 } } as const;
const TOP_FULL = 112;
const TOP_NARROW = 60;
const BOTTOM = 32;
type Tier = "full" | "mid" | "tiny";

export function OffRouteCard({ mode, lang, distanceM, hint, busy, countdown, signedIn, onBack, onBest, onTalk, onDismiss }: OffRouteCardProps) {
  const t = walkCopy.offRouteCard[lang];
  const [minimised, setMinimised] = useState(false);
  const [tier, setTier] = useState<Tier>("full");
  const boxRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const titleId = "off-route-title";
  const hintText = busy ? t.finding : hint ? t.hint(hint.kind, roundTo10(hint.distanceM), hint.bearing) : "";

  // One buzz and one focus per episode: this card mounts once per episode (it is never re-keyed).
  useEffect(() => {
    primaryRef.current?.focus({ preventScroll: true });
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") navigator.vibrate(120);
  }, []);

  // Compact when the map area cannot hold the full card below the map controls.
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const key = signedIn ? "in" : "out";
    const measure = () => {
      const h = box.clientHeight;
      if (h === 0) return; // not laid out (tests): keep the full layout
      setTier(h >= TOP_FULL + NEEDS.full[key] + BOTTOM ? "full" : h >= TOP_NARROW + NEEDS.mid[key] + BOTTOM ? "mid" : "tiny");
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, [minimised, signedIn]);

  // Restoring from the pill puts focus back on the primary action.
  useEffect(() => {
    if (!minimised) primaryRef.current?.focus({ preventScroll: true });
  }, [minimised]);

  if (minimised) {
    return (
      <div ref={boxRef} className="pointer-events-none absolute inset-x-0 top-[max(68px,calc(env(safe-area-inset-top)+56px))] z-[650] flex justify-center px-16">
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

  const action = "rounded-full px-4 text-[17px] font-semibold";
  const tint = `${action} bg-forest/10 text-forest`;
  const compact = tier !== "full";
  const tiny = tier === "tiny";
  const tall = tiny ? "min-h-12" : "min-h-14";

  return (
    <div
      ref={boxRef}
      onKeyDown={(e) => {
        if (e.key === "Escape") setMinimised(true);
      }}
      className="pointer-events-none absolute inset-x-0 top-0 bottom-[var(--hud-h,9rem)] z-[650]"
    >
      {/* The scrim stops 28 px above the sheet so the map's logo row stays clean. */}
      <button
        type="button"
        tabIndex={-1}
        aria-hidden
        data-testid="off-route-scrim"
        onClick={() => setMinimised(true)}
        className="pointer-events-auto absolute inset-x-0 top-0 bottom-7 bg-black/20 backdrop-blur-[2px] dark:bg-black/35"
      />
      <div
        className={`pointer-events-none absolute inset-0 flex items-center justify-center px-4 pb-8 ${
          compact ? "pt-[max(60px,calc(env(safe-area-inset-top)+44px))]" : "pt-[max(112px,calc(env(safe-area-inset-top)+72px))]"
        }`}
      >
        <div
          role="alertdialog"
          aria-modal="false"
          aria-labelledby={titleId}
          aria-describedby={mode === "ask" ? "off-route-auto" : undefined}
          data-testid="off-route-card"
          data-tier={tier}
          className={`pointer-events-auto relative max-h-full w-full max-w-[420px] overflow-y-auto rounded-[28px] bg-paper shadow-tk-card motion-safe:animate-[off-route-in_200ms_ease-out] ${
            compact ? "me-[60px] p-3" : "p-4"
          }`}
        >
          <button
            type="button"
            onClick={() => setMinimised(true)}
            aria-label={t.minimise}
            className="absolute start-1 top-1 flex h-11 w-11 items-center justify-center rounded-full text-charcoal/60"
          >
            <ChevronDownIcon />
          </button>
          {compact ? null : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/images/traike/accessories/signpost.png" alt="" aria-hidden className="pointer-events-none absolute end-3 top-3 h-14 w-14 object-contain drop-shadow-lg" />
          )}
          <div className={`flex items-baseline gap-2 ${compact ? "ps-10" : "mt-8"}`}>
            <span className={`${compact ? "text-[32px]" : "text-[48px]"} font-light leading-none tabular-nums text-tk-ink`}>{distanceM}</span>
            <span className="text-[17px] text-charcoal/70">{t.meters}</span>
          </div>
          <h2 id={titleId} dir="auto" className={`${compact ? "mt-1 text-[20px] leading-6" : "mt-2 text-[26px] leading-8"} font-display text-forest`}>
            {mode === "ask" ? t.askTitle : t.title}
          </h2>
          <p dir="auto" className="mt-0.5 flex min-h-6 items-center gap-2 text-[17px] text-tk-ink">
            {busy ? <span aria-hidden className="h-4 w-4 animate-spin rounded-full border-2 border-forest/30 border-t-forest motion-reduce:animate-none" /> : null}
            <HintText text={hintText} kind={busy ? "busy" : (hint?.kind ?? "")} />
          </p>
          <div className={`mt-3 flex flex-col ${compact ? "gap-2" : "gap-2"}`}>
            <button ref={primaryRef} type="button" onClick={onBack} className={`${action} relative ${tall} overflow-hidden bg-terra text-on-accent`}>
              {t.back}
              {mode === "ask" && countdown ? <CountdownBar countdown={countdown} /> : null}
            </button>
            <div className={tiny && signedIn ? "grid grid-cols-2 gap-2" : "flex flex-col gap-2"}>
              <button type="button" onClick={onBest} className={`${tint} ${tall} ${tiny && signedIn ? "text-[15px] leading-tight" : ""}`}>
                {t.best}
              </button>
              {signedIn ? (
                <button
                  type="button"
                  onClick={() => {
                    // The chat opens in the sheet below: get out of its way. The countdown keeps running.
                    setMinimised(true);
                    onTalk();
                  }}
                  className={`${tint} ${tall} ${tiny ? "text-[15px] leading-tight" : ""}`}
                >
                  {t.talk}
                </button>
              ) : null}
            </div>
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

/** The hint line is announced only when the kind of instruction changes, not on every distance tick. */
function HintText({ text, kind }: { text: string; kind: string }) {
  const [announced, setAnnounced] = useState({ text, kind });
  useEffect(() => {
    setAnnounced((prev) => (prev.kind === kind ? prev : { text, kind }));
  }, [text, kind]);
  return (
    <>
      <span aria-hidden>{text}</span>
      <span className="sr-only" role="status">
        {announced.text}
      </span>
    </>
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
