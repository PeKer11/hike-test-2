"use client";

import { useState } from "react";

import { PushPinIcon } from "@/components/ui/icons";
import type { Attraction } from "@/lib/types";
import { formatDistance } from "@/lib/utils/geo";
import { CATEGORY_EMOJI } from "@/lib/constants/categories";

const COPY = {
  en: {
    ahead: "Attractions ahead",
    count: (d: number, n: number) => `${d} of ${n} stops`,
    done: (d: number, n: number) => `${d} of ${n} stops done`,
    toggle: (show: boolean, d: number) => `${show ? "Hide" : "Show"} ${d} done ${d === 1 ? "stop" : "stops"}`,
    next: "next",
    confirmSkip: (x: string) => `Confirm skipping pinned ${x}`,
    skipAria: (x: string) => `Skip ${x}`,
    skipPinned: "Skip pinned?",
    skip: "Skip",
    unpin: (x: string) => `Unpin ${x}`,
    pin: (x: string) => `Pin ${x}`,
    passed: "passed",
  },
  he: {
    ahead: "התחנות הבאות",
    count: (d: number, n: number) => `${d} מתוך ${n} תחנות`,
    done: (d: number, n: number) => `${d} מתוך ${n} תחנות הושלמו`,
    toggle: (show: boolean, d: number) => `${show ? "הסתרת" : "הצגת"} ${d} שהושלמו`,
    next: "הבאה",
    confirmSkip: (x: string) => `לאשר דילוג על ${x}`,
    skipAria: (x: string) => `דילוג על ${x}`,
    skipPinned: "לדלג על נעוצה?",
    skip: "דילוג",
    unpin: (x: string) => `ביטול נעיצה ${x}`,
    pin: (x: string) => `נעיצה ${x}`,
    passed: "עברנו",
  },
} as const;

interface Props {
  attractions: Attraction[];
  attractionDistances: Record<string, number>;
  // Pinned attractions survive an automatic re-plan even if time runs short.
  pinnedIds?: string[];
  onTogglePin?: (attractionId: string) => void;
  // Stops already done — GPS-confirmed visits and stops the walker skipped by hand.
  visitedIds?: string[];
  onSkip?: (attractionId: string) => void;
  lang?: "en" | "he";
}

export function AttractionDistancesPanel({
  attractions,
  attractionDistances,
  pinnedIds = [],
  onTogglePin,
  visitedIds = [],
  onSkip,
  lang = "en",
}: Props) {
  const t = COPY[lang];
  // A pinned stop was explicitly marked "definitely include this", so skipping it
  // costs a second click on the same button rather than a modal.
  const [pendingSkipId, setPendingSkipId] = useState<string | null>(null);
  // Done stops stay folded away (they are also what a rebuild leaves behind) until asked for.
  const [showDone, setShowDone] = useState(false);

  if (attractions.length === 0) return null;

  const visited = new Set(visitedIds);

  const items = attractions
    .map((a) => ({
      attraction: a,
      meters: attractionDistances[a.id] ?? null,
      // Walked past (no route distance left to it) or marked done by hand.
      passed: attractionDistances[a.id] === 0 || visited.has(a.id),
    }))
    .filter((item) => item.meters !== null)
    // Done stops collect at the top — where zero-distance ones already sorted —
    // and everything still ahead stays ordered by what's closest.
    .sort((a, b) =>
      a.passed === b.passed
        ? (a.meters ?? 0) - (b.meters ?? 0)
        : Number(b.passed) - Number(a.passed),
    );

  if (items.length === 0) return null;

  // The first stop still ahead — not index 0, which is a done stop as soon as
  // the walker has finished one.
  const nextIndex = items.findIndex((item) => !item.passed);
  const doneCount = items.filter((item) => item.passed).length;
  const progressPercent = Math.round((doneCount / items.length) * 100);

  return (
    <section className="rounded-lg border border-charcoal/10 bg-paper shadow-sm">
      <div className="space-y-1.5 border-b border-charcoal/10 px-3 py-2">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[13px] font-semibold text-charcoal/60">
            {t.ahead}
          </span>
          <span className="text-[13px] font-medium tabular-nums text-charcoal/60">
            {t.count(doneCount, items.length)}
          </span>
        </div>
        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-charcoal/10"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={items.length}
          aria-valuenow={doneCount}
          aria-label={t.done(doneCount, items.length)}
        >
          <div
            className="h-full rounded-full bg-terra transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
      {doneCount > 0 && (
        <button
          type="button"
          onClick={() => setShowDone((v) => !v)}
          className="w-full border-b border-charcoal/10 px-3 py-1.5 text-start text-[13px] font-medium text-charcoal/50 hover:bg-charcoal/5"
        >
          {t.toggle(showDone, doneCount)}
        </button>
      )}
      <ul className="divide-y divide-charcoal/10">
        {items.map(({ attraction, meters, passed }, idx) => {
          if (passed && !showDone) return null;
          const isNext = idx === nextIndex;
          const emoji = CATEGORY_EMOJI[attraction.category] ?? "📍";
          const isPinned = pinnedIds.includes(attraction.id);
          const isPendingSkip = pendingSkipId === attraction.id;

          return (
            <li
              key={attraction.id}
              className={`flex items-center justify-between px-3 py-2 ${
                isNext ? "bg-terra/10" : ""
              }`}
            >
              <div className="flex flex-1 items-center gap-2 min-w-0">
                <span className="text-base leading-none">{emoji}</span>
                <span
                  className={`truncate text-sm ${
                    passed ? "text-charcoal/40 line-through" : "text-charcoal/80"
                  }`}
                >
                  {attraction.name}
                </span>
                {isNext && (
                  <span className="shrink-0 rounded-full bg-terra/15 px-1.5 py-0.5 text-[13px] font-medium text-terra">
                    {t.next}
                  </span>
                )}
              </div>
              {onSkip && isNext && (
                <button
                  onClick={() => {
                    if (isPinned && !isPendingSkip) {
                      setPendingSkipId(attraction.id);
                      return;
                    }
                    setPendingSkipId(null);
                    onSkip(attraction.id);
                  }}
                  aria-label={
                    isPendingSkip
                      ? t.confirmSkip(attraction.name)
                      : t.skipAria(attraction.name)
                  }
                  className="ml-2 shrink-0 rounded-full px-1.5 py-0.5 text-[13px] font-medium text-charcoal/50 transition hover:bg-charcoal/5 hover:text-charcoal/80"
                >
                  {isPendingSkip ? t.skipPinned : t.skip}
                </button>
              )}
              {onTogglePin && (
                <button
                  onClick={() => onTogglePin(attraction.id)}
                  aria-label={
                    isPinned
                      ? t.unpin(attraction.name)
                      : t.pin(attraction.name)
                  }
                  className={`ml-2 flex shrink-0 items-center justify-center rounded-full p-1 text-amber-800 transition ${
                    isPinned
                      ? "bg-amber-100 opacity-100"
                      : "opacity-40 hover:opacity-80"
                  }`}
                >
                  <PushPinIcon />
                </button>
              )}
              <span
                className={`ml-3 shrink-0 text-sm font-medium tabular-nums ${
                  passed
                    ? "text-charcoal/40"
                    : isNext
                      ? "text-terra"
                      : "text-charcoal/70"
                }`}
              >
                {passed ? t.passed : formatDistance(meters ?? 0, lang)}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
