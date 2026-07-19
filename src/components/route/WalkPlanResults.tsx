"use client";

import { Card } from "@/components/ui";
import type { WalkPlan } from "@/lib/types";
import { formatDistance } from "@/lib/utils/geo";
import { CATEGORY_EMOJI } from "@/lib/constants/categories";

interface WalkPlanResultsProps {
  plan: WalkPlan | null;
  error: string | null;
  walkOrigin?: { lat: number; lng: number };
  walkMinutes?: number;
  walkRadius?: number;
}

export function WalkPlanResults({ plan, error, walkOrigin, walkMinutes, walkRadius }: WalkPlanResultsProps) {
  if (error) {
    return (
      <Card>
        <p className="text-sm text-rose-700">{error}</p>
      </Card>
    );
  }

  if (!plan) return null;

  if (!plan.feasible || plan.orderedAttractions.length === 0) {
    return (
      <Card>
        <p className="text-sm text-slate-600">
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
        <h2 className="text-base font-semibold text-slate-900">Your Walk Plan</h2>
        <div className="mt-1 flex gap-3 text-xs text-slate-500">
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
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
                {index + 1}
              </span>
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-900">
                  {emoji} {attraction.name}
                </p>
                <p className="text-xs text-slate-500">
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
      <div className="rounded-md bg-slate-50 p-2 text-xs text-slate-600 space-y-0.5">
        <div className="flex justify-between">
          <span>Walking time</span>
          <span>{Math.round(walkingMinutes)} min</span>
        </div>
        <div className="flex justify-between">
          <span>Visit time</span>
          <span>{Math.round(visitMinutes)} min</span>
        </div>
        <div className="flex justify-between font-semibold text-slate-900">
          <span>Total</span>
          <span>{Math.round(plan.totalMinutes)} min</span>
        </div>
      </div>

      {/* TSP Graph link */}
      {walkOrigin && (
        <a
          href={`/tsp-debug?lat=${walkOrigin.lat}&lng=${walkOrigin.lng}&minutes=${walkMinutes ?? 90}&radius=${walkRadius ?? 2000}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-slate-300 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          🔬 View TSP Graph
        </a>
      )}

      {/* Dropped attractions */}
      {plan.droppedAttractions.length > 0 && (
        <div className="text-xs text-slate-500">
          <p className="font-medium text-slate-700">
            Didn&apos;t fit in time budget:
          </p>
          <p>{plan.droppedAttractions.map((a) => a.name).join(", ")}</p>
        </div>
      )}
    </Card>
  );
}
