"use client";

import type { Attraction } from "@/lib/types";
import { formatDistance } from "@/lib/utils/geo";
import { CATEGORY_EMOJI } from "@/lib/constants/categories";

interface Props {
  attractions: Attraction[];
  attractionDistances: Record<string, number>;
}

export function AttractionDistancesPanel({ attractions, attractionDistances }: Props) {
  if (attractions.length === 0) return null;

  const items = attractions
    .map((a) => ({ attraction: a, meters: attractionDistances[a.id] ?? null }))
    .filter((item) => item.meters !== null)
    .sort((a, b) => (a.meters ?? 0) - (b.meters ?? 0));

  if (items.length === 0) return null;

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Attractions ahead
        </span>
      </div>
      <ul className="divide-y divide-slate-100">
        {items.map(({ attraction, meters }, idx) => {
          const passed = meters === 0;
          const isNext = idx === 0 && !passed;
          const emoji = CATEGORY_EMOJI[attraction.category] ?? "📍";

          return (
            <li
              key={attraction.id}
              className={`flex items-center justify-between px-3 py-2 ${
                isNext ? "bg-emerald-50" : ""
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base leading-none">{emoji}</span>
                <span
                  className={`truncate text-sm ${
                    passed ? "text-slate-400 line-through" : "text-slate-700"
                  }`}
                >
                  {attraction.name}
                </span>
                {isNext && (
                  <span className="shrink-0 rounded-full bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-700">
                    next
                  </span>
                )}
              </div>
              <span
                className={`ml-3 shrink-0 text-sm font-medium tabular-nums ${
                  passed
                    ? "text-slate-400"
                    : isNext
                      ? "text-emerald-700"
                      : "text-slate-600"
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
