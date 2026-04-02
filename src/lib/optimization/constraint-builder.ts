import type {
  ConstraintSet,
  OrsOptimizationJob,
  OrsOptimizationRequest,
  Waypoint,
} from "@/lib/types";
import { toOrsCoord } from "@/lib/utils/geo";
import { timeToSeconds } from "@/lib/utils/time";

export interface ConstraintBuildResult {
  request: OrsOptimizationRequest;
  jobWaypointMap: Map<number, Waypoint>;
  startWaypoint?: Waypoint;
  endWaypoint?: Waypoint;
}

function getTimeWindowForWaypoint(
  waypoint: Waypoint,
  constraints: ConstraintSet,
): Array<[number, number]> | undefined {
  if (!constraints.timeWindows.enabled) {
    return undefined;
  }

  const activeWindow = waypoint.timeWindow ?? constraints.timeWindows.defaultWindow;
  if (!activeWindow) {
    return undefined;
  }

  const start = timeToSeconds(activeWindow.start);
  const end = timeToSeconds(activeWindow.end);

  if (start === null || end === null || start >= end) {
    return undefined;
  }

  return [[start, end]];
}

export function buildOptimizationRequest(
  waypoints: Waypoint[],
  constraints: ConstraintSet,
): ConstraintBuildResult {
  const explicitStartWaypoint = constraints.fixedStartEnd.enabled
    ? waypoints.find((waypoint) => waypoint.isStart)
    : undefined;
  const explicitEndWaypoint = constraints.fixedStartEnd.enabled
    ? waypoints.find((waypoint) => waypoint.isEnd)
    : undefined;
  const startWaypoint =
    explicitStartWaypoint ??
    (!constraints.fixedStartEnd.enabled && waypoints.length >= 3
      ? waypoints[0]
      : undefined);
  const endWaypoint = explicitEndWaypoint;

  const jobs: OrsOptimizationJob[] = [];
  const jobWaypointMap = new Map<number, Waypoint>();
  let nextJobId = 1;

  for (const waypoint of waypoints) {
    if (startWaypoint?.id === waypoint.id || endWaypoint?.id === waypoint.id) {
      continue;
    }

    const job: OrsOptimizationJob = {
      id: nextJobId,
      location: toOrsCoord(waypoint.coordinates),
      priority: waypoint.required ? 100 : 0,
    };

    const timeWindows = getTimeWindowForWaypoint(waypoint, constraints);
    if (timeWindows) {
      job.time_windows = timeWindows;
    }

    jobs.push(job);
    jobWaypointMap.set(nextJobId, waypoint);
    nextJobId += 1;
  }

  const vehicle = {
    id: 1,
    profile: "foot-walking" as const,
    start: startWaypoint ? toOrsCoord(startWaypoint.coordinates) : undefined,
    end: endWaypoint ? toOrsCoord(endWaypoint.coordinates) : undefined,
    max_distance: constraints.maxDistance.enabled
      ? Math.round(constraints.maxDistance.maxKm * 1000)
      : undefined,
  };

  return {
    request: {
      jobs,
      vehicles: [vehicle],
    },
    jobWaypointMap,
    startWaypoint,
    endWaypoint,
  };
}
