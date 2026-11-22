"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { MapCredits } from "@/components/map/MapCredits";
import { WalkAlertCard, type WalkAlert } from "@/components/walk/WalkAlertCard";
import { CheckIcon, StopIcon, WarnIcon } from "@/components/ui/icons";
import { TraikeLockup } from "@/components/ui/TraikeMark";
import { WalkSheet } from "@/components/walk/WalkSheet";
import { WalkStatsBar, type WalkStatsData } from "@/components/walk/WalkStatsBar";
import { WalkTurnDeck, etaClock } from "@/components/walk/WalkTurnDeck";
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
  /** Shown only while a rough position is really being shared with others; one tap hides it. */
  sharing?: { label: string; hideLabel: string; onHide: () => void } | null;
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
  /** Which stop the walker is heading for, of how many; drives the chip floating on the map. */
  stopProgress?: { index: number; total: number } | null;
  /** Shown only when the sheet is dragged to HALF: the stops coming up and the quick actions. */
  half?: ReactNode;
  /** Past HALF (or the layers glyph): the full Details. */
  onDetails: () => void;
  onEndWalk: () => void;
  /** Other data credits that apply now (WorldCover, Open-Meteo), added to the routing credit at the bottom of the sheet. */
  creditExtras?: string[];
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
export function WalkHud({ alert, notice = null, sharing = null, center, sheet, chat, stats, gpsState = "idle", lang = "en", nextStop, stopProgress = null, half, onDetails, onEndWalk, creditExtras }: WalkHudProps) {
  const outerRef = useRef<HTMLDivElement>(null);
  const stackRef = useRef<HTMLDivElement>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const t = walkCopy.hud.sheet[lang];
  const gpsCopy = walkCopy.hud.gps[lang];
  const gpsLabel =
    gpsState === "searching" ? gpsCopy.searching : gpsState === "denied" ? gpsCopy.denied : gpsState === "coarse" || gpsState === "timeout" || gpsState === "unavailable" ? gpsCopy.weak : null;

  useEffect(() => {
    if (!confirmEnd) return;
    const timer = window.setTimeout(() => setConfirmEnd(false), 5000);
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
      {/* The Traike logo and the stop chip float on the map, beside Google's own controls (they sit at the inline-end: right, or left in Hebrew). */}
      <div dir={lang === "he" ? "rtl" : "ltr"} className="absolute inset-x-0 top-[max(12px,env(safe-area-inset-top))] flex items-center gap-2 ps-3.5 pe-[60px]">
        {/* The logo, not a control: no box, no lip, nothing under it to tap (touches go through to the map). */}
        <TraikeLockup
          data-testid="walk-logo"
          markSize={26}
          textClassName="text-[20px]"
          className="pointer-events-none shrink-0 select-none text-[#FFF7EC] [text-shadow:0_0_3px_rgba(27,38,32,0.7),0_1px_8px_rgba(27,38,32,0.6)]"
        />
        {stopProgress && stopProgress.total > 0 ? (
          <span dir="auto" data-testid="walk-stop-chip" className="tk-paper-tag pointer-events-auto !gap-1.5 !px-2.5 !text-[15px]">
            <span aria-hidden className="tk-champagne-ring !border-[var(--tk-tk-ink)] !bg-[var(--tk-cream)]" />
            <span className="min-w-0 truncate">
              {t.stopOf(stopProgress.index, stopProgress.total)}
              {stats?.timeToFinishMin != null ? <> · <bdi dir="ltr">{etaClock(stats.timeToFinishMin)}</bdi></> : null}
            </span>
          </span>
        ) : null}
      </div>
      {center}
      <WalkSheet
        sheetRef={stackRef}
        half={half}
        onFull={onDetails}
        label={t.details}
        deck={nextStop ? <WalkTurnDeck label={t.nextStop} name={nextStop.name} minutes={nextStop.minutes} minUnit={t.minUnit} /> : undefined}
      >
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
        {sharing ? (
          <div data-testid="walk-sharing" className="flex items-center justify-between gap-2 rounded-2xl bg-forest/10 px-3 text-[15px] font-medium text-forest">
            <span className="flex items-center gap-2 py-2">
              <span aria-hidden className="h-2 w-2 rounded-full bg-forest" />
              {sharing.label}
            </span>
            <button type="button" onClick={sharing.onHide} className="min-h-11 shrink-0 rounded-full px-3 text-[15px] font-semibold text-terra">
              {sharing.hideLabel}
            </button>
          </div>
        ) : null}
        {notice ? (
          <div
            key={notice.id}
            role="status"
            data-testid="walk-notice"
            className={`flex items-center gap-2 rounded-2xl px-3 py-1 text-[15px] font-medium ${notice.tone === "ok" ? "bg-forest/10 text-forest" : "bg-warn/15 text-tk-ink"}`}
          >
            {notice.tone === "ok" ? <CheckIcon className="h-[18px] w-[18px] shrink-0" /> : <WarnIcon className="h-[18px] w-[18px] shrink-0" />}
            <span dir="auto" className="min-w-0 flex-1 py-2">{notice.text}</span>
            {notice.action ? (
              <button type="button" onClick={notice.action.onClick} className="min-h-11 shrink-0 rounded-full px-3 text-[15px] font-semibold text-terra">
                {notice.action.label}
              </button>
            ) : null}
          </div>
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
            className="tk-btn tk-btn-secondary ms-auto min-h-[52px] shrink-0"
          >
            <StopIcon />
            {confirmEnd ? t.endConfirm : t.endWalk}
          </button>
        </div>
        {/* The route line is openrouteservice's: its credit is always on screen, here rather than on the map's edge. */}
        <MapCredits extra={creditExtras} />
      </WalkSheet>
    </div>
  );
}
