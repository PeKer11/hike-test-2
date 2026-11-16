"use client";

import { useMemo } from "react";

import type { Coordinates } from "@/lib/types";
import { routeOf, type WalkAgainDecision, type WalkAgainMode, type WalkAgainOption } from "@/lib/walks/walk-again";
import type { SavedWalk } from "@/lib/walks/saved-walks";

const COPY = {
  en: {
    go: "Let's go",
    sketch: "Route and where you are",
    over: "With the way there, this is longer than the walk was.",
    close: "Not now",
    skipped: (n: number) => `${n} stop${n === 1 ? "" : "s"} skipped`,
    min: "min",
    modes: {
      start_now: "Start the walk",
      resume: "Continue where I stopped",
      join_nearest: "Join at the nearest point",
      walk_to_start: "Walk to the start",
      reroute_from_here: "Same route, from here",
      same_style_here: "A walk in the same style, here",
      transit_to_start: "Get there",
      reverse: "Walk it the other way",
      original_start_no_location: "Start from the beginning",
    } as Record<WalkAgainMode, string>,
  },
  he: {
    go: "יוצאים",
    sketch: "המסלול והמיקום שלכם",
    over: "יחד עם הדרך לשם, זה ארוך מההליכה המקורית.",
    close: "לא עכשיו",
    skipped: (n: number) => `${n} תחנות דולגו`,
    min: "דק׳",
    modes: {
      start_now: "מתחילים את ההליכה",
      resume: "המשך מאיפה שעצרתי",
      join_nearest: "הצטרפות בנקודה הקרובה",
      walk_to_start: "הליכה לנקודת ההתחלה",
      reroute_from_here: "אותו מסלול, מכאן",
      same_style_here: "מסלול באותו סגנון כאן",
      transit_to_start: "להגיע לשם",
      reverse: "ללכת אותו בכיוון ההפוך",
      original_start_no_location: "מתחילים מההתחלה",
    } as Record<WalkAgainMode, string>,
  },
} as const;

/** A route drawn small: the walk, the walker, and a dashed line to where it joins. No map library, no tiles. */
function Sketch({ route, here, label }: { route: Coordinates[]; here: Coordinates | null; label: string }) {
  const view = useMemo(() => {
    const pts = here ? [...route, here] : route;
    const lats = pts.map((p) => p.lat);
    const lngs = pts.map((p) => p.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const span = Math.max(maxLat - minLat, maxLng - minLng, 1e-5);
    const w = 300;
    const h = 120;
    const pad = 14;
    const scale = (Math.min(w, h) - pad * 2) / span;
    const x = (lng: number) => pad + (lng - minLng) * scale + (w - pad * 2 - (maxLng - minLng) * scale) / 2;
    const y = (lat: number) => h - pad - (lat - minLat) * scale - (h - pad * 2 - (maxLat - minLat) * scale) / 2;
    return { w, h, x, y };
  }, [route, here]);
  const d = route.map((p, i) => `${i ? "L" : "M"}${view.x(p.lng).toFixed(1)} ${view.y(p.lat).toFixed(1)}`).join(" ");
  // The dashed approach: from the walker to the closest vertex of the route.
  const near = here
    ? route.reduce((best, p) => (Math.hypot(p.lat - here.lat, p.lng - here.lng) < Math.hypot(best.lat - here.lat, best.lng - here.lng) ? p : best), route[0])
    : null;
  return (
    <svg role="img" aria-label={label} viewBox={`0 0 ${view.w} ${view.h}`} className="h-[120px] w-full rounded-[14px] bg-forest/5">
      <path d={d} fill="none" style={{ stroke: "var(--tk-route)" }} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {here && near ? (
        <>
          <line x1={view.x(here.lng)} y1={view.y(here.lat)} x2={view.x(near.lng)} y2={view.y(near.lat)} style={{ stroke: "var(--tk-terra)" }} strokeWidth="2" strokeDasharray="4 4" strokeLinecap="round" />
          <circle cx={view.x(here.lng)} cy={view.y(here.lat)} r="5" fill="#2563eb" stroke="#fff" strokeWidth="2" />
        </>
      ) : null}
    </svg>
  );
}

function detail(option: WalkAgainOption, t: (typeof COPY)["en"] | (typeof COPY)["he"]): string {
  const parts: string[] = [];
  if (option.approachMin !== undefined) parts.push(`${option.approachMin} ${t.min}`);
  if (option.skippedStops) parts.push(t.skipped(option.skippedStops));
  return parts.join(" · ");
}

/**
 * Walk again from where you are: a sketch, one primary button with the default, and at most two plain rows.
 * Only the modes the app can run are offered (`supported`).
 */
export function WalkAgainSheet({
  walk,
  here,
  decision,
  lang,
  supported,
  onChoose,
  onClose,
}: {
  walk: SavedWalk;
  here: Coordinates | null;
  decision: WalkAgainDecision;
  lang: "he" | "en";
  supported: ReadonlySet<WalkAgainMode>;
  onChoose: (option: WalkAgainOption) => void;
  onClose: () => void;
}) {
  const t = COPY[lang];
  const alternatives = decision.alternatives.filter((a) => supported.has(a.mode));
  const primaryDetail = detail(decision.primary, t);
  return (
    <div className="fixed inset-0 z-[1100] flex items-end justify-center bg-charcoal/40 sm:items-center" role="dialog" aria-modal="true" aria-label={walk.title}>
      <div className="w-full max-w-[440px] space-y-3 rounded-t-[22px] bg-paper p-4 pb-[max(16px,env(safe-area-inset-bottom))] shadow-[0_-8px_30px_rgba(30,61,47,0.18)] sm:rounded-[22px]">
        <h2 dir="auto" className="font-display text-[20px] leading-[26px] text-tk-ink">
          {walk.title}
        </h2>
        <Sketch route={routeOf(walk)} here={here} label={t.sketch} />
        <button
          type="button"
          onClick={() => onChoose(decision.primary)}
          className="min-h-12 w-full rounded-full bg-terra px-5 text-[15px] font-semibold text-on-accent shadow-tk-soft transition-colors hover:bg-terra/90"
        >
          {t.go} · {t.modes[decision.primary.mode]}
          {primaryDetail ? ` · ${primaryDetail}` : ""}
        </button>
        {decision.overBudget ? <p className="text-[13px] text-charcoal/70">{t.over}</p> : null}
        {alternatives.map((option) => (
          <button
            key={option.mode}
            type="button"
            onClick={() => onChoose(option)}
            className="flex min-h-11 w-full items-center justify-between gap-3 rounded-full bg-charcoal/5 px-4 text-start text-[15px] font-medium text-charcoal"
          >
            <span>{t.modes[option.mode]}</span>
            <span className="shrink-0 text-[13px] text-charcoal/60">{detail(option, t)}</span>
          </button>
        ))}
        <button type="button" onClick={onClose} className="min-h-11 w-full text-[15px] font-semibold text-charcoal/70">
          {t.close}
        </button>
      </div>
    </div>
  );
}
