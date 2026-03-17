"use client";

import { Button, Toggle } from "@/components/ui";
import type { TimeWindow, Waypoint } from "@/lib/types";

interface WaypointItemProps {
  waypoint: Waypoint;
  index: number;
  onRename: (id: string, name: string) => void;
  onToggleRequired: (id: string) => void;
  onSetStart: (id: string) => void;
  onSetEnd: (id: string) => void;
  onDelete: (id: string) => void;
  onSetTimeWindow: (id: string, timeWindow?: TimeWindow) => void;
}

export function WaypointItem({
  waypoint,
  index,
  onRename,
  onToggleRequired,
  onSetStart,
  onSetEnd,
  onDelete,
  onSetTimeWindow,
}: WaypointItemProps) {
  return (
    <article className="space-y-3 rounded-md border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-semibold text-slate-500">#{index + 1}</div>
        <div className="flex items-center gap-2 text-xs">
          {waypoint.isStart && (
            <span className="rounded bg-rose-100 px-2 py-1 font-medium text-rose-700">
              Start
            </span>
          )}
          {waypoint.isEnd && (
            <span className="rounded bg-emerald-100 px-2 py-1 font-medium text-emerald-700">
              End
            </span>
          )}
        </div>
      </div>

      <input
        type="text"
        value={waypoint.name}
        onChange={(event) => onRename(waypoint.id, event.target.value)}
        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none"
      />

      <Toggle
        checked={waypoint.required}
        onChange={() => onToggleRequired(waypoint.id)}
        label="Required stop"
      />

      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={() => onSetStart(waypoint.id)}>
          Set Start
        </Button>
        <Button variant="secondary" onClick={() => onSetEnd(waypoint.id)}>
          Set End
        </Button>
      </div>

      <div className="space-y-1">
        <p className="text-xs font-medium text-slate-600">Time window</p>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="time"
            value={waypoint.timeWindow?.start ?? ""}
            onChange={(event) =>
              onSetTimeWindow(waypoint.id, {
                start: event.target.value,
                end: waypoint.timeWindow?.end ?? event.target.value,
              })
            }
            className="rounded-md border border-slate-300 px-2 py-1 text-xs focus:border-emerald-500 focus:outline-none"
          />
          <input
            type="time"
            value={waypoint.timeWindow?.end ?? ""}
            onChange={(event) =>
              onSetTimeWindow(waypoint.id, {
                start: waypoint.timeWindow?.start ?? event.target.value,
                end: event.target.value,
              })
            }
            className="rounded-md border border-slate-300 px-2 py-1 text-xs focus:border-emerald-500 focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={() => onSetTimeWindow(waypoint.id, undefined)}
          className="text-xs text-slate-500 underline underline-offset-2"
        >
          Clear time window
        </button>
      </div>

      <Button variant="danger" onClick={() => onDelete(waypoint.id)} fullWidth>
        Remove waypoint
      </Button>
    </article>
  );
}
