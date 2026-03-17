"use client";

import { Button, Card, LoadingSpinner, Toggle } from "@/components/ui";
import type { ConstraintSet, TimeWindow } from "@/lib/types";

import { MaxDistanceInput } from "./MaxDistanceInput";
import { TimeWindowInput } from "./TimeWindowInput";

interface ConstraintPanelProps {
  constraints: ConstraintSet;
  isCalculating: boolean;
  onToggleMaxDistance: () => void;
  onSetMaxDistanceKm: (value: number) => void;
  onToggleTimeWindows: () => void;
  onSetDefaultTimeWindow: (value?: TimeWindow) => void;
  onToggleFixedStartEnd: () => void;
  onCalculateRoute: () => void;
}

export function ConstraintPanel({
  constraints,
  isCalculating,
  onToggleMaxDistance,
  onSetMaxDistanceKm,
  onToggleTimeWindows,
  onSetDefaultTimeWindow,
  onToggleFixedStartEnd,
  onCalculateRoute,
}: ConstraintPanelProps) {
  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-slate-900">Constraints</h2>
        <p className="text-xs text-slate-500">
          Configure optimization conditions before route calculation.
        </p>
      </div>

      <div className="space-y-3">
        <Toggle
          checked={constraints.maxDistance.enabled}
          onChange={onToggleMaxDistance}
          label="Enable max distance"
        />
        {constraints.maxDistance.enabled && (
          <MaxDistanceInput
            value={constraints.maxDistance.maxKm}
            onChange={onSetMaxDistanceKm}
          />
        )}
      </div>

      <div className="space-y-3">
        <Toggle
          checked={constraints.timeWindows.enabled}
          onChange={onToggleTimeWindows}
          label="Enable time windows"
        />
        {constraints.timeWindows.enabled && (
          <TimeWindowInput
            value={constraints.timeWindows.defaultWindow}
            onChange={onSetDefaultTimeWindow}
          />
        )}
      </div>

      <Toggle
        checked={constraints.fixedStartEnd.enabled}
        onChange={onToggleFixedStartEnd}
        label="Respect Start/End markers"
      />

      <Button onClick={onCalculateRoute} fullWidth disabled={isCalculating}>
        {isCalculating ? (
          <span className="inline-flex items-center gap-2">
            <LoadingSpinner size="sm" />
            Calculating...
          </span>
        ) : (
          "Calculate Route"
        )}
      </Button>
    </Card>
  );
}
