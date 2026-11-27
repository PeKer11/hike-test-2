"use client";

import { Card } from "@/components/ui";
import { ClockIcon, TrailIcon, WalkIcon } from "@/components/ui/icons";
import type { WalkPlan } from "@/lib/types";
import { formatDistance } from "@/lib/utils/geo";
import { CATEGORY_EMOJI } from "@/lib/constants/categories";
import { CommunityBadge } from "@/components/walk/CommunityBadge";
import type { CommunityAggregates, SocialLang } from "@/lib/social/aggregates";

interface WalkPlanResultsProps {
  plan: WalkPlan | null;
  error: string | null;
  /** Social layer (NEXT_PUBLIC_SOCIAL=1 + opt-in); absent => nothing extra renders. */
  community?: CommunityAggregates;
  lang?: SocialLang;
}

const COPY = {
  en: {
    title: "Your Walk Plan",
    total: (n: number) => `${n} min total`,
    walking: (n: number) => `${n} min walking`,
    visit: (n: number) => `${n} min visit`,
    walk: (n: number) => `${n} min walk`,
    walkingTime: "Walking time",
    visitTime: "Visit time",
    totalLabel: "Total",
    min: (n: number) => `${n} min`,
    dropped: "Didn't fit in time budget:",
    none: "No attractions found in this area for your time budget. Try increasing the search radius or available time.",
  },
  he: {
    title: "המסלול שלך",
    total: (n: number) => `${n} דק׳ בסך הכול`,
    walking: (n: number) => `${n} דק׳ הליכה`,
    visit: (n: number) => `${n} דק׳ ביקור`,
    walk: (n: number) => `${n} דק׳ הליכה`,
    walkingTime: "זמן הליכה",
    visitTime: "זמן ביקורים",
    totalLabel: "סה״כ",
    min: (n: number) => `${n} דק׳`,
    dropped: "לא נכנסו בזמן:",
    none: "לא מצאנו מקומות שמתאימים לזמן שלך.",
  },
} as const;

export function WalkPlanResults({ plan, error, community, lang = "en" }: WalkPlanResultsProps) {
  const t = COPY[lang];
  if (error) {
    return (
      <Card>
        <p className="text-sm text-rose-700">{error}</p>
      </Card>
    );
  }

  if (!plan) return null;

  // Deliberately not gated on `plan.feasible`: a pinned stop can push a perfectly
  // real itinerary over the time budget, and hiding the whole plan behind "no
  // attractions found" would be both wrong and contradicted by the pin prompt.
  if (plan.orderedAttractions.length === 0) {
    return (
      <Card>
        <p className="text-sm text-charcoal/70">{t.none}</p>
      </Card>
    );
  }

  const walkingMinutes = plan.segments.reduce(
    (sum, s) => sum + s.walkingMinutes,
    0,
  );
  const visitMinutes = plan.orderedAttractions.reduce(
    (sum, a) => sum + a.avgVisitMinutes,
    0,
  );

  return (
    <Card className="space-y-3">
      <div>
        <h2 className="font-display text-base font-bold text-forest">{t.title}</h2>
        <div className="mt-1 flex gap-3 text-xs text-charcoal/60">
          <span className="inline-flex items-center gap-1"><ClockIcon className="h-4 w-4" /> {t.total(Math.round(plan.totalMinutes))}</span>
          <span className="inline-flex items-center gap-1"><WalkIcon className="h-4 w-4" /> {t.walking(Math.round(walkingMinutes))}</span>
          <span className="inline-flex items-center gap-1"><TrailIcon className="h-4 w-4" /> {formatDistance(plan.totalDistanceMeters, lang)}</span>
        </div>
      </div>

      {/* Ordered stops */}
      <ol className="space-y-2">
        {plan.orderedAttractions.map((attraction, index) => {
          const segment = plan.segments[index];
          const emoji = CATEGORY_EMOJI[attraction.category] ?? "📍";

          return (
            <li key={attraction.id} className="flex gap-2">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-terra/15 text-xs font-bold text-terra">
                {index + 1}
              </span>
              <div className="flex-1">
                <p className="text-sm font-medium text-forest">
                  {emoji} {attraction.name}
                </p>
                <p className="text-xs text-charcoal/60">
                  {t.visit(attraction.avgVisitMinutes)}
                  {segment
                    ? ` · ${t.walk(Math.round(segment.walkingMinutes))} · ${formatDistance(segment.distanceMeters, lang)}`
                    : ""}
                </p>
                {community ? (
                  <CommunityBadge poiKey={attraction.id} data={community} lang={lang} />
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>

      {/* Time breakdown */}
      <div className="rounded-md bg-cream/70 p-2 text-xs text-charcoal/70 space-y-0.5">
        <div className="flex justify-between">
          <span>{t.walkingTime}</span>
          <span>{t.min(Math.round(walkingMinutes))}</span>
        </div>
        <div className="flex justify-between">
          <span>{t.visitTime}</span>
          <span>{t.min(Math.round(visitMinutes))}</span>
        </div>
        <div className="flex justify-between font-semibold text-forest">
          <span>{t.totalLabel}</span>
          <span>{t.min(Math.round(plan.totalMinutes))}</span>
        </div>
      </div>

      {/* Dropped attractions */}
      {plan.droppedAttractions.length > 0 && (
        <div className="text-xs text-charcoal/60">
          <p className="font-medium text-charcoal/80">{t.dropped}</p>
          <p>{plan.droppedAttractions.map((a) => a.name).join(", ")}</p>
        </div>
      )}
    </Card>
  );
}
