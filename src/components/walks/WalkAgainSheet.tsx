"use client";

import { RouteSketch } from "@/components/walks/RouteSketch";
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
        <RouteSketch route={routeOf(walk)} here={here} label={t.sketch} className="h-[120px] w-full" />
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
