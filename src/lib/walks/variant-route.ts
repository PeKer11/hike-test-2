import type { Coordinates } from "@/lib/types";
import { haversineDistance } from "@/lib/utils/geo";
import { orsRoute, routeDetail } from "@/lib/walk/ors-route";

import type { RouteFn, RoutedLine } from "./variants";

/** The real router (server only): walking geometry through the waypoints, with distance and climb from its legs. */
export const orsRouteFn: RouteFn = async (waypoints: Coordinates[]): Promise<RoutedLine> => {
  const geometry = await orsRoute(waypoints, null);
  const legs = routeDetail(geometry)?.legs ?? null;
  let distanceM = legs ? legs.reduce((sum, l) => sum + l.distanceM, 0) : 0;
  if (!distanceM) for (let i = 1; i < geometry.length; i += 1) distanceM += haversineDistance(geometry[i - 1], geometry[i]);
  return { geometry, distanceM, ascentM: legs ? Math.round(legs.reduce((sum, l) => sum + l.ascentM, 0)) : null };
};
