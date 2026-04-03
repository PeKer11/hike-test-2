"use client";

import { useEffect, useRef, useState } from "react";

import type { CalculatedRoute, Coordinates, TrailIntelligenceReport } from "@/lib/types";

interface ApiErrorResponse {
  error?: string;
}

async function postTrailIntelligence(
  route: CalculatedRoute,
  userLocation?: Coordinates,
): Promise<TrailIntelligenceReport> {
  const response = await fetch("/api/trail-intelligence", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ route, userLocation }),
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => ({}))) as ApiErrorResponse;
    throw new Error(errorBody.error ?? "Failed to generate trail briefing.");
  }

  return (await response.json()) as TrailIntelligenceReport;
}

export function useTrailIntelligence(
  route: CalculatedRoute | null,
  userLocation?: Coordinates,
) {
  const [report, setReport] = useState<TrailIntelligenceReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeRequestIdRef = useRef(0);
  const userLat = userLocation?.lat;
  const userLng = userLocation?.lng;

  useEffect(() => {
    activeRequestIdRef.current += 1;
    const requestId = activeRequestIdRef.current;

    if (!route) {
      setReport(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    void (async () => {
      try {
        const nextReport = await postTrailIntelligence(
          route,
          userLat !== undefined && userLng !== undefined
            ? { lat: userLat, lng: userLng }
            : undefined,
        );
        if (requestId !== activeRequestIdRef.current) {
          return;
        }

        setReport(nextReport);
      } catch (trailError) {
        if (requestId !== activeRequestIdRef.current) {
          return;
        }

        const message =
          trailError instanceof Error
            ? trailError.message
            : "Failed to load trail briefing.";
        setError(message);
        setReport(null);
      } finally {
        if (requestId === activeRequestIdRef.current) {
          setIsLoading(false);
        }
      }
    })();
  }, [route, userLat, userLng]);

  const clear = () => {
    activeRequestIdRef.current += 1;
    setReport(null);
    setError(null);
    setIsLoading(false);
  };

  return {
    report,
    isLoading,
    error,
    clear,
  };
}
