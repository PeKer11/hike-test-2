import type { WalkEnvironment } from "@/lib/types/discovery";

import { ENV_LIMITS } from "./discovery-cadence";
import { detourMinutes, isDetourOfferable } from "./discovery-collection";

/**
 * Whether the "Add to walk" action may be shown for a place the walker tapped:
 * the lateral distance must be within the environment's detour limit and the
 * round-trip detour must pass the time rule for the walk that is left.
 * `lateralM` is the item's cross-track distance (null when it has no frame);
 * `fallbackDistanceM` is the callout's own distance in that case.
 */
export function canOfferAdd(args: {
  lateralM: number | null;
  fallbackDistanceM: number;
  speedMpm: number;
  remainingWalkMin: number;
  environment: WalkEnvironment;
}): boolean {
  const lateral = Math.abs(args.lateralM ?? args.fallbackDistanceM);
  if (lateral > ENV_LIMITS[args.environment].detourOfferM) return false;
  return isDetourOfferable(detourMinutes(lateral, args.speedMpm), args.remainingWalkMin);
}

/**
 * Callouts are held back while direction options are pending/shown, and while
 * an off-route card is up; they resume once the card is dismissed (spec 6).
 */
export function calloutsSuppressed(args: {
  collapsed: boolean;
  offRoute: boolean;
  cardVisible: boolean;
  /** The off-route card was dismissed by the walker (a ref, current this fix). */
  offRouteDismissed: boolean;
  /** The "redraw?" ask card is up (a ref, current this fix). */
  askUp: boolean;
}): boolean {
  // The off-route / ask card is derived from state that lands only after this
  // fix renders, so the first off-route fix has `cardVisible` false although the
  // card is about to appear: count it from the refs that mirror that state.
  const offRouteCard = args.offRoute && (args.askUp || !args.offRouteDismissed);
  return args.collapsed || (args.offRoute && args.cardVisible) || offRouteCard;
}
