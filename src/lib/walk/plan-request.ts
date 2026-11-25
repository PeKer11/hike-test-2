import type { Attraction, Coordinates } from "@/lib/types";
import type { WalkCompanionInput } from "@/lib/types/walk-companion";

export interface PlanRequestArgs {
  input: WalkCompanionInput;
  options?: {
    autoResume?: boolean;
    fixedOrder?: boolean;
    presetGeometry?: Coordinates[];
    fillRemainingTime?: boolean;
    heading?: number;
  };
  /** The stops to keep (already without the ones the walker has visited). */
  keep?: Attraction[];
  /** Stops the AI builder chose: they win over `keep`, in its order and with its route. */
  aiStops?: Attraction[];
  aiGeometry?: Coordinates[];
  aiDecided?: boolean;
  routeRules?: Record<string, unknown>;
  activePinnedIds: string[];
  visitedIds: Iterable<string>;
  droppedIds: Iterable<string>;
  stopCount: number | null;
  notableOnly: boolean;
  learnPreferences: boolean;
  timeZone: string;
}

/**
 * The exact body of a POST /api/walk-plan. One function so that the build and the card's dry-run preview
 * ask the planner the same question and cannot drift apart.
 */
export function walkPlanRequestBody(a: PlanRequestArgs): Record<string, unknown> {
  const { input, options } = a;
  return {
    lat: input.origin.lat,
    lng: input.origin.lng,
    availableMinutes: input.availableMinutes,
    walkingPaceMinPerKm: input.walkingPaceMinPerKm,
    radiusMeters: input.radiusMeters,
    maxEndDistanceFromOriginMeters: input.maxEndDistanceFromOriginMeters,
    endAnchor: input.endAnchor,
    // A loop closes at the real start. Mid-walk `origin` is where the walker stands, so
    // without this a rebuild would end the walk at the spot it was rebuilt.
    returnTo: options?.autoResume ? input.endAnchor : undefined,
    preferredCategories: input.preferredCategories,
    explicitAttractions: a.aiStops ?? a.keep,
    fixedOrder: a.aiStops || options?.fixedOrder === true ? true : undefined,
    presetGeometry: a.aiGeometry ?? options?.presetGeometry,
    ...a.routeRules,
    pinnedAttractionIds: a.activePinnedIds,
    fillRemainingTime: options?.fillRemainingTime ?? false,
    heading: options?.heading,
    // Mid-walk, what discovery turns up must not be a place the walker has already been to or dropped.
    excludeIds: options?.autoResume ? [...new Set([...a.visitedIds, ...a.droppedIds])] : undefined,
    stopCount: a.stopCount ?? undefined,
    notableOnly: a.notableOnly,
    learnPreferences: a.learnPreferences,
    timeZone: a.timeZone,
  };
}
