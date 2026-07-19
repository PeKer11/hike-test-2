import { getRtgTrails } from "@/lib/api/rtg-client";
import { fetchOsmHikingTrails } from "@/lib/api/osm-trails-client";
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
const PREFERRED_TRAILHEAD_DISTANCE_METERS = 1000;
const MAX_TRAIL_GAP_METERS = 500;
const DEFAULT_FALLBACK_DISTANCE_METERS = 2500;
const DEFAULT_DESIRED_ROUTE_COUNT = 1;
const MAX_DESIRED_ROUTE_COUNT = 5;
const AUTO_START_DISTANCE_BASE_METERS = 2200;
const AUTO_START_DISTANCE_STEP_METERS = 400;
const MALFORMED_TRAIL_WARNING =
  "RTG trail data is malformed or unusable for this request. Showing fallback route.";
const NON_OFFICIAL_DISCLAIMER =
  "No official RTG trail was found for this request. This is a general hiking suggestion, not an official recommendation, and final responsibility remains with you.";

let _waypointIdCounter = 0;
function createWaypointId(index: number): string {
  return `generated-${index}-${++_waypointIdCounter}`;
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
  if (!Array.isArray(trail.geometry) || trail.geometry.length < 3) {
    return false;
  }

  return trail.geometry.every((point) => isValidCoordinate(point));
}

function geometryGapPenalty(trail: RtgTrail): number {
  let largestGap = 0;

  for (let index = 1; index < trail.geometry.length; index += 1) {
    largestGap = Math.max(
      largestGap,
      haversineDistance(trail.geometry[index - 1], trail.geometry[index]),
    );
  }

  if (largestGap <= MAX_TRAIL_GAP_METERS) {
    return 1;
  }

  const overageRatio = Math.min(largestGap / MAX_TRAIL_GAP_METERS, 3);
  return Math.max(0, 1 - (overageRatio - 1) * 0.5);
}

function inferAreaLabel(point: Coordinates): string {
  if (point.lat > 31.6 && point.lng > 35.05) {
    return "jerusalem";
  }

  if (point.lat > 32.7) {
    return "north";
  }

  if (point.lat < 31.2) {
    return "south";
  }

  return "central";
}

function regionMatchScore(trail: RtgTrail, origin: Coordinates): number {
  const areaLabel = inferAreaLabel(origin);
  const region = trail.region.toLowerCase();

  if (region.includes(areaLabel)) {
    return 1;
  }

  if (areaLabel === "jerusalem" && region.includes("hills")) {
    return 0.85;
  }

  return 0.45;
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
  maxStartDistanceMeters: number,
  endpointDistance?: number,
): number {
  const targetDistance =
    request.targetDistanceMeters ?? request.preferences?.maxDistanceMeters;
  const effectiveMaxStartDistance = Math.max(
    maxStartDistanceMeters,
    PREFERRED_TRAILHEAD_DISTANCE_METERS + 1,
  );
  const proximityOrigin =
    originDistance <= PREFERRED_TRAILHEAD_DISTANCE_METERS
      ? 1
      : Math.max(
          0,
          1 -
            (originDistance - PREFERRED_TRAILHEAD_DISTANCE_METERS) /
              (effectiveMaxStartDistance - PREFERRED_TRAILHEAD_DISTANCE_METERS),
        );
  const proximityEndpoint =
    request.endpoint && endpointDistance !== undefined
      ? Math.max(0, 1 - endpointDistance / ENDPOINT_RADIUS_METERS)
      : 0.7;
  const fit = distanceFitScore(trail.lengthMeters, targetDistance);
  const difficulty = difficultyScore(trail, request.preferences?.difficulty);
  const completeness = geometryGapPenalty(trail);
  const regionMatch = regionMatchScore(trail, request.origin);

  return (
    proximityOrigin * 0.3 +
    proximityEndpoint * 0.2 +
    fit * 0.2 +
    completeness * 0.2 +
    regionMatch * 0.08 +
    difficulty * 0.02
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
    routeApproximated: true,
  };
}

function endpointDistancesFromOrigin(
  trail: RtgTrail,
  origin: Coordinates,
): [number, number] {
  const first = trail.geometry[0];
  const last = trail.geometry[trail.geometry.length - 1];
  return [haversineDistance(origin, first), haversineDistance(origin, last)];
}

function chooseGeometryOrientation(
  geometry: Coordinates[],
  origin: Coordinates,
  maxFinishDistanceFromOriginMeters?: number,
): Coordinates[] {
  const first = geometry[0];
  const last = geometry[geometry.length - 1];
  if (!first || !last) {
    return geometry;
  }

  const startDistanceForward = haversineDistance(origin, first);
  const finishDistanceForward = haversineDistance(origin, last);
  const startDistanceReverse = haversineDistance(origin, last);
  const finishDistanceReverse = haversineDistance(origin, first);

  if (maxFinishDistanceFromOriginMeters) {
    const forwardFits = finishDistanceForward <= maxFinishDistanceFromOriginMeters;
    const reverseFits = finishDistanceReverse <= maxFinishDistanceFromOriginMeters;

    if (forwardFits && !reverseFits) {
      return geometry;
    }

    if (reverseFits && !forwardFits) {
      return [...geometry].reverse();
    }
  }

  return startDistanceForward <= startDistanceReverse ? geometry : [...geometry].reverse();
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

function endpointWithinFinishLimit(
  origin: Coordinates,
  endpoint: Coordinates,
  maxFinishDistanceFromOriginMeters?: number,
): Coordinates {
  if (
    !maxFinishDistanceFromOriginMeters ||
    haversineDistance(origin, endpoint) <= maxFinishDistanceFromOriginMeters
  ) {
    return endpoint;
  }

  const ratio =
    maxFinishDistanceFromOriginMeters /
    Math.max(haversineDistance(origin, endpoint), 1);

  return {
    lat: origin.lat + (endpoint.lat - origin.lat) * ratio,
    lng: origin.lng + (endpoint.lng - origin.lng) * ratio,
  };
}

function waypointsFromGeometry(
  geometry: Coordinates[],
  prefix: string,
  names: [string, string, string],
  origin: Coordinates,
  maxFinishDistanceFromOriginMeters?: number,
): Waypoint[] | null {
  if (geometry.length < 3 || !geometry.every((point) => isValidCoordinate(point))) {
    return null;
  }

  const orientedGeometry = chooseGeometryOrientation(
    geometry,
    origin,
    maxFinishDistanceFromOriginMeters,
  );
  const first = orientedGeometry[0];
  const middle = orientedGeometry[Math.floor((orientedGeometry.length - 1) / 2)];
  const last = orientedGeometry[orientedGeometry.length - 1];

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
  const maxFinishDistanceFromOriginMeters =
    request.preferences?.maxFinishDistanceFromOriginMeters;
  const endpoint = endpointWithinFinishLimit(
    request.origin,
    request.endpoint ?? buildFallbackEndpoint(request.origin),
    maxFinishDistanceFromOriginMeters,
  );
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

function buildConstraintHints(request: HikeSearchRequest): string[] {
  const hints: string[] = [];

  if (request.preferences?.maxDistanceMeters) {
    hints.push(
      "Try increasing the max distance constraint by 20-40% to unlock more candidate trails.",
    );
  }

  if (request.preferences?.maxStartDistanceMeters) {
    hints.push(
      "Try increasing the max start distance constraint so nearby RTG trails can be considered.",
    );
  }

  if ((request.preferences?.desiredRouteCount ?? DEFAULT_DESIRED_ROUTE_COUNT) > 1) {
    hints.push(
      "If options remain limited, reduce the nearby route count request to focus on the strongest match.",
    );
  }

  if (request.endpoint) {
    hints.push(
      "Try removing the endpoint constraint temporarily to expand the RTG trail search area.",
    );
  }

  if (request.targetDistanceMeters) {
    hints.push(
      "Try relaxing the target finish distance requirement to allow near-match trail suggestions.",
    );
  }

  if (request.preferences?.maxFinishDistanceFromOriginMeters) {
    hints.push(
      "Try increasing the finish-distance-from-origin constraint to allow more feasible route endings.",
    );
  }

  hints.push(
    "If results are limited, move the origin marker slightly toward nearby marked trails and try again.",
  );

  return hints;
}

function buildFallbackMessages(
  request: HikeSearchRequest,
  candidates: HikeCandidate[],
): { fallbackReason: string; guidance: string[] } {
  const bestCandidate = candidates[0];
  const guidance = buildConstraintHints(request);

  if (bestCandidate?.trail) {
    const proximity = Math.round(distanceToTrail(request.origin, bestCandidate.trail));
    return {
      fallbackReason:
        `Could not build a complete walking route from the top RTG candidate "${bestCandidate.trail.name}". ` +
        `Nearest candidate trail point is about ${proximity}m from your origin.`,
      guidance,
    };
  }

  return {
    fallbackReason:
      "No RTG trail candidate matched the current constraints closely enough to build a route.",
    guidance,
  };
}

function clampDesiredRouteCount(value?: number): number {
  if (!Number.isInteger(value)) {
    return DEFAULT_DESIRED_ROUTE_COUNT;
  }

  return Math.min(Math.max(value ?? 1, 1), MAX_DESIRED_ROUTE_COUNT);
}

function resolveDesiredRouteCount(request: HikeSearchRequest): number {
  return clampDesiredRouteCount(request.preferences?.desiredRouteCount);
}

function resolveMaxStartDistanceMeters(request: HikeSearchRequest): number {
  if (request.preferences?.maxStartDistanceMeters) {
    return request.preferences.maxStartDistanceMeters;
  }

  const desiredRouteCount = resolveDesiredRouteCount(request);
  const recommended =
    AUTO_START_DISTANCE_BASE_METERS +
    (desiredRouteCount - 1) * AUTO_START_DISTANCE_STEP_METERS;

  return Math.min(Math.max(recommended, PREFERRED_TRAILHEAD_DISTANCE_METERS), ORIGIN_RADIUS_METERS);
}

export function findHikeCandidates(
  request: HikeSearchRequest,
  trails: RtgTrail[],
): HikeCandidate[] {
  const maxStartDistanceMeters = resolveMaxStartDistanceMeters(request);
  const maxFinishDistanceFromOriginMeters =
    request.preferences?.maxFinishDistanceFromOriginMeters;

  return trails
    .filter((trail) => hasValidTrailGeometry(trail))
    .filter((trail) => matchesMaxDistance(trail, request))
    .map((trail) => {
      const originDistance = distanceToTrail(request.origin, trail);
      const endpointDistance = request.endpoint
        ? distanceToTrail(request.endpoint, trail)
        : undefined;
      const [firstEndpointDistance, lastEndpointDistance] = endpointDistancesFromOrigin(
        trail,
        request.origin,
      );
      const minFinishDistance = Math.min(firstEndpointDistance, lastEndpointDistance);

      return {
        trail,
        originDistance,
        endpointDistance,
        minFinishDistance,
      };
    })
    .filter(({ originDistance, endpointDistance, minFinishDistance }) => {
      if (originDistance > maxStartDistanceMeters) {
        return false;
      }
      if (
        maxFinishDistanceFromOriginMeters &&
        minFinishDistance > maxFinishDistanceFromOriginMeters
      ) {
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
        scoreTrail(
          trail,
          request,
          originDistance,
          maxStartDistanceMeters,
          endpointDistance,
        ),
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
  const [rtgTrails, osmTrails] = await Promise.allSettled([
    getRtgTrails(),
    fetchOsmHikingTrails(request.origin),
  ]);

  const trails: RtgTrail[] = [
    ...(rtgTrails.status === "fulfilled" ? rtgTrails.value : []),
    ...(osmTrails.status === "fulfilled" ? osmTrails.value : []),
  ];

  const candidates = findHikeCandidates(request, trails);
  const desiredRouteCount = resolveDesiredRouteCount(request);

  for (let index = 0; index < candidates.length; index += 1) {
    const selected = candidates[index];
    const maxFinishDistanceFromOriginMeters =
      request.preferences?.maxFinishDistanceFromOriginMeters;
    const selectedWaypoints = waypointsFromGeometry(
      selected.geometry,
      "rtg",
      ["RTG start", "RTG midpoint", "RTG finish"],
      request.origin,
      maxFinishDistanceFromOriginMeters,
    );
    if (!selectedWaypoints) {
      continue;
    }

    try {
      const route = await buildRouteFromWaypoints(selectedWaypoints, baseConstraints);
      const alternates = candidates
        .filter((_, candidateIndex) => candidateIndex !== index)
        .slice(0, Math.max(0, desiredRouteCount - 1));
      const autoStartDistance = resolveMaxStartDistanceMeters(request);
      const alternateSummary =
        alternates.length > 0
          ? `Nearby alternatives: ${alternates
              .map((alternate) => `${alternate.trail?.name ?? "Unnamed trail"} (${Math.round(alternate.distanceMeters / 100) / 10} km)`)
              .join(", ")}.`
          : "";

      return {
        selected,
        alternates,
        route: {
          ...route,
          source: "rtg",
          sourceLabel:
            selected.trail?.source === "osm-hiking"
              ? "OpenStreetMap Hiking Route (path approximated)"
              : selected.trail?.source === "rtg-official"
              ? "RTG-Guided Route (path approximated)"
              : "RTG-Guided Route (curated trail, path approximated)",
          warnings: [
            ...route.warnings,
            selected.trail?.source === "rtg-official"
              ? "Route path is generated by ORS between RTG trail points and may not exactly follow the official marked trail."
              : "Route path is generated by ORS from a curated RTG-style trail dataset and may not exactly follow the official marked trail.",
            request.preferences?.maxStartDistanceMeters
              ? `Applied start-distance constraint: up to ${(request.preferences.maxStartDistanceMeters / 1000).toFixed(1)} km from your location.`
              : `Applied automatic start-distance filter: up to ${(autoStartDistance / 1000).toFixed(1)} km from your location.`,
            ...(request.preferences?.maxFinishDistanceFromOriginMeters
              ? [
                  `Applied finish-distance constraint: route ending kept within ${(request.preferences.maxFinishDistanceFromOriginMeters / 1000).toFixed(1)} km of your location.`,
                ]
              : []),
            ...(alternateSummary ? [alternateSummary] : []),
          ],
        },
      };
    } catch {
      continue;
    }
  }

  const fallbackReason =
    candidates.length > 0
      ? MALFORMED_TRAIL_WARNING
      : "No RTG trail candidate matched the current constraints.";
  const fallbackMessages = buildFallbackMessages(request, candidates);
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
      routeApproximated: false,
    },
    route: {
      ...fallbackRoute,
      source: "fallback",
      sourceLabel: "Suggested route (no official RTG trail found)",
      warnings: Array.from(
        new Set([
          ...fallbackRoute.warnings,
          NON_OFFICIAL_DISCLAIMER,
          fallbackReason,
          fallbackMessages.fallbackReason,
          ...fallbackMessages.guidance,
        ]),
      ),
    },
    fallbackReason,
  };
}
