import { Card } from "@/components/ui";
import type { CalculatedRoute } from "@/lib/types";
import { formatDistance } from "@/lib/utils/geo";
import { formatDuration } from "@/lib/utils/time";

import { RouteStats } from "./RouteStats";

interface RouteResultsProps {
  route: CalculatedRoute | null;
  error?: string | null;
}

export function RouteResults({ route, error }: RouteResultsProps) {
  return (
    <Card className="space-y-3">
      <div>
        <h2 className="text-base font-semibold text-slate-900">Route Results</h2>
        <p className="text-xs text-slate-500">Calculated path and stop sequence</p>
      </div>

      {error && <div className="rounded-md bg-rose-50 p-2 text-sm text-rose-700">{error}</div>}

      {!route && !error && (
        <p className="rounded-md bg-slate-50 p-2 text-sm text-slate-500">
          Calculate a route to see results.
        </p>
      )}

      {route && (
        <div className="space-y-3">
          <RouteStats
            totalDistanceMeters={route.totalDistanceMeters}
            totalDurationSeconds={route.totalDurationSeconds}
            stopsCount={route.orderedWaypoints.length}
          />

          {route.warnings.length > 0 && (
            <ul className="space-y-1 rounded-md bg-amber-50 p-2 text-xs text-amber-700">
              {route.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          )}

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-700">Stop order</h3>
            <ol className="space-y-1">
              {route.orderedWaypoints.map((waypoint, index) => (
                <li
                  key={waypoint.id}
                  className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700"
                >
                  {index + 1}. {waypoint.name}
                </li>
              ))}
            </ol>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-700">Segments</h3>
            <ul className="space-y-1 text-xs text-slate-600">
              {route.segments.map((segment) => (
                <li key={`${segment.from.id}-${segment.to.id}`}>
                  {segment.from.name} → {segment.to.name} ({formatDistance(segment.distanceMeters)}
                  , {formatDuration(segment.durationSeconds)})
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Card>
  );
}
