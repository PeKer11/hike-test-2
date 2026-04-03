import type {
  CalculatedRoute,
  ConstraintSet,
  Coordinates,
  OrsDirectionsResponse,
  OrsOptimizationResponse,
  RouteSegment,
  RouteStep,
  Waypoint,
} from "@/lib/types";
import { buildOptimizationRequest } from "@/lib/optimization/constraint-builder";
import { toOrsCoord } from "@/lib/utils/geo";
import { decodePolyline } from "@/lib/utils/polyline";

interface PlanRouteInput {
  waypoints: Waypoint[];
  constraints: ConstraintSet;
}

interface ApiErrorResponse {
  error?: string;
}

function hasActiveConstraints(constraints: ConstraintSet): boolean {
  return (
    constraints.maxDistance.enabled ||
    constraints.timeWindows.enabled ||
    constraints.fixedStartEnd.enabled
  );
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => ({}))) as ApiErrorResponse;
    throw new Error(errorBody.error ?? `Request failed (${response.status})`);
  }

  return (await response.json()) as T;
}

function getWaypointOrderFromOptimization(
  optimization: OrsOptimizationResponse,
  waypoints: Waypoint[],
  constraints: ConstraintSet,
): Waypoint[] {
  const { jobWaypointMap, startWaypoint, endWaypoint } = buildOptimizationRequest(
    waypoints,
    constraints,
  );
  const steps = optimization.routes[0]?.steps ?? [];
  const ordered: Waypoint[] = [];

  for (const step of steps) {
    if (step.type === "start" && startWaypoint) {
      ordered.push(startWaypoint);
      continue;
    }

    if (step.type === "job") {
      const waypoint = jobWaypointMap.get(step.id);
      if (waypoint) {
        ordered.push(waypoint);
      }
      continue;
    }

    if (step.type === "end" && endWaypoint) {
      ordered.push(endWaypoint);
    }
  }

  if (ordered.length >= 2) {
    return ordered;
  }

  return waypoints;
}

function toRouteSteps(directions: OrsDirectionsResponse): RouteStep[] {
  const firstRoute = directions.routes[0];
  if (!firstRoute) {
    return [];
  }

  return firstRoute.segments.flatMap((segment) =>
    segment.steps.map((step) => ({
      instruction: step.instruction,
      distanceMeters: step.distance,
      durationSeconds: step.duration,
    })),
  );
}

async function getDirectionsBetween(
  from: Waypoint,
  to: Waypoint,
): Promise<OrsDirectionsResponse> {
  return postJson<OrsDirectionsResponse>("/api/directions", {
    profile: "foot-walking",
    instructions: true,
    coordinates: [toOrsCoord(from.coordinates), toOrsCoord(to.coordinates)],
  });
}

function aggregateGeometry(segments: RouteSegment[]): Coordinates[] {
  const geometry: Coordinates[] = [];

  for (const segment of segments) {
    for (let index = 0; index < segment.geometry.length; index += 1) {
      const point = segment.geometry[index];
      const isFirstPointOfSegment = index === 0;
      const lastPoint = geometry[geometry.length - 1];

      if (
        isFirstPointOfSegment &&
        lastPoint &&
        lastPoint.lat === point.lat &&
        lastPoint.lng === point.lng
      ) {
        continue;
      }

      geometry.push(point);
    }
  }

  return geometry;
}

async function calculateViaDirections(waypoints: Waypoint[]): Promise<CalculatedRoute> {
  const directions = await postJson<OrsDirectionsResponse>("/api/directions", {
    profile: "foot-walking",
    instructions: true,
    coordinates: waypoints.map((waypoint) => toOrsCoord(waypoint.coordinates)),
  });

  const route = directions.routes[0];
  if (!route) {
    throw new Error(
      "No walking route found between these locations. Try moving waypoints closer to a road or trail.",
    );
  }

  const geometry = decodePolyline(route.geometry);
  const segmentSummaries = route.segments;
  const wayPointIndices = route.way_points;
  const segments: RouteSegment[] = [];

  for (let index = 0; index < waypoints.length - 1; index += 1) {
    const segment = segmentSummaries[index];
    const startIdx = wayPointIndices[index] ?? 0;
    const endIdx = wayPointIndices[index + 1] ?? geometry.length - 1;
    segments.push({
      from: waypoints[index],
      to: waypoints[index + 1],
      distanceMeters: segment?.distance ?? 0,
      durationSeconds: segment?.duration ?? 0,
      geometry: geometry.slice(startIdx, endIdx + 1),
      steps:
        segment?.steps.map((step) => ({
          instruction: step.instruction,
          distanceMeters: step.distance,
          durationSeconds: step.duration,
        })) ?? [],
    });
  }

  return {
    orderedWaypoints: waypoints,
    segments,
    geometry,
    totalDistanceMeters: route.summary.distance,
    totalDurationSeconds: route.summary.duration,
    warnings: [],
  };
}

async function calculateViaOptimization(
  waypoints: Waypoint[],
  constraints: ConstraintSet,
): Promise<CalculatedRoute> {
  const optimizationRequest = buildOptimizationRequest(waypoints, constraints);

  if (
    optimizationRequest.request.jobs.length === 0 &&
    constraints.fixedStartEnd.enabled &&
    optimizationRequest.startWaypoint &&
    optimizationRequest.endWaypoint
  ) {
    return calculateViaDirections([
      optimizationRequest.startWaypoint,
      optimizationRequest.endWaypoint,
    ]);
  }

  const optimizationResponse = await postJson<OrsOptimizationResponse>(
    "/api/optimization",
    optimizationRequest.request,
  );

  const orderedWaypoints = getWaypointOrderFromOptimization(
    optimizationResponse,
    waypoints,
    constraints,
  );

  if (orderedWaypoints.length < 2) {
    throw new Error("Not enough optimized waypoints to build a route.");
  }

  const segments: RouteSegment[] = [];
  const warnings: string[] = [];

  if (optimizationResponse.unassigned.length) {
    warnings.push(
      `${optimizationResponse.unassigned.length} waypoint(s) could not be assigned due to constraints.`,
    );
  }

  for (let index = 0; index < orderedWaypoints.length - 1; index += 1) {
    const from = orderedWaypoints[index];
    const to = orderedWaypoints[index + 1];

    let directions: OrsDirectionsResponse;
    try {
      directions = await getDirectionsBetween(from, to);
    } catch {
      warnings.push(
        `Could not get directions from "${from.name}" to "${to.name}". Segment skipped.`,
      );
      continue;
    }

    const route = directions.routes[0];
    if (!route) {
      warnings.push(
        `No walking route found between "${from.name}" and "${to.name}". Try moving that waypoint closer to a path.`,
      );
      continue;
    }

    segments.push({
      from,
      to,
      distanceMeters: route.summary.distance,
      durationSeconds: route.summary.duration,
      geometry: decodePolyline(route.geometry),
      steps: toRouteSteps(directions),
    });
  }

  if (segments.length === 0) {
    throw new Error(
      "No walking route could be generated for the optimized waypoint order. Try moving waypoints closer to a road or trail.",
    );
  }

  const totalDistanceMeters = segments.reduce(
    (sum, segment) => sum + segment.distanceMeters,
    0,
  );
  const totalDurationSeconds = segments.reduce(
    (sum, segment) => sum + segment.durationSeconds,
    0,
  );

  return {
    orderedWaypoints,
    segments,
    geometry: aggregateGeometry(segments),
    totalDistanceMeters,
    totalDurationSeconds,
    warnings,
  };
}

export async function planRoute({
  waypoints,
  constraints,
}: PlanRouteInput): Promise<CalculatedRoute> {
  if (waypoints.length < 2) {
    throw new Error("Add at least two waypoints before calculating a route.");
  }

  const shouldOptimize = waypoints.length >= 3 || hasActiveConstraints(constraints);
  if (!shouldOptimize) {
    return calculateViaDirections(waypoints);
  }

  return calculateViaOptimization(waypoints, constraints);
}
