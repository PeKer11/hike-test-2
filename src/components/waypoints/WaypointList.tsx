"use client";

import { useState } from "react";

import { Card } from "@/components/ui";
import type { TimeWindow, Waypoint } from "@/lib/types";

import { WaypointItem } from "./WaypointItem";

interface WaypointListProps {
  waypoints: Waypoint[];
  onRename: (id: string, name: string) => void;
  onToggleRequired: (id: string) => void;
  onSetStart: (id: string) => void;
  onSetEnd: (id: string) => void;
  onDelete: (id: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onSetTimeWindow: (id: string, timeWindow?: TimeWindow) => void;
}

export function WaypointList({
  waypoints,
  onRename,
  onToggleRequired,
  onSetStart,
  onSetEnd,
  onDelete,
  onReorder,
  onSetTimeWindow,
}: WaypointListProps) {
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  return (
    <Card className="space-y-3">
      <div>
        <h2 className="font-display text-base font-bold text-forest">Waypoints</h2>
        <p className="text-xs text-charcoal/60">Drag a stop to change the order</p>
      </div>

      {waypoints.length === 0 && (
        <p className="rounded-md bg-cream/70 px-3 py-2 text-sm text-charcoal/60">
          Add waypoints from map clicks or search results.
        </p>
      )}

      <ul className="space-y-2">
        {waypoints.map((waypoint, index) => (
          <li
            key={waypoint.id}
            draggable
            onDragStart={() => setDraggingIndex(index)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => {
              if (draggingIndex === null) {
                return;
              }
              onReorder(draggingIndex, index);
              setDraggingIndex(null);
            }}
            onDragEnd={() => setDraggingIndex(null)}
            className="cursor-grab active:cursor-grabbing"
          >
            <WaypointItem
              waypoint={waypoint}
              index={index}
              onRename={onRename}
              onToggleRequired={onToggleRequired}
              onSetStart={onSetStart}
              onSetEnd={onSetEnd}
              onDelete={onDelete}
              onSetTimeWindow={onSetTimeWindow}
            />
          </li>
        ))}
      </ul>
    </Card>
  );
}
