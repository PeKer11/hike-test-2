"use client";

import { useState } from "react";

import { planRoute } from "@/lib/optimization/route-planner";
import type { CalculatedRoute, ConstraintSet, Waypoint } from "@/lib/types";

export function useRouteCalculation() {
  const [route, setRoute] = useState<CalculatedRoute | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calculateRoute = async (
    waypoints: Waypoint[],
    constraints: ConstraintSet,
  ): Promise<CalculatedRoute | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await planRoute({ waypoints, constraints });
      setRoute(result);
      return result;
    } catch (routeError) {
      const message =
        routeError instanceof Error
          ? routeError.message
          : "Route calculation failed.";
      setError(message);
      setRoute(null);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const clearRoute = () => {
    setRoute(null);
    setError(null);
  };

  return {
    route,
    isLoading,
    error,
    calculateRoute,
    clearRoute,
  };
}
