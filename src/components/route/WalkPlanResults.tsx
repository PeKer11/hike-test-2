"use client";

import { Card } from "@/components/ui";
import type { WalkPlan } from "@/lib/types";
import { formatDistance } from "@/lib/utils/geo";
import { CATEGORY_EMOJI } from "@/lib/constants/categories";

interface WalkPlanResultsProps {
  plan: WalkPlan | null;
  error: string | null;
}

export function WalkPlanResults({ plan, error }: WalkPlanResultsProps) {
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
        <p className="text-sm text-charcoal/70">
          No attractions found in this area for your time budget. Try increasing
          the search radius or available time.
        </p>
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
        <h2 className="font-display text-base font-bold text-forest">Your Walk Plan</h2>
        <div className="mt-1 flex gap-3 text-xs text-charcoal/60">
          <span>🕐 {Math.round(plan.totalMinutes)} min total</span>
          <span>🚶 {Math.round(walkingMinutes)} min walking</span>
          <span>📍 {formatDistance(plan.totalDistanceMeters)}</span>
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
                  {attraction.avgVisitMinutes} min visit
                  {segment
                    ? ` · ${Math.round(segment.walkingMinutes)} min walk · ${formatDistance(segment.distanceMeters)}`
                    : ""}
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      {/* Time breakdown */}
      <div className="rounded-md bg-cream/70 p-2 text-xs text-charcoal/70 space-y-0.5">
        <div className="flex justify-between">
          <span>Walking time</span>
          <span>{Math.round(walkingMinutes)} min</span>
        </div>
        <div className="flex justify-between">
          <span>Visit time</span>
          <span>{Math.round(visitMinutes)} min</span>
        </div>
        <div className="flex justify-between font-semibold text-forest">
          <span>Total</span>
          <span>{Math.round(plan.totalMinutes)} min</span>
        </div>
      </div>

      {/* Dropped attractions */}
      {plan.droppedAttractions.length > 0 && (
        <div className="text-xs text-charcoal/60">
          <p className="font-medium text-charcoal/80">
            Didn&apos;t fit in time budget:
          </p>
          <p>{plan.droppedAttractions.map((a) => a.name).join(", ")}</p>
        </div>
      )}
    </Card>
  );
}
