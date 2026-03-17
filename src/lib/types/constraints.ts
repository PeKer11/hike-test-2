import type { TimeWindow } from "./waypoint";

export interface MaxDistanceConstraint {
  enabled: boolean;
  maxKm: number;
}

export interface TimeWindowConstraint {
  enabled: boolean;
  defaultWindow?: TimeWindow;
}

export interface StartEndConstraint {
  enabled: boolean;
}

export interface ConstraintSet {
  maxDistance: MaxDistanceConstraint;
  timeWindows: TimeWindowConstraint;
  fixedStartEnd: StartEndConstraint;
}

export const defaultConstraints: ConstraintSet = {
  maxDistance: {
    enabled: false,
    maxKm: 15,
  },
  timeWindows: {
    enabled: false,
  },
  fixedStartEnd: {
    enabled: false,
  },
};
