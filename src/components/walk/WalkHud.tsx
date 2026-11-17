"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { WalkAlertCard, type WalkAlert } from "@/components/walk/WalkAlertCard";
import { WalkSheet } from "@/components/walk/WalkSheet";
import { WalkStatsBar, type WalkStatsData } from "@/components/walk/WalkStatsBar";
import type { LocateState } from "@/lib/geo/locate";
import { walkCopy } from "@/lib/walk/walk-copy";

/** The result of a rebuild, shown for a few seconds above the next-stop line. */
export interface WalkNotice {
  id: number;
  text: string;
  tone: "ok" | "warn";
  action?: { label: string; onClick: () => void };
}

interface WalkHudProps {
  alert: WalkAlert | null;
  notice?: WalkNotice | null;
  /** A card centred over the map area (the off-route card); a sibling of the sheet, never inside it. */
  center?: ReactNode;
  /** The direction options after a collapse; takes the alert's slot (one card, never two). */
  sheet?: ReactNode;
  /** The in-walk chat (the "Ask" pill); shares the bottom row with End walk. */
  chat?: ReactNode;
  stats: WalkStatsData | null;
  /** Lock-on state of the real GPS; the chip shows while it is searching or weak, and is hidden once good. */
  gpsState?: LocateState;
  lang?: "he" | "en";
  /** The next unvisited stop and roughly how many minutes away it is. */
  nextStop?: { name: string; minutes: number | null } | null;
  /** Shown only when the sheet is dragged to HALF: the stops coming up and the quick actions. */
  half?: ReactNode;
  /** Past HALF (or the layers glyph): the full Details. */
  onDetails: () => void;
  onEndWalk: () => void;
}

/**
 * Everything the walker sees over the map while walking, as one opaque bottom
 * sheet that paints to the screen edge (safe-area included), so no page
 * background shows around it: the single alert card, the next stop, the live
 * numbers, and Ask / End walk. End walk needs a second tap within 3 s.
 *
 * The sheet publishes its own height as `--hud-h` on the map section so the
 * map ends exactly above it (Google's logo and terms stay visible; Leaflet's
 * attribution is lifted clear of it).
 */
export function WalkHud({ alert, notice = null, center, sheet, chat, stats, gpsState = "idle", lang = "en", nextStop, half, onDetails, onEndWalk }: WalkHudProps) {
  const outerRef = useRef<HTMLDivElement>(null);
  const stackRef = useRef<HTMLDivElement>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const t = walkCopy.hud.sheet[lang];
  const gpsCopy = walkCopy.hud.gps[lang];
  const gpsLabel =
    gpsState === "searching" ? gpsCopy.searching : gpsState === "denied" ? gpsCopy.denied : gpsState === "coarse" || gpsState === "timeout" || gpsState === "unavailable" ? gpsCopy.weak : null;

  useEffect(() => {
    if (!confirmEnd) return;
    const timer = window.setTimeout(() => setConfirmEnd(false), 3000);
    return () => window.clearTimeout(timer);
  }, [confirmEnd]);

  useEffect(() => {
    const stack = stackRef.current;
    // The wrapper's parent: a descendant of the map section (MapView's div) that
    // carries `.walk-hud`, so only a property set there is inherited by Leaflet's
    // controls.
    const host = outerRef.current?.parentElement;
    if (!stack || !host) return;

    const publish = () => host.style.setProperty("--hud-h", `${stack.offsetHeight}px`);
    publish();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(publish);
    observer.observe(stack);
    return () => {
      observer.disconnect();
      host.style.removeProperty("--hud-h");
    };
  }, []);

  return (
    <div ref={outerRef} className="pointer-events-none absolute inset-0 z-[600]">
      {center}
      <WalkSheet sheetRef={stackRef} half={half} onFull={onDetails} label={t.details}>
        {sheet ?? (alert ? <WalkAlertCard key={alert.id} alert={alert} /> : null)}
        {gpsLabel ? (
          <div
            role="status"
            data-testid="gps-chip"
            className="flex items-center gap-2 self-start rounded-full bg-forest/10 px-3 py-1 text-[13px] font-medium text-forest"
          >
            <span
              aria-hidden
              className={`h-2 w-2 rounded-full ${gpsState === "searching" ? "animate-pulse bg-forest" : "bg-warn"}`}
            />
            {gpsLabel}
          </div>
        ) : null}
        {notice ? (
          <div
            key={notice.id}
            role="status"
            data-testid="walk-notice"
            className={`flex items-center gap-2 rounded-2xl px-3 py-1 text-[15px] font-medium ${notice.tone === "ok" ? "bg-forest/10 text-forest" : "bg-warn/15 text-tk-ink"}`}
          >
            <svg aria-hidden viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              {notice.tone === "ok" ? <path d="M5 12.5l4.5 4.5L19 7.5" /> : <path d="M12 8v5m0 3.5h.01M10.3 3.9L2.6 17.5A2 2 0 004.3 20.5h15.4a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />}
            </svg>
            <span dir="auto" className="min-w-0 flex-1 py-2">{notice.text}</span>
            {notice.action ? (
              <button type="button" onClick={notice.action.onClick} className="min-h-11 shrink-0 rounded-full px-3 text-[15px] font-semibold text-terra">
                {notice.action.label}
              </button>
            ) : null}
          </div>
        ) : null}
        {nextStop ? (
          <p dir="auto" className="flex items-baseline gap-2 text-[17px] font-medium leading-6 text-tk-ink" data-testid="walk-next-stop">
            <span aria-hidden className="h-2.5 w-2.5 shrink-0 translate-y-px rounded-full bg-terra" />
            <span className="min-w-0 truncate">
              {t.nextStop} · {nextStop.name}
            </span>
            {nextStop.minutes !== null ? <span className="shrink-0 text-[13px] text-charcoal/60">{nextStop.minutes} {lang === "he" ? "דק׳" : "min"}</span> : null}
          </p>
        ) : null}
        {stats ? <WalkStatsBar stats={stats} lang={lang} /> : null}
        <div className="flex flex-wrap items-center gap-2">
          {chat}
          <button
            type="button"
            onClick={() => {
              if (confirmEnd) {
                setConfirmEnd(false);
                onEndWalk();
              } else {
                setConfirmEnd(true);
              }
            }}
            className="ms-auto min-h-12 shrink-0 rounded-full bg-terra/10 px-5 text-[15px] font-semibold text-terra shadow-tk-soft transition-colors hover:bg-terra/15"
          >
            {confirmEnd ? t.endConfirm : t.endWalk}
          </button>
        </div>
      </WalkSheet>
    </div>
  );
}
