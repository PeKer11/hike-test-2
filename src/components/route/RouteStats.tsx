import { Card } from "@/components/ui";
import { formatDistance } from "@/lib/utils/geo";
import { formatDuration } from "@/lib/utils/time";

interface RouteStatsProps {
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  stopsCount: number;
}

export function RouteStats({
  totalDistanceMeters,
  totalDurationSeconds,
  stopsCount,
}: RouteStatsProps) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <Card className="p-3">
        <div className="text-xs text-slate-500">Distance</div>
        <div className="text-sm font-semibold text-slate-900">
          {formatDistance(totalDistanceMeters)}
        </div>
      </Card>
      <Card className="p-3">
        <div className="text-xs text-slate-500">Duration</div>
        <div className="text-sm font-semibold text-slate-900">
          {formatDuration(totalDurationSeconds)}
        </div>
      </Card>
      <Card className="p-3">
        <div className="text-xs text-slate-500">Stops</div>
        <div className="text-sm font-semibold text-slate-900">{stopsCount}</div>
      </Card>
    </div>
  );
}
