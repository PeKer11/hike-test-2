import type { ReplanReason } from "@/lib/walk/replan-trigger";

import type { AmenityKind, PlanOperator } from "./companion-types";

/**
 * What the planner screen must run for an answer. Every variant but the last
 * three reuses a rebuild that already exists in `planner-actions.ts` /
 * `WalkPlannerApp` (named in the comments); `drop-stops` is the new
 * `planner-actions` builder. There is no swap/reorder: the planner re-orders
 * stops itself, so it cannot be honoured until a fixed-order option exists.
 */
export type OperatorAction =
  | { run: "pace-rebuild"; reason: ReplanReason; capMin?: number } // runPaceTriggeredRebuild / buildPaceRebuildRequest
  | { run: "drop-stops"; dropStopIds: string[]; capMin?: number } // buildDropStopsRebuildRequest (new)
  | { run: "extended-time-rebuild" } // runExtendedTimeRebuild / buildExtendedTimeRebuildRequest
  | { run: "walk-options-roundtrip"; theme: "nature" } // /api/walk-options roundtrip
  | { run: "amenity-detour"; kind: AmenityKind } // amenity-detour.ts -> /api/reroute -> spliceRoute
  | { run: "head-back" } // the "Shorter" direction option toward endAnchor
  | { run: "none" };

export function resolveOperator(op: PlanOperator | null): OperatorAction {
  if (op === null) return { run: "none" };
  switch (op.op) {
    case "shorten":
      return op.dropStopIds && op.dropStopIds.length > 0
        ? {
            run: "drop-stops",
            dropStopIds: op.dropStopIds,
            ...(op.capMin !== undefined ? { capMin: op.capMin } : {}),
          }
        : {
            run: "pace-rebuild",
            reason: "sustained-slow-pace",
            // Cap the rebuild's remaining time (e.g. at minutes-to-sunset).
            ...(op.capMin !== undefined ? { capMin: op.capMin } : {}),
          };
    case "keep-all-extend":
      return { run: "extended-time-rebuild" };
    case "extend":
      return { run: "pace-rebuild", reason: "sustained-fast-pace" };
    case "loop-from-here":
      return { run: "walk-options-roundtrip", theme: op.theme };
    case "find-amenity":
      return { run: "amenity-detour", kind: op.kind };
    case "head-back":
      return { run: "head-back" };
    case "dismiss":
      return { run: "none" };
    default: {
      const never: never = op;
      return never;
    }
  }
}
