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
        <h2 className="font-display text-base font-bold text-forest">Constraints</h2>
        <p className="text-xs text-charcoal/60">
          Set the rules your route has to respect.
        </p>
      </div>

      <div className="space-y-3">
        <Toggle
          checked={constraints.maxDistance.enabled}
          onChange={onToggleMaxDistance}
          label="Limit total distance"
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
          label="Use opening hours per stop"
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
        label="Keep my start and end points"
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
