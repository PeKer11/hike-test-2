"use client";

import { useState } from "react";

import type { ConstraintSet, TimeWindow } from "@/lib/types";
import { defaultConstraints } from "@/lib/types";

export function useConstraints(initialConstraints: ConstraintSet = defaultConstraints) {
  const [constraints, setConstraints] = useState<ConstraintSet>(initialConstraints);

  const toggleMaxDistance = () => {
    setConstraints((current) => ({
      ...current,
      maxDistance: {
        ...current.maxDistance,
        enabled: !current.maxDistance.enabled,
      },
    }));
  };

  const setMaxDistanceKm = (maxKm: number) => {
    setConstraints((current) => ({
      ...current,
      maxDistance: {
        ...current.maxDistance,
        maxKm,
      },
    }));
  };

  const toggleTimeWindows = () => {
    setConstraints((current) => ({
      ...current,
      timeWindows: {
        ...current.timeWindows,
        enabled: !current.timeWindows.enabled,
      },
    }));
  };

  const setDefaultTimeWindow = (timeWindow?: TimeWindow) => {
    setConstraints((current) => ({
      ...current,
      timeWindows: {
        ...current.timeWindows,
        defaultWindow: timeWindow,
      },
    }));
  };

  const toggleFixedStartEnd = () => {
    setConstraints((current) => ({
      ...current,
      fixedStartEnd: {
        enabled: !current.fixedStartEnd.enabled,
      },
    }));
  };

  const resetConstraints = () => {
    setConstraints(defaultConstraints);
  };

  return {
    constraints,
    setConstraints,
    toggleMaxDistance,
    setMaxDistanceKm,
    toggleTimeWindows,
    setDefaultTimeWindow,
    toggleFixedStartEnd,
    resetConstraints,
  };
}
