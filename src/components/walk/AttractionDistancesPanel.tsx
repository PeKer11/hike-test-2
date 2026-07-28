"use client";

import type { Attraction } from "@/lib/types";
import { formatDistance } from "@/lib/utils/geo";
import { CATEGORY_EMOJI } from "@/lib/constants/categories";

interface Props {
  attractions: Attraction[];
  attractionDistances: Record<string, number>;
  // Pinned attractions survive an automatic re-plan even if time runs short.
  pinnedIds?: string[];
  onTogglePin?: (attractionId: string) => void;
}

export function AttractionDistancesPanel({
  attractions,
  attractionDistances,
  pinnedIds = [],
  onTogglePin,
}: Props) {
  if (attractions.length === 0) return null;

  const items = attractions
    .map((a) => ({ attraction: a, meters: attractionDistances[a.id] ?? null }))
    .filter((item) => item.meters !== null)
    .sort((a, b) => (a.meters ?? 0) - (b.meters ?? 0));

  if (items.length === 0) return null;

  return (
    <section className="rounded-lg border border-charcoal/10 bg-white shadow-sm">
      <div className="border-b border-charcoal/10 px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-charcoal/60">
          Attractions ahead
        </span>
      </div>
      <ul className="divide-y divide-charcoal/10">
        {items.map(({ attraction, meters }, idx) => {
          const passed = meters === 0;
          const isNext = idx === 0 && !passed;
          const emoji = CATEGORY_EMOJI[attraction.category] ?? "📍";

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
              {onTogglePin && (
                <button
                  onClick={() => onTogglePin(attraction.id)}
                  aria-label={
                    pinnedIds.includes(attraction.id)
                      ? `Unpin ${attraction.name}`
                      : `Pin ${attraction.name}`
                  }
                  className={`ml-2 shrink-0 rounded-full px-1.5 py-0.5 text-sm transition ${
                    pinnedIds.includes(attraction.id)
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
