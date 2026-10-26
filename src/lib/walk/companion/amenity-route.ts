import type { Coordinates } from "@/lib/types";
import { accessBody } from "@/lib/walk/active-access";
import { haversineDistance } from "@/lib/utils/geo";
import { isPlausibleConnector, spliceRoute } from "@/lib/walk/rejoin";
import { cumulativeDistances } from "@/lib/walk/walk-stats";

import { amenityRerouteBodies } from "./amenity-detour";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** The route resumes this far past the amenity's own place along it. */
export const REJOIN_PAST_AMENITY_M = 40;

interface RerouteReply {
  geometry?: Coordinates[];
  distanceMeters?: number;
}

function pathLengthM(path: Coordinates[]): number {
  const cum = cumulativeDistances(path);
  return cum[cum.length - 1] ?? 0;
}

/**
 * The route with a water / toilets stop spliced in: out to the amenity, back
 * to a point shortly past it on the original line, then the rest of the route.
 * At most two `/api/reroute` calls. Null when either leg fails or is not a
 * plausible walking connector, so the caller keeps the current route.
 */
export async function planAmenityDetour(args: {
  geometry: Coordinates[];
  /** Index of the segment the walker is matched on. */
  segmentIndex: number;
  position: Coordinates;
  amenity: Coordinates;
  /** The amenity's place along the route, metres (null when unknown). */
  amenityAlongM: number | null;
  /** The walker's place along the route, metres. */
  walkerAlongM: number;
  doFetch?: FetchLike;
}): Promise<Coordinates[] | null> {
  const { geometry } = args;
  if (geometry.length < 2) return null;
  const cum = cumulativeDistances(geometry);
  const target = Math.max(args.amenityAlongM ?? 0, args.walkerAlongM) + REJOIN_PAST_AMENITY_M;
  let j = geometry.length - 1;
  for (let i = Math.max(1, args.segmentIndex + 1); i < geometry.length; i += 1) {
    if (cum[i] >= target) {
      j = i;
      break;
    }
  }
  const rejoin = geometry[j];
  const [outBody, backBody] = amenityRerouteBodies(args.position, args.amenity, rejoin);
  const doFetch = args.doFetch ?? ((input, init) => fetch(input, init));

  const leg = async (body: object, from: Coordinates, to: Coordinates) => {
    const res = await doFetch("/api/reroute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, ...accessBody() }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as RerouteReply;
    if (!Array.isArray(data.geometry) || data.geometry.length < 2) return null;
    const length = data.distanceMeters ?? pathLengthM(data.geometry);
    return isPlausibleConnector(length, haversineDistance(from, to)) ? data.geometry : null;
  };

  try {
    const out = await leg(outBody, args.position, args.amenity);
    if (!out) return null;
    const back = await leg(backBody, args.amenity, rejoin);
    if (!back) return null;
    return spliceRoute(geometry, { point: rejoin, segmentIndex: j, alongM: cum[j] }, [...out, ...back]);
  } catch {
    return null;
  }
}
