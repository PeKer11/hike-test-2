import type { Coordinates } from "@/lib/types";
import type { WalkEnvironment } from "@/lib/types/discovery";
import { haversineDistance } from "@/lib/utils/geo";
import { ENV_LIMITS } from "@/lib/walk/discovery-cadence";
import { detourMinutes, isDetourOfferable } from "@/lib/walk/discovery-collection";

import type { AmenityKind } from "./companion-types";

export interface AmenityItem {
  id: string;
  kind: AmenityKind;
  name?: string;
  coordinates: Coordinates;
  /** Cross-track distance to the route when known (DiscoveryItem.frame). Not used for the walker's distance. */
  lateralM?: number | null;
  /** Metres along the route to the point nearest the amenity (DiscoveryItem.frame.alongM). */
  alongM?: number | null;
}

/** Only amenities up to this far ahead along the route are offered. */
export const AMENITY_AHEAD_WINDOW_M = 1500;
/** GPS slack for an amenity the walker is level with. */
export const AMENITY_BEHIND_SLACK_M = 30;

export interface AmenityPick {
  item: AmenityItem;
  /** One-way distance used for the rule, metres. */
  distM: number;
  detourMin: number;
}

/**
 * Nearest amenity of `kind` ahead of the walker that passes the environment's distance limit and the
 * detour time rule (`isDetourOfferable`). Null when none does.
 */
export function pickAmenity(args: {
  items: AmenityItem[];
  kind: AmenityKind;
  position: Coordinates;
  environment: WalkEnvironment;
  speedMpm: number;
  remainingWalkMin: number;
  /** Walker's metres along the route; with an item's `alongM` it drops amenities behind. */
  walkerAlongM?: number | null;
}): AmenityPick | null {
  let best: AmenityPick | null = null;
  for (const item of args.items) {
    if (item.kind !== args.kind) continue;
    if (args.walkerAlongM != null && item.alongM != null) {
      const ahead = item.alongM - args.walkerAlongM;
      if (ahead < -AMENITY_BEHIND_SLACK_M || ahead > AMENITY_AHEAD_WINDOW_M) continue;
    }
    // Straight-line from the walker, never the item's cross-track to the route.
    const distM = haversineDistance(args.position, item.coordinates);
    if (distM > ENV_LIMITS[args.environment].detourOfferM) continue;
    const detourMin = detourMinutes(distM, args.speedMpm);
    if (!isDetourOfferable(detourMin, args.remainingWalkMin)) continue;
    if (best === null || distM < best.distM) best = { item, distM, detourMin };
  }
  return best;
}

/** The `/api/reroute` bodies for an amenity detour: out to it, then back to the route. At most 2 ORS calls. */
export function amenityRerouteBodies(
  position: Coordinates,
  amenity: Coordinates,
  rejoin: Coordinates,
): [
  { from: Coordinates; candidates: [Coordinates] },
  { from: Coordinates; candidates: [Coordinates] },
] {
  return [
    { from: position, candidates: [amenity] },
    { from: amenity, candidates: [rejoin] },
  ];
}
