import { getRtgTrails } from "@/lib/api/rtg-client";
import { defaultConstraints } from "@/lib/types";
import type {
  CalculatedRoute,
  ConstraintSet,
  Coordinates,
  HikeCandidate,
  HikeSearchRequest,
  HikeSearchResult,
  RtgTrail,
  Waypoint,
} from "@/lib/types";
import { haversineDistance } from "@/lib/utils/geo";

import { planRoute } from "./route-planner";

const ORIGIN_RADIUS_METERS = 6000;
const ENDPOINT_RADIUS_METERS = 2500;
const DEFAULT_FALLBACK_DISTANCE_METERS = 2500;
const MAX_ALTERNATES = 2;
const MALFORMED_TRAIL_WARNING =
  "Official RTG trail data is malformed or unusable for this request. Showing fallback route.";

function createWaypointId(index: number): string {
  return `generated-${index}-${Date.now()}`;
}

function distanceToTrail(point: Coordinates, trail: RtgTrail): number {
  return trail.geometry.reduce((minDistance, segmentPoint) => {
    const current = haversineDistance(point, segmentPoint);
    return Math.min(minDistance, current);
  }, Number.POSITIVE_INFINITY);
}

function isValidCoordinate(point: Coordinates | undefined): point is Coordinates {
  if (!point) {
    return false;
  }

  return (
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng) &&
    point.lat >= -90 &&
    point.lat <= 90 &&
    point.lng >= -180 &&
    point.lng <= 180
  );
}

function hasValidTrailGeometry(trail: RtgTrail): boolean {
  if (!Array.isArray(trail.geometry) || trail.geometry.length < 2) {
    return false;
  }

  return trail.geometry.every((point) => isValidCoordinate(point));
}

function distanceFitScore(distanceMeters: number, targetMeters?: number): number {
  if (!targetMeters) {
    return 0.7;
  }

  const delta = Math.abs(distanceMeters - targetMeters);
  const ratio = Math.min(delta / Math.max(targetMeters, 1), 1);
  return 1 - ratio;
}

function difficultyScore(trail: RtgTrail, preference?: string): number {
  if (!preference || !trail.difficulty) {
    return 0.6;
  }

  return trail.difficulty.toLowerCase() === preference.toLowerCase() ? 1 : 0.3;
}

function scoreTrail(
  trail: RtgTrail,
  request: HikeSearchRequest,
  originDistance: number,
  endpointDistance?: number,
): number {
  const targetDistance =
    request.targetDistanceMeters ?? request.preferences?.maxDistanceMeters;
  const proximityOrigin = Math.max(0, 1 - originDistance / ORIGIN_RADIUS_METERS);
  const proximityEndpoint =
    request.endpoint && endpointDistance !== undefined
      ? Math.max(0, 1 - endpointDistance / ENDPOINT_RADIUS_METERS)
      : 0.7;
  const fit = distanceFitScore(trail.lengthMeters, targetDistance);
  const difficulty = difficultyScore(trail, request.preferences?.difficulty);

  return (
    proximityOrigin * 0.35 +
    proximityEndpoint * 0.3 +
    fit * 0.25 +
    difficulty * 0.1
  );
}

function matchesMaxDistance(trail: RtgTrail, request: HikeSearchRequest): boolean {
  const maxDistance = request.preferences?.maxDistanceMeters;
  if (!maxDistance) {
    return true;
  }

  return trail.lengthMeters <= maxDistance * 1.1;
}

function toCandidate(trail: RtgTrail, score: number): HikeCandidate {
  return {
    trail,
    source: "rtg",
    geometry: trail.geometry,
    distanceMeters: trail.lengthMeters,
    score,
  };
}

function buildFallbackEndpoint(origin: Coordinates): Coordinates {
  // Approximate 1 degree lat ~ 111.32km, lng depends on latitude.
  const latOffset = DEFAULT_FALLBACK_DISTANCE_METERS / 111_320;
  const lngOffset =
    DEFAULT_FALLBACK_DISTANCE_METERS /
    (111_320 * Math.max(Math.cos((origin.lat * Math.PI) / 180), 0.1));

  return {
    lat: origin.lat + latOffset,
    lng: origin.lng + lngOffset,
  };
}

function waypointsFromGeometry(
  geometry: Coordinates[],
  prefix: string,
  names: [string, string, string],
): Waypoint[] | null {
  if (geometry.length < 2 || !geometry.every((point) => isValidCoordinate(point))) {
    return null;
  }

  const first = geometry[0];
  const middle = geometry[Math.floor((geometry.length - 1) / 2)];
  const last = geometry[geometry.length - 1];

  if (!isValidCoordinate(first) || !isValidCoordinate(middle) || !isValidCoordinate(last)) {
    return null;
  }

  return [
    {
      id: `${prefix}-${createWaypointId(1)}`,
      name: names[0],
      coordinates: first,
      required: true,
      isStart: true,
      isEnd: false,
    },
    {
      id: `${prefix}-${createWaypointId(2)}`,
      name: names[1],
      coordinates: middle,
      required: false,
      isStart: false,
      isEnd: false,
    },
    {
      id: `${prefix}-${createWaypointId(3)}`,
      name: names[2],
      coordinates: last,
      required: true,
      isStart: false,
      isEnd: true,
    },
  ];
}

function fallbackWaypoints(request: HikeSearchRequest): Waypoint[] {
  const endpoint = request.endpoint ?? buildFallbackEndpoint(request.origin);
  const midpoint: Coordinates = {
    lat: (request.origin.lat + endpoint.lat) / 2,
    lng: (request.origin.lng + endpoint.lng) / 2 + 0.002,
  };

  return [
    {
      id: `fallback-${createWaypointId(1)}`,
      name: "Origin",
      coordinates: request.origin,
      required: true,
      isStart: true,
      isEnd: false,
    },
    {
      id: `fallback-${createWaypointId(2)}`,
      name: "Scenic midpoint",
      coordinates: midpoint,
      required: false,
      isStart: false,
      isEnd: false,
    },
    {
      id: `fallback-${createWaypointId(3)}`,
      name: request.endpoint ? "Endpoint" : "Suggested finish",
      coordinates: endpoint,
      required: true,
      isStart: false,
      isEnd: true,
    },
  ];
}

export function findHikeCandidates(
  request: HikeSearchRequest,
  trails: RtgTrail[],
): HikeCandidate[] {
  return trails
    .filter((trail) => hasValidTrailGeometry(trail))
    .filter((trail) => matchesMaxDistance(trail, request))
    .map((trail) => {
      const originDistance = distanceToTrail(request.origin, trail);
      const endpointDistance = request.endpoint
        ? distanceToTrail(request.endpoint, trail)
        : undefined;

      return {
        trail,
        originDistance,
        endpointDistance,
      };
    })
    .filter(({ originDistance, endpointDistance }) => {
      if (originDistance > ORIGIN_RADIUS_METERS) {
        return false;
      }
      if (request.endpoint && endpointDistance !== undefined) {
        return endpointDistance <= ENDPOINT_RADIUS_METERS;
      }
      return true;
    })
    .map(({ trail, originDistance, endpointDistance }) =>
      toCandidate(
        trail,
        scoreTrail(trail, request, originDistance, endpointDistance),
      ),
    )
    .sort((a, b) => b.score - a.score);
}

async function buildRouteFromWaypoints(
  waypoints: Waypoint[],
  baseConstraints?: ConstraintSet,
): Promise<CalculatedRoute> {
  const constraints = baseConstraints ?? defaultConstraints;
  const route = await planRoute({ waypoints, constraints });
  return route;
}

export async function searchBestHike(
  request: HikeSearchRequest,
  baseConstraints?: ConstraintSet,
): Promise<HikeSearchResult> {
  const trails = await getRtgTrails();
  const candidates = findHikeCandidates(request, trails);

  for (let index = 0; index < candidates.length; index += 1) {
    const selected = candidates[index];
    const selectedWaypoints = waypointsFromGeometry(
      selected.geometry,
      "rtg",
      ["RTG start", "RTG midpoint", "RTG finish"],
    );
    if (!selectedWaypoints) {
      continue;
    }

    try {
      const route = await buildRouteFromWaypoints(selectedWaypoints, baseConstraints);
      const alternates = candidates
        .filter((_, candidateIndex) => candidateIndex !== index)
        .slice(0, MAX_ALTERNATES);

      return {
        selected,
        alternates,
        route: {
          ...route,
          source: "rtg",
          sourceLabel: "Official RTG trail",
        },
      };
    } catch {
      continue;
    }
  }

  const fallbackReason =
    candidates.length > 0
      ? MALFORMED_TRAIL_WARNING
      : "No official RTG trail found for these constraints. Showing a suggested fallback route.";
  const fallback = fallbackWaypoints(request);
  const fallbackRoute = await buildRouteFromWaypoints(fallback, baseConstraints);
  const fallbackDistance = fallbackRoute.totalDistanceMeters;

  return {
    selected: {
      trail: null,
      source: "fallback",
      geometry: fallbackRoute.geometry,
      distanceMeters: fallbackDistance,
      score: 0,
    },
    route: {
      ...fallbackRoute,
      source: "fallback",
      sourceLabel: "Suggested route (no official RTG trail found)",
      warnings: [...fallbackRoute.warnings, fallbackReason],
    },
    fallbackReason,
  };
}
