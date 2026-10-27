import type { Coordinates } from "@/lib/types";
import type { AvoidPolygons } from "./clean-route";

/** A turn that has used its routing calls: callers treat it like a failed route and report what they could not check. */
export class BudgetExceeded extends Error {
  constructor() {
    super("routing budget for this turn used up");
  }
}

export interface RoutingBudget {
  used: number;
  take(): void;
}

/** ORS free tier allows ~40 directions calls a minute: one tool call may use at most `max`. A fired `deadline` (the turn's time) ends the budget too. */
export function makeBudget(max: number, deadline?: AbortSignal): RoutingBudget {
  const budget: RoutingBudget = {
    used: 0,
    take() {
      if (budget.used >= max || deadline?.aborted) throw new BudgetExceeded();
      budget.used += 1;
    },
  };
  return budget;
}

/** Wraps a router so each real (uncached) call is counted against `budget`; `fresh` says whether a call hit the network. */
export function budgeted<T>(
  route: (waypoints: Coordinates[], avoid: AvoidPolygons | null) => Promise<T>,
  budget: RoutingBudget,
  isCached: (waypoints: Coordinates[], avoid: AvoidPolygons | null) => boolean,
): (waypoints: Coordinates[], avoid: AvoidPolygons | null) => Promise<T> {
  return (waypoints, avoid) => {
    if (!isCached(waypoints, avoid)) budget.take();
    return route(waypoints, avoid);
  };
}

const MATRIX_COOLDOWN_MS = 30 * 60_000;
let matrixCoolUntil = 0;

/** After a matrix quota/limit error, skip the matrix call for a while (straight lines are used instead). */
export function matrixCoolingDown(now = Date.now()): boolean {
  return now < matrixCoolUntil;
}

export function noteMatrixError(err: unknown, now = Date.now()): void {
  const msg = err instanceof Error ? err.message.toLowerCase() : "";
  if (msg.includes("quota") || msg.includes("rate limit")) matrixCoolUntil = now + MATRIX_COOLDOWN_MS;
}

export function resetMatrixCooldown(): void {
  matrixCoolUntil = 0;
}
