"use client";

import { useState } from "react";

import type { Attraction } from "@/lib/types";
import { formatDistance } from "@/lib/utils/geo";
import { CATEGORY_EMOJI } from "@/lib/constants/categories";

interface Props {
  attractions: Attraction[];
  attractionDistances: Record<string, number>;
  // Pinned attractions survive an automatic re-plan even if time runs short.
  pinnedIds?: string[];
  onTogglePin?: (attractionId: string) => void;
  // Stops already done — GPS-confirmed visits and stops the walker skipped by hand.
  visitedIds?: string[];
  onSkip?: (attractionId: string) => void;
}

export function AttractionDistancesPanel({
  attractions,
  attractionDistances,
  pinnedIds = [],
  onTogglePin,
  visitedIds = [],
  onSkip,
}: Props) {
  // A pinned stop was explicitly marked "definitely include this", so skipping it
  // costs a second click on the same button rather than a modal.
  const [pendingSkipId, setPendingSkipId] = useState<string | null>(null);

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
    <section className="rounded-lg border border-charcoal/10 bg-white shadow-sm">
      <div className="space-y-1.5 border-b border-charcoal/10 px-3 py-2">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-charcoal/60">
            Attractions ahead
          </span>
          <span className="text-xs font-medium tabular-nums text-charcoal/60">
            {doneCount} of {items.length} stops
          </span>
        </div>
        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-charcoal/10"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={items.length}
          aria-valuenow={doneCount}
          aria-label={`${doneCount} of ${items.length} stops done`}
        >
          <div
            className="h-full rounded-full bg-terra transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
      <ul className="divide-y divide-charcoal/10">
        {items.map(({ attraction, meters, passed }, idx) => {
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
                  <span className="shrink-0 rounded-full bg-terra/15 px-1.5 py-0.5 text-xs font-medium text-terra">
                    next
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
                      ? `Confirm skipping pinned ${attraction.name}`
                      : `Skip ${attraction.name}`
                  }
                  className="ml-2 shrink-0 rounded-full px-1.5 py-0.5 text-xs font-medium text-charcoal/50 transition hover:bg-charcoal/5 hover:text-charcoal/80"
                >
                  {isPendingSkip ? "Skip pinned?" : "Skip"}
                </button>
              )}
              {onTogglePin && (
                <button
                  onClick={() => onTogglePin(attraction.id)}
                  aria-label={
                    isPinned
                      ? `Unpin ${attraction.name}`
                      : `Pin ${attraction.name}`
                  }
                  className={`ml-2 shrink-0 rounded-full px-1.5 py-0.5 text-sm transition ${
                    isPinned
                      ? "bg-amber-100 opacity-100"
                      : "opacity-30 hover:opacity-70"
                  }`}
                >
                  📌
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
                {passed ? "passed" : formatDistance(meters ?? 0)}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
