import "server-only";

import { OrsNoRouteError } from "@/lib/walk/ors-errors";
import type {
  OrsDirectionsRequest,
  OrsDirectionsResponse,
  OrsMatrixRequest,
  OrsMatrixResponse,
  OrsOptimizationRequest,
  OrsOptimizationResponse,
} from "@/lib/types";
import { appUserAgent } from "./http-identity";

// api.openrouteservice.org is deprecated (10x lower quota, shut-off planned early Nov 2026); directions and matrix live on heigit.
const ORS_BASE_URL = "https://api.heigit.org/openrouteservice";

function parseOrsError(errorText: string, status: number): string {
  let normalizedError = errorText.toLowerCase();

  try {
    const parsedError = JSON.parse(errorText) as {
      error?: { message?: string; code?: number } | string;
      message?: string;
    };
    // ORS sends route-not-found (2009) and point-not-found (2010) as HTTP 404, so the code must win over the 404 branch below.
    const code = typeof parsedError.error === "object" ? parsedError.error?.code : undefined;
    if (code === 2009) return "No valid route could be found with these constraints. Try relaxing the constraints.";
    if (code === 2010) return "One or more waypoints are too far from a walkable road or trail. Move them closer to a path and try again.";
    const errorMessage = (typeof parsedError.error === "object" ? parsedError.error?.message : parsedError.error) ?? parsedError.message;

    if (errorMessage) {
      normalizedError = errorMessage.toLowerCase();
    }
  } catch {
    // Fall back to plain-text matching when ORS does not return structured JSON.
  }

  if (status === 429) {
    return "Routing rate limit reached.";
  }

  if (status === 403 && normalizedError.includes("quota")) {
    return "Routing quota exceeded.";
  }

  if (status === 401 || status === 403) {
    return "API key is missing or invalid.";
  }

  if (status === 404) {
    return "Routing service endpoint not found.";
  }

  if (
    normalizedError.includes("not routable") ||
    normalizedError.includes("could not find routable point") ||
    normalizedError.includes("could not find routable") ||
    normalizedError.includes("no routable point")
  ) {
    return "One or more waypoints are too far from a walkable road or trail. Move them closer to a path and try again.";
  }

  if (normalizedError.includes("no solution")) {
    return "No valid route could be found with these constraints. Try relaxing the constraints.";
  }

  return "Routing service error. Please try again.";
}

function getApiKey(): string {
  const key = process.env.ORS_API_KEY;
  if (!key) {
    throw new Error("ORS_API_KEY is not configured.");
  }

  return key;
}

// A hung ORS call must not hold a whole walk build open: Overpass already has
// its own per-mirror timeouts, ORS had none.
export const ORS_TIMEOUT_MS = 15_000;

async function fetchOrs<T>(
  url: string,
  body: unknown,
  init?: RequestInit,
): Promise<T> {
  // AbortController + setTimeout rather than AbortSignal.timeout: fake timers
  // can drive this one.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ORS_TIMEOUT_MS);

  try {
    const send = () =>
      fetch(url, {
        method: "POST",
        headers: {
          Authorization: getApiKey(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        ...init,
        signal: init?.signal ?? controller.signal,
      });
    let response = await send();
    // One short retry for a rate-limit or server blip (honouring Retry-After, capped), not an endless loop.
    if (response.status === 429 || response.status >= 500) {
      const retryAfter = Number(response.headers?.get?.("Retry-After"));
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, 3_000) : 1_000;
      await response.body?.cancel?.().catch(() => {});
      await new Promise((r) => setTimeout(r, waitMs));
      response = await send();
    }

    if (!response.ok) {
      const errorText = await response.text();
      const message = parseOrsError(errorText, response.status);
      throw message.startsWith("One or more waypoints") || message.startsWith("No valid route") ? new OrsNoRouteError(message) : new Error(message);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

const OSRM_FOOT_URL = "https://routing.openstreetmap.de/routed-foot/route/v1/foot";
const OSRM_TIMEOUT_MS = 8_000;
// ORS has been seen hanging for the full ORS_TIMEOUT_MS; start the OSRM backup
// after this long (or as soon as ORS fails) and let the first good answer win.
const OSRM_HEDGE_DELAY_MS = 4_000;

interface OsrmStep {
  distance: number;
  duration: number;
  name?: string;
  maneuver?: { type?: string; modifier?: string };
}

interface OsrmResponse {
  code?: string;
  routes?: Array<{
    geometry: string;
    distance: number;
    duration: number;
    legs: Array<{ distance: number; duration: number; steps: OsrmStep[] }>;
  }>;
  waypoints?: Array<{ location: [number, number] }>;
}

// Encoded-polyline (precision 5) decoder; returns [lng, lat] pairs.
function decodePolyline(encoded: string): Array<[number, number]> {
  const points: Array<[number, number]> = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  const readValue = (): number => {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };

  while (index < encoded.length) {
    lat += readValue();
    lng += readValue();
    points.push([lng / 1e5, lat / 1e5]);
  }
  return points;
}

function describeOsrmStep(step: OsrmStep): string {
  const type = step.maneuver?.type ?? "continue";
  const modifier = step.maneuver?.modifier;
  const onto = step.name ? ` onto ${step.name}` : "";

  if (type === "depart") return `Head ${modifier ?? "out"}${onto}`;
  if (type === "arrive") return "Arrive at your destination";
  if (modifier) return `Turn ${modifier}${onto}`;
  return `Continue${onto}`;
}

async function getOsrmFootDirections(
  coordinates: OrsDirectionsRequest["coordinates"],
): Promise<OrsDirectionsResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OSRM_TIMEOUT_MS);

  try {
    const path = coordinates.map(([lng, lat]) => `${lng},${lat}`).join(";");
    const response = await fetch(
      `${OSRM_FOOT_URL}/${path}?overview=full&geometries=polyline&steps=true`,
      { cache: "no-store", signal: controller.signal, headers: { "User-Agent": appUserAgent() } },
    );
    if (!response.ok) {
      throw new Error("Fallback routing service error.");
    }

    const data = (await response.json()) as OsrmResponse;
    const route = data.routes?.[0];
    if (data.code !== "Ok" || !route) {
      throw new Error("Fallback routing found no route.");
    }

    // ORS way_points are indices into the decoded geometry; OSRM gives snapped
    // waypoint locations, so map each to the nearest geometry point at or after
    // the previous one.
    const line = decodePolyline(route.geometry);
    const wayPoints: number[] = [];
    let from = 0;
    for (const waypoint of data.waypoints ?? []) {
      let best = from;
      let bestDist = Infinity;
      for (let i = from; i < line.length; i++) {
        const d =
          (line[i][0] - waypoint.location[0]) ** 2 +
          (line[i][1] - waypoint.location[1]) ** 2;
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      }
      wayPoints.push(best);
      from = best;
    }

    return {
      routes: [
        {
          geometry: route.geometry,
          summary: { distance: route.distance, duration: route.duration },
          segments: route.legs.map((leg) => ({
            distance: leg.distance,
            duration: leg.duration,
            steps: leg.steps.map((step) => ({
              distance: step.distance,
              duration: step.duration,
              instruction: describeOsrmStep(step),
            })),
          })),
          way_points: wayPoints,
        },
      ],
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function getDirections(
  request: OrsDirectionsRequest,
): Promise<OrsDirectionsResponse> {
  const profile = request.profile ?? "foot-walking";

  const ors = fetchOrs<OrsDirectionsResponse>(
    `${ORS_BASE_URL}/v2/directions/${profile}/json`,
    {
      coordinates: request.coordinates,
      instructions: request.instructions ?? true,
      ...(request.options ? { options: request.options } : {}),
      ...(request.extra_info ? { extra_info: request.extra_info } : {}),
      ...(request.elevation ? { elevation: true } : {}),
    },
    { cache: "no-store" },
  );

  // OSRM can't do round trips, and only has a foot profile.
  // OSRM also ignores avoid_polygons: a "re-route around X" through it would quietly return X again.
  const canFallBack =
    !request.options?.round_trip &&
    !request.options?.avoid_polygons &&
    // OSRM knows neither stairs nor slopes: a stroller or wheelchair route must come from ORS or fail.
    !request.options?.avoid_features &&
    !request.options?.profile_params &&
    (profile === "foot-walking" || profile === "foot-hiking");
  if (!canFallBack) return ors;

  return new Promise<OrsDirectionsResponse>((resolve, reject) => {
    let settled = false;
    let orsError: unknown;
    let osrmStarted = false;
    let osrmFailed = false;
    let orsFailed = false;

    const finish = (value: OrsDirectionsResponse) => {
      if (settled) return;
      settled = true;
      clearTimeout(hedgeTimer);
      resolve(value);
    };
    const maybeReject = () => {
      if (!settled && orsFailed && osrmFailed) {
        settled = true;
        reject(orsError);
      }
    };
    const startOsrm = () => {
      if (osrmStarted || settled) return;
      osrmStarted = true;
      getOsrmFootDirections(request.coordinates).then(finish, () => {
        osrmFailed = true;
        maybeReject();
      });
    };

    const hedgeTimer = setTimeout(startOsrm, OSRM_HEDGE_DELAY_MS);
    ors.then(finish, (error) => {
      orsError = error;
      orsFailed = true;
      startOsrm();
      maybeReject();
    });
  });
}

// All-pairs walking-network distances in one request. ORS caps a foot profile at
// 50 locations; a walk plan asks for 1 origin + ~10 stops, so no chunking here.
export async function getMatrix(
  request: OrsMatrixRequest,
): Promise<OrsMatrixResponse> {
  const profile = request.profile ?? "foot-walking";

  return fetchOrs<OrsMatrixResponse>(
    `${ORS_BASE_URL}/v2/matrix/${profile}`,
    {
      // Already in ORS [lng, lat] order — callers build these with `toOrsCoord()`.
      locations: request.locations,
      // ORS defaults to duration only; ordering needs metres.
      metrics: ["distance"],
      units: "m",
    },
    { cache: "no-store" },
  );
}

/**
 * Orders the jobs for one vehicle. ORS shuts its /optimization (VROOM) host down in November 2026, so this
 * uses the walking matrix and orders the stops here: exact for a handful of stops, nearest-neighbour above.
 * Only the first vehicle is used; time windows and max_distance are not applied (nothing is reported unassigned).
 */
export async function optimizeRoute(
  request: OrsOptimizationRequest,
): Promise<OrsOptimizationResponse> {
  const vehicle = request.vehicles[0];
  const jobs = request.jobs;
  const start = vehicle.start ?? vehicle.end ?? jobs[0]?.location;
  if (!start) throw new Error("Optimization needs a start point.");
  const end = vehicle.end;
  const locations = [start, ...jobs.map((j) => j.location), ...(end ? [end] : [])];
  const { distances } = await getMatrix({ locations, profile: vehicle.profile });
  const n = jobs.length;
  const endIdx = end ? n + 1 : 0; // no end: the walk stops at the last job, so no closing leg
  const d = (a: number, b: number) => distances[a]?.[b] ?? Infinity;
  const cost = (order: number[]) => {
    let at = 0;
    let sum = 0;
    for (const j of order) {
      sum += d(at, j);
      at = j;
    }
    return end ? sum + d(at, endIdx) : sum;
  };
  let best: number[] = [];
  if (n > 7) {
    const left = new Set(Array.from({ length: n }, (_, i) => i + 1));
    let at = 0;
    while (left.size) {
      let pick = -1;
      for (const j of left) if (pick < 0 || d(at, j) < d(at, pick)) pick = j;
      best.push(pick);
      left.delete(pick);
      at = pick;
    }
  } else {
    let bestCost = Infinity;
    const permute = (rest: number[], picked: number[]) => {
      if (rest.length === 0) {
        const c = cost(picked);
        if (c < bestCost) {
          bestCost = c;
          best = picked;
        }
        return;
      }
      rest.forEach((j, i) => permute([...rest.slice(0, i), ...rest.slice(i + 1)], [...picked, j]));
    };
    permute(Array.from({ length: n }, (_, i) => i + 1), []);
  }
  const total = cost(best);
  return {
    code: 0,
    summary: { cost: total, routes: 1, unassigned: 0 },
    unassigned: [],
    routes: [
      {
        vehicle: vehicle.id,
        distance: total,
        duration: 0,
        steps: [
          ...(vehicle.start ? [{ type: "start", id: vehicle.id }] : []),
          ...best.map((j) => ({ type: "job", id: jobs[j - 1].id })),
          ...(end ? [{ type: "end", id: vehicle.id }] : []),
        ],
      },
    ],
  };
}
